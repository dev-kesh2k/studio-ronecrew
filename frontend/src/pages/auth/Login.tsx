import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Phone, User as UserIcon } from 'lucide-react';
import { api, type User } from '../../api';
import { useAuth } from '../../auth';
import { Logo } from '../../layout';
import { FormError, IconInput, PasswordInput } from '../../ui';

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <div className="mx-auto w-full max-w-md px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
        <Logo />
        <h1 className="h1 mt-10">{title}</h1>
        <p className="mt-2 text-base text-muted">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

export function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ token: string; user: User }>('/auth/login', { login, password });
      signIn(r.token, r.user);
      nav(r.user.role === 'admin' ? '/admin' : '/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Entrar" subtitle="Acesse para agendar e acompanhar suas sessões.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <IconInput icon={Mail} placeholder="E-mail ou telefone" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required aria-label="E-mail ou telefone" />
        <PasswordInput icon={Lock} placeholder="Senha" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required aria-label="Senha" />
        <div className="-mt-1 flex justify-end">
          <Link to="/esqueci" className="flex min-h-[44px] items-center text-base font-medium text-accent">
            Esqueci minha senha
          </Link>
        </div>
        <FormError message={error} />
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <div className="my-6 flex items-center gap-4 text-muted">
        <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
      </div>
      <Link to="/cadastro" className="btn-secondary w-full">
        Criar conta
      </Link>
      <p className="mt-6 text-center text-base text-muted">
        Não tem conta?{' '}
        <Link to="/cadastro" className="font-bold text-accent">
          Cadastre-se
        </Link>
      </p>
    </AuthFrame>
  );
}

export function Register() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ token: string; user: User }>('/auth/register', f);
      signIn(r.token, r.user);
      nav('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Criar conta" subtitle="Leva menos de um minuto.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <IconInput icon={UserIcon} placeholder="Nome completo" autoComplete="name" value={f.name} onChange={set('name')} required aria-label="Nome completo" />
        <IconInput icon={Mail} type="email" inputMode="email" placeholder="E-mail" autoComplete="email" value={f.email} onChange={set('email')} required aria-label="E-mail" />
        <IconInput icon={Phone} type="tel" inputMode="tel" placeholder="Telefone (WhatsApp)" autoComplete="tel" value={f.phone} onChange={set('phone')} required aria-label="Telefone" />
        <PasswordInput icon={Lock} placeholder="Senha (mín. 8 caracteres)" autoComplete="new-password" minLength={8} value={f.password} onChange={set('password')} required aria-label="Senha" />
        <FormError message={error} />
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Criando…' : 'Cadastrar'}
        </button>
      </form>
      <p className="mt-6 text-center text-base text-muted">
        Já tem conta?{' '}
        <Link to="/login" className="font-bold text-accent">
          Entrar
        </Link>
      </p>
    </AuthFrame>
  );
}
