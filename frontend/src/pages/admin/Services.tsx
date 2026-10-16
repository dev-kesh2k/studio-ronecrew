import { useEffect, useState } from 'react';
import { Pencil, Plus, Tag } from 'lucide-react';
import { api, useApi, type Artist, type Service } from '../../api';
import { reloadConfig, useConfig } from '../../config';
import { Checkbox, Empty, ErrorBox, Field, FormError, Loading, PageHead, ServiceIcon, SERVICE_ICON_KEYS, Sheet, Switch, toast } from '../../ui';
import { brl, duration, firstName, moneyInput, parseMoney, priceFrom } from '../../util';

type Form = { name: string; description: string; price: string; durationMin: string; icon: string; active: boolean; artistIds: string[] };
const blank: Form = { name: '', description: '', price: '', durationMin: '60', icon: 'pen', active: true, artistIds: [] };
const DURATIONS = [30, 45, 60, 90, 120, 180, 240, 300, 360, 480];

export default function Services() {
  const config = useConfig();
  const { data, error, loading, reload, setData } = useApi<{ services: Service[] }>('/admin/services');
  const artists = useApi<{ artists: Artist[] }>('/admin/artists');
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [f, setF] = useState<Form>(blank);
  const [depOpen, setDepOpen] = useState(false);
  const [dep, setDep] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setErr('');
    if (editing === 'new') setF(blank);
    else if (editing)
      setF({
        name: editing.name,
        description: editing.description,
        price: moneyInput(editing.priceCents),
        durationMin: String(editing.durationMin),
        icon: editing.icon,
        active: editing.active,
        artistIds: (editing.artists || []).map((a) => a.id),
      });
  }, [editing]);

  async function toggle(s: Service, active: boolean) {
    setData((d) => d && { services: d.services.map((x) => (x.id === s.id ? { ...x, active } : x)) });
    try {
      await api.patch(`/admin/services/${s.id}/active`, { active });
      toast(active ? `${s.name} visível para clientes` : `${s.name} oculto dos clientes`);
    } catch (e) {
      toast((e as Error).message, true);
      reload();
    }
  }

  async function save() {
    const priceCents = parseMoney(f.price);
    if (priceCents === null) return setErr('Informe o preço (0 para grátis)');
    setBusy(true);
    setErr('');
    try {
      const body = { ...f, priceCents, durationMin: Number(f.durationMin) };
      if (editing === 'new') await api.post('/admin/services', body);
      else if (editing) await api.put(`/admin/services/${editing.id}`, body);
      toast('Serviço salvo');
      setEditing(null);
      reload();
      artists.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing || editing === 'new' || !confirm(`Excluir ${editing.name}?`)) return;
    try {
      await api.del(`/admin/services/${editing.id}`);
      toast('Serviço excluído');
      setEditing(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function saveDeposit() {
    const cents = parseMoney(dep);
    if (cents === null) return setErr('Informe o valor do sinal');
    setBusy(true);
    setErr('');
    try {
      const { settings } = await api.get<{ settings: Record<string, unknown> }>('/admin/settings');
      await api.put('/admin/settings', { ...settings, depositCents: cents });
      await reloadConfig();
      toast('Valor do sinal atualizado');
      setDepOpen(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHead
        title="Serviços e preços"
        subtitle={
          config && (
            <button
              className="inline-flex min-h-[44px] items-center gap-2 text-left"
              onClick={() => {
                setDep(moneyInput(config.depositCents));
                setErr('');
                setDepOpen(true);
              }}
            >
              Valor do sinal padrão: {brl(config.depositCents)} por sessão <Pencil size={16} className="shrink-0 text-accent" />
            </button>
          )
        }
        action={
          <button className="btn-pill" onClick={() => setEditing('new')}>
            <Plus size={22} /> Novo
          </button>
        }
      />
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.services.length === 0 && <Empty icon={Tag} title="Nenhum serviço" text="Cadastre os serviços que o estúdio oferece." />}
      <div className="grid gap-3 lg:grid-cols-2">
        {data?.services.map((s) => (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => setEditing(s)}
            onKeyDown={(e) => e.key === 'Enter' && setEditing(s)}
            className="card flex cursor-pointer items-center gap-3 p-4 transition active:scale-[0.99] min-[380px]:gap-4 min-[380px]:p-5 sm:p-6"
          >
            <ServiceIcon icon={s.icon} active={s.active} />
            <div className="min-w-0 flex-1">
              <p className={`text-lg font-bold ${s.active ? '' : 'text-soft'}`}>{s.name}</p>
              <p className="text-base text-muted">
                Cerca de {duration(s.durationMin)}
                {s.artists?.length ? ` · ${s.artists.map((a) => firstName(a.name)).join(', ')}` : ' · sem artista'}
              </p>
              <p className={`mt-0.5 text-lg font-bold ${s.active ? 'text-accent' : 'text-soft'}`}>{priceFrom(s.priceCents)}</p>
            </div>
            <Switch checked={s.active} onChange={(v) => toggle(s, v)} label={`Serviço ativo: ${s.name}`} />
          </div>
        ))}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo serviço' : 'Editar serviço'}>
        <div className="grid gap-4">
          <Field label="Nome">
            <input className="input" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Descrição">
            <input className="input" maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="A partir de (R$)">
              <input className="input" inputMode="decimal" placeholder="0" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
            </Field>
            <Field label="Duração">
              <select className="input" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })}>
                {[...new Set([...DURATIONS, Number(f.durationMin)])]
                  .sort((a, b) => a - b)
                  .map((d) => (
                    <option key={d} value={d}>
                      {duration(d)}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <div>
            <span className="label">Ícone</span>
            <div className="flex flex-wrap gap-2">
              {SERVICE_ICON_KEYS.map((k) => (
                <button key={k} type="button" aria-label={`Ícone ${k}`} aria-pressed={f.icon === k} onClick={() => setF({ ...f, icon: k })} className={`rounded-[16px] border-2 ${f.icon === k ? 'border-accent' : 'border-transparent'}`}>
                  <ServiceIcon icon={k} size="sm" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface2 px-4 py-3">
            <span>Visível para clientes</span>
            <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Visível para clientes" />
          </div>
          <div>
            <span className="label">Artistas que fazem</span>
            {artists.data?.artists.map((a) => {
              const on = f.artistIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setF({ ...f, artistIds: on ? f.artistIds.filter((x) => x !== a.id) : [...f.artistIds, a.id] })}
                  className="flex min-h-[48px] w-full items-center gap-3 text-left"
                >
                  <Checkbox on={on} /> {a.name}
                </button>
              );
            })}
          </div>
          <FormError message={err} />
          <button className="btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
          {editing && editing !== 'new' && (
            <button className="btn-danger" onClick={remove}>
              Excluir serviço
            </button>
          )}
        </div>
      </Sheet>

      <Sheet open={depOpen} onClose={() => setDepOpen(false)} title="Valor do sinal">
        <Field label="Sinal por sessão (R$)" hint="Descontado do valor final. Use 0 para não cobrar sinal.">
          <input className="input" inputMode="decimal" value={dep} onChange={(e) => setDep(e.target.value)} />
        </Field>
        <div className="mt-4">
          <FormError message={err} />
        </div>
        <button className="btn-primary mt-4 w-full" disabled={busy} onClick={saveDeposit}>
          Salvar
        </button>
      </Sheet>
    </div>
  );
}
