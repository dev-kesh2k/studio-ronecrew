import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, Search } from 'lucide-react';
import { photoUrl, useApi, type Artist, type Booking, type GalleryPhoto } from '../../api';
import { getSavedName, getSavedPhone } from '../../client';
import { ErrorBox, Loading } from '../../ui';
import { firstName, fmtShort } from '../../util';
import { ArtistCard } from './parts';

export default function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const phone = getSavedPhone();
  const name = getSavedName();
  const artists = useApi<{ artists: Artist[]; styles: string[] }>('/artists');
  const gallery = useApi<{ photos: GalleryPhoto[] }>('/gallery');
  const mine = useApi<{ bookings: Booking[]; today: string }>(phone ? `/bookings/by-phone?phone=${encodeURIComponent(phone)}` : null);

  const next = mine.data?.bookings
    .filter((b) => ['requested', 'pending_deposit', 'confirmed'].includes(b.status) && b.date >= mine.data!.today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];

  const featured = [...(artists.data?.artists || [])]
    .filter((a) => a.available)
    .sort((a, b) => Number(b.topRequested) - Number(a.topRequested) || (b.rating || 0) - (a.rating || 0))
    .slice(0, 3);

  function search(e: FormEvent) {
    e.preventDefault();
    nav(`/artistas${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  }

  return (
    <div>
      <header className="mb-6 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base text-muted">{name ? `Olá, ${firstName(name)}` : 'Olá!'}</p>
          <h1 className="h1 mt-1">Bora tatuar?</h1>
        </div>
        <Link to="/agenda" className="icon-btn" aria-label="Meus agendamentos">
          <CalendarDays size={22} />
        </Link>
      </header>

      <form onSubmit={search} role="search">
        <div className="relative">
          <Search size={22} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input min-h-[56px] pl-14"
            placeholder="Buscar artista ou estilo"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar artista ou estilo"
            enterKeyHint="search"
          />
        </div>
      </form>

      {artists.data && artists.data.styles.length > 0 && (
        <div className="no-scrollbar -mx-6 mt-4 flex gap-2 overflow-x-auto px-6 md:mx-0 md:flex-wrap md:px-0">
          <Link to="/artistas" className="chip chip-on">
            Todos
          </Link>
          {artists.data.styles.map((s) => (
            <Link key={s} to={`/artistas?style=${encodeURIComponent(s)}`} className="chip">
              {s}
            </Link>
          ))}
        </div>
      )}

      {next ? (
        <Link to={`/agenda/${next.id}`} className="mt-6 flex items-center gap-4 rounded-[20px] bg-accent p-5 text-bg transition active:scale-[0.99]">
          <CalendarDays size={28} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold uppercase tracking-[0.1em]">Sua próxima sessão</p>
            <p className="mt-1 truncate text-lg font-bold">
              {next.service.name} com {firstName(next.artist.name)}
            </p>
            <p className="text-base">{fmtShort(next.date, next.time)}</p>
          </div>
          <ChevronRight className="shrink-0" />
        </Link>
      ) : (
        <div className="stripes mt-6 overflow-hidden rounded-[20px] border border-line p-6">
          <p className="font-display text-[clamp(1.8rem,8vw,2.4rem)] font-extrabold uppercase leading-[0.95]">
            Sua próxima tattoo <span className="text-accent">começa aqui</span>
          </p>
          <p className="mt-2 text-base text-soft">Escolha o artista, o serviço e o melhor horário.</p>
          <Link to="/artistas" className="btn-primary mt-5 w-full sm:w-auto sm:max-w-xs">
            Agendar agora
          </Link>
        </div>
      )}

      {artists.data && artists.data.styles.length > 0 && (
        <section className="mt-8">
          <h2 className="h2 mb-4">Estilos populares</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {artists.data.styles.slice(0, 4).map((s) => (
              <Link key={s} to={`/artistas?style=${encodeURIComponent(s)}`} className="stripes flex aspect-[4/3] items-end rounded-[18px] border border-line p-4 transition active:scale-[0.98]">
                <span className="font-display text-2xl font-bold uppercase leading-none">{s}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {gallery.data && gallery.data.photos.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="h2">Galeria</h2>
            <Link to="/galeria" className="flex min-h-[44px] items-center text-base text-accent">
              Ver tudo
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
            {gallery.data.photos.slice(0, 6).map((p) => (
              <Link key={p.id} to={`/galeria?artist=${p.artist.id}`} className="aspect-square overflow-hidden rounded-[14px] bg-surface2" aria-label={`Trabalho de ${p.artist.name}`}>
                <img src={photoUrl(p.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="h2">Artistas em destaque</h2>
          <Link to="/artistas" className="flex min-h-[44px] items-center text-base text-accent">
            Ver todos
          </Link>
        </div>
        {artists.loading && !artists.data && <Loading />}
        {artists.error && <ErrorBox message={artists.error} onRetry={artists.reload} />}
        <div className="grid gap-3 lg:grid-cols-2">
          {featured.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
        </div>
        {artists.data && featured.length === 0 && <p className="text-muted">Nenhum artista disponível no momento.</p>}
      </section>
    </div>
  );
}
