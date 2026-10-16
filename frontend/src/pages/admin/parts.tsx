import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { api, useApi, type Artist, type Booking, type Slot } from '../../api';
import { useConfig } from '../../config';
import { Checkbox, Field, FormError, Sheet, StatusPill, toast } from '../../ui';
import { brl, duration, firstName, fmtDate, fmtShort, METHOD, moneyInput, parseMoney, STATUS, waLink } from '../../util';
import { RefThumb } from '../client/BookingDetail';

/** Linha de sessão: hora | barra de status | cliente · artista | status. */
export function SessionRow({ b, onClick, detailed }: { b: Booking; onClick?: () => void; detailed?: boolean }) {
  return (
    <button onClick={onClick} className="card flex w-full min-w-0 items-center gap-3 px-4 py-4 text-left transition active:scale-[0.99] min-[380px]:gap-4 min-[380px]:px-5 sm:px-6">
      <div className="w-[3.2rem] shrink-0 text-center">
        <p className="text-lg font-bold leading-tight min-[380px]:text-xl">{b.time}</p>
        {detailed && <p className="text-sm text-muted">{duration(b.durationMin)}</p>}
      </div>
      <span className={`w-1 shrink-0 self-stretch rounded-full ${STATUS[b.status].bar}`} />
      <div className="min-w-0 flex-1">
        {detailed ? (
          <>
            <p className="break-words text-lg font-bold">{b.clientName}</p>
            <p className="break-words text-base text-muted">
              {b.service.name} · {b.artist.name}
            </p>
            <div className="mt-2 sm:hidden">
              <StatusPill status={b.status} />
            </div>
          </>
        ) : (
          <p className="break-words text-base min-[380px]:text-lg">
            {b.clientName} <span className="text-muted">· {firstName(b.artist.name)}</span>
          </p>
        )}
      </div>
      {detailed ? (
        <span className="hidden sm:block">
          <StatusPill status={b.status} />
        </span>
      ) : (
        <span className="max-w-[40%] text-right">
          <StatusPill status={b.status} plain />
        </span>
      )}
    </button>
  );
}

const PAY = ['cash', 'pix', 'card', 'tap'];

function MethodPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PAY.map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)} className={`chip w-full ${value === m ? 'chip-on' : ''}`}>
          {METHOD[m]}
        </button>
      ))}
    </div>
  );
}

