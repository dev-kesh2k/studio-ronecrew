import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarX, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, serviceUrl, useApi, type Artist, type Service, type Slot } from '../../api';
import { useConfig } from '../../config';
import { FullPage } from '../../layout';
import { Empty, ErrorBox, Loading, PageHead, Radio, ServiceIcon, Stepper } from '../../ui';
import { addDays, duration, fmtLong, MONTHS, priceFrom, weekdayOf } from '../../util';

export function useArtist(id: string | null) {
  return useApi<{ artist: Artist }>(id ? `/artists/${id}` : null);
}

export function BookService() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const artistId = params.get('artist');
  const artist = useArtist(artistId);
  const { data, error, loading, reload } = useApi<{ services: Service[] }>(artistId ? `/services?artistId=${artistId}` : null);
  const [selected, setSelected] = useState(params.get('service') || '');

  useEffect(() => {
    if (!artistId) nav('/artistas', { replace: true });
  }, [artistId, nav]);

  return (
    <FullPage
      footer={
        <button className="btn-primary w-full" disabled={!selected} onClick={() => nav(`/agendar/data?artist=${artistId}&service=${selected}`)}>
          Continuar
        </button>
      }
    >
      <PageHead back={`/artistas/${artistId}`} title="Escolha o serviço" subtitle={artist.data ? `com ${artist.data.artist.name}` : undefined} />
      <Stepper step={0} />
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.services.length === 0 && <Empty icon={CalendarX} title="Sem serviços disponíveis" text="Esse artista não tem serviços ativos no momento." />}
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Serviço">
        {data?.services.map((s) => {
          const on = s.id === selected;
          return (
            <button
              key={s.id}
              role="radio"
              aria-checked={on}
              onClick={() => setSelected(s.id)}
              className={`flex items-center gap-4 rounded-[20px] border p-4 text-left transition active:scale-[0.99] ${on ? 'border-accent bg-tint' : 'border-line bg-surface'}`}
            >
              <ServiceIcon icon={s.icon} photo={serviceUrl(s)} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold">{s.name}</p>
                {s.description && <p className="text-sm text-muted">{s.description}</p>}
                <p className="mt-1 text-sm text-soft">
                  Cerca de {duration(s.durationMin)} · <span className="font-bold text-accent">{priceFrom(s.priceCents)}</span>
                </p>
              </div>
              <Radio on={on} />
            </button>
          );
        })}
      </div>
    </FullPage>
  );
}

function Calendar({ today, value, onChange, schedule }: { today: string; value: string; onChange: (d: string) => void; schedule: { open: boolean }[] }) {
  const [month, setMonth] = useState((value || today).slice(0, 7));
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = weekdayOf(first);
  const max = addDays(today, 365);
  const canPrev = month > today.slice(0, 7);
  const canNext = month < max.slice(0, 7);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <button className="icon-btn h-11 w-11 border-transparent bg-transparent disabled:opacity-30" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Mês anterior">
          <ChevronLeft size={22} />
        </button>
        <p className="font-display text-xl font-bold uppercase">
          {MONTHS[m - 1]} {y}
        </p>
        <button className="icon-btn h-11 w-11 border-transparent bg-transparent disabled:opacity-30" onClick={() => shift(1)} disabled={!canNext} aria-label="Próximo mês">
          <ChevronRight size={22} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm text-muted">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, '0')}`;
          const disabled = day < today || day > max || !schedule[weekdayOf(day)]?.open;
          const sel = day === value;
          const isToday = day === today;
          return (
            <button
              key={day}
              disabled={disabled}
              onClick={() => onChange(day)}
              aria-label={fmtLong(day)}
              aria-pressed={sel}
              className={`mx-auto flex aspect-square w-full max-w-[48px] items-center justify-center rounded-xl text-base font-medium transition ${
                sel ? 'bg-accent font-bold text-bg' : isToday ? 'border border-accent text-ink' : disabled ? 'text-dis' : 'text-ink active:bg-surface2'
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BookDate() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const config = useConfig();
  const artistId = params.get('artist') || '';
  const serviceId = params.get('service') || '';
  const artist = useArtist(artistId);
  const [date, setDate] = useState(params.get('date') || '');
  const [time, setTime] = useState(params.get('time') || '');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotErr, setSlotErr] = useState('');

  const service = useMemo(() => artist.data?.artist.services.find((s) => s.id === serviceId), [artist.data, serviceId]);

  useEffect(() => {
    if (!artistId || !serviceId) nav('/artistas', { replace: true });
  }, [artistId, serviceId, nav]);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    setSlots(null);
    setSlotErr('');
    api
      .get<{ slots: Slot[] }>(`/availability?artistId=${artistId}&serviceId=${serviceId}&date=${date}`)
      .then((r) => alive && setSlots(r.slots))
      .catch((e) => alive && setSlotErr((e as Error).message));
    return () => {
      alive = false;
    };
  }, [date, artistId, serviceId]);

  useEffect(() => {
    if (slots && time && !slots.find((s) => s.time === time)?.available) setTime('');
  }, [slots, time]);

  if (!config || (artist.loading && !artist.data)) return <Loading />;
  const free = slots?.filter((s) => s.available).length ?? 0;

  return (
    <FullPage
      footer={
        <button
          className="btn-primary w-full"
          disabled={!date || !time}
          onClick={() => nav(`/agendar/pagamento?artist=${artistId}&service=${serviceId}&date=${date}&time=${time}`)}
        >
          Continuar
        </button>
      }
    >
      <PageHead
        back={`/agendar/servico?artist=${artistId}&service=${serviceId}`}
        title="Data e horário"
        subtitle={service && artist.data ? `${service.name} com ${artist.data.artist.name} · cerca de ${duration(service.durationMin)}` : undefined}
      />
      <Stepper step={date ? 2 : 1} />
      <div className="grid gap-6 md:grid-cols-2">
        <Calendar
          today={config.today}
          schedule={config.schedule}
          value={date}
          onChange={(d) => {
            setDate(d);
            setTime('');
          }}
        />
        <section>
          <h2 className="h2 mb-3">{date ? fmtLong(date) : 'Horários'}</h2>
          {!date && <p className="text-muted">Escolha um dia no calendário. O estúdio abre de segunda a sábado, das 9h às 18h.</p>}
          {date && !slots && !slotErr && <Loading label="Buscando horários…" />}
          {slotErr && <ErrorBox message={slotErr} />}
          {slots && free === 0 && <p className="card p-4 text-muted">Sem horários livres neste dia. Tente outra data.</p>}
          {slots && free > 0 && (
            <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Horário">
              {slots.map((s) => (
                <button
                  key={s.time}
                  role="radio"
                  aria-checked={time === s.time}
                  disabled={!s.available}
                  onClick={() => setTime(s.time)}
                  className={`min-h-[52px] rounded-2xl border text-base font-bold transition ${
                    time === s.time
                      ? 'border-accent bg-accent text-bg'
                      : s.available
                        ? 'border-line bg-surface text-ink active:scale-95'
                        : 'border-line/50 bg-transparent text-dis line-through'
                  }`}
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </FullPage>
  );
}
