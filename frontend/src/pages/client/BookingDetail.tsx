import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, ImagePlus, Star } from 'lucide-react';
import { api, API_BASE, fetchImageUrl, useApi, type Booking } from '../../api';
import { useSavedPhone } from '../../client';
import PhoneGate from './PhoneGate';
import { useConfig } from '../../config';
import { ErrorBox, Field, FormError, Loading, PageHead, Sheet, Stars, StatusPill, toast } from '../../ui';
import { brl, duration, fmtDate, METHOD, priceFrom, resizeImage, WEEKDAYS_SHORT, weekdayOf } from '../../util';

/** Miniatura da referência: o cliente acessa pelo celular; o estúdio, pelo token. */
export function RefThumb({ id, phone }: { id: string; phone?: string }) {
  const [url, setUrl] = useState(phone ? `${API_BASE}/references/${id}/image?phone=${encodeURIComponent(phone)}` : '');
  useEffect(() => {
    if (phone) return;
    let u = '';
    fetchImageUrl(`/references/${id}/image`)
      .then((x) => setUrl((u = x)))
      .catch(() => setUrl(''));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [id, phone]);
  return (
    <a href={url || undefined} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-[14px] bg-surface2">
      {url && <img src={url} alt="Referência" className="h-full w-full object-cover" />}
    </a>
  );
}

export default function BookingDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const config = useConfig();
  const [phone, setPhone] = useSavedPhone();
  const { data, error, loading, reload } = useApi<{ booking: Booking }>(phone ? `/bookings/${id}?phone=${encodeURIComponent(phone)}` : null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);

  // Link do WhatsApp após a sessão: /agenda/<id>?avaliar=1 abre a avaliação direto.
  const wantsReview = params.get('avaliar') === '1';
  const canReview = data?.booking.status === 'completed' && !data.booking.review;
  useEffect(() => {
    if (wantsReview && canReview) setReviewOpen(true);
  }, [wantsReview, canReview]);

  if (!phone)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHead back="/agenda" title="Agendamento" />
        <PhoneGate onSubmit={setPhone} text="Informe o celular usado neste agendamento." />
      </div>
    );
  if (loading && !data) return <Loading />;
  if (error || !data)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHead back="/agenda" title="Agendamento" />
        <ErrorBox message={error || 'Agendamento não encontrado'} onRetry={reload} />
        <button className="btn-secondary mt-4 w-full" onClick={() => setPhone('')}>
          Usar outro celular
        </button>
      </div>
    );
  const b = data.booking;
  const today = config?.today || '';
  const active = ['requested', 'pending_deposit', 'confirmed'].includes(b.status);
  const canCancel = active && b.date >= today;
  const remaining = Math.max(0, b.priceCents - b.paidCents);

  async function run(fn: () => Promise<unknown>, ok: string, close: () => void) {
    setBusy(true);
    setErr('');
    try {
      await fn();
      toast(ok);
      close();
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    setBusy(true);
    setErr('');
    try {
      const r = await api.post<{ googleReviewUrl: string | null }>(`/bookings/${b.id}/review`, { rating, comment, phone });
      setReviewOpen(false);
      if (r.googleReviewUrl) setGoogleUrl(r.googleReviewUrl);
      else toast('Obrigado pela avaliação!');
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addRef(file?: File) {
    if (!file) return;
    try {
      const image = await resizeImage(file);
      await api.post(`/bookings/${b.id}/references`, { image, phone });
      toast('Referência adicionada');
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead back="/agenda" title={b.service.name} subtitle={`com ${b.artist.name}`} />

      {params.get('novo') && (
        <div className="mb-5 flex items-start gap-3 rounded-[20px] border border-ok/30 bg-okbg p-4">
          <CheckCircle2 className="mt-0.5 shrink-0 text-ok" />
          <div>
            <p className="font-bold text-ok">{b.status === 'requested' ? 'Solicitação enviada!' : 'Agendamento confirmado!'}</p>
            <p className="text-sm text-soft">
              {b.status === 'requested' ? 'O estúdio vai aprovar o horário. Acompanhe a resposta aqui em Agenda, com o seu celular.' : 'Te esperamos no estúdio. Chegue 10 minutos antes.'}
            </p>
          </div>
        </div>
      )}

      <div className="card divide-y divide-line">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <span className="text-muted">Status</span>
          <StatusPill status={b.status} />
        </div>
        {[
          ['Data', `${WEEKDAYS_SHORT[weekdayOf(b.date)]}, ${fmtDate(b.date)}`],
          ['Horário', `${b.time} · cerca de ${duration(b.durationMin)}`],
          ['Valor', priceFrom(b.priceCents)],
          ['Sinal', b.depositCents === 0 ? 'Sem sinal' : `${brl(b.depositCents)} · ${b.depositPaid ? `pago (${METHOD[b.paymentMethod] || b.paymentMethod})` : 'a pagar no estúdio'}`],
          ['Pago até agora', brl(b.paidCents)],
          ...(b.status !== 'completed' && b.priceCents > 0 ? [['Restante estimado', brl(remaining)]] : []),
        ].map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 px-5 py-4">
            <span className="shrink-0 text-muted">{k}</span>
            <span className="min-w-0 text-right font-medium">{v}</span>
          </div>
        ))}
        {b.cancelReason && (b.status === 'cancelled' || b.status === 'rejected') && (
          <div className="px-5 py-4">
            <p className="text-muted">Motivo</p>
            <p className="mt-1">{b.cancelReason}</p>
          </div>
        )}
      </div>

      {b.notes && (
        <section className="mt-5">
          <h2 className="h2 mb-2">Sua ideia</h2>
          <p className="card whitespace-pre-wrap break-words p-4 text-soft">{b.notes}</p>
        </section>
      )}

      <section className="mt-5">
        <h2 className="h2 mb-3">Referências</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {b.references?.map((r) => (
            <RefThumb key={r.id} id={r.id} phone={phone} />
          ))}
          {active && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-line2 text-sm text-muted">
              <ImagePlus size={22} /> Adicionar
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => addRef(e.target.files?.[0])} />
            </label>
          )}
        </div>
        {!active && !b.references?.length && <p className="text-muted">Nenhuma referência anexada.</p>}
      </section>

      {b.review && (
        <section className="card mt-5 p-4">
          <p className="mb-1 font-bold">Sua avaliação</p>
          <Stars value={b.review.rating} />
          {b.review.comment && <p className="mt-2 text-soft">{b.review.comment}</p>}
          {b.review.rating >= 4 && config?.googleReviewUrl && (
            <a href={config.googleReviewUrl} target="_blank" rel="noreferrer" className="btn-secondary mt-4 w-full">
              <GoogleG /> Avaliar também no Google
            </a>
          )}
        </section>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {b.status === 'completed' && !b.review && (
          <button className="btn-primary" onClick={() => setReviewOpen(true)}>
            <Star size={20} /> Avaliar sessão
          </button>
        )}
        {canCancel && (
          <a className="btn-secondary" href={`${API_BASE}/bookings/${b.id}/calendar.ics?phone=${encodeURIComponent(phone)}`} download={`sessao-${b.date}.ics`}>
            <CalendarPlus size={20} /> Adicionar ao calendário
          </a>
        )}
        {canCancel && (
          <button className="btn-danger" onClick={() => setCancelOpen(true)}>
            Cancelar agendamento
          </button>
        )}
      </div>

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar agendamento?">
        <p className="mb-4 text-soft">
          {b.depositPaid ? `O sinal de ${brl(b.depositCents)} já foi pago: combine com o estúdio a remarcação ou devolução.` : 'O horário fica livre para outra pessoa.'}
        </p>
        <Field label="Motivo (opcional)">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </Field>
        <div className="mt-4">
          <FormError message={err} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="btn-secondary" onClick={() => setCancelOpen(false)}>
            Voltar
          </button>
          <button className="btn-primary" disabled={busy} onClick={() => run(() => api.post(`/bookings/${b.id}/cancel`, { reason, phone }), 'Agendamento cancelado', () => setCancelOpen(false))}>
            Cancelar
          </button>
        </div>
      </Sheet>

      <Sheet open={reviewOpen} onClose={() => setReviewOpen(false)} title="Avaliar sessão">
        <div className="mb-4 flex justify-center gap-2" role="radiogroup" aria-label="Nota">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} estrelas`} onClick={() => setRating(n)} className="flex h-12 w-12 items-center justify-center text-accent">
              <Star size={34} fill={n <= rating ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
        <p className="-mt-2 mb-4 text-center text-sm text-muted">{['', 'Muito ruim', 'Ruim', 'Regular', 'Boa', 'Excelente'][rating]}</p>
        <Field label={rating <= 3 ? 'O que podemos melhorar? (opcional)' : 'Comentário (opcional)'}>
          <textarea className="input min-h-[100px]" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <div className="mt-4">
          <FormError message={err} />
        </div>
        <button className="btn-primary mt-4 w-full" disabled={busy} onClick={submitReview}>
          Enviar avaliação
        </button>
      </Sheet>

      <Sheet open={!!googleUrl} onClose={() => setGoogleUrl(null)} title="Obrigado!">
        <p className="mb-5 text-soft">Que bom que você curtiu! Pode deixar essa avaliação também no Google? Ajuda muito o estúdio a ser encontrado.</p>
        {googleUrl && (
          <a href={googleUrl} target="_blank" rel="noreferrer" className="btn-primary w-full" onClick={() => setGoogleUrl(null)}>
            <GoogleG /> Avaliar no Google
          </a>
        )}
        <button className="btn-secondary mt-3 w-full" onClick={() => setGoogleUrl(null)}>
          Agora não
        </button>
      </Sheet>
    </div>
  );
}

/** "G" do Google (logo simples em SVG). */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
