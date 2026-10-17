import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Award, ChevronLeft, Heart, ImageOff } from 'lucide-react';
import { apiUrl, avatarUrl, photoUrl, serviceUrl, useApi, type Artist } from '../../api';
import { getFavorites, toggleFavorite } from '../../client';
import { FullPage } from '../../layout';
import { Avatar, ErrorBox, Lightbox, Loading, ServiceIcon, Stars, toast } from '../../ui';
import { duration, fmtDate, priceFrom } from '../../util';
import { RatingText } from './parts';

interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  name: string;
  avatar: string | null;
}

export default function ArtistProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, error, loading, reload } = useApi<{ artist: Artist; reviews: Review[] }>(`/artists/${id}`);
  const [zoom, setZoom] = useState<number | null>(null);
  const [fav, setFav] = useState(() => getFavorites().includes(id || ''));

  if (loading && !data) return <Loading />;
  if (error || !data)
    return (
      <FullPage>
        <ErrorBox message={error || 'Artista não encontrado'} onRetry={reload} />
      </FullPage>
    );

  const a = data.artist;

  function toggleFav() {
    const on = toggleFavorite(a.id);
    setFav(on);
    toast(on ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
  }

  const footer = a.available ? (
    <Link to={`/agendar/servico?artist=${a.id}`} className="btn-primary w-full">
      Agendar sessão
    </Link>
  ) : (
    <button className="btn-primary w-full" disabled>
      {a.unavailableNote || 'Indisponível para agendamento'}
    </button>
  );

  return (
    <FullPage footer={footer}>
      <div className="relative -mx-6 -mt-[max(2.25rem,env(safe-area-inset-top))] md:mx-0 md:mt-0">
        <div className="stripes relative h-[clamp(14rem,62vw,22rem)] overflow-hidden md:rounded-[24px]">
          {a.photos[0] && <img src={photoUrl(a.photos[0])} alt={`Trabalho de ${a.name}`} className="h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-bg/90" />
        </div>
        <div className="absolute inset-x-0 top-0 flex justify-between px-6 pt-[max(1.5rem,env(safe-area-inset-top))] md:pt-5">
          <button className="icon-btn bg-bg/80" aria-label="Voltar" onClick={() => nav(-1)}>
            <ChevronLeft size={24} />
          </button>
          <button className="icon-btn bg-bg/80" aria-label={fav ? 'Remover dos favoritos' : 'Favoritar'} aria-pressed={fav} onClick={toggleFav}>
            <Heart size={22} className={fav ? 'text-accent' : ''} fill={fav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="relative -mt-10 flex items-end gap-4">
        <div className="rounded-full border-4 border-bg">
          <Avatar name={a.name} size="lg" accent src={avatarUrl(a)} />
        </div>
      </div>
      <h1 className="h1 mt-3">{a.name}</h1>
      <p className="mt-1 text-base text-muted">
        {a.style}
        {a.years > 0 && ` · ${a.years} ${a.years === 1 ? 'ano' : 'anos'} de experiência`}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <RatingText artist={a} />
        {a.topRequested && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tint2 px-3 py-1.5 text-sm font-bold text-accent">
            <Award size={16} /> Mais requisitado
          </span>
        )}
        {!a.available && <span className="rounded-full bg-warnbg px-3 py-1.5 text-sm font-bold text-warn">{a.unavailableNote || 'Indisponível'}</span>}
      </div>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="h2">Portfólio</h2>
          {a.photos.length > 8 && (
            <Link to={`/galeria?artist=${a.id}`} className="flex min-h-[44px] items-center text-base text-accent">
              Ver todas ({a.photos.length})
            </Link>
          )}
        </div>
        {a.photos.length ? (
          <div className="grid grid-cols-4 gap-2 md:gap-3">
            {a.photos.slice(0, 8).map((p, i) => (
              <button key={p} onClick={() => setZoom(i)} className="aspect-square overflow-hidden rounded-[14px] bg-surface2" aria-label="Ampliar foto">
                <img src={photoUrl(p)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <div className="card flex items-center gap-3 p-4 text-muted">
            <ImageOff size={22} className="shrink-0" /> O artista ainda não publicou fotos do portfólio.
          </div>
        )}
      </section>

      {a.bio && (
        <section className="mt-7">
          <h2 className="h2 mb-3">Sobre</h2>
          <p className="text-base leading-relaxed text-soft">{a.bio}</p>
        </section>
      )}

      <section className="mt-7">
        <h2 className="h2 mb-3">Serviços</h2>
        <div className="card divide-y divide-line">
          {a.services.length === 0 && <p className="p-4 text-muted">Nenhum serviço disponível.</p>}
          {a.services.map((s) => (
            <div key={s.id} className="flex items-center gap-4 p-4">
              <ServiceIcon icon={s.icon} size="sm" photo={serviceUrl(s)} />
              <div className="min-w-0 flex-1">
                <p className="break-words font-bold">{s.name}</p>
                <p className="text-sm text-muted">Cerca de {duration(s.durationMin)}</p>
                <p className="text-sm font-bold text-accent">{priceFrom(s.priceCents)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {data.reviews.length > 0 && (
        <section className="mt-7">
          <h2 className="h2 mb-3">Avaliações</h2>
          <div className="flex flex-col gap-3">
            {data.reviews.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={r.name} size="sm" src={apiUrl(r.avatar)} />
                  <p className="min-w-0 flex-1 font-bold">{r.name}</p>
                  <Stars value={r.rating} />
                </div>
                {r.comment && <p className="mt-2 text-soft">{r.comment}</p>}
                <p className="mt-2 text-sm text-muted">{fmtDate(r.createdAt.slice(0, 10))}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {zoom !== null && <Lightbox urls={a.photos.map(photoUrl)} index={zoom} onIndex={setZoom} onClose={() => setZoom(null)} />}
    </FullPage>
  );
}
