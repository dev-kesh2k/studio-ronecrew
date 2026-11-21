import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, LogOut, Send, User, XCircle } from 'lucide-react';
import { api, API_BASE, useApi, type DaySchedule } from '../../api';
import { useAuth } from '../../auth';
import { reloadConfig } from '../../config';
import { ErrorBox, Field, FormError, Loading, PageHead, PasswordInput, Radio, Switch, toast } from '../../ui';
import { fmtDateTime, moneyInput, parseMoney, resizeImage } from '../../util';

interface S {
  studioName: string;
  depositCents: number;
  phone: string;
  whatsapp: string;
  address: string;
  hours: string;
  schedule: DaySchedule[];
  logoVersion: number;
  about: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
  website: string;
  googleReviewUrl: string;
  waEnabled: string;
  waPhoneNumberId: string;
  waMode: 'text' | 'template';
  waTemplate: string;
  waLanguage: string;
  waNotifyStudio: string;
  waReminders: string;
  waTokenSet: boolean;
  waTokenHint: string;
  waConfigured: boolean;
}
type Form = Omit<S, 'depositCents' | 'waTokenSet' | 'waTokenHint' | 'waConfigured'> & { deposit: string; waToken: string };

interface LogItem {
  id: string;
  to: string;
  event: string;
  text: string;
  status: 'sent' | 'failed';
  error: string;
  createdAt: string;
}

