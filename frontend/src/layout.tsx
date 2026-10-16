import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, CalendarDays, Home, LayoutGrid, LogOut, Settings, Tag, User, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from './auth';

type Tab = { to: string; label: string; icon: LucideIcon; end?: boolean };

export const CLIENT_TABS: Tab[] = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/artistas', label: 'Artistas', icon: Users },
  { to: '/perfil', label: 'Perfil', icon: User },
];

export const ADMIN_TABS: Tab[] = [
  { to: '/admin', label: 'Painel', icon: LayoutGrid, end: true },
  { to: '/admin/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/admin/equipe', label: 'Equipe', icon: Users },
  { to: '/admin/servicos', label: 'Serviços', icon: Tag },
  { to: '/admin/financeiro', label: 'Financeiro', icon: BarChart3 },
];

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 512 512" className={compact ? 'h-10 w-10' : 'h-12 w-12'} aria-hidden>
        <rect width="512" height="512" rx="112" fill="#17171A" />
        <path d="M256 96c-58 82-118 150-118 222a118 118 0 0 0 236 0c0-72-60-140-118-222z" fill="#F0553A" />
        <path d="M214 330a44 44 0 0 0 44 44" stroke="#0D0D0E" strokeWidth="22" strokeLinecap="round" fill="none" />
      </svg>
      <p className="font-display text-2xl font-extrabold uppercase leading-none">
        RoneCrew <span className="text-accent">Tatoo</span>
      </p>
    </div>
  );
}

/** Página com abas: barra inferior no celular e menu lateral a partir do md. */
export function TabsLayout({ tabs, admin }: { tabs: Tab[]; admin?: boolean }) {
  const { signOut } = useAuth();
  return (
    <div className="min-h-[100dvh] md:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-tabbar px-4 py-6 md:flex">
        <div className="px-2">
          <Logo compact />
        </div>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Menu">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex min-h-[48px] items-center gap-3 rounded-2xl px-4 text-base font-medium transition ${
                  isActive ? 'bg-tint2 font-bold text-accent' : 'text-soft hover:bg-surface'
                }`
              }
            >
              <t.icon size={22} /> {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          {admin && (
            <NavLink
              to="/admin/config"
              className={({ isActive }) =>
                `flex min-h-[48px] items-center gap-3 rounded-2xl px-4 text-base font-medium ${isActive ? 'bg-tint2 text-accent' : 'text-soft hover:bg-surface'}`
              }
            >
              <Settings size={22} /> Configurações
            </NavLink>
          )}
          <button onClick={signOut} className="flex min-h-[48px] items-center gap-3 rounded-2xl px-4 text-base font-medium text-accent hover:bg-surface">
            <LogOut size={22} /> Sair
          </button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-5xl px-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[max(2.25rem,env(safe-area-inset-top))] md:px-10 md:pb-12 md:pt-10">
        <Outlet />
      </main>

      <nav
        aria-label="Menu"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-tabbar pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto flex max-w-xl">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex min-h-[68px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-[clamp(11px,3.4vw,13px)] transition ${
                  isActive ? 'font-bold text-accent' : 'text-muted'
                }`
              }
            >
              <t.icon size={24} strokeWidth={1.9} />
              <span className="max-w-full truncate">{t.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Tela cheia sem abas (perfil do artista, fluxo de agendamento). */
export function FullPage({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <div className={`mx-auto w-full max-w-3xl px-6 pt-[max(2.25rem,env(safe-area-inset-top))] ${footer ? 'pb-[calc(7.5rem+env(safe-area-inset-bottom))]' : 'pb-[max(2rem,env(safe-area-inset-bottom))]'}`}>
        {children}
      </div>
      {footer && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">{footer}</div>
        </div>
      )}
    </div>
  );
}
