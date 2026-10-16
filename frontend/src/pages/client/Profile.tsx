import { Link } from 'react-router-dom';
import { Bell, CalendarDays, ChevronRight, CircleHelp, CreditCard, Droplet, Heart, Image, LogOut, User } from 'lucide-react';
import { useAuth } from '../../auth';
import { Avatar, PageHead } from '../../ui';

const MENU = [
  { to: '/perfil/dados', label: 'Informações pessoais', icon: User },
  { to: '/agenda', label: 'Meus agendamentos', icon: CalendarDays },
  { to: '/perfil/favoritos', label: 'Artistas favoritos', icon: Heart },
  { to: '/perfil/referencias', label: 'Minhas referências', icon: Image },
  { to: '/perfil/cuidados', label: 'Cuidados pós-tattoo', icon: Droplet },
  { to: '/perfil/pagamento', label: 'Formas de pagamento', icon: CreditCard },
  { to: '/notificacoes', label: 'Notificações', icon: Bell },
  { to: '/perfil/ajuda', label: 'Ajuda e suporte', icon: CircleHelp },
];

export default function Profile() {
  const { user, unread, signOut } = useAuth();
  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="Perfil" />
      <Link to="/perfil/dados" className="card flex items-center gap-4 p-5 min-[380px]:gap-5 min-[380px]:p-6">
        <Avatar name={user.name} size="lg" accent />
        <div className="min-w-0">
          <p className="break-words text-xl font-bold">{user.name}</p>
          <p className="break-all text-base text-muted">{user.email}</p>
          {user.phone && <p className="text-base text-muted">{user.phone}</p>}
        </div>
      </Link>

      <nav className="card mt-5 py-2" aria-label="Opções do perfil">
        {MENU.map((m) => (
          <Link key={m.to + m.label} to={m.to} className="flex min-h-[60px] items-center gap-4 px-5 py-2 text-base transition active:bg-surface2 min-[380px]:px-6 min-[380px]:text-lg">
            <m.icon size={24} className="shrink-0" />
            <span className="min-w-0 flex-1">{m.label}</span>
            {m.to === '/notificacoes' && unread > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-sm font-bold text-bg">{unread}</span>}
            <ChevronRight size={20} className="shrink-0 text-soft" />
          </Link>
        ))}
      </nav>

      <button onClick={signOut} className="card mt-5 flex min-h-[64px] w-full items-center gap-4 px-6 text-lg text-accent transition active:bg-surface2">
        <LogOut size={24} /> Sair
      </button>
    </div>
  );
}
