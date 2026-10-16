import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SearchX } from 'lucide-react';
import { useApi, type Artist } from '../../api';
import { Empty, ErrorBox, Loading, PageHead } from '../../ui';
import { ArtistCard } from './parts';

export default function Artists() {
  const [params, setParams] = useSearchParams();
  const style = params.get('style') || '';
  const [q, setQ] = useState(params.get('q') || '');
  const [debounced, setDebounced] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const qs = new URLSearchParams();
  if (debounced) qs.set('q', debounced);
  if (style) qs.set('style', style);
  const { data, error, loading, reload } = useApi<{ artists: Artist[]; styles: string[] }>(`/artists?${qs}`);
  const all = useApi<{ artists: Artist[]; styles: string[] }>('/artists');
  const styles = all.data?.styles || [];

  const pick = (s: string) => {
    const p = new URLSearchParams(params);
    if (s) p.set('style', s);
    else p.delete('style');
    setParams(p, { replace: true });
  };

  return (
    <div>
      <PageHead back="/" title="Artistas" />
      <div className="relative">
        <Search size={22} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input min-h-[56px] pl-14" placeholder="Buscar artista" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar artista" type="search" />
      </div>
      <div className="no-scrollbar -mx-6 mt-4 flex gap-2 overflow-x-auto px-6 md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="Filtrar por estilo">
        <button role="tab" aria-selected={!style} className={`chip ${!style ? 'chip-on' : ''}`} onClick={() => pick('')}>
          Todos
        </button>
        {styles.map((s) => (
          <button key={s} role="tab" aria-selected={style === s} className={`chip ${style === s ? 'chip-on' : ''}`} onClick={() => pick(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading && !data && <Loading />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {data && data.artists.length === 0 && (
          <Empty icon={SearchX} title="Nenhum artista encontrado" text="Tente outro nome ou estilo." />
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {data?.artists.map((a) => (
            <ArtistCard key={a.id} artist={a} />
          ))}
        </div>
      </div>
    </div>
  );
}
