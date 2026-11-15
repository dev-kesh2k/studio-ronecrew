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
export const prisma = new PrismaClient({ datasources: { db: { url: dbUrl() } }, omit: { artist: { avatar: true }, clientProfile: { avatar: true } } });

export { HttpError } from './validate.js';
import { HttpError } from './validate.js';

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export { TZ, todayStr, nowTime, isDay, isMonth, addDays, weekday, weekStart, monthRange, toMin, shortDate } from './dates.js';

// ---------- Agenda do estúdio ----------
export { SLOTS, DEFAULT_SCHEDULE, parseSchedule, checkSchedule, slotsOf, ACTIVE_STATUSES, BLOCKING_STATUSES } from './schedule.js';
import { DEFAULT_SCHEDULE, parseSchedule } from './schedule.js';

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
export { text, email, password, digits, phone, phoneKey, mobile, formatPhone, int, oneOf, image, url } from './validate.js';

// Limite por IP para consultas pelo celular (evita varredura de números).
const lookups = new Map();
export function limitLookup(ip, max = 60) {
  const now = Date.now();
  const list = (lookups.get(ip) || []).filter((t) => now - t < WINDOW);
  if (list.length >= max) throw new HttpError(429, 'Muitas consultas. Aguarde alguns minutos.');
  list.push(now);
  lookups.set(ip, list);
}

// ---------- Configurações do estúdio ----------
/** Visíveis para o cliente (GET /config). */
export const PUBLIC_SETTINGS = {
  studioName: 'RoneCrew Tatoo',
  depositCents: '10000',
  phone: '',
  whatsapp: '',
  address: '',
  hours: '',
  logoVersion: '0',
  schedule: JSON.stringify(DEFAULT_SCHEDULE),
  about: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  youtube: '',
  website: '',
  googleReviewUrl: '',
};

/** Só do estúdio: integração com a API do WhatsApp (Cloud API da Meta). */
export const PRIVATE_SETTINGS = {
  appUrl: '',
  waEnabled: 'false',
  waToken: '',
  waPhoneNumberId: '',
  waMode: 'text', // text | template
  waTemplate: '',
  waLanguage: 'pt_BR',
  waNotifyStudio: 'true',
  waReminders: 'true',
};

export const SETTING_DEFAULTS = { ...PUBLIC_SETTINGS, ...PRIVATE_SETTINGS };

export async function getSettings() {
  // A imagem da logo fica na linha "logo" e não deve ser lida a cada consulta.
  const rows = await prisma.setting.findMany({ where: { key: { not: 'logo' } } });
  const s = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in s) s[r.key] = r.value;
  return { ...s, depositCents: Number(s.depositCents) || 0, logoVersion: Number(s.logoVersion) || 0, schedule: parseSchedule(s.schedule) };
}

export async function getPublicSettings() {
  const s = await getSettings();
  return Object.fromEntries(Object.keys(PUBLIC_SETTINGS).map((k) => [k, s[k]]));
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
