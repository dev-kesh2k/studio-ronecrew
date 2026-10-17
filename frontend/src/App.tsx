import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { introSeen } from './client';
import { ADMIN_TABS, CLIENT_TABS, TabsLayout } from './layout';
import { Loading, Toaster } from './ui';
import Welcome from './pages/auth/Welcome';
import AdminLogin from './pages/auth/Login';
import Home from './pages/client/Home';
import Artists from './pages/client/Artists';
import Gallery from './pages/client/Gallery';
import ArtistProfile from './pages/client/ArtistProfile';
import { BookDate, BookService } from './pages/client/BookingFlow';
import BookPayment from './pages/client/BookPayment';
import Bookings from './pages/client/Bookings';
import BookingDetail from './pages/client/BookingDetail';
import Profile from './pages/client/Profile';
import PersonalInfo from './pages/client/PersonalInfo';
import Favorites from './pages/client/Favorites';
import Aftercare from './pages/client/Aftercare';
import Help from './pages/client/Help';
import Feedback from './pages/client/Feedback';
import About from './pages/client/About';
import AdminFeedback from './pages/admin/Feedback';
import Notifications from './pages/Notifications';
import Dashboard from './pages/admin/Dashboard';
import Agenda from './pages/admin/Agenda';
import Team from './pages/admin/Team';
import Services from './pages/admin/Services';
import Finance from './pages/admin/Finance';
import Settings from './pages/admin/Settings';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (user?.role !== 'admin') return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

/** Apresentação só na primeira visita; depois vai direto para o início. */
function HomeOrIntro() {
  const [seen, setSeen] = useState(introSeen);
  return seen ? <Home /> : <Welcome onDone={() => setSeen(true)} />;
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Toaster />
      <Routes>
        {/* Cliente: sem login, identificado pelo celular no agendamento */}
        <Route element={<TabsLayout tabs={CLIENT_TABS} />}>
          <Route path="/" element={<HomeOrIntro />} />
          <Route path="/agenda" element={<Bookings />} />
          <Route path="/agenda/:id" element={<BookingDetail />} />
          <Route path="/artistas" element={<Artists />} />
          <Route path="/galeria" element={<Gallery />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/perfil/favoritos" element={<Favorites />} />
          <Route path="/perfil/cuidados" element={<Aftercare />} />
          <Route path="/perfil/ajuda" element={<Help />} />
          <Route path="/perfil/feedback" element={<Feedback />} />
          <Route path="/sobre" element={<About />} />
        </Route>
        <Route path="/artistas/:id" element={<ArtistProfile />} />
        <Route path="/agendar/servico" element={<BookService />} />
        <Route path="/agendar/data" element={<BookDate />} />
        <Route path="/agendar/pagamento" element={<BookPayment />} />

        {/* Estúdio: login obrigatório */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          element={
            <RequireAdmin>
              <TabsLayout tabs={ADMIN_TABS} admin />
            </RequireAdmin>
          }
        >
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/agenda" element={<Agenda />} />
          <Route path="/admin/equipe" element={<Team />} />
          <Route path="/admin/servicos" element={<Services />} />
          <Route path="/admin/financeiro" element={<Finance />} />
          <Route path="/admin/config" element={<Settings />} />
          <Route path="/admin/feedback" element={<AdminFeedback />} />
          <Route path="/admin/conta" element={<PersonalInfo />} />
          <Route path="/admin/notificacoes" element={<Notifications />} />
        </Route>
        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
