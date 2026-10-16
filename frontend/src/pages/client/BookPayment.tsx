import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, ImagePlus, Info, QrCode, Smartphone, Store, Trash2 } from 'lucide-react';
import { api, useApi, type Booking, type Card } from '../../api';
import { useConfig } from '../../config';
import { FullPage } from '../../layout';
import { Checkbox, ErrorBox, Field, FormError, Loading, PageHead, Radio, Stepper } from '../../ui';
import { brl, duration, fmtDate, priceFrom, resizeImage, WEEKDAYS_SHORT, weekdayOf } from '../../util';
import { useArtist } from './BookingFlow';

type Method = 'card' | 'pix' | 'tap' | 'studio';

const METHODS: { id: Method; label: string; hint: string; icon: typeof CreditCard }[] = [
  { id: 'card', label: 'Cartão de crédito', hint: 'Aprovação na hora', icon: CreditCard },
  { id: 'pix', label: 'Pix', hint: 'Confirmação imediata', icon: QrCode },
  { id: 'tap', label: 'Pagamento por aproximação', hint: 'Celular ou relógio', icon: Smartphone },
  { id: 'studio', label: 'Pagar no estúdio', hint: 'Sem sinal agora · sujeito à aprovação', icon: Store },
];

function formatCardNumber(v: string) {
  return v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
}
function formatExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function NewCardFields({ card, setCard }: { card: NewCard; setCard: (c: NewCard) => void }) {
  return (
    <div className="grid gap-3">
      <Field label="Número do cartão">
        <input className="input" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={card.number} onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })} />
      </Field>
      <Field label="Nome impresso no cartão">
        <input className="input" autoComplete="cc-name" value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value.toUpperCase() })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Validade">
          <input className="input" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })} />
        </Field>
        <Field label="CVV">
          <input className="input" inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })} />
        </Field>
      </div>
    </div>
  );
}

export interface NewCard {
  number: string;
  holder: string;
  expiry: string;
  cvv: string;
  save?: boolean;
}
export const emptyCard: NewCard = { number: '', holder: '', expiry: '', cvv: '', save: true };

