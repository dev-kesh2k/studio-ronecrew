import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Camera, ChevronRight, CircleHelp, Droplet, Heart, Info, Lock, MessageSquareHeart, Smartphone } from 'lucide-react';
import { api, apiUrl } from '../../api';
import { forgetClient, getSavedName, getSavedPhone, isValidPhone, maskPhone, saveClient } from '../../client';
import { Avatar, Field, FormError, PageHead, Sheet, toast } from '../../ui';
import { squareImage } from '../../util';

const MENU = [
  { to: '/agenda', label: 'Meus agendamentos', icon: CalendarDays },
  { to: '/perfil/favoritos', label: 'Artistas favoritos', icon: Heart },
  { to: '/sobre', label: 'Sobre o estúdio', icon: Info },
  { to: '/perfil/feedback', label: 'Enviar feedback', icon: MessageSquareHeart },
  { to: '/perfil/cuidados', label: 'Cuidados pós-tattoo', icon: Droplet },
  { to: '/perfil/ajuda', label: 'Ajuda e suporte', icon: CircleHelp },
];

interface ClientProfile {
  name: string;
  avatar: string | null;
}

export default function Profile() {
  const [phone, setPhone] = useState(getSavedPhone);
  const [name, setName] = useState(getSavedName);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ phone: '', name: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!phone) {
      setProfile(null);
      return;
    }
    let alive = true;
    api
      .get<{ profile: ClientProfile }>(`/client-profile?phone=${encodeURIComponent(phone)}`)
      .then((r) => {
        if (!alive) return;
        setProfile(r.profile);
        // O nome salvo em outro aparelho (ou num comentário) vale aqui também.
        if (!getSavedName() && r.profile.name) {
          saveClient(phone, r.profile.name);
          setName(r.profile.name);
        }
      })
      .catch(() => alive && setProfile(null));
    return () => {
      alive = false;
    };
  }, [phone]);

  function edit() {
    setF({ phone, name });
    setErr('');
    setOpen(true);
  }

  async function save() {
    if (!isValidPhone(f.phone)) return setErr('Informe o celular com DDD, ex.: (11) 91234-5678');
    setBusy(true);
    try {
      const r = await api.put<{ profile: ClientProfile }>('/client-profile', { phone: f.phone, name: f.name });
      saveClient(f.phone, f.name);
      setPhone(getSavedPhone());
      setName(getSavedName());
      setProfile(r.profile);
      setOpen(false);
      toast('Dados salvos');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changeAvatar(file?: File) {
    if (!file) return;
    if (!phone) {
      edit();
      return toast('Informe seu celular para salvar a foto', true);
    }
    setBusy(true);
    try {
      const r = await api.post<{ profile: ClientProfile }>('/client-profile/avatar', { phone, image: await squareImage(file, 512) });
      setProfile(r.profile);
      toast('Foto atualizada');
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    if (!confirm('Remover sua foto?')) return;
    try {
      const r = await api.del<{ profile: ClientProfile }>(`/client-profile/avatar?phone=${encodeURIComponent(phone)}`);
      setProfile(r.profile);
      toast('Foto removida');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  function forget() {
    forgetClient();
    setPhone('');
    setName('');
    setProfile(null);
    toast('Celular removido deste aparelho');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="Perfil" />
      <div className="card flex items-center gap-4 p-5 min-[380px]:p-6">
        <label className={`relative shrink-0 cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`} aria-label="Trocar foto do perfil">
          <Avatar name={name || 'Você'} size="lg" accent src={apiUrl(profile?.avatar)} />
          <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-accent text-bg">
            <Camera size={16} />
          </span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => changeAvatar(e.target.files?.[0])} />
        </label>
        <button onClick={edit} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1">
            {phone ? (
              <>
                <span className="block break-words text-xl font-bold">{name || 'Seu perfil'}</span>
                <span className="block text-base text-muted">{phone}</span>
              </>
            ) : (
              <>
                <span className="block text-xl font-bold">Sem celular salvo</span>
                <span className="block text-base text-muted">Toque para informar</span>
              </>
            )}
          </span>
          <ChevronRight size={20} className="shrink-0 text-soft" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 px-1">
        <p className="text-sm text-muted">Sem cadastro: seu celular identifica seus agendamentos.</p>
        {profile?.avatar && (
          <button className="min-h-[40px] text-sm font-bold text-accent" onClick={removeAvatar}>
            Remover foto
          </button>
        )}
      </div>

      <nav className="card mt-5 py-2" aria-label="Opções">
        {MENU.map((m) => (
          <Link key={m.to} to={m.to} className="flex min-h-[60px] items-center gap-4 px-5 py-2 text-base transition active:bg-surface2 min-[380px]:px-6 min-[380px]:text-lg">
            <m.icon size={24} className="shrink-0" />
            <span className="min-w-0 flex-1">{m.label}</span>
            <ChevronRight size={20} className="shrink-0 text-soft" />
          </Link>
        ))}
      </nav>

      {phone && (
        <button onClick={forget} className="card mt-5 flex min-h-[60px] w-full items-center gap-4 px-5 py-2 text-left text-base text-accent min-[380px]:px-6">
          <Smartphone size={22} /> Esquecer meu celular neste aparelho
        </button>
      )}

      <Link to="/admin" className="mt-8 flex min-h-[44px] items-center justify-center gap-2 text-sm text-muted">
        <Lock size={16} /> Área do estúdio
      </Link>

      <Sheet open={open} onClose={() => setOpen(false)} title="Seus dados">
        <div className="grid gap-4">
          <Field label="Celular (WhatsApp) *">
            <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 91234-5678" value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} />
          </Field>
          <Field label="Nome" hint="Aparece nos seus comentários e avaliações">
            <input className="input" autoComplete="name" maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <FormError message={err} />
          <button className="btn-primary" disabled={busy} onClick={save}>
            Salvar
          </button>
        </div>
      </Sheet>
    </div>
  );
}
