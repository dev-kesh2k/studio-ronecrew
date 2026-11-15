// Agenda do estúdio: expediente por dia da semana e horários livres (sem banco: testáveis).
import { toMin, weekday } from './dates.js';
import { HttpError } from './validate.js';

/** Horários de início possíveis (de hora em hora); o expediente de cada dia da semana vem das configurações. */
export const SLOTS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
/** Expediente padrão: segunda a sábado, 09:00–18:00; domingo fechado. Índice = dia da semana (0 = domingo). */
export const DEFAULT_SCHEDULE = Array.from({ length: 7 }, (_, d) => ({ open: d !== 0, from: '09:00', to: '18:00' }));
/** Lê o JSON salvo; qualquer coisa inválida volta ao padrão. */
export function parseSchedule(raw) {
  try {
    const a = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(a) || a.length !== 7) return DEFAULT_SCHEDULE;
    return a.map((d) => ({ open: !!d?.open, from: HHMM.test(d?.from) ? d.from : '09:00', to: HHMM.test(d?.to) ? d.to : '18:00' }));
  } catch {
    return DEFAULT_SCHEDULE;
  }
}
/** Valida o que o admin enviou (7 dias, abre antes de fechar). */
export function checkSchedule(v) {
  let a = v;
  if (typeof v === 'string') {
    try {
      a = JSON.parse(v);
    } catch {
      // Texto que não é JSON é erro de quem enviou (400), não do servidor (500).
      throw new HttpError(400, 'Horário de atendimento inválido');
    }
  }
  if (!Array.isArray(a) || a.length !== 7) throw new HttpError(400, 'Horário de atendimento inválido');
  const names = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const out = a.map((d, i) => {
    const day = { open: !!d?.open, from: String(d?.from || '09:00'), to: String(d?.to || '18:00') };
    if (!day.open) {
      // Dia fechado: os horários não importam; mantém valores válidos.
      if (!HHMM.test(day.from)) day.from = '09:00';
      if (!HHMM.test(day.to)) day.to = '18:00';
      return day;
    }
    if (!HHMM.test(day.from) || !HHMM.test(day.to)) throw new HttpError(400, `Informe abertura e fechamento de ${names[i]}`);
    if (toMin(day.from) >= toMin(day.to)) throw new HttpError(400, `Em ${names[i]}, o fechamento precisa ser depois da abertura`);
    return day;
  });
  return JSON.stringify(out);
}
/** Horários de início livres para o expediente do dia (vazio se fechado). */
export const slotsOf = (schedule, date) => {
  const d = schedule[weekday(date)];
  return d?.open ? SLOTS.filter((t) => toMin(t) >= toMin(d.from) && toMin(t) < toMin(d.to)) : [];
};
export const ACTIVE_STATUSES = ['requested', 'pending_deposit', 'confirmed'];
export const BLOCKING_STATUSES = ['requested', 'pending_deposit', 'confirmed', 'completed'];
