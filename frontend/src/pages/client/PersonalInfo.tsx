import { useState, type FormEvent } from 'react';
import { api, type User } from '../../api';
import { useAuth } from '../../auth';
import { Field, FormError, PageHead, PasswordInput, toast } from '../../ui';

export default function PersonalInfo() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const [pw, setPw] = useState({ current: '', password: '' });
  const [err, setErr] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdmin = user?.role === 'admin';

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api.put<{ user: User }>('/me', f);
      setUser(r.user);
      toast('Dados atualizados');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changePw(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPwErr('');
    try {
      await api.put('/me/password', pw);
      setPw({ current: '', password: '' });
      toast(isAdmin ? 'Senha alterada. Atualize também a entrada no Cofre do Hub.' : 'Senha alterada');
    } catch (e2) {
      setPwErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead back={isAdmin ? '/admin/config' : '/perfil'} title="Informações pessoais" />
      <form onSubmit={save} className="card grid gap-4 p-5">
        <Field label="Nome">
          <input className="input" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        </Field>
        <Field label="E-mail">
          <input className="input" type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        </Field>
        <Field label="Telefone (WhatsApp)">
          <input className="input" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required={!isAdmin} />
        </Field>
        <FormError message={err} />
        <button className="btn-primary" disabled={busy}>
          Salvar
        </button>
      </form>

      <h2 className="h2 mb-3 mt-8">Alterar senha</h2>
      <form onSubmit={changePw} className="card grid gap-4 p-5">
        <Field label="Senha atual">
          <PasswordInput autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
        </Field>
        <Field label="Nova senha" hint="Mínimo de 8 caracteres">
          <PasswordInput autoComplete="new-password" minLength={8} value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required />
        </Field>
        <FormError message={pwErr} />
        <button className="btn-secondary" disabled={busy}>
          Alterar senha
        </button>
      </form>
    </div>
  );
}
