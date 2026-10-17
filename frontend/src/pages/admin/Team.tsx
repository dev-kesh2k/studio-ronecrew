import { useEffect, useState } from 'react';
import { Camera, ImagePlus, Plus, Star, Trash2, Users } from 'lucide-react';
import { api, avatarUrl, photoUrl, useApi, type Artist, type Service } from '../../api';
import { Avatar, Checkbox, Empty, ErrorBox, Field, FormError, Loading, PageHead, Sheet, Switch, toast } from '../../ui';
import { resizeImage, squareImage } from '../../util';

type Form = { name: string; style: string; years: string; bio: string; available: boolean; unavailableNote: string; serviceIds: string[] };
const blank: Form = { name: '', style: '', years: '0', bio: '', available: true, unavailableNote: '', serviceIds: [] };

export default function Team() {
  const { data, error, loading, reload, setData } = useApi<{ artists: Artist[] }>('/admin/artists');
  const services = useApi<{ services: Service[] }>('/admin/services');
  const [editing, setEditing] = useState<Artist | 'new' | null>(null);
  const [f, setF] = useState<Form>(blank);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const current = editing && editing !== 'new' ? data?.artists.find((a) => a.id === editing.id) || editing : null;

  useEffect(() => {
    setErr('');
    if (editing === 'new') setF(blank);
    else if (editing)
      setF({
        name: editing.name,
        style: editing.style,
        years: String(editing.years),
        bio: editing.bio,
        available: editing.available,
        unavailableNote: editing.unavailableNote,
        serviceIds: editing.services.map((s) => s.id),
      });
  }, [editing]);

  async function toggle(a: Artist, available: boolean) {
    setData((d) => d && { artists: d.artists.map((x) => (x.id === a.id ? { ...x, available } : x)) });
    try {
      await api.patch(`/admin/artists/${a.id}/available`, { available });
      toast(available ? `${a.name} disponível para agendamento` : `${a.name} fora da agenda`);
      reload();
    } catch (e) {
      toast((e as Error).message, true);
      reload();
    }
  }

  async function save() {
    setBusy(true);
    setErr('');
    try {
      const body = { ...f, years: Number(f.years) || 0 };
      if (editing === 'new') {
        const r = await api.post<{ artist: Artist }>('/admin/artists', body);
        toast('Artista adicionado. Agora você pode subir fotos do portfólio.');
        const fresh = await api.get<{ artists: Artist[] }>('/admin/artists');
        setData(fresh);
        setEditing(fresh.artists.find((a) => a.id === r.artist.id) || null);
      } else if (editing) {
        await api.put(`/admin/artists/${editing.id}`, body);
        toast('Artista atualizado');
        setEditing(null);
        reload();
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!current || !confirm(`Excluir ${current.name}?`)) return;
    try {
      await api.del(`/admin/artists/${current.id}`);
      toast('Artista excluído');
      setEditing(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function addPhoto(file?: File) {
    if (!file || !current) return;
    try {
      await api.post(`/admin/artists/${current.id}/photos`, { image: await resizeImage(file, 1600) });
      toast('Foto adicionada');
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  async function setAvatar(file?: File) {
    if (!file || !current) return;
    setAvatarBusy(true);
    try {
      await api.post(`/admin/artists/${current.id}/avatar`, { image: await squareImage(file, 512) });
      toast('Foto atualizada');
      await reload();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    if (!current || !confirm('Remover a foto? Voltam a aparecer as iniciais.')) return;
    setAvatarBusy(true);
    try {
      await api.del(`/admin/artists/${current.id}/avatar`);
      toast('Foto removida');
      await reload();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function delPhoto(id: string) {
    if (!confirm('Remover esta foto?')) return;
    try {
      await api.del(`/admin/photos/${id}`);
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  const list = data?.artists || [];
  const avail = list.filter((a) => a.available).length;

  return (
    <div>
      <PageHead
        title="Equipe"
        subtitle={data ? `${list.length} ${list.length === 1 ? 'artista' : 'artistas'} · ${avail} ${avail === 1 ? 'disponível' : 'disponíveis'} para agendamento` : undefined}
        action={
          <button className="btn-pill" onClick={() => setEditing('new')}>
            <Plus size={22} /> Artista
          </button>
        }
      />
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && list.length === 0 && <Empty icon={Users} title="Nenhum artista" text="Cadastre a equipe para liberar o agendamento." />}
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((a) => (
          <div key={a.id} className="card p-4 min-[380px]:p-5 sm:p-6">
            <div className="flex items-center gap-3 min-[380px]:gap-4">
              <div className={a.available ? '' : 'opacity-60'}>
                <Avatar name={a.name} size="lg" src={avatarUrl(a)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-lg font-bold ${a.available ? '' : 'text-soft'}`}>{a.name}</p>
                <p className="text-base text-muted">
                  {a.available ? a.services.map((s) => s.name).join(' · ') || a.style : [a.style, a.unavailableNote || 'Indisponível'].join(' · ')}
                </p>
              </div>
              <Switch checked={a.available} onChange={(v) => toggle(a, v)} label={`Disponível para agendamento: ${a.name}`} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-4">
              <span className="text-base">
                {a.weekSessions} {a.weekSessions === 1 ? 'sessão' : 'sessões'} na semana
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Star size={18} className="text-accent" fill="currentColor" />
                {a.rating ? a.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : '–'}
              </span>
              <button className="ml-auto min-h-[44px] text-base font-bold text-accent" onClick={() => setEditing(a)}>
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo artista' : 'Editar artista'}>
        <div className="grid gap-4">
          {current ? (
            <div className="flex items-center gap-4">
              <Avatar name={current.name} size="lg" accent src={avatarUrl(current)} />
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                <label className={`btn-secondary min-h-[44px] cursor-pointer px-4 text-sm ${avatarBusy ? 'pointer-events-none opacity-50' : ''}`}>
                  <Camera size={18} /> {current.avatarVersion ? 'Trocar foto' : 'Adicionar foto'}
                  <input type="file" accept="image/*" className="sr-only" aria-label="Foto do artista" onChange={(e) => setAvatar(e.target.files?.[0])} />
                </label>
                {current.avatarVersion && (
                  <button type="button" className="min-h-[44px] px-2 text-sm font-bold text-accent" disabled={avatarBusy} onClick={removeAvatar}>
                    Remover
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl bg-surface2 px-4 py-3 text-sm text-muted">Salve o artista para adicionar a foto de avatar e o portfólio.</p>
          )}
          <Field label="Nome">
            <input className="input" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label="Estilo principal">
              <input className="input" maxLength={40} placeholder="Ex.: Fine line" value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })} />
            </Field>
            <Field label="Anos">
              <input className="input" inputMode="numeric" value={f.years} onChange={(e) => setF({ ...f, years: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
            </Field>
          </div>
          <Field label="Sobre">
            <textarea className="input min-h-[90px]" maxLength={1000} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface2 px-4 py-3">
            <span>Disponível para agendamento</span>
            <Switch checked={f.available} onChange={(v) => setF({ ...f, available: v })} label="Disponível para agendamento" />
          </div>
          {!f.available && (
            <Field label="Aviso para os clientes">
              <input className="input" maxLength={80} placeholder="Ex.: De férias até 30 out" value={f.unavailableNote} onChange={(e) => setF({ ...f, unavailableNote: e.target.value })} />
            </Field>
          )}
          <div>
            <span className="label">Serviços que faz</span>
            <div className="grid gap-1">
              {services.data?.services.map((s) => {
                const on = f.serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setF({ ...f, serviceIds: on ? f.serviceIds.filter((x) => x !== s.id) : [...f.serviceIds, s.id] })}
                    className="flex min-h-[48px] items-center gap-3 text-left"
                  >
                    <Checkbox on={on} />
                    <span className={s.active ? '' : 'text-muted'}>
                      {s.name}
                      {!s.active && ' (inativo)'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {current && (
            <div>
              <span className="label">Portfólio ({current.photos.length}/12)</span>
              <div className="grid grid-cols-4 gap-2">
                {current.photos.map((p) => (
                  <div key={p} className="relative aspect-square overflow-hidden rounded-[14px] bg-surface2">
                    <img src={photoUrl(p)} alt="" className="h-full w-full object-cover" />
                    <button className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-bg/80" aria-label="Remover foto" onClick={() => delPhoto(p)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {current.photos.length < 12 && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-line2 text-sm text-muted">
                    <ImagePlus size={22} /> Foto
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => addPhoto(e.target.files?.[0])} />
                  </label>
                )}
              </div>
            </div>
          )}

          <FormError message={err} />
          <button className="btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
          {current && (
            <button className="btn-danger" onClick={remove}>
              Excluir artista
            </button>
          )}
        </div>
      </Sheet>
    </div>
  );
}
