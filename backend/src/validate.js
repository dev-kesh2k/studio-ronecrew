// Erro HTTP e validação dos campos recebidos (sem banco: testáveis isoladamente).

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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

/** Link http(s) opcional. */
export function url(v, field) {
  const s = text(v, field, { max: 300 });
  if (s && !/^https?:\/\/[^\s]+$/i.test(s)) throw new HttpError(400, `${field}: informe um link começando com https://`);
  return s;
}
