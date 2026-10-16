import type { BookingStatus } from './api';

export function brl(cents: number) {
  const v = cents / 100;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export const priceFrom = (cents: number) => (cents === 0 ? 'Grátis' : `a partir de ${brl(cents)}`);

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const parts = (day: string) => day.split('-').map(Number) as [number, number, number];
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const weekStart = (day: string) => addDays(day, -((weekdayOf(day) + 6) % 7));

/** "23 out 2026" */
export function fmtDate(day: string) {
  const [y, m, d] = parts(day);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "Sáb 17, 10:00" */
export function fmtShort(day: string, time?: string) {
  const [, , d] = parts(day);
  return `${WEEKDAYS_SHORT[weekdayOf(day)]} ${d}${time ? `, ${time}` : ''}`;
}

/** "Sexta, 16 de outubro" */
export function fmtLong(day: string) {
  const [, m, d] = parts(day);
  return `${WEEKDAYS[weekdayOf(day)]}, ${d} de ${MONTHS[m - 1]}`;
}

export const dayNum = (day: string) => parts(day)[2];
export const monthShort = (day: string) => MONTHS_SHORT[parts(day)[1] - 1];

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
}

export function duration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export const STATUS: Record<BookingStatus, { label: string; text: string; bg: string; bar: string }> = {
  requested: { label: 'Aguardando aprovação', text: 'text-soft', bg: 'bg-surface2', bar: 'bg-soft' },
  pending_deposit: { label: 'Sinal pendente', text: 'text-warn', bg: 'bg-warnbg', bar: 'bg-warn' },
  confirmed: { label: 'Confirmado', text: 'text-ok', bg: 'bg-okbg', bar: 'bg-accent' },
  completed: { label: 'Concluído', text: 'text-soft', bg: 'bg-surface2', bar: 'bg-dis' },
  cancelled: { label: 'Cancelado', text: 'text-muted', bg: 'bg-surface2', bar: 'bg-dis' },
  rejected: { label: 'Recusado', text: 'text-accent', bg: 'bg-tint2', bar: 'bg-dis' },
};

export const METHOD: Record<string, string> = {
  card: 'Cartão',
  pix: 'Pix',
  tap: 'Aproximação',
  cash: 'Dinheiro',
  studio: 'No estúdio',
};

/** Converte "350,00" / "350" em centavos. */
export function parseMoney(v: string): number | null {
  const s = v.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export const moneyInput = (cents: number) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Reduz a imagem no navegador (máx. 1280 px, JPEG) antes de enviar. */
export function resizeImage(file: File, max = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Escolha uma imagem'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem'));
    };
    img.src = url;
  });
}

export const waLink = (phone: string, text = '') => {
  let d = phone.replace(/\D/g, '');
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};
