import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarOff, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api, useApi, type Booking } from '../../api';
import { useConfig } from '../../config';
import { ErrorBox, Field, FormError, Loading, PageHead, Sheet, toast } from '../../ui';
import { addDays, dayNum, fmtDate, fmtShort, monthShort, WEEKDAYS_SHORT, weekdayOf, weekStart } from '../../util';
import { NewBookingSheet, SessionRow, SessionSheet } from './parts';

export default function Agenda() {
  const config = useConfig();
  const [params, setParams] = useSearchParams();
  const today = config?.today || '';
  const day = params.get('day') || today;
  const start = day ? weekStart(day) : '';
  const week = start ? Array.from({ length: 7 }, (_, i) => addDays(start, i)) : [];

  const bookings = useApi<{ bookings: Booking[] }>(start ? `/admin/bookings?from=${start}&to=${addDays(start, 6)}` : null);
  const requests = useApi<{ requests: Booking[] }>('/admin/requests');
  const [open, setOpen] = useState<Booking | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [rejecting, setRejecting] = useState<Booking | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string>('');

  if (!config) return <Loading />;

  const setDay = (d: string) => setParams({ day: d }, { replace: true });
  const reloadAll = () => {
    bookings.reload();
    requests.reload();
  };

  const daySessions = (bookings.data?.bookings || []).filter((b) => b.date === day && !['cancelled', 'rejected', 'requested'].includes(b.status));
  const countByDay = (d: string) => (bookings.data?.bookings || []).filter((b) => b.date === d && ['pending_deposit', 'confirmed', 'completed'].includes(b.status)).length;

  async function approve(b: Booking) {
    setBusy(b.id);
    try {
      await api.post(`/admin/bookings/${b.id}/approve`);
      toast(`Aprovado: ${b.clientName}`);
      reloadAll();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy('');
    }
  }

  async function reject() {
    if (!rejecting) return;
    setBusy(rejecting.id);
    setErr('');
    try {
      await api.post(`/admin/bookings/${rejecting.id}/reject`, { reason });
      toast('Solicitação recusada');
      setRejecting(null);
      setReason('');
      reloadAll();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div>
      <PageHead
        title="Agenda"
        action={
          <button className="btn-pill" onClick={() => setNewOpen(true)}>
            <Plus size={22} /> Novo
          </button>
        }
      />

      <div className="mb-3 flex items-center justify-between gap-2">
        <button className="icon-btn h-11 w-11" aria-label="Semana anterior" onClick={() => setDay(addDays(start, -7))}>
          <ChevronLeft size={20} />
        </button>
        <p className="text-base text-soft">
          {dayNum(start)} {monthShort(start)} – {dayNum(addDays(start, 6))} {monthShort(addDays(start, 6))}
        </p>
        <button className="icon-btn h-11 w-11" aria-label="Próxima semana" onClick={() => setDay(addDays(start, 7))}>
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5" role="tablist" aria-label="Dias da semana">
        {week.map((d) => {
          const sel = d === day;
          const closed = weekdayOf(d) === 0;
          const n = countByDay(d);
          return (
            <button
              key={d}
              role="tab"
              aria-selected={sel}
              aria-label={`${fmtShort(d)}${n ? `, ${n} sessões` : ''}`}
              onClick={() => setDay(d)}
              className={`relative flex min-h-[72px] min-w-0 flex-col items-center justify-center rounded-2xl border transition sm:min-h-[84px] ${
                sel ? 'border-accent bg-accent text-bg' : d === today ? 'border-accent/60 bg-surface' : 'border-line bg-surface'
              } ${closed && !sel ? 'opacity-50' : ''}`}
            >
              <span className={`text-[13px] sm:text-sm ${sel ? 'text-bg' : 'text-muted'}`}>{WEEKDAYS_SHORT[weekdayOf(d)]}</span>
              <span className="text-[clamp(1.05rem,5vw,1.5rem)] font-bold leading-tight">{dayNum(d)}</span>
              {n > 0 && <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${sel ? 'bg-bg' : 'bg-accent'}`} />}
            </button>
          );
        })}
      </div>

      <section className="mt-8">
        <h2 className="h2 mb-4">
          Solicitações pendentes {requests.data && requests.data.requests.length > 0 && <span className="text-accent">{requests.data.requests.length}</span>}
        </h2>
        {requests.loading && !requests.data && <Loading />}
        {requests.error && <ErrorBox message={requests.error} onRetry={requests.reload} />}
        {requests.data && requests.data.requests.length === 0 && <p className="card p-5 text-muted">Nenhuma solicitação aguardando resposta.</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {requests.data?.requests.map((b) => (
            <div key={b.id} className="card p-5 sm:p-6">
              <button className="block w-full text-left" onClick={() => setOpen(b)}>
                <p className="text-lg font-bold">{b.clientName}</p>
                <p className="text-base text-muted">
                  {b.service.name} · {b.artist.name} · {fmtShort(b.date, b.time)}
                </p>
                {b.notes && <p className="mt-2 line-clamp-2 break-words text-sm text-soft">“{b.notes}”</p>}
              </button>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button className="btn-secondary" disabled={busy === b.id} onClick={() => setRejecting(b)}>
                  Recusar
                </button>
                <button className="btn-primary" disabled={busy === b.id} onClick={() => approve(b)}>
                  Aprovar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="h2 mb-4">{day === today ? 'Hoje' : fmtShort(day)}</h2>
        {bookings.loading && !bookings.data && <Loading />}
        {bookings.error && <ErrorBox message={bookings.error} onRetry={bookings.reload} />}
        {bookings.data && daySessions.length === 0 && (
          <div className="card flex items-center gap-3 p-5 text-muted">
            <CalendarOff size={22} className="shrink-0" />
            {weekdayOf(day) === 0 ? 'Domingo: estúdio fechado.' : `Nenhuma sessão em ${fmtDate(day)}.`}
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {daySessions.map((b) => (
            <SessionRow key={b.id} b={b} onClick={() => setOpen(b)} />
          ))}
        </div>
      </section>

      <SessionSheet booking={open} onClose={() => setOpen(null)} onChanged={reloadAll} today={today} />
      <NewBookingSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        defaultDate={day < today || weekdayOf(day) === 0 ? today : day}
        onCreated={(b) => {
          setDay(b.date);
          reloadAll();
        }}
      />
      <Sheet open={!!rejecting} onClose={() => setRejecting(null)} title="Recusar solicitação">
        {rejecting && (
          <p className="mb-4 text-soft">
            {rejecting.clientName} · {rejecting.service.name} · {fmtShort(rejecting.date, rejecting.time)}
          </p>
        )}
        <Field label="Motivo (enviado ao cliente)">
          <input className="input" maxLength={300} placeholder="Ex.: artista sem horário nesse dia" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="mt-4">
          <FormError message={err} />
        </div>
        <button className="btn-danger mt-4 w-full" disabled={!!busy} onClick={reject}>
          Recusar
        </button>
      </Sheet>
    </div>
  );
}
