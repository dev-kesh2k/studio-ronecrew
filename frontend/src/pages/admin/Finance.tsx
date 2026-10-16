import { useState } from 'react';
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { useApi } from '../../api';
import { useConfig } from '../../config';
import { Empty, ErrorBox, Loading, PageHead } from '../../ui';
import { brl, dayNum, fmtDateTime, METHOD, monthShort, MONTHS } from '../../util';

interface Week {
  label: string;
  from: string;
  to: string;
  totalCents: number;
  current: boolean;
}
interface PaymentRow {
  id: string;
  kind: 'deposit' | 'final';
  method: string;
  amountCents: number;
  createdAt: string;
  booking: { id: string; clientName: string; date: string; service: { name: string }; artist: { name: string } };
}
interface FinanceData {
  month: string;
  revenue: number;
  prevRevenue: number;
  revenueChange: number | null;
  depositsReceived: number;
  depositsReceivedCount: number;
  depositsDue: number;
  depositsDueCount: number;
  weeks: Week[];
  recent: PaymentRow[];
}

const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};

/** Barras por semana: série única, semana atual em destaque, valor ao tocar/passar o mouse. */
function WeekBars({ weeks }: { weeks: Week[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...weeks.map((w) => w.totalCents), 1);
  const focus = hover ?? weeks.findIndex((w) => w.current);
  return (
    <div>
      <div className="mb-3 min-h-[3rem]" aria-live="polite">
        {focus >= 0 && weeks[focus] && (
          <>
            <p className="text-sm text-muted">
              {weeks[focus].label} · {dayNum(weeks[focus].from)}–{dayNum(weeks[focus].to)} {monthShort(weeks[focus].to)}
              {weeks[focus].current && ' · semana atual'}
            </p>
            <p className="text-xl font-bold">{brl(weeks[focus].totalCents)}</p>
          </>
        )}
      </div>
      <div className="flex items-end gap-[2px] border-b border-line" role="list" aria-label="Receita por semana">
        {weeks.map((w, i) => {
          const px = w.totalCents > 0 ? Math.max(4, Math.round((w.totalCents / max) * 150)) : 0;
          return (
            <button
              key={w.from}
              type="button"
              role="listitem"
              aria-label={`${w.label}: ${brl(w.totalCents)}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(i)}
              className="block h-[160px] min-w-0 flex-1 px-1.5 sm:px-3"
            >
              <div className="relative mx-auto h-full w-full max-w-[56px]">
                <div
                  className={`absolute inset-x-0 bottom-0 rounded-t-[4px] transition-all ${w.current ? 'bg-accent' : hover === i ? 'bg-soft' : 'bg-line2'}`}
                  style={{ height: px }}
                />
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[2px]">
        {weeks.map((w) => (
          <span key={w.from} className={`min-w-0 flex-1 truncate text-center text-sm ${w.current ? 'font-bold text-ink' : 'text-muted'}`}>
            {w.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Finance() {
  const config = useConfig();
  const [month, setMonth] = useState('');
  const current = month || config?.today.slice(0, 7) || '';
  const { data, error, loading, reload } = useApi<FinanceData>(current ? `/admin/finance?month=${current}` : null);

  if (!config) return <Loading />;
  const [y, m] = current.split('-').map(Number);
  const isCurrent = current === config.today.slice(0, 7);

  return (
    <div>
      <PageHead title="Financeiro" />
      <div className="mb-5 flex items-center justify-between gap-2">
        <button className="icon-btn h-11 w-11" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(current, -1))}>
          <ChevronLeft size={20} />
        </button>
        <p className="font-display text-xl font-bold uppercase">
          {MONTHS[m - 1]} {y}
        </p>
        <button className="icon-btn h-11 w-11 disabled:opacity-30" aria-label="Próximo mês" disabled={isCurrent} onClick={() => setMonth(shiftMonth(current, 1))}>
          <ChevronRight size={20} />
        </button>
      </div>

      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (
        <>
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
            <div className="rounded-[20px] bg-accent p-5 text-bg lg:col-span-1">
              <p className="text-base">Receita do mês</p>
              <p className="mt-1 break-words font-display text-[clamp(2.4rem,12vw,3.5rem)] font-extrabold leading-none">{brl(data.revenue)}</p>
              <p className="mt-2 text-base">
                {data.revenueChange === null ? `Mês anterior: ${brl(data.prevRevenue)}` : `${data.revenueChange >= 0 ? '+' : ''}${data.revenueChange}% vs. mês anterior`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-2">
              <div className="card p-5">
                <p className="text-base text-soft">Sinais recebidos</p>
                <p className="mt-1 break-words font-display text-[clamp(1.8rem,8vw,2.75rem)] font-extrabold leading-none">{brl(data.depositsReceived)}</p>
                <p className="mt-2 text-base text-ok">
                  {data.depositsReceivedCount} {data.depositsReceivedCount === 1 ? 'sinal' : 'sinais'}
                </p>
              </div>
              <div className="card p-5">
                <p className="text-base text-soft">A receber</p>
                <p className="mt-1 break-words font-display text-[clamp(1.8rem,8vw,2.75rem)] font-extrabold leading-none">{brl(data.depositsDue)}</p>
                <p className="mt-2 text-base text-warn">
                  {data.depositsDueCount} {data.depositsDueCount === 1 ? 'sinal pendente' : 'sinais pendentes'}
                </p>
              </div>
            </div>
          </div>

          <section className="card mt-5 p-5 sm:p-6">
            <h2 className="h2 mb-4">Receita por semana</h2>
            <WeekBars weeks={data.weeks} />
          </section>

          <section className="mt-8">
            <h2 className="h2 mb-4">Pagamentos recentes</h2>
            {data.recent.length === 0 && <Empty icon={Receipt} title="Nenhum pagamento no mês" text="Sinais e pagamentos finais registrados aparecem aqui." />}
            <div className="card divide-y divide-line">
              {data.recent.map((p) => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.booking.clientName}</p>
                    <p className="truncate text-sm text-muted">
                      {p.booking.service.name} · {METHOD[p.method] || p.method} · {fmtDateTime(p.createdAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold">{brl(p.amountCents)}</p>
                    <p className={`text-sm ${p.kind === 'deposit' ? 'text-warn' : 'text-ok'}`}>{p.kind === 'deposit' ? 'Sinal' : 'Final'}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