export default function BookPayment() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const config = useConfig();
  const artistId = params.get('artist') || '';
  const serviceId = params.get('service') || '';
  const date = params.get('date') || '';
  const time = params.get('time') || '';
  const artist = useArtist(artistId);
  const cards = useApi<{ cards: Card[] }>('/cards');

  const [method, setMethod] = useState<Method>('card');
  const [cardId, setCardId] = useState<string>('');
  const [newCard, setNewCard] = useState<NewCard>(emptyCard);
  const [notes, setNotes] = useState('');
  const [ref, setRef] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!artistId || !serviceId || !date || !time) nav('/artistas', { replace: true });
  }, [artistId, serviceId, date, time, nav]);

  useEffect(() => {
    if (cards.data && !cardId) {
      const def = cards.data.cards.find((c) => c.isDefault) || cards.data.cards[0];
      setCardId(def ? def.id : 'new');
    }
  }, [cards.data, cardId]);

  if (!config || (artist.loading && !artist.data)) return <Loading />;
  if (artist.error || !artist.data) return <FullPage><ErrorBox message={artist.error || 'Artista não encontrado'} /></FullPage>;

  const a = artist.data.artist;
  const service = a.services.find((s) => s.id === serviceId);
  if (!service) return <FullPage><ErrorBox message="Serviço indisponível para esse artista." /></FullPage>;
  const deposit = Math.min(config.depositCents, service.priceCents);
  const free = deposit === 0;

  async function pickRef(file?: File) {
    if (!file) return;
    try {
      setRef(await resizeImage(file));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = { artistId, serviceId, date, time, notes, paymentMethod: free ? 'studio' : method };
      if (!free && method === 'card') {
        if (cardId && cardId !== 'new') body.cardId = cardId;
        else body.newCard = newCard;
      }
      const r = await api.post<{ booking: Booking }>('/bookings', body);
      if (ref) {
        await api.post('/references', { image: ref, note: notes.slice(0, 300), bookingId: r.booking.id }).catch(() => undefined);
      }
      nav(`/agenda/${r.booking.id}?novo=1`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const label = free ? 'Confirmar agendamento' : method === 'studio' ? 'Solicitar agendamento' : `Pagar sinal ${brl(deposit)}`;

  return (
    <FullPage
      footer={
        <>
          <FormError message={error} />
          <button className={`btn-primary w-full ${error ? 'mt-3' : ''}`} onClick={submit} disabled={busy}>
            {busy ? 'Processando…' : label}
          </button>
        </>
      }
    >
      <PageHead back={`/agendar/data?artist=${artistId}&service=${serviceId}&date=${date}&time=${time}`} title="Pagamento" />
      <Stepper step={3} />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <section className="card divide-y divide-line">
            {[
              ['Artista', a.name],
              ['Serviço', `${service.name} · ${duration(service.durationMin)}`],
              ['Data', `${WEEKDAYS_SHORT[weekdayOf(date)]}, ${fmtDate(date)} · ${time}`],
              ['Valor', priceFrom(service.priceCents)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 px-5 py-4">
                <span className="shrink-0 text-muted">{k}</span>
                <span className="min-w-0 text-right font-medium">{v}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <span className="font-bold">Sinal</span>
              <span className="font-display text-2xl font-extrabold text-accent">{brl(deposit)}</span>
            </div>
          </section>

          {!free && (
            <p className="flex items-start gap-3 rounded-2xl bg-tint px-4 py-3 text-sm text-soft">
              <Info size={18} className="mt-0.5 shrink-0 text-accent" />O sinal de {brl(deposit)} é descontado do valor final da sessão.
            </p>
          )}

          <section>
            <h2 className="h2 mb-3">Detalhes</h2>
            <Field label="Conte sua ideia (opcional)">
              <textarea className="input min-h-[110px] resize-y" maxLength={1000} placeholder="Ex.: rosa fine line no antebraço, uns 10 cm" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <div className="mt-3">
              {ref ? (
                <div className="card flex items-center gap-3 p-3">
                  <img src={ref} alt="Referência" className="h-16 w-16 rounded-xl object-cover" />
                  <p className="min-w-0 flex-1 text-sm text-soft">Referência anexada</p>
                  <button className="icon-btn h-11 w-11" aria-label="Remover referência" onClick={() => setRef(null)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              ) : (
                <label className="btn-secondary w-full cursor-pointer">
                  <ImagePlus size={20} /> Anexar referência
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickRef(e.target.files?.[0])} />
                </label>
              )}
            </div>
          </section>
        </div>

        {!free && (
          <section>
            <h2 className="h2 mb-3">Forma de pagamento</h2>
            <div className="flex flex-col gap-3" role="radiogroup" aria-label="Forma de pagamento">
              {METHODS.map((m) => {
                const on = method === m.id;
                return (
                  <div key={m.id} className={`rounded-[20px] border transition ${on ? 'border-accent bg-tint' : 'border-line bg-surface'}`}>
                    <button role="radio" aria-checked={on} onClick={() => setMethod(m.id)} className="flex w-full items-center gap-4 p-4 text-left">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface2 text-accent">
                        <m.icon size={22} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{m.label}</span>
                        <span className="block text-sm text-muted">{m.hint}</span>
                      </span>
                      <Radio on={on} />
                    </button>
                    {on && m.id === 'card' && (
                      <div className="border-t border-line p-4">
                        {cards.loading && !cards.data && <Loading />}
                        <div className="flex flex-col gap-2">
                          {cards.data?.cards.map((c) => (
                            <button key={c.id} onClick={() => setCardId(c.id)} className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-surface2 px-4 text-left">
                              <Radio on={cardId === c.id} />
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {c.brand} •••• {c.last4}
                              </span>
                              <span className="text-sm text-muted">{c.expiry}</span>
                            </button>
                          ))}
                          <button onClick={() => setCardId('new')} className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-surface2 px-4 text-left">
                            <Radio on={cardId === 'new'} />
                            <span className="font-medium">Novo cartão</span>
                          </button>
                        </div>
                        {cardId === 'new' && (
                          <div className="mt-4">
                            <NewCardFields card={newCard} setCard={setNewCard} />
                            <button className="mt-3 flex min-h-[44px] items-center gap-3 text-left text-soft" onClick={() => setNewCard({ ...newCard, save: !newCard.save })}>
                              <Checkbox on={!!newCard.save} /> Salvar cartão para as próximas vezes
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-sm text-muted">
              Pagamento simulado: o sinal fica registrado no estúdio, sem cobrança real. Guardamos só a bandeira e os 4 últimos dígitos do cartão.
            </p>
          </section>
        )}
      </div>
    </FullPage>
  );
}
