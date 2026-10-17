import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

// O Postgres do Hub é compartilhado (max_connections baixo): limita o pool deste app.
function dbUrl() {
  const raw = process.env.DATABASE_URL || '';
  try {
    const u = new URL(raw);
    const max = Number(process.env.DB_POOL_SIZE) || 3;
    const current = Number(u.searchParams.get('connection_limit')) || Infinity;
    u.searchParams.set('connection_limit', String(Math.min(current, max)));
    return u.toString();
  } catch {
    return raw;
  }
}

// A foto do artista (bytes) só é lida pela rota da imagem: fica fora de todas as outras consultas.
export const prisma = new PrismaClient({ datasources: { db: { url: dbUrl() } }, omit: { artist: { avatar: true } } });

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Datas no fuso do estúdio ----------
export const TZ = process.env.TZ || 'America/Sao_Paulo';

/** Dia (YYYY-MM-DD) no fuso do estúdio. */
export function todayStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Hora atual (HH:MM) no fuso do estúdio. */
export function nowTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const isMonth = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado */
export const weekday = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** Segunda-feira da semana de `day`. */
export const weekStart = (day) => addDays(day, -((weekday(day) + 6) % 7));

export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(next, -1) };
}

export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// ---------- Agenda do estúdio ----------
/** Horários de início: 09:00 a 17:00, de hora em hora. Domingo fechado. */
export const SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
export const ACTIVE_STATUSES = ['requested', 'pending_deposit', 'confirmed'];
export const BLOCKING_STATUSES = ['requested', 'pending_deposit', 'confirmed', 'completed'];

// ---------- Autenticação ----------
const SECRET = process.env.JWT_SECRET || '';
if (!SECRET) console.warn('JWT_SECRET não definido: usando segredo temporário (sessões caem ao reiniciar).');
const KEY = SECRET || crypto.randomBytes(32).toString('hex');

export const signToken = (user) => jwt.sign({ sub: user.id }, KEY, { expiresIn: '30d' });

/** true se o header Authorization traz o token de um administrador. */
export async function isAdminRequest(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return false;
  try {
    const { sub } = jwt.verify(h.slice(7), KEY);
    const u = await prisma.user.findUnique({ where: { id: sub }, select: { role: true } });
    return u?.role === 'admin';
  } catch {
    return false;
  }
}

export function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const { sub } = jwt.verify(token, KEY);
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) return res.status(401).json({ error: 'Sessão inválida' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Sessão expirada' });
  }
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Apenas administradores'));
  next();
}

// Limite simples de tentativas de login por IP+login (memória do processo).
const attempts = new Map();
const WINDOW = 15 * 60_000;
export function tooManyAttempts(key) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < WINDOW);
  attempts.set(key, list);
  return list.length >= 10;
}
export function recordFailure(key) {
  const list = attempts.get(key) || [];
  list.push(Date.now());
  attempts.set(key, list);
}
export const clearFailures = (key) => attempts.delete(key);

// ---------- Validação ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function text(v, field, { max = 200, required = false } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw new HttpError(400, `${field} é obrigatório`);
  if (s.length > max) throw new HttpError(400, `${field} deve ter no máximo ${max} caracteres`);
  return s;
}

export function email(v, { required = true } = {}) {
  const s = text(v, 'E-mail', { max: 160, required }).toLowerCase();
  if (s && !EMAIL_RE.test(s)) throw new HttpError(400, 'E-mail inválido');
  return s;
}

export function password(v) {
  if (typeof v !== 'string' || v.length < 8) throw new HttpError(400, 'A senha deve ter pelo menos 8 caracteres');
  if (v.length > 200) throw new HttpError(400, 'Senha muito longa');
  return v;
}

export const digits = (s) => String(s || '').replace(/\D/g, '');

export function phone(v, { required = false } = {}) {
  const s = text(v, 'Telefone', { max: 30, required });
  if (s && !/^[+\d\s().-]{8,30}$/.test(s)) throw new HttpError(400, 'Telefone inválido');
  return s;
}

/** Celular normalizado (DDD + número, sem o 55): chave para o cliente encontrar seus agendamentos. */
export function phoneKey(v) {
  let d = digits(v);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d;
}

export function mobile(v) {
  const raw = text(v, 'Celular', { required: true, max: 30 });
  const key = phoneKey(raw);
  if (key.length < 10 || key.length > 11) throw new HttpError(400, 'Informe o celular com DDD (ex.: 11 91234-5678)');
  return { raw, key };
}

/** Formata a chave para exibição: (11) 91234-5678 */
export const formatPhone = (key) =>
  key.length === 11 ? `(${key.slice(0, 2)}) ${key.slice(2, 7)}-${key.slice(7)}` : key.length === 10 ? `(${key.slice(0, 2)}) ${key.slice(2, 6)}-${key.slice(6)}` : key;

// Limite por IP para consultas pelo celular (evita varredura de números).
const lookups = new Map();
export function limitLookup(ip, max = 60) {
  const now = Date.now();
  const list = (lookups.get(ip) || []).filter((t) => now - t < WINDOW);
  if (list.length >= max) throw new HttpError(429, 'Muitas consultas. Aguarde alguns minutos.');
  list.push(now);
  lookups.set(ip, list);
}

export function int(v, field, { min = 0, max = 1_000_000_000 } = {}) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) throw new HttpError(400, `${field} inválido`);
  if (n < min || n > max) throw new HttpError(400, `${field} deve estar entre ${min} e ${max}`);
  return n;
}

export function oneOf(v, field, list) {
  if (!list.includes(v)) throw new HttpError(400, `${field} inválido`);
  return v;
}

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
/** Decodifica uma imagem em data URL (já reduzida no navegador). */
export function image(v) {
  const m = typeof v === 'string' ? /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(v) : null;
  if (!m || !IMAGE_MIMES.includes(m[1])) throw new HttpError(400, 'Imagem inválida (use JPG, PNG ou WebP)');
  const data = Buffer.from(m[2], 'base64');
  if (data.length > 2_500_000) throw new HttpError(413, 'Imagem muito grande (máx. 2,5 MB)');
  return { mime: m[1], data };
}


// ---------- Configurações do estúdio ----------
export const SETTING_DEFAULTS = {
  studioName: 'RoneCrew Tatoo',
  depositCents: '10000',
  phone: '',
  whatsapp: '',
  address: '',
  instagram: '',
};

export async function getSettings() {
  const rows = await prisma.setting.findMany();
  const s = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in s) s[r.key] = r.value;
  return { ...s, depositCents: Number(s.depositCents) || 0 };
}

export async function notify(userIds, title, body = '', link = '') {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, title, body, link })) });
}

export async function notifyAdmins(title, body = '', link = '') {
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
  await notify(admins.map((a) => a.id), title, body, link);
}

export const brl = (cents) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const shortDate = (day) => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
