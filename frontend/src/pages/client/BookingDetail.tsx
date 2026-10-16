import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ImagePlus, Star } from 'lucide-react';
import { api, fetchImageUrl, useApi, type Booking } from '../../api';
import { useConfig } from '../../config';
import { ErrorBox, Field, FormError, Loading, PageHead, Sheet, Stars, StatusPill, toast } from '../../ui';
import { brl, duration, fmtDate, METHOD, priceFrom, resizeImage, WEEKDAYS_SHORT, weekdayOf } from '../../util';

export function RefThumb({ id }: { id: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let u = '';
    fetchImageUrl(`/references/${id}/image`)
      .then((x) => setUrl((u = x)))
      .catch(() => setUrl(''));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
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
  const { data, error, loading, reload } = useApi<{ booking: Booking }>(`/bookings/${id}`);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error || 'Agendamento não encontrado'} onRetry={reload} />;
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

  async function addRef(file?: File) {
    if (!file) return;
    try {
      const image = await resizeImage(file);
      await api.post('/references', { image, bookingId: b.id });
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
              {b.status === 'requested' ? 'O estúdio vai aprovar o horário e você recebe a resposta nas notificações.' : 'Te esperamos no estúdio. Chegue 10 minutos antes.'}
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
            <RefThumb key={r.id} id={r.id} />
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
        </section>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {b.status === 'completed' && !b.review && (
          <button className="btn-primary" onClick={() => setReviewOpen(true)}>
            <Star size={20} /> Avaliar sessão
          </button>
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
          <button className="btn-primary" disabled={busy} onClick={() => run(() => api.post(`/bookings/${b.id}/cancel`, { reason }), 'Agendamento cancelado', () => setCancelOpen(false))}>
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
        <Field label="Comentário (opcional)">
          <textarea className="input min-h-[100px]" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <div className="mt-4">
          <FormError message={err} />
        </div>
        <button className="btn-primary mt-4 w-full" disabled={busy} onClick={() => run(() => api.post(`/bookings/${b.id}/review`, { rating, comment }), 'Obrigado pela avaliação!', () => setReviewOpen(false))}>
          Enviar avaliação
        </button>
      </Sheet>
    </div>
  );
}
