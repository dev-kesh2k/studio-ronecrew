import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LogOut, User } from 'lucide-react';
import { api, useApi } from '../../api';
import { useAuth } from '../../auth';
import { reloadConfig } from '../../config';
import { ErrorBox, Field, FormError, Loading, PageHead, toast } from '../../ui';
import { moneyInput, parseMoney } from '../../util';

interface S {
  studioName: string;
  depositCents: number;
  phone: string;
  whatsapp: string;
  address: string;
  instagram: string;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { data, error, loading, reload } = useApi<{ settings: S }>('/admin/settings');
  const [f, setF] = useState<(Omit<S, 'depositCents'> & { deposit: string }) | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      const { depositCents, ...rest } = data.settings;
      setF({ ...rest, deposit: moneyInput(depositCents) });
    }
  }, [data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!f) return;
    const depositCents = parseMoney(f.deposit);
    if (depositCents === null) return setErr('Informe o valor do sinal');
    setBusy(true);
    setErr('');
    try {
      const { deposit: _d, ...rest } = f;
      void _d;
      await api.put('/admin/settings', { ...rest, depositCents });
      await reloadConfig();
      toast('Configurações salvas');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead back="/admin" title="Configurações" />

      <Link to="/admin/conta" className="card mb-6 flex min-h-[64px] items-center gap-4 px-5">
        <User size={22} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Minha conta</span>
          <span className="block truncate text-sm text-muted">{user?.email} · alterar dados e senha</span>
        </span>
        <ChevronRight size={20} className="text-soft" />
      </Link>

      {f && (
        <form onSubmit={save} className="card grid gap-4 p-5">
          <h2 className="h2">Estúdio</h2>
          <Field label="Nome do estúdio">
            <input className="input" maxLength={60} value={f.studioName} onChange={(e) => setF({ ...f, studioName: e.target.value })} required />
          </Field>
          <Field label="Sinal por sessão (R$)" hint="Descontado do valor final. 0 = sem sinal.">
            <input className="input" inputMode="decimal" value={f.deposit} onChange={(e) => setF({ ...f, deposit: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp">
              <input className="input" type="tel" inputMode="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <input className="input" type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Instagram">
            <input className="input" placeholder="@ronecrew" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} />
          </Field>
          <Field label="Endereço">
            <input className="input" maxLength={200} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
          <FormError message={err} />
          <button className="btn-primary" disabled={busy}>
            Salvar
          </button>
        </form>
      )}

      <button onClick={signOut} className="card mt-6 flex min-h-[64px] w-full items-center gap-4 px-5 text-lg text-accent">
        <LogOut size={22} /> Sair
      </button>
    </div>
  );
}
