// Notificações pela API oficial do WhatsApp (Cloud API da Meta).
// Configuração em Configurações → WhatsApp (token, ID do número, modo texto ou modelo aprovado).
import { prisma, getSettings, todayStr, nowTime, addDays, phoneKey, brl, shortDate } from './util.js';
import { trimTrailingSlashes } from './validate.js';

/**
 * Junta as linhas com " · " (cada trecho de espaços que tem quebra de linha vira um separador)
 * e reduz espaços repetidos a um: mesmo resultado das regex antigas, sem retrocesso.
 */
export function oneLine(text) {
  return text.replace(/\s+/g, (run) => (run.includes('\n') ? ' · ' : run)).replace(/\s{2,}/g, ' ');
}

// Em testes pode apontar para um servidor falso; em produção é a Graph API.
const API_BASE = trimTrailingSlashes(process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com/v21.0');

/** Número no formato internacional (só dígitos, com 55). */
export function waNumber(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length >= 12) return d;
  const key = phoneKey(d);
  return key.length >= 10 ? `55${key}` : '';
}

export const isConfigured = (s) => s.waEnabled === 'true' && !!s.waToken && !!s.waPhoneNumberId;

async function log(to, event, text, status, error = '') {
  await prisma.whatsAppLog.create({ data: { to, event, text: text.slice(0, 1000), status, error: error.slice(0, 500) } }).catch(() => undefined);
}

/**
 * Envia uma mensagem. Modo "text": texto livre (a Meta só entrega se o cliente falou com o número
 * nas últimas 24 h). Modo "template": modelo aprovado com UM parâmetro no corpo ({{1}}) = a mensagem.
 * Nunca lança: o resultado vai para o histórico (WhatsAppLog).
 */
export async function sendWhatsApp(toRaw, text, event, settings) {
  const s = settings || (await getSettings());
  const to = waNumber(toRaw);
  if (!isConfigured(s)) return { ok: false, error: 'WhatsApp não configurado' };
  if (!to) {
    await log(String(toRaw || ''), event, text, 'failed', 'Número inválido');
    return { ok: false, error: 'Número inválido' };
  }
  const body =
    s.waMode === 'template' && s.waTemplate
      ? {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: s.waTemplate,
            language: { code: s.waLanguage || 'pt_BR' },
            // Parâmetro de modelo não aceita quebra de linha nem tabulação.
            components: [{ type: 'body', parameters: [{ type: 'text', text: oneLine(text) }] }],
          },
        }
      : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: true } };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(s.waPhoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.waToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data?.error?.message || `HTTP ${res.status}`;
      await log(to, event, text, 'failed', err);
      return { ok: false, error: err };
    }
    await log(to, event, text, 'sent');
    return { ok: true, id: data?.messages?.[0]?.id };
  } catch (e) {
    const err = e?.name === 'AbortError' ? 'Tempo esgotado ao falar com a API do WhatsApp' : String(e?.message || e);
    await log(to, event, text, 'failed', err);
    return { ok: false, error: err };
  } finally {
    clearTimeout(timer);
  }
}

const first = (name) => (name || '').trim().split(/\s+/)[0] || '';
const hello = (b) => (/^Cliente \(/.test(b.clientName) ? 'Olá!' : `Olá, ${first(b.clientName)}!`);
const when = (b) => `${shortDate(b.date)} às ${b.time}`;
const link = (s, b, extra = '') => (s.appUrl ? `\n${trimTrailingSlashes(s.appUrl)}/agenda/${b.id}${extra}` : '');

/** Texto da mensagem ao cliente para cada evento do agendamento. */
function clientMessage(event, b, s) {
  const what = `${b.service.name} com ${b.artist.name}, ${when(b)}`;
  switch (event) {
    case 'confirmed':
      return `${hello(b)} Seu agendamento no ${s.studioName} está confirmado: ${what}.${b.depositPaid ? ` Sinal de ${brl(b.depositCents)} recebido.` : ''}${link(s, b)}`;
    case 'requested':
      return `${hello(b)} Recebemos sua solicitação no ${s.studioName}: ${what}. Avisamos assim que o estúdio aprovar.${link(s, b)}`;
    case 'approved':
      return `${hello(b)} Seu agendamento foi aprovado: ${what}.${b.status === 'pending_deposit' ? ` Pague o sinal de ${brl(b.depositCents)} no estúdio para garantir o horário.` : ''}${link(s, b)}`;
    case 'rejected':
      return `${hello(b)} Infelizmente não conseguimos atender sua solicitação (${what}).${b.cancelReason ? ` Motivo: ${b.cancelReason}.` : ''} Escolha outro horário no app.${link(s, b)}`;
    case 'deposit':
      return `${hello(b)} Recebemos o sinal de ${brl(b.depositCents)}. Sua sessão está confirmada: ${what}.${link(s, b)}`;
    case 'cancelled':
      return `${hello(b)} Seu agendamento (${what}) foi cancelado pelo estúdio.${b.cancelReason ? ` Motivo: ${b.cancelReason}.` : ''}${link(s, b)}`;
    case 'completed':
      return `${hello(b)} Obrigado por tatuar com a gente! Conta pra nós como foi a sessão com ${b.artist.name}: leva 1 minuto.${link(s, b, '?avaliar=1')}`;
    case 'reminder':
      return `${hello(b)} Lembrete: amanhã você tem ${b.service.name} com ${b.artist.name} às ${b.time} no ${s.studioName}.${s.address ? ` Endereço: ${s.address}.` : ''}${link(s, b)}`;
    default:
      return '';
  }
}

/** Avisa o cliente (sem bloquear a resposta da API). */
export function notifyClientWA(event, booking) {
  getSettings()
    .then((s) => {
      if (!isConfigured(s) || !booking.clientPhone) return;
      const text = clientMessage(event, booking, s);
      if (text) return sendWhatsApp(booking.clientPhone, text, event, s);
    })
    .catch((e) => console.error('WhatsApp:', e));
}

/** Avisa o WhatsApp do estúdio (Configurações → WhatsApp do estúdio). */
export function notifyStudioWA(event, text) {
  getSettings()
    .then((s) => {
      if (!isConfigured(s) || s.waNotifyStudio !== 'true' || !s.whatsapp) return;
      return sendWhatsApp(s.whatsapp, `${s.studioName}: ${text}`, event, s);
    })
    .catch((e) => console.error('WhatsApp:', e));
}

const reminderInclude = { artist: { select: { name: true } }, service: { select: { name: true } } };

/** Lembrete de véspera: a partir das 10h, uma vez por agendamento. */
export async function sendReminders() {
  const s = await getSettings();
  if (!isConfigured(s) || s.waReminders !== 'true' || nowTime() < '10:00') return 0;
  const list = await prisma.booking.findMany({
    where: { date: addDays(todayStr(), 1), status: { in: ['confirmed', 'pending_deposit'] }, reminderSentAt: null, clientPhone: { not: '' } },
    include: reminderInclude,
    take: 50,
  });
  for (const b of list) {
    // Marca antes de enviar: se houver 2 réplicas, só uma pega o agendamento.
    const claimed = await prisma.booking.updateMany({ where: { id: b.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
    if (claimed.count) await sendWhatsApp(b.clientPhone, clientMessage('reminder', b, s), 'reminder', s);
  }
  return list.length;
}

export function startReminderLoop() {
  const run = () => sendReminders().catch((e) => console.error('Lembretes WhatsApp:', e));
  setTimeout(run, 30_000);
  setInterval(run, 15 * 60_000).unref();
}
