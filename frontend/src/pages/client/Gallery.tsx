import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Heart, Images, MessageCircle, Trash2 } from 'lucide-react';
import { api, apiUrl, downloadUrl, photoUrl, useApi, type GalleryPhoto, type PhotoComment } from '../../api';
import { deviceId, getSavedName, getSavedPhone, isValidPhone, maskPhone, saveClient } from '../../client';
import { Avatar, Empty, ErrorBox, Field, FormError, Lightbox, Loading, PageHead, Sheet, toast } from '../../ui';
import { fmtDateTime } from '../../util';

/** Comentários de uma foto: lista + formulário (celular e nome identificam quem comenta). */
function CommentsSheet({ photo, onClose, onCount }: { photo: GalleryPhoto; onClose: () => void; onCount: (n: number) => void }) {
  const [list, setList] = useState<PhotoComment[] | null>(null);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState(getSavedPhone);
  const [name, setName] = useState(getSavedName);
  const [textValue, setTextValue] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const hasPhone = !!getSavedPhone();

  useEffect(() => {
    const p = getSavedPhone();
    api
      .get<{ comments: PhotoComment[] }>(`/gallery/${photo.id}/comments${p ? `?phone=${encodeURIComponent(p)}` : ''}`)
      .then((r) => setList(r.comments))
      .catch((e) => setError((e as Error).message));
  }, [photo.id]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!textValue.trim()) return setErr('Escreva o comentário');
    if (!name.trim()) return setErr('Informe seu nome');
    if (!isValidPhone(phone)) return setErr('Informe o celular com DDD');
    setBusy(true);
    try {
      const r = await api.post<{ comments: PhotoComment[] }>(`/gallery/${photo.id}/comments`, { phone, name, text: textValue });
      saveClient(phone, name);
      setList(r.comments);
      onCount(r.comments.length);
      setTextValue('');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: PhotoComment) {
    if (!confirm('Apagar seu comentário?')) return;
    try {
      await api.del(`/gallery/comments/${c.id}?phone=${encodeURIComponent(getSavedPhone())}`);
      const next = (list || []).filter((x) => x.id !== c.id);
      setList(next);
      onCount(next.length);
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Comentários">
      <p className="-mt-3 mb-4 text-sm text-muted">Trabalho de {photo.artist.name}</p>
      {!list && !error && <Loading />}
      {error && <ErrorBox message={error} />}
      {list && list.length === 0 && <p className="mb-4 rounded-2xl bg-surface2 p-4 text-muted">Seja o primeiro a comentar.</p>}
      <ul className="mb-4 flex flex-col gap-3">
        {list?.map((c) => (
          <li key={c.id} className="flex items-start gap-3">
            <Avatar name={c.name} size="sm" src={apiUrl(c.avatar)} />
            <div className="min-w-0 flex-1 rounded-2xl bg-surface2 px-4 py-3">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-bold">{c.name}</span>
                <span className="text-sm text-muted">{fmtDateTime(c.createdAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-soft">{c.text}</p>
            </div>
            {c.mine && (
              <button className="flex h-11 w-11 shrink-0 items-center justify-center text-muted" aria-label="Apagar comentário" onClick={() => remove(c)}>
                <Trash2 size={18} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={send} className="grid gap-3 border-t border-line pt-4">
        {(!hasPhone || !getSavedName()) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Seu nome">
              <input className="input" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {!hasPhone && (
              <Field label="Celular" hint="Não aparece para ninguém">
                <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 91234-5678" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
              </Field>
            )}
          </div>
        )}
        <Field label={hasPhone && getSavedName() ? `Comentar como ${getSavedName()}` : 'Comentário'}>
          <textarea className="input min-h-[80px] resize-y" maxLength={500} value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="Escreva um comentário…" />
        </Field>
        <FormError message={err} />
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Enviando…' : 'Comentar'}
        </button>
      </form>
    </Sheet>
  );
}

/** Galeria do estúdio: trabalhos de todos os artistas, com filtro, curtidas, comentários e download. */
export default function Gallery() {
  const [params, setParams] = useSearchParams();
  const artistId = params.get('artist') || '';
  const voter = deviceId();
  const { data, error, loading, reload, setData } = useApi<{ photos: GalleryPhoto[] }>(`/gallery?voter=${voter}`);
  const [open, setOpen] = useState<number | null>(null);
  const [commentsFor, setCommentsFor] = useState<GalleryPhoto | null>(null);

  const all = data?.photos || [];
  const artists = [...new Map(all.map((p) => [p.artist.id, p.artist])).values()];
  const list = artistId ? all.filter((p) => p.artist.id === artistId) : all;
  const current = open !== null ? list[open] : null;

  const patch = (id: string, changes: Partial<GalleryPhoto>) =>
    setData((d) => d && { photos: d.photos.map((p) => (p.id === id ? { ...p, ...changes } : p)) });

  async function like(p: GalleryPhoto) {
    // Atualiza na hora; corrige com a resposta do servidor.
    patch(p.id, { liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) });
    try {
      const r = await api.post<{ liked: boolean; likes: number }>(`/gallery/${p.id}/like`, { voter });
      patch(p.id, r);
    } catch (e) {
      patch(p.id, { liked: p.liked, likes: p.likes });
      toast((e as Error).message, true);
    }
  }

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
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-[16px] bg-surface2">
            <button onClick={() => setOpen(i)} className="block h-full w-full" aria-label={`Ampliar trabalho de ${p.artist.name}`}>
              <img src={photoUrl(p.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-1 bg-gradient-to-t from-black/85 to-transparent pl-3 pt-8">
              <span className="min-w-0 flex-1 truncate pb-2.5 text-sm font-medium">{p.artist.name}</span>
              <button
                onClick={() => like(p)}
                aria-label={p.liked ? 'Descurtir' : 'Curtir'}
                aria-pressed={p.liked}
                className="pointer-events-auto flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 px-2 text-sm"
              >
                <Heart size={18} className={p.liked ? 'text-accent' : ''} fill={p.liked ? 'currentColor' : 'none'} />
                {p.likes > 0 && p.likes}
              </button>
            </div>
          </div>
        ))}
      </div>

      {current && open !== null && (
        <Lightbox
          urls={list.map((p) => photoUrl(p.id))}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          caption={
            <div className="rounded-2xl bg-surface p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{current.artist.name}</p>
                  <p className="truncate text-sm text-muted">{current.artist.style}</p>
                </div>
                <Link to={`/artistas/${current.artist.id}`} className="btn-pill min-h-[44px] px-4 text-sm">
                  {current.artist.available ? 'Agendar' : 'Ver perfil'}
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                <button onClick={() => like(current)} aria-pressed={current.liked} className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-surface2 text-sm font-medium">
                  <Heart size={18} className={current.liked ? 'text-accent' : ''} fill={current.liked ? 'currentColor' : 'none'} />
                  {current.likes || 'Curtir'}
                </button>
                <button onClick={() => setCommentsFor(current)} className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-surface2 text-sm font-medium">
                  <MessageCircle size={18} /> {current.comments || 'Comentar'}
                </button>
                <a href={downloadUrl(current.id)} download className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-surface2 text-sm font-medium">
                  <Download size={18} /> Baixar
                </a>
              </div>
            </div>
          }
        />
      )}

      {commentsFor && <CommentsSheet photo={commentsFor} onClose={() => setCommentsFor(null)} onCount={(n) => patch(commentsFor.id, { comments: n })} />}
    </div>
  );
}
