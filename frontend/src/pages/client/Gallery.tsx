import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Images } from 'lucide-react';
import { photoUrl, useApi, type GalleryPhoto } from '../../api';
import { Empty, ErrorBox, Lightbox, Loading, PageHead } from '../../ui';

/** Galeria do estúdio: trabalhos de todos os artistas, com filtro por artista. */
export default function Gallery() {
  const [params, setParams] = useSearchParams();
  const artistId = params.get('artist') || '';
  const { data, error, loading, reload } = useApi<{ photos: GalleryPhoto[] }>('/gallery');
  const [open, setOpen] = useState<number | null>(null);

  const all = data?.photos || [];
  const artists = [...new Map(all.map((p) => [p.artist.id, p.artist])).values()];
  const list = artistId ? all.filter((p) => p.artist.id === artistId) : all;
  const current = open !== null ? list[open] : null;

  const pick = (id: string) => {
    setOpen(null);
    setParams(id ? { artist: id } : {}, { replace: true });
  };

  return (
    <div>
      <PageHead title="Galeria" subtitle="Trabalhos feitos pela equipe do estúdio." />

      {artists.length > 1 && (
        <div className="no-scrollbar -mx-6 mb-5 flex gap-2 overflow-x-auto px-6 md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="Filtrar por artista">
          <button role="tab" aria-selected={!artistId} className={`chip ${!artistId ? 'chip-on' : ''}`} onClick={() => pick('')}>
            Todos
          </button>
          {artists.map((a) => (
            <button key={a.id} role="tab" aria-selected={artistId === a.id} className={`chip ${artistId === a.id ? 'chip-on' : ''}`} onClick={() => pick(a.id)}>
              {a.name}
            </button>
          ))}
        </div>
      )}

      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && list.length === 0 && (
        <Empty
          icon={Images}
          title="Galeria vazia por enquanto"
          text="Os trabalhos dos artistas aparecem aqui assim que o estúdio publicar as fotos."
          action={
            <Link to="/artistas" className="btn-primary w-full">
              Ver artistas
            </Link>
          }
        />
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {list.map((p, i) => (
          <button key={p.id} onClick={() => setOpen(i)} className="group relative aspect-square overflow-hidden rounded-[16px] bg-surface2" aria-label={`Trabalho de ${p.artist.name}`}>
            <img src={photoUrl(p.id)} alt="" loading="lazy" className="h-full w-full object-cover transition group-active:scale-[0.98]" />
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 text-left text-sm font-medium">
              {p.artist.name}
            </span>
          </button>
        ))}
      </div>

      {current && open !== null && (
        <Lightbox
          urls={list.map((p) => photoUrl(p.id))}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          caption={
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{current.artist.name}</p>
                <p className="truncate text-sm text-muted">{current.artist.style}</p>
              </div>
              <Link to={`/artistas/${current.artist.id}`} className="btn-pill min-h-[44px] px-4 text-sm">
                {current.artist.available ? 'Agendar' : 'Ver perfil'}
              </Link>
            </div>
          }
        />
      )}
    </div>
  );
}
