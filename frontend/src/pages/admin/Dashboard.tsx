import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarCheck, Settings } from 'lucide-react';
import { useApi, type Booking } from '../../api';
import { Empty, ErrorBox, Loading, PageHead } from '../../ui';
import { brl, fmtLong, fmtShort } from '../../util';
import { SessionRow, SessionSheet } from './parts';

interface Dash {
  today: string;
  studioName: string;
  sessionsToday: number;
  completedToday: number;
  revenueToday: number;
  revenueChange: number | null;
  pendingRequests: number;
  depositsDue: number;
  depositsDueClients: number;
  upcoming: Booking[];
  unread: number;
}

function Stat({ label, value, note, noteClass = 'text-muted', accent, to }: { label: string; value: string; note: string; noteClass?: string; accent?: boolean; to: string }) {
  return (
    <Link to={to} className={`flex min-w-0 flex-col rounded-[20px] border p-5 transition active:scale-[0.98] ${accent ? 'border-accent bg-accent text-bg' : 'border-line bg-surface'}`}>
      <span className={`text-base ${accent ? 'text-bg' : 'text-soft'}`}>{label}</span>
      <span className="mt-1 break-words font-display text-[clamp(2.1rem,10vw,3.25rem)] font-extrabold leading-none">{value}</span>
      <span className={`mt-2 text-base ${accent ? 'text-bg' : noteClass}`}>{note}</span>
    </Link>
  );
}

export default function Dashboard() {
  const { data, error, loading, reload } = useApi<Dash>('/admin/dashboard');
  const [open, setOpen] = useState<Booking | null>(null);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error || 'Erro ao carregar'} onRetry={reload} />;

  const weekday = fmtLong(data.today).split(',')[0].toLowerCase();
  const change =
    data.revenueChange === null ? 'Sem base de comparação' : `${data.revenueChange >= 0 ? '+' : ''}${data.revenueChange}% vs. ${weekday} passada`;

  return (
    <div>
      <PageHead
        eyebrow="Administrador"
        title={data.studioName}
        subtitle={fmtLong(data.today)}
        action={
          <div className="flex gap-2 self-start">
            <Link to="/admin/notificacoes" className="icon-btn" aria-label={data.unread ? `Notificações (${data.unread} novas)` : 'Notificações'}>
              <Bell size={22} />
              {data.unread > 0 && <span className="absolute right-2.5 top-2.5 h-3 w-3 rounded-full border-2 border-surface bg-accent" />}
            </Link>
            <Link to="/admin/config" className="icon-btn md:hidden" aria-label="Configurações">
              <Settings size={22} />
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat accent to="/admin/agenda" label="Sessões hoje" value={String(data.sessionsToday)} note={`${data.completedToday} já ${data.completedToday === 1 ? 'concluída' : 'concluídas'}`} />
        <Stat
          to="/admin/financeiro"
          label="Receita do dia"
          value={brl(data.revenueToday)}
          note={change}
          noteClass={data.revenueChange === null ? 'text-muted' : data.revenueChange >= 0 ? 'text-ok' : 'text-accent'}
        />
        <Stat
          to="/admin/agenda"
          label="Solicitações pendentes"
          value={String(data.pendingRequests)}
          note={data.pendingRequests ? 'Aguardando resposta' : 'Tudo respondido'}
          noteClass={data.pendingRequests ? 'text-warn' : 'text-muted'}
        />
        <Stat
          to="/admin/financeiro"
          label="Sinais a receber"
          value={brl(data.depositsDue)}
          note={`${data.depositsDueClients} ${data.depositsDueClients === 1 ? 'cliente' : 'clientes'}`}
        />
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="h2">Próximas sessões</h2>
          <Link to="/admin/agenda" className="flex min-h-[44px] items-center text-base text-accent">
            Ver agenda
          </Link>
        </div>
        {data.upcoming.length === 0 && <Empty icon={CalendarCheck} title="Nenhuma sessão marcada" text="As próximas sessões confirmadas aparecem aqui." />}
        <div className="grid gap-3 lg:grid-cols-2">
          {data.upcoming.map((b) => (
            <div key={b.id} className="min-w-0">
              {b.date !== data.today && <p className="mb-1.5 text-sm font-medium text-muted">{fmtShort(b.date)}</p>}
              <SessionRow b={b} detailed onClick={() => setOpen(b)} />
            </div>
          ))}
        </div>
      </section>

      <SessionSheet booking={open} onClose={() => setOpen(null)} onChanged={reload} today={data.today} />
    </div>
  );
}
