import { useState, type FormEvent } from 'react';
import { CheckCircle2, Heart, Lightbulb, MessageSquare, ThumbsDown } from 'lucide-react';
import { api } from '../../api';
import { getSavedName, getSavedPhone, isValidPhone, maskPhone } from '../../client';
import { Field, FormError, PageHead } from '../../ui';

const KINDS = [
  { id: 'elogio', label: 'Elogio', icon: Heart },
  { id: 'sugestao', label: 'Sugestão', icon: Lightbulb },
  { id: 'reclamacao', label: 'Reclamação', icon: ThumbsDown },
  { id: 'outro', label: 'Outro', icon: MessageSquare },
] as const;

/** Feedback livre para o estúdio (lido pela equipe em Feedback, no painel). */
export default function Feedback() {
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('sugestao');
  const [message, setMessage] = useState('');
  const [name, setName] = useState(getSavedName);
  const [phone, setPhone] = useState(getSavedPhone);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!message.trim()) return setErr('Escreva sua mensagem');
    if (phone && !isValidPhone(phone)) return setErr('Celular inválido. Deixe em branco ou informe com DDD.');
    setBusy(true);
    try {
      await api.post('/feedback', { kind, message, name, phone: phone || undefined });
      setSent(true);
      setMessage('');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead back="/perfil" title="Feedback" subtitle="Sua opinião ajuda o estúdio a melhorar. A equipe lê todas as mensagens." />
      {sent ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 size={40} className="text-ok" />
          <p className="text-lg font-bold">Obrigado pelo feedback!</p>
          <p className="text-muted">{phone ? 'Se precisar, o estúdio responde pelo seu celular.' : 'Sua mensagem foi enviada para a equipe.'}</p>
          <button className="btn-secondary mt-2" onClick={() => setSent(false)}>
            Enviar outra mensagem
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="card grid gap-4 p-5">
          <div>
            <span className="label">Tipo</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Tipo de feedback">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.id}
                  onClick={() => setKind(k.id)}
                  className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border px-2 text-base transition ${kind === k.id ? 'border-accent bg-tint font-bold text-ink' : 'border-line text-soft'}`}
                >
                  <k.icon size={18} className={kind === k.id ? 'text-accent' : ''} /> {k.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Mensagem *">
            <textarea className="input min-h-[140px] resize-y" maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Conte o que achou, o que podemos melhorar…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome (opcional)">
              <input className="input" autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Celular (opcional)" hint="Para o estúdio responder">
              <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 91234-5678" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
            </Field>
          </div>
          <FormError message={err} />
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar feedback'}
          </button>
        </form>
      )}
    </div>
  );
}
