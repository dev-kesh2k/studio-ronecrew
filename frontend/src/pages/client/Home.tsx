import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, MapPin, MessageSquareHeart, Search, Star } from 'lucide-react';
import { useConfig } from '../../config';
import Social, { socialLinks } from './Social';
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
  const config = useConfig();
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

      <Link to="/perfil/feedback" className="card mt-8 flex items-center gap-4 p-5 transition active:scale-[0.99]">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tint2 text-accent">
          <MessageSquareHeart size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold">Deixe seu feedback</span>
          <span className="block text-base text-muted">Elogio, sugestão ou reclamação: conte pra gente.</span>
        </span>
        <ChevronRight size={22} className="shrink-0 text-muted" />
      </Link>

      {config?.googleReviewUrl && (
        <a href={config.googleReviewUrl} target="_blank" rel="noreferrer" className="card mt-3 flex items-center gap-4 p-5 transition active:scale-[0.99]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tint2 text-accent">
            <Star size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold">Avalie no Google</span>
            <span className="block text-base text-muted">Gostou do estúdio? Deixe sua avaliação.</span>
          </span>
          <ChevronRight size={22} className="shrink-0 text-muted" />
        </a>
      )}

      {config && (
        <section className="card mt-8 p-6 text-center">
          <p className="font-display text-3xl font-bold uppercase leading-none text-accent">{config.studioName}</p>
          {config.address && (
            <p className="mx-auto mt-3 flex max-w-xs items-start justify-center gap-1.5 text-sm text-muted">
              <MapPin size={16} className="mt-0.5 shrink-0" /> <span className="break-words">{config.address}</span>
            </p>
          )}
          <Link to="/sobre" className="btn-secondary mt-5 w-full">
            Sobre e localização
          </Link>
          {socialLinks(config).length > 0 && (
            <div className="mt-5 border-t border-line pt-5">
              <p className="mb-3 text-sm text-muted">Siga o estúdio</p>
              <div className="flex justify-center">
                <Social config={config} compact />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