const EVENT: Record<string, string> = {
  test: 'Teste',
  confirmed: 'Confirmação',
  requested: 'Solicitação recebida',
  approved: 'Aprovado',
  rejected: 'Recusado',
  deposit: 'Sinal recebido',
  cancelled: 'Cancelado',
  completed: 'Pedido de avaliação',
  reminder: 'Lembrete',
  studio_booking: 'Estúdio: novo agendamento',
  studio_request: 'Estúdio: nova solicitação',
  studio_cancel: 'Estúdio: cancelamento',
};

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <section className="card grid grid-cols-1 gap-4 p-5 [&>*]:min-w-0">
      <div>
        <h2 className="h2">{title}</h2>
        {hint && <p className="mt-2 text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function ScheduleEditor({ value, onChange }: { value: DaySchedule[]; onChange: (v: DaySchedule[]) => void }) {
  const upd = (i: number, patch: Partial<DaySchedule>) => onChange(value.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  return (
    <div className="grid gap-2">
      {DAY_ORDER.map((i) => {
        const d = value[i];
        return (
          <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex min-h-[44px] w-36 items-center gap-3">
              <Switch checked={d.open} onChange={(v) => upd(i, { open: v })} label={DAY_NAMES[i]} />
              <span className={d.open ? 'font-medium' : 'text-muted'}>{DAY_NAMES[i]}</span>
            </div>
            {d.open ? (
              <div className="flex items-center gap-2">
                <input type="time" className="input w-[7.5rem]" value={d.from} onChange={(e) => upd(i, { from: e.target.value })} aria-label={`Abre ${DAY_NAMES[i]}`} />
                <span className="text-muted">às</span>
                <input type="time" className="input w-[7.5rem]" value={d.to} onChange={(e) => upd(i, { to: e.target.value })} aria-label={`Fecha ${DAY_NAMES[i]}`} />
              </div>
            ) : (
              <span className="text-muted">Fechado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Toggle({ label, hint, on, set }: { label: string; hint?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface2 px-4 py-3">
      <span className="min-w-0">
        <span className="block">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <Switch checked={on} onChange={set} label={label} />
    </div>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { data, error, loading, reload } = useApi<{ settings: S }>('/admin/settings');
  const log = useApi<{ log: LogItem[] }>('/admin/whatsapp/log');
  const [f, setF] = useState<Form | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testErr, setTestErr] = useState('');

  useEffect(() => {
    if (!data) return;
    const { depositCents, waTokenSet: _a, waTokenHint: _b, waConfigured: _c, ...rest } = data.settings;
    void _a;
    void _b;
    void _c;
    setF({ ...rest, deposit: moneyInput(depositCents), waToken: '' });
    setTestTo((t) => t || data.settings.whatsapp);
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error || !data || !f) return <ErrorBox message={error || 'Erro ao carregar'} onRetry={reload} />;
  const s = data.settings;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!f) return;
    const depositCents = parseMoney(f.deposit);
    if (depositCents === null) return setErr('Informe o valor do sinal');
    setBusy(true);
    setErr('');
    try {
      const { deposit: _d, waToken, ...rest } = f;
      void _d;
      // O endereço do app entra nos links das mensagens do WhatsApp.
      const appUrl = `${window.location.origin}${import.meta.env.BASE_URL}`;
      await api.put('/admin/settings', { ...rest, depositCents, appUrl, ...(waToken.trim() ? { waToken: waToken.trim() } : {}) });
      await Promise.all([reloadConfig(), reload()]);
      toast('Configurações salvas');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pickLogo(file?: File) {
    if (!file) return;
    try {
      await api.post('/admin/logo', { image: await resizeImage(file, 512, 'image/png') });
      await Promise.all([reloadConfig(), reload()]);
      toast('Logo atualizada');
    } catch (e2) {
      toast((e2 as Error).message, true);
    }
  }

  async function removeLogo() {
    if (!confirm('Remover a logo?')) return;
    try {
      await api.del('/admin/logo');
      await Promise.all([reloadConfig(), reload()]);
      toast('Logo removida');
    } catch (e2) {
      toast((e2 as Error).message, true);
    }
  }

  async function clearToken() {
    if (!confirm('Remover o token do WhatsApp? As notificações param.')) return;
    try {
      await api.put('/admin/settings', { waTokenClear: true, waEnabled: false });
      toast('Token removido');
      reload();
    } catch (e2) {
      toast((e2 as Error).message, true);
    }
  }

  async function test() {
    setTestErr('');
    try {
      await api.post('/admin/whatsapp/test', { to: testTo });
      toast('Mensagem de teste enviada');
    } catch (e2) {
      setTestErr((e2 as Error).message);
    } finally {
      log.reload();
    }
  }

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

      <form onSubmit={save} className="grid gap-6">
        <Section title="Estúdio">
          <Field label="Logo do app" hint="Aparece no topo do app e na tela de login do estúdio.">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface2">
                {s.logoVersion ? <img src={`${API_BASE}/logo?v=${s.logoVersion}`} alt="Logo" className="h-full w-full object-contain" /> : <span className="text-sm text-muted">Padrão</span>}
              </div>
              <label className="btn-secondary cursor-pointer">
                {s.logoVersion ? 'Trocar logo' : 'Enviar logo'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    void pickLogo(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {s.logoVersion > 0 && (
                <button type="button" className="text-base text-accent" onClick={removeLogo}>
                  Remover
                </button>
              )}
            </div>
          </Field>
          <Field label="Nome do estúdio">
            <input className="input" maxLength={60} value={f.studioName} onChange={(e) => set('studioName', e.target.value)} required />
          </Field>
          <Field label="Sinal por sessão (R$)" hint="Descontado do valor final. 0 = sem sinal.">
            <input className="input" inputMode="decimal" value={f.deposit} onChange={(e) => set('deposit', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp do estúdio" hint="Recebe os avisos de novos agendamentos">
              <input className="input" type="tel" inputMode="tel" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
            </Field>
            <Field label="Telefone">
              <input className="input" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Sobre e localização" hint="Aparece na página Sobre do app, com o mapa e o botão Como chegar.">
          <Field label="Sobre o estúdio">
            <textarea className="input min-h-[120px] resize-y" maxLength={3000} value={f.about} onChange={(e) => set('about', e.target.value)} placeholder="Quem somos, estilos, experiência…" />
          </Field>
          <Field label="Horário de atendimento" hint="Dias e faixa de horário em que os clientes podem agendar (a sessão começa de hora em hora dentro da faixa).">
            <ScheduleEditor value={f.schedule} onChange={(v) => set('schedule', v)} />
          </Field>
          <Field label="Observação do horário (opcional)">
            <textarea className="input min-h-[70px] resize-y" maxLength={300} value={f.hours} onChange={(e) => set('hours', e.target.value)} placeholder="Ex.: feriados sob consulta" />
          </Field>
          <Field label="Endereço completo" hint="Usado no mapa: rua, número, bairro, cidade">
            <input className="input" maxLength={200} value={f.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
        </Section>

        <Section title="Redes sociais" hint="Só aparecem as preenchidas.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Instagram">
              <input className="input" placeholder="@ronecrew" value={f.instagram} onChange={(e) => set('instagram', e.target.value)} />
            </Field>
            <Field label="TikTok">
              <input className="input" placeholder="@ronecrew" value={f.tiktok} onChange={(e) => set('tiktok', e.target.value)} />
            </Field>
          </div>
          <Field label="Facebook (link)">
            <input className="input" type="url" inputMode="url" placeholder="https://facebook.com/…" value={f.facebook} onChange={(e) => set('facebook', e.target.value)} />
          </Field>
          <Field label="YouTube (link)">
            <input className="input" type="url" inputMode="url" placeholder="https://youtube.com/@…" value={f.youtube} onChange={(e) => set('youtube', e.target.value)} />
          </Field>
          <Field label="Site (link)">
            <input className="input" type="url" inputMode="url" placeholder="https://…" value={f.website} onChange={(e) => set('website', e.target.value)} />
          </Field>
        </Section>

        <Section
          title="Avaliação no Google"
          hint="Depois de avaliar a sessão com 4 ou 5 estrelas, o cliente é convidado a avaliar também no Google. Pegue o link no Perfil da Empresa no Google → Pedir avaliações → Compartilhar."
        >
          <Field label="Link de avaliação do Google">
            <input className="input" type="url" inputMode="url" placeholder="https://g.page/r/…/review" value={f.googleReviewUrl} onChange={(e) => set('googleReviewUrl', e.target.value)} />
          </Field>
        </Section>

        <Section
          title="WhatsApp"
          hint={
            <>
              Notificações pela API oficial do WhatsApp (Cloud API da Meta). No painel <b className="text-soft">developers.facebook.com</b> → seu app → WhatsApp → Configuração da API, copie o <b className="text-soft">token de acesso</b> (de preferência um token permanente de usuário do sistema) e o <b className="text-soft">ID do número de telefone</b>.
            </>
          }
        >
          <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${s.waConfigured ? 'bg-okbg text-ok' : 'bg-surface2 text-muted'}`}>
            {s.waConfigured ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {s.waConfigured ? 'Ligado: as notificações estão sendo enviadas.' : 'Desligado: nenhuma mensagem é enviada.'}
          </div>
          <Toggle label="Enviar notificações pelo WhatsApp" on={f.waEnabled === 'true'} set={(v) => set('waEnabled', String(v))} />
          <Field label="Token de acesso" hint={s.waTokenSet ? `Salvo (${s.waTokenHint}). Deixe em branco para manter.` : 'Obrigatório para ligar.'}>
            <PasswordInput autoComplete="off" value={f.waToken} onChange={(e) => set('waToken', e.target.value)} placeholder={s.waTokenSet ? 'Token salvo' : 'EAAG…'} />
          </Field>
          {s.waTokenSet && (
            <button type="button" className="-mt-2 justify-self-start text-sm font-bold text-accent" onClick={clearToken}>
              Remover token
            </button>
          )}
          <Field label="ID do número de telefone">
            <input className="input" inputMode="numeric" value={f.waPhoneNumberId} onChange={(e) => set('waPhoneNumberId', e.target.value.replace(/\D/g, ''))} placeholder="Ex.: 123456789012345" />
          </Field>
          <div>
            <span className="label">Tipo de mensagem</span>
            <div className="grid gap-2">
              {[
                { id: 'template' as const, label: 'Modelo aprovado (recomendado)', hint: 'Entrega sempre. Crie na Meta um modelo de Utilidade com o corpo só com a variável {{1}}.' },
                { id: 'text' as const, label: 'Texto livre', hint: 'Só é entregue se o cliente falou com o seu número nas últimas 24 h.' },
              ].map((m) => (
                <button key={m.id} type="button" onClick={() => set('waMode', m.id)} className={`flex items-start gap-3 rounded-2xl border p-4 text-left ${f.waMode === m.id ? 'border-accent bg-tint' : 'border-line'}`}>
                  <Radio on={f.waMode === m.id} />
                  <span className="min-w-0">
                    <span className="block font-bold">{m.label}</span>
                    <span className="block text-sm text-muted">{m.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          {f.waMode === 'template' && (
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field label="Nome do modelo">
                <input className="input" value={f.waTemplate} onChange={(e) => set('waTemplate', e.target.value.toLowerCase())} placeholder="aviso_agendamento" />
              </Field>
              <Field label="Idioma">
                <input className="input" value={f.waLanguage} onChange={(e) => set('waLanguage', e.target.value)} />
              </Field>
            </div>
          )}
          <Toggle label="Avisar o WhatsApp do estúdio" hint="Novo agendamento, solicitação e cancelamento" on={f.waNotifyStudio === 'true'} set={(v) => set('waNotifyStudio', String(v))} />
          <Toggle label="Lembrete na véspera" hint="Enviado ao cliente a partir das 10h do dia anterior" on={f.waReminders === 'true'} set={(v) => set('waReminders', String(v))} />
          <p className="text-sm text-muted">O cliente recebe: confirmação, solicitação recebida, aprovação, recusa, sinal recebido, cancelamento pelo estúdio, lembrete e o pedido de avaliação depois da sessão.</p>
        </Section>

        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 md:bottom-4">
          <FormError message={err} />
          <button type="submit" className={`btn-primary w-full shadow-xl ${err ? 'mt-3' : ''}`} disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </div>
      </form>

      <section className="card mt-6 grid grid-cols-1 gap-4 p-5 [&>*]:min-w-0">
        <h2 className="h2">Testar WhatsApp</h2>
        <p className="text-sm text-muted">Salve as configurações antes. A mensagem de teste vai para o número abaixo.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className="input" type="tel" inputMode="tel" placeholder="(11) 91234-5678" value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Número para o teste" />
          <button type="button" className="btn-secondary shrink-0" onClick={test} disabled={!s.waConfigured}>
            <Send size={18} /> Enviar teste
          </button>
        </div>
        <FormError message={testErr} />
        <div>
          <p className="label">Últimos envios</p>
          {log.data && log.data.log.length === 0 && <p className="text-sm text-muted">Nenhuma mensagem enviada ainda.</p>}
          <ul className="divide-y divide-line">
            {log.data?.log.map((l) => (
              <li key={l.id} className="py-3">
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className={`font-bold ${l.status === 'sent' ? 'text-ok' : 'text-accent'}`}>{l.status === 'sent' ? 'Enviada' : 'Falhou'}</span>
                  <span>{EVENT[l.event] || l.event}</span>
                  <span className="text-muted">· +{l.to} · {fmtDateTime(l.createdAt)}</span>
                </p>
                <p className="mt-1 line-clamp-2 break-all text-sm text-muted">{l.text}</p>
                {l.error && <p className="mt-1 break-all text-sm text-accent">{l.error}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <button onClick={signOut} className="card mt-6 flex min-h-[64px] w-full items-center gap-4 px-5 text-lg text-accent">
        <LogOut size={22} /> Sair
      </button>
    </div>
  );
}
