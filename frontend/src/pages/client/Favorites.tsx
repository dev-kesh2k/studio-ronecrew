import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useApi, type Artist } from '../../api';
import { Empty, ErrorBox, Loading, PageHead } from '../../ui';
import { ArtistCard } from './parts';

export default function Favorites() {
  const { data, error, loading, reload } = useApi<{ artists: Artist[] }>('/artists?favorites=1');
  return (
    <div>
      <PageHead back="/perfil" title="Artistas favoritos" />
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.artists.length === 0 && (
        <Empty
          icon={Heart}
          title="Nenhum favorito ainda"
          text="Toque no coração no perfil de um artista para salvá-lo aqui."
          action={
            <Link to="/artistas" className="btn-primary w-full">
              Ver artistas
            </Link>
          }
        />
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {data?.artists.map((a) => (
          <ArtistCard key={a.id} artist={a} />
        ))}
      </div>
    </div>
  );
}
