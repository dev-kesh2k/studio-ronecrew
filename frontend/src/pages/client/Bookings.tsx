import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, History, XCircle } from 'lucide-react';
import { useApi, type Booking } from '../../api';
import { Empty, ErrorBox, Loading, PageHead } from '../../ui';
import { BookingCard } from './parts';

const TABS = [
  { id: 'next', label: 'Próximos' },
  { id: 'past', label: 'Anteriores' },
  { id: 'cancel', label: 'Cancelados' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const ACTIVE = ['requested', 'pending_deposit', 'confirmed'];

export default function Bookings() {
  const [tab, setTab] = useState<TabId>('next');
  const { data, error, loading, reload } = useApi<{ bookings: Booking[]; today: string }>('/bookings/mine');

  const groups: Record<TabId, Booking[]> = { next: [], past: [], cancel: [] };
  for (const b of data?.bookings || []) {
    if (b.status === 'cancelled' || b.status === 'rejected') groups.cancel.push(b);
    else if (ACTIVE.includes(b.status) && b.date >= data!.today) groups.next.push(b);
    else groups.past.push(b);
  }
  groups.next.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const list = groups[tab];

  return (
    <div>
      <PageHead
        title="Meus agendamentos"
        action={
          <Link to="/artistas" className="btn-pill" aria-label="Novo agendamento">
            <CalendarPlus size={20} /> <span className="hidden min-[380px]:inline">Novo</span>
          </Link>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-[44px] min-w-0 truncate rounded-xl px-1 text-[clamp(13px,4vw,15px)] font-medium transition ${tab === t.id ? 'bg-accent font-bold text-bg' : 'text-soft'}`}
          >
            {t.label}
            {data && groups[t.id].length > 0 && <span className="ml-1 hidden opacity-70 min-[400px]:inline">{groups[t.id].length}</span>}
          </button>
        ))}
      </div>

      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && list.length === 0 && (
        <Empty
          icon={tab === 'next' ? CalendarPlus : tab === 'past' ? History : XCircle}
          title={tab === 'next' ? 'Nenhum agendamento' : tab === 'past' ? 'Nenhuma sessão anterior' : 'Nada cancelado'}
          text={tab === 'next' ? 'Escolha um artista e marque sua próxima tattoo.' : undefined}
          action={
            tab === 'next' ? (
              <Link to="/artistas" className="btn-primary w-full">
                Agendar
              </Link>
            ) : undefined
          }
        />
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((b) => (
          <BookingCard key={b.id} booking={b} />
        ))}
      </div>
    </div>
  );
}
