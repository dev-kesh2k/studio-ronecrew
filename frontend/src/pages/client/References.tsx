import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Image, ImagePlus, Trash2 } from 'lucide-react';
import { api, useApi } from '../../api';
import { Empty, ErrorBox, Field, FormError, Loading, PageHead, Sheet, toast } from '../../ui';
import { fmtDate, resizeImage } from '../../util';
import { RefThumb } from './BookingDetail';

interface Ref {
  id: string;
  note: string;
  bookingId: string | null;
  createdAt: string;
  booking: { date: string; service: { name: string } } | null;
}

export default function References() {
  const { data, error, loading, reload } = useApi<{ references: Ref[] }>('/references');
  const [img, setImg] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(file?: File) {
    if (!file) return;
    try {
      setImg(await resizeImage(file));
      setNote('');
      setErr('');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  async function save() {
    setBusy(true);
    setErr('');
    try {
      await api.post('/references', { image: img, note });
      setImg(null);
      toast('Referência salva');
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta referência?')) return;
    try {
      await api.del(`/references/${id}`);
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  const add = (
    <label className="btn-pill cursor-pointer">
      <ImagePlus size={20} /> <span className="hidden min-[380px]:inline">Adicionar</span>
      <input type="file" accept="image/*" className="sr-only" aria-label="Adicionar referência" onChange={(e) => pick(e.target.files?.[0])} />
    </label>
  );

  return (
    <div>
      <PageHead back="/perfil" title="Referências" subtitle="Imagens de inspiração para mostrar ao artista." action={add} />
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.references.length === 0 && <Empty icon={Image} title="Nenhuma referência" text="Adicione fotos de desenhos ou tattoos que você curte." />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data?.references.map((r) => (
          <div key={r.id} className="card overflow-hidden p-2">
            <RefThumb id={r.id} />
            <div className="flex items-start gap-1 px-1 pt-2">
              <div className="min-w-0 flex-1">
                {r.note && <p className="line-clamp-2 break-words text-sm">{r.note}</p>}
                {r.booking ? (
                  <Link to={`/agenda/${r.bookingId}`} className="block truncate text-sm text-accent">
                    {r.booking.service.name} · {fmtDate(r.booking.date)}
                  </Link>
                ) : (
                  <p className="text-sm text-muted">{fmtDate(r.createdAt.slice(0, 10))}</p>
                )}
              </div>
              <button className="flex h-11 w-11 shrink-0 items-center justify-center text-muted" aria-label="Excluir referência" onClick={() => remove(r.id)}>
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!img} onClose={() => setImg(null)} title="Nova referência">
        {img && <img src={img} alt="" className="mb-4 max-h-[40dvh] w-full rounded-2xl object-contain" />}
        <Field label="Descrição (opcional)">
          <input className="input" maxLength={300} placeholder="Ex.: quero algo nesse traço" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="mt-4">
          <FormError message={err} />
        </div>
        <button className="btn-primary mt-4 w-full" disabled={busy} onClick={save}>
          {busy ? 'Enviando…' : 'Salvar referência'}
        </button>
      </Sheet>
    </div>
  );
}
