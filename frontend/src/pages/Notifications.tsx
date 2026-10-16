import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff } from 'lucide-react';
import { api, useApi, type Notification } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorBox, Loading, PageHead } from '../ui';
import { fmtDateTime } from '../util';

export default function Notifications() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const { data, error, loading, reload } = useApi<{ notifications: Notification[] }>('/notifications');
  const hasUnread = !!data?.notifications.some((n) => !n.read);

  useEffect(() => {
    if (hasUnread) api.post('/notifications/read-all').then(refresh).catch(() => undefined);
  }, [hasUnread, refresh]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead back={user?.role === 'admin' ? '/admin' : '/perfil'} title="Notificações" />
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.notifications.length === 0 && <Empty icon={BellOff} title="Nada por aqui" text="Avisos sobre seus agendamentos aparecem aqui." />}
      <div className="flex flex-col gap-3">
        {data?.notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => n.link && nav(n.link)}
            className={`card flex items-start gap-3 p-4 text-left ${n.link ? 'active:scale-[0.99]' : 'cursor-default'}`}
          >
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? 'bg-line2' : 'bg-accent'}`} />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{n.title}</p>
              {n.body && <p className="mt-0.5 break-words text-soft">{n.body}</p>}
              <p className="mt-1 text-sm text-muted">{fmtDateTime(n.createdAt)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
