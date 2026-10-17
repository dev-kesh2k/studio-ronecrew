import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useApi, type Artist } from '../../api';
import { getFavorites } from '../../client';
import { Empty, ErrorBox, Loading, PageHead } from '../../ui';
import { ArtistCard } from './parts';

export default function Favorites() {
  const { data, error, loading, reload } = useApi<{ artists: Artist[] }>('/artists');
  const favs = getFavorites();
  const list = (data?.artists || []).filter((a) => favs.includes(a.id));
  return (
    <div>
      <PageHead back="/perfil" title="Artistas favoritos" subtitle="Salvos neste aparelho." />
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && list.length === 0 && (
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
        {list.map((a) => (
          <ArtistCard key={a.id} artist={a} />
        ))}
      </div>
    </div>
  );
}
