import express from 'express';
import bcrypt from 'bcryptjs';
import {
  prisma,
  HttpError,
  wrap,
  todayStr,
  nowTime,
  isDay,
  signToken,
  publicUser,
  requireAuth,
  tooManyAttempts,
  recordFailure,
  clearFailures,
  text,
  email,
  password,
  phone,
  digits,
  int,
  oneOf,
  image,
  getSettings,
  notifyAdmins,
  ACTIVE_STATUSES,
  brl,
  shortDate,
} from './util.js';
import {
  daySlots,
  checkBookable,
  createBooking,
  bookingInclude,
  serializeBooking,
  artistInclude,
  artistStats,
  serializeArtist,
} from './booking.js';
import { admin } from './admin.js';

export const api = express.Router();

api.get('/health', wrap(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, db: 'up' });
}));

api.get('/config', wrap(async (_req, res) => {
  const s = await getSettings();
  res.json({ ...s, today: todayStr(), now: nowTime() });
}));

// ---------- Fotos do portfólio (públicas, ids não adivinháveis) ----------
api.get('/photos/:id', wrap(async (req, res) => {
  const p = await prisma.artistPhoto.findUnique({ where: { id: req.params.id } });
  if (!p) throw new HttpError(404, 'Foto não encontrada');
  res.set('Content-Type', p.mime).set('Cache-Control', 'public, max-age=31536000, immutable').send(Buffer.from(p.data));
}));

