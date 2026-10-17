import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, CircleHelp, Droplet, Heart, Lock, Smartphone } from 'lucide-react';
import { forgetClient, getSavedName, getSavedPhone, isValidPhone, maskPhone, saveClient } from '../../client';
import { Field, FormError, PageHead, Sheet, toast } from '../../ui';

const MENU = [
  { to: '/agenda', label: 'Meus agendamentos', icon: CalendarDays },
  { to: '/perfil/favoritos', label: 'Artistas favoritos', icon: Heart },
  { to: '/perfil/cuidados', label: 'Cuidados pós-tattoo', icon: Droplet },
  { to: '/perfil/ajuda', label: 'Ajuda e suporte', icon: CircleHelp },
];

export default function Profile() {
  const [phone, setPhone] = useState(getSavedPhone);
  const [name, setName] = useState(getSavedName);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ phone: '', name: '' });
  const [err, setErr] = useState('');

  function edit() {
    setF({ phone, name });
    setErr('');
    setOpen(true);
  }

  function save() {
    if (!isValidPhone(f.phone)) return setErr('Informe o celular com DDD, ex.: (11) 91234-5678');
    saveClient(f.phone, f.name);
    setPhone(getSavedPhone());
    setName(getSavedName());
    setOpen(false);
    toast('Dados salvos neste aparelho');
  }

  function forget() {
    forgetClient();
    setPhone('');
    setName('');
    toast('Celular removido deste aparelho');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead title="Perfil" />
      <button onClick={edit} className="card flex w-full items-center gap-4 p-5 text-left min-[380px]:p-6">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-bg">
          <Smartphone size={26} />
        </span>
        <span className="min-w-0 flex-1">
          {phone ? (
            <>
              <span className="block break-words text-xl font-bold">{name || 'Seu celular'}</span>
              <span className="block text-base text-muted">{phone}</span>
            </>
          ) : (
            <>
              <span className="block text-xl font-bold">Sem celular salvo</span>
              <span className="block text-base text-muted">Toque para informar e ver seus agendamentos</span>
            </>
          )}
        </span>
        <ChevronRight size={20} className="shrink-0 text-soft" />
      </button>
      <p className="mt-2 px-1 text-sm text-muted">Sem cadastro: seu celular identifica seus agendamentos e fica salvo só neste aparelho.</p>

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
          <Field label="Nome (opcional)">
            <input className="input" autoComplete="name" maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <FormError message={err} />
          <button className="btn-primary" onClick={save}>
            Salvar
          </button>
        </div>
      </Sheet>
    </div>
  );
}
