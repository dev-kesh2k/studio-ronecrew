import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { ADMIN_TABS, CLIENT_TABS, TabsLayout } from './layout';
import { Loading, Toaster } from './ui';
import Welcome from './pages/auth/Welcome';
import { Login, Register } from './pages/auth/Login';
import Forgot from './pages/auth/Forgot';
import Home from './pages/client/Home';
import Artists from './pages/client/Artists';
import ArtistProfile from './pages/client/ArtistProfile';
import { BookDate, BookService } from './pages/client/BookingFlow';
import BookPayment from './pages/client/BookPayment';
import Bookings from './pages/client/Bookings';
import BookingDetail from './pages/client/BookingDetail';
import Profile from './pages/client/Profile';
import PersonalInfo from './pages/client/PersonalInfo';
import Favorites from './pages/client/Favorites';
import References from './pages/client/References';
import Aftercare from './pages/client/Aftercare';
import PaymentMethods from './pages/client/PaymentMethods';
import Help from './pages/client/Help';
import Notifications from './pages/Notifications';
import Dashboard from './pages/admin/Dashboard';
import Agenda from './pages/admin/Agenda';
import Team from './pages/admin/Team';
import Services from './pages/admin/Services';
import Finance from './pages/admin/Finance';
import Settings from './pages/admin/Settings';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function RequireRole({ role, children }: { role: 'client' | 'admin'; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;

  return (
    <>
      <ScrollTop />
      <Toaster />
      <Routes>
        {!user ? (
          <>
            <Route path="/" element={<Welcome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Register />} />
            <Route path="/esqueci" element={<Forgot />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            <Route path="/login" element={<Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />} />
            <Route path="/cadastro" element={<Navigate to="/" replace />} />

            {/* Cliente */}
            <Route
              element={
                <RequireRole role="client">
                  <TabsLayout tabs={CLIENT_TABS} />
                </RequireRole>
              }
            >
              <Route path="/" element={<Home />} />
              <Route path="/agenda" element={<Bookings />} />
              <Route path="/agenda/:id" element={<BookingDetail />} />
              <Route path="/artistas" element={<Artists />} />
              <Route path="/perfil" element={<Profile />} />
              <Route path="/perfil/dados" element={<PersonalInfo />} />
              <Route path="/perfil/favoritos" element={<Favorites />} />
              <Route path="/perfil/referencias" element={<References />} />
              <Route path="/perfil/cuidados" element={<Aftercare />} />
              <Route path="/perfil/pagamento" element={<PaymentMethods />} />
              <Route path="/perfil/ajuda" element={<Help />} />
              <Route path="/notificacoes" element={<Notifications />} />
            </Route>
            <Route path="/artistas/:id" element={<RequireRole role="client"><ArtistProfile /></RequireRole>} />
            <Route path="/agendar/servico" element={<RequireRole role="client"><BookService /></RequireRole>} />
            <Route path="/agendar/data" element={<RequireRole role="client"><BookDate /></RequireRole>} />
            <Route path="/agendar/pagamento" element={<RequireRole role="client"><BookPayment /></RequireRole>} />

            {/* Administrador */}
            <Route
              element={
                <RequireRole role="admin">
                  <TabsLayout tabs={ADMIN_TABS} admin />
                </RequireRole>
              }
            >
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/agenda" element={<Agenda />} />
              <Route path="/admin/equipe" element={<Team />} />
              <Route path="/admin/servicos" element={<Services />} />
              <Route path="/admin/financeiro" element={<Finance />} />
              <Route path="/admin/config" element={<Settings />} />
              <Route path="/admin/conta" element={<PersonalInfo />} />
              <Route path="/admin/notificacoes" element={<Notifications />} />
            </Route>
            <Route path="*" element={<Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />} />
          </>
        )}
      </Routes>
    </>
  );
}