// ---------- Autenticação ----------
api.post('/auth/register', wrap(async (req, res) => {
  const name = text(req.body.name, 'Nome', { required: true, max: 100 });
  const mail = email(req.body.email);
  const tel = phone(req.body.phone, { required: true });
  const pass = password(req.body.password);
  if (await prisma.user.findUnique({ where: { email: mail } })) throw new HttpError(409, 'Já existe uma conta com esse e-mail');
  const user = await prisma.user.create({
    data: { name, email: mail, phone: tel, role: 'client', passwordHash: await bcrypt.hash(pass, 10) },
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

api.post('/auth/login', wrap(async (req, res) => {
  const login = text(req.body.login, 'E-mail ou telefone', { required: true, max: 160 }).toLowerCase();
  const pass = typeof req.body.password === 'string' ? req.body.password : '';
  if (!pass) throw new HttpError(400, 'Informe a senha');
  const key = `${req.ip}:${login}`;
  if (tooManyAttempts(key)) throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos.');

  let user = null;
  if (login.includes('@')) {
    user = await prisma.user.findUnique({ where: { email: login } });
  } else if (digits(login).length >= 8) {
    const rows = await prisma.$queryRaw`SELECT id FROM "User" WHERE regexp_replace(phone, '\\D', '', 'g') = ${digits(login)} LIMIT 1`;
    if (rows.length) user = await prisma.user.findUnique({ where: { id: rows[0].id } });
  }
  if (!user || !(await bcrypt.compare(pass, user.passwordHash))) {
    recordFailure(key);
    throw new HttpError(401, 'E-mail/telefone ou senha incorretos');
  }
  clearFailures(key);
  res.json({ token: signToken(user), user: publicUser(user) });
}));

api.use(requireAuth);

api.get('/auth/me', wrap(async (req, res) => {
  const unread = await prisma.notification.count({ where: { userId: req.user.id, read: false } });
  res.json({ user: publicUser(req.user), unread });
}));

api.put('/me', wrap(async (req, res) => {
  const name = text(req.body.name, 'Nome', { required: true, max: 100 });
  const mail = email(req.body.email);
  const tel = phone(req.body.phone, { required: req.user.role !== 'admin' });
  if (mail !== req.user.email && (await prisma.user.findUnique({ where: { email: mail } }))) {
    throw new HttpError(409, 'Esse e-mail já está em uso');
  }
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { name, email: mail, phone: tel } });
  res.json({ user: publicUser(user) });
}));

api.put('/me/password', wrap(async (req, res) => {
  const current = typeof req.body.current === 'string' ? req.body.current : '';
  const next = password(req.body.password);
  if (!(await bcrypt.compare(current, req.user.passwordHash))) throw new HttpError(400, 'Senha atual incorreta');
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  res.json({ ok: true });
}));

// ---------- Artistas e serviços ----------
async function favoriteSet(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { favorites: { select: { id: true } } } });
  return new Set((u?.favorites || []).map((f) => f.id));
}

api.get('/artists', wrap(async (req, res) => {
  const q = text(req.query.q, 'Busca', { max: 80 });
  const style = text(req.query.style, 'Estilo', { max: 80 });
  const where = {};
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { style: { contains: q, mode: 'insensitive' } }];
  if (style) where.style = { equals: style, mode: 'insensitive' };
  if (req.query.favorites === '1') where.favoredBy = { some: { id: req.user.id } };
  const [artists, stats, favs] = await Promise.all([
    prisma.artist.findMany({ where, include: artistInclude(true), orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    artistStats(),
    favoriteSet(req.user.id),
  ]);
  const styles = await prisma.artist.findMany({ distinct: ['style'], select: { style: true }, orderBy: { sortOrder: 'asc' } });
  res.json({ artists: artists.map((a) => serializeArtist(a, stats, favs)), styles: styles.map((s) => s.style) });
}));

api.get('/artists/:id', wrap(async (req, res) => {
  const [a, stats, favs] = await Promise.all([
    prisma.artist.findUnique({ where: { id: req.params.id }, include: artistInclude(true) }),
    artistStats(),
    favoriteSet(req.user.id),
  ]);
  if (!a) throw new HttpError(404, 'Artista não encontrado');
  const reviews = await prisma.review.findMany({
    where: { artistId: a.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, rating: true, comment: true, createdAt: true, user: { select: { name: true } } },
  });
  res.json({ artist: serializeArtist(a, stats, favs), reviews });
}));

api.post('/artists/:id/favorite', wrap(async (req, res) => {
  await prisma.user.update({ where: { id: req.user.id }, data: { favorites: { connect: { id: req.params.id } } } });
  res.json({ favorite: true });
}));

api.delete('/artists/:id/favorite', wrap(async (req, res) => {
  await prisma.user.update({ where: { id: req.user.id }, data: { favorites: { disconnect: { id: req.params.id } } } });
  res.json({ favorite: false });
}));

api.get('/services', wrap(async (req, res) => {
  const artistId = text(req.query.artistId, 'Artista', { max: 40 });
  const services = await prisma.service.findMany({
    where: { active: true, ...(artistId ? { artists: { some: { id: artistId } } } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ services });
}));

api.get('/availability', wrap(async (req, res) => {
  const artistId = text(req.query.artistId, 'Artista', { required: true, max: 40 });
  const serviceId = text(req.query.serviceId, 'Serviço', { required: true, max: 40 });
  const date = String(req.query.date || '');
  if (!isDay(date)) throw new HttpError(400, 'Data inválida');
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new HttpError(404, 'Serviço não encontrado');
  res.json({ date, slots: await daySlots(artistId, date, service.durationMin) });
}));

// ---------- Cartões salvos (só bandeira e 4 últimos dígitos) ----------
function luhn(num) {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function cardBrand(num) {
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(num)) return 'Elo';
  if (/^4/.test(num)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'Amex';
  if (/^(606282|3841)/.test(num)) return 'Hipercard';
  return 'Cartão';
}

function parseCard(body) {
  const num = digits(body?.number);
  if (num.length < 13 || num.length > 19 || !luhn(num)) throw new HttpError(400, 'Número do cartão inválido');
  const exp = String(body?.expiry || '').trim();
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(exp);
  if (!m) throw new HttpError(400, 'Validade inválida (use MM/AA)');
  const [y, mo] = todayStr().split('-').map(Number);
  const ey = 2000 + Number(m[2]);
  if (ey < y || (ey === y && Number(m[1]) < mo)) throw new HttpError(400, 'Cartão vencido');
  const holder = text(body?.holder, 'Nome no cartão', { required: true, max: 80 });
  const cvv = digits(body?.cvv);
  if (cvv.length < 3 || cvv.length > 4) throw new HttpError(400, 'CVV inválido');
  return { brand: cardBrand(num), last4: num.slice(-4), expiry: exp, holder };
}

api.get('/cards', wrap(async (req, res) => {
  const cards = await prisma.card.findMany({ where: { userId: req.user.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  res.json({ cards });
}));

api.post('/cards', wrap(async (req, res) => {
  const data = parseCard(req.body);
  const count = await prisma.card.count({ where: { userId: req.user.id } });
  if (count >= 5) throw new HttpError(400, 'Limite de 5 cartões salvos');
  const card = await prisma.card.create({ data: { ...data, userId: req.user.id, isDefault: count === 0 } });
  res.status(201).json({ card });
}));

api.post('/cards/:id/default', wrap(async (req, res) => {
  const card = await prisma.card.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!card) throw new HttpError(404, 'Cartão não encontrado');
  await prisma.$transaction([
    prisma.card.updateMany({ where: { userId: req.user.id }, data: { isDefault: false } }),
    prisma.card.update({ where: { id: card.id }, data: { isDefault: true } }),
  ]);
  res.json({ ok: true });
}));

api.delete('/cards/:id', wrap(async (req, res) => {
  const card = await prisma.card.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!card) throw new HttpError(404, 'Cartão não encontrado');
  await prisma.card.delete({ where: { id: card.id } });
  if (card.isDefault) {
    const next = await prisma.card.findFirst({ where: { userId: req.user.id }, orderBy: { createdAt: 'asc' } });
    if (next) await prisma.card.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  res.json({ ok: true });
}));

// ---------- Agendamentos do cliente ----------
api.post('/bookings', wrap(async (req, res) => {
  const { artist, service } = await checkBookable(req.body);
  const notes = text(req.body.notes, 'Detalhes', { max: 1000 });
  const settings = await getSettings();
  const deposit = Math.min(settings.depositCents, service.priceCents);
  let method = deposit > 0 ? oneOf(req.body.paymentMethod, 'Forma de pagamento', ['card', 'pix', 'tap', 'studio']) : 'studio';

  if (method === 'card') {
    if (req.body.cardId) {
      const card = await prisma.card.findFirst({ where: { id: String(req.body.cardId), userId: req.user.id } });
      if (!card) throw new HttpError(400, 'Cartão não encontrado');
    } else {
      const card = parseCard(req.body.newCard);
      if (req.body.newCard?.save) {
        const count = await prisma.card.count({ where: { userId: req.user.id } });
        if (count < 5) await prisma.card.create({ data: { ...card, userId: req.user.id, isDefault: count === 0 } });
      }
    }
  }

  const paysNow = deposit > 0 && method !== 'studio';
  const status = deposit === 0 ? 'confirmed' : paysNow ? 'confirmed' : 'requested';
  const booking = await createBooking(
    {
      clientId: req.user.id,
      clientName: req.user.name,
      clientPhone: req.user.phone,
      artistId: artist.id,
      serviceId: service.id,
      date: req.body.date,
      time: req.body.time,
      durationMin: service.durationMin,
      priceCents: service.priceCents,
      depositCents: deposit,
      status,
      paymentMethod: method,
      depositPaid: paysNow,
      notes,
    },
    paysNow ? [{ kind: 'deposit', method, amountCents: deposit }] : [],
  );

  const when = `${shortDate(booking.date)}, ${booking.time}`;
  if (status === 'requested') {
    await notifyAdmins('Nova solicitação de agendamento', `${req.user.name} · ${service.name} com ${artist.name} · ${when}`, '/admin/agenda');
  } else {
    await notifyAdmins('Novo agendamento confirmado', `${req.user.name} · ${service.name} com ${artist.name} · ${when}${paysNow ? ` · sinal ${brl(deposit)} pago` : ''}`, '/admin/agenda');
  }
  const full = await prisma.booking.findUnique({ where: { id: booking.id }, include: bookingInclude });
  res.status(201).json({ booking: serializeBooking(full) });
}));

api.get('/bookings/mine', wrap(async (req, res) => {
  const list = await prisma.booking.findMany({
    where: { clientId: req.user.id },
    include: bookingInclude,
    orderBy: [{ date: 'desc' }, { time: 'desc' }],
  });
  res.json({ bookings: list.map(serializeBooking), today: todayStr(), now: nowTime() });
}));

async function loadOwnBooking(req) {
  const b = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { ...bookingInclude, references: { select: { id: true, note: true } } },
  });
  if (!b || (req.user.role !== 'admin' && b.clientId !== req.user.id)) throw new HttpError(404, 'Agendamento não encontrado');
  return b;
}

api.get('/bookings/:id', wrap(async (req, res) => {
  res.json({ booking: serializeBooking(await loadOwnBooking(req)) });
}));

api.post('/bookings/:id/cancel', wrap(async (req, res) => {
  const b = await loadOwnBooking(req);
  if (!ACTIVE_STATUSES.includes(b.status)) throw new HttpError(400, 'Esse agendamento não pode ser cancelado');
  if (b.date < todayStr()) throw new HttpError(400, 'Esse agendamento já passou');
  const reason = text(req.body.reason, 'Motivo', { max: 300 });
  await prisma.booking.update({ where: { id: b.id }, data: { status: 'cancelled', cancelReason: reason || 'Cancelado pelo cliente' } });
  await notifyAdmins('Agendamento cancelado pelo cliente', `${b.clientName} · ${b.service.name} com ${b.artist.name} · ${shortDate(b.date)}, ${b.time}`, '/admin/agenda');
  res.json({ ok: true });
}));

api.post('/bookings/:id/review', wrap(async (req, res) => {
  const b = await loadOwnBooking(req);
  if (b.clientId !== req.user.id) throw new HttpError(403, 'Apenas o cliente pode avaliar');
  if (b.status !== 'completed') throw new HttpError(400, 'Avalie depois que a sessão for concluída');
  if (b.review) throw new HttpError(409, 'Você já avaliou esta sessão');
  const rating = int(req.body.rating, 'Nota', { min: 1, max: 5 });
  const comment = text(req.body.comment, 'Comentário', { max: 500 });
  await prisma.review.create({ data: { bookingId: b.id, userId: req.user.id, artistId: b.artistId, rating, comment } });
  res.status(201).json({ ok: true });
}));

// ---------- Referências (imagens do cliente) ----------
api.get('/references', wrap(async (req, res) => {
  const refs = await prisma.reference.findMany({
    where: { userId: req.user.id },
    select: { id: true, note: true, bookingId: true, createdAt: true, booking: { select: { date: true, service: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ references: refs });
}));

api.post('/references', wrap(async (req, res) => {
  const { mime, data } = image(req.body.image);
  const note = text(req.body.note, 'Descrição', { max: 300 });
  let bookingId = null;
  if (req.body.bookingId) {
    const b = await prisma.booking.findFirst({ where: { id: String(req.body.bookingId), clientId: req.user.id } });
    if (!b) throw new HttpError(400, 'Agendamento não encontrado');
    bookingId = b.id;
  }
  if ((await prisma.reference.count({ where: { userId: req.user.id } })) >= 30) throw new HttpError(400, 'Limite de 30 referências');
  const ref = await prisma.reference.create({ data: { userId: req.user.id, bookingId, note, mime, data }, select: { id: true } });
  res.status(201).json({ reference: ref });
}));

api.get('/references/:id/image', wrap(async (req, res) => {
  const r = await prisma.reference.findUnique({ where: { id: req.params.id } });
  if (!r || (req.user.role !== 'admin' && r.userId !== req.user.id)) throw new HttpError(404, 'Imagem não encontrada');
  res.set('Content-Type', r.mime).set('Cache-Control', 'private, max-age=86400').send(Buffer.from(r.data));
}));

api.delete('/references/:id', wrap(async (req, res) => {
  const r = await prisma.reference.findFirst({ where: { id: req.params.id, userId: req.user.id }, select: { id: true } });
  if (!r) throw new HttpError(404, 'Referência não encontrada');
  await prisma.reference.delete({ where: { id: r.id } });
  res.json({ ok: true });
}));

// ---------- Notificações ----------
api.get('/notifications', wrap(async (req, res) => {
  const list = await prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ notifications: list });
}));

api.post('/notifications/read-all', wrap(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  res.json({ ok: true });
}));

api.use('/admin', admin);