/** Detalhe da sessão com as ações do estúdio. */
export function SessionSheet({ booking, onClose, onChanged, today }: { booking: Booking | null; onClose: () => void; onChanged: () => void; today: string }) {
  const [mode, setMode] = useState<'view' | 'deposit' | 'complete' | 'cancel'>('view');
  const [method, setMethod] = useState('pix');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const full = useApi<{ booking: Booking }>(booking ? `/bookings/${booking.id}` : null);

  useEffect(() => {
    setMode('view');
    setErr('');
    setReason('');
    if (booking) setAmount(moneyInput(Math.max(0, booking.priceCents - booking.paidCents)));
  }, [booking]);

  if (!booking) return null;
  const b = full.data?.booking || booking;

  async function run(path: string, body: unknown, ok: string) {
    setBusy(true);
    setErr('');
    try {
      await api.post(`/admin/bookings/${b.id}/${path}`, body);
      toast(ok);
      onChanged();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const active = ['requested', 'pending_deposit', 'confirmed'].includes(b.status);
  const canComplete = (b.status === 'confirmed' || b.status === 'pending_deposit') && b.date <= today;

  return (
    <Sheet open onClose={onClose} title={b.clientName}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusPill status={b.status} />
        <span className="text-muted">
          {fmtShort(b.date, b.time)} · {duration(b.durationMin)}
        </span>
      </div>
      <div className="divide-y divide-line rounded-2xl bg-surface2">
        {[
          ['Serviço', b.service.name],
          ['Artista', b.artist.name],
          ['Valor', brl(b.priceCents)],
          ['Sinal', b.depositCents === 0 ? 'Sem sinal' : `${brl(b.depositCents)} · ${b.depositPaid ? 'pago' : 'pendente'}`],
          ['Recebido', brl(b.paidCents)],
          ...(b.client?.email ? [['E-mail', b.client.email]] : []),
          ...(b.clientPhone ? [['Telefone', b.clientPhone]] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3 px-4 py-3">
            <span className="shrink-0 text-muted">{k}</span>
            <span className="min-w-0 break-words text-right">{v}</span>
          </div>
        ))}
      </div>
      {b.notes && <p className="mt-3 whitespace-pre-wrap break-words rounded-2xl bg-surface2 p-4 text-soft">{b.notes}</p>}
      {!!b.references?.length && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {b.references.map((r) => (
            <RefThumb key={r.id} id={r.id} />
          ))}
        </div>
      )}
      {b.cancelReason && !active && <p className="mt-3 text-muted">Motivo: {b.cancelReason}</p>}

      {mode === 'deposit' && (
        <div className="mt-5 grid gap-3">
          <p className="font-bold">Receber sinal de {brl(b.depositCents)}</p>
          <MethodPicker value={method} onChange={setMethod} />
        </div>
      )}
      {mode === 'complete' && (
        <div className="mt-5 grid gap-3">
          <Field label="Valor recebido agora (R$)" hint={`Restante pelo preço base: ${brl(Math.max(0, b.priceCents - b.paidCents))}`}>
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <MethodPicker value={method} onChange={setMethod} />
        </div>
      )}
      {mode === 'cancel' && (
        <div className="mt-5">
          <Field label="Motivo (enviado ao cliente)">
            <input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="mt-4">
        <FormError message={err} />
      </div>

      <div className="mt-4 grid gap-3">
        {mode === 'view' && (
          <>
            {b.status === 'requested' && (
              <div className="grid grid-cols-2 gap-3">
                <button className="btn-secondary" disabled={busy} onClick={() => setMode('cancel')}>
                  Recusar
                </button>
                <button className="btn-primary" disabled={busy} onClick={() => run('approve', {}, 'Solicitação aprovada')}>
                  Aprovar
                </button>
              </div>
            )}
            {b.status === 'pending_deposit' && (
              <button className="btn-primary" onClick={() => setMode('deposit')}>
                Registrar sinal recebido
              </button>
            )}
            {canComplete && (
              <button className={b.status === 'confirmed' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode('complete')}>
                Concluir sessão
              </button>
            )}
            {b.clientPhone && (
              <a className="btn-secondary" href={waLink(b.clientPhone, `Olá, ${firstName(b.clientName)}! Aqui é do estúdio, sobre sua sessão de ${fmtDate(b.date)} às ${b.time}.`)} target="_blank" rel="noreferrer">
                <MessageCircle size={20} /> WhatsApp do cliente
              </a>
            )}
            {active && b.status !== 'requested' && (
              <button className="btn-danger" onClick={() => setMode('cancel')}>
                Cancelar agendamento
              </button>
            )}
          </>
        )}
        {mode === 'deposit' && (
          <button className="btn-primary" disabled={busy} onClick={() => run('deposit', { method }, 'Sinal registrado')}>
            Confirmar recebimento
          </button>
        )}
        {mode === 'complete' && (
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => {
              const cents = parseMoney(amount);
              if (cents === null) return setErr('Informe o valor recebido');
              run('complete', { amountCents: cents, method }, 'Sessão concluída');
            }}
          >
            Concluir e registrar pagamento
          </button>
        )}
        {mode === 'cancel' && (
          <button
            className="btn-danger"
            disabled={busy}
            onClick={() => run(b.status === 'requested' ? 'reject' : 'cancel', { reason }, b.status === 'requested' ? 'Solicitação recusada' : 'Agendamento cancelado')}
          >
            {b.status === 'requested' ? 'Recusar solicitação' : 'Confirmar cancelamento'}
          </button>
        )}
        {mode !== 'view' && (
          <button className="btn-secondary" onClick={() => setMode('view')}>
            Voltar
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** Novo agendamento feito pelo estúdio (balcão, WhatsApp, telefone). */
export function NewBookingSheet({ open, onClose, onCreated, defaultDate }: { open: boolean; onClose: () => void; onCreated: (b: Booking) => void; defaultDate: string }) {
  const config = useConfig();
  const artists = useApi<{ artists: Artist[] }>(open ? '/admin/artists' : null);
  const [f, setF] = useState({ clientName: '', clientPhone: '', clientEmail: '', artistId: '', serviceId: '', date: defaultDate, time: '', notes: '', depositReceived: false, depositMethod: 'pix' });
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setF((x) => ({ ...x, date: defaultDate, time: '' }));
  }, [open, defaultDate]);

  const artist = artists.data?.artists.find((a) => a.id === f.artistId);
  const services = (artist?.services || []).filter((s) => s.active);
  const service = services.find((s) => s.id === f.serviceId);

  useEffect(() => {
    setSlots(null);
    if (!f.artistId || !f.serviceId || !f.date) return;
    let alive = true;
    api
      .get<{ slots: Slot[] }>(`/availability?artistId=${f.artistId}&serviceId=${f.serviceId}&date=${f.date}`)
      .then((r) => alive && setSlots(r.slots))
      .catch(() => alive && setSlots([]));
    return () => {
      alive = false;
    };
  }, [f.artistId, f.serviceId, f.date]);

  async function submit() {
    setBusy(true);
    setErr('');
    try {
      const r = await api.post<{ booking: Booking }>('/admin/bookings', f);
      toast('Agendamento criado');
      setF({ ...f, clientName: '', clientPhone: '', clientEmail: '', time: '', notes: '', depositReceived: false });
      onCreated(r.booking);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const deposit = service && config ? Math.min(config.depositCents, service.priceCents) : 0;

  return (
    <Sheet open={open} onClose={onClose} title="Novo agendamento">
      <div className="grid gap-4">
        <Field label="Nome do cliente">
          <input className="input" value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} maxLength={100} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone">
            <input className="input" type="tel" inputMode="tel" value={f.clientPhone} onChange={(e) => setF({ ...f, clientPhone: e.target.value })} />
          </Field>
          <Field label="E-mail da conta (opcional)" hint="Vincula ao app do cliente">
            <input className="input" type="email" inputMode="email" value={f.clientEmail} onChange={(e) => setF({ ...f, clientEmail: e.target.value })} />
          </Field>
        </div>
        <Field label="Artista">
          <select className="input" value={f.artistId} onChange={(e) => setF({ ...f, artistId: e.target.value, serviceId: '', time: '' })}>
            <option value="">Selecione</option>
            {artists.data?.artists.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.available}>
                {a.name}
                {!a.available ? ' (indisponível)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Serviço">
          <select className="input" value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value, time: '' })} disabled={!artist}>
            <option value="">Selecione</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {duration(s.durationMin)} · {brl(s.priceCents)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data">
          <input className="input" type="date" min={config?.today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, time: '' })} />
        </Field>
        {slots && (
          <div>
            <span className="label">Horário</span>
            {slots.every((s) => !s.available) ? (
              <p className="text-muted">Sem horários livres nesse dia.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    disabled={!s.available}
                    onClick={() => setF({ ...f, time: s.time })}
                    className={`min-h-[48px] rounded-xl border font-bold ${f.time === s.time ? 'border-accent bg-accent text-bg' : s.available ? 'border-line bg-surface2' : 'border-transparent text-dis line-through'}`}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {deposit > 0 && (
          <div className="grid gap-3">
            <button type="button" className="flex min-h-[44px] items-center gap-3 text-left" onClick={() => setF({ ...f, depositReceived: !f.depositReceived })}>
              <Checkbox on={f.depositReceived} /> Sinal de {brl(deposit)} já recebido
            </button>
            {f.depositReceived && <MethodPicker value={f.depositMethod} onChange={(v) => setF({ ...f, depositMethod: v })} />}
          </div>
        )}
        <Field label="Observações">
          <textarea className="input min-h-[80px]" maxLength={1000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <FormError message={err} />
        <button className="btn-primary" disabled={busy || !f.clientName || !f.time} onClick={submit}>
          {busy ? 'Salvando…' : 'Agendar'}
        </button>
      </div>
    </Sheet>
  );
}
