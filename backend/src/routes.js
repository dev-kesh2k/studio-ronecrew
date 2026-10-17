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
  isAdminRequest,
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
  mobile,
  phoneKey,
  formatPhone,
  limitLookup,
  getSettings,
  notifyAdmins,
  ACTIVE_STATUSES,
  brl,
  shortDate,
} from './util.js';
// Clientes não têm conta: agendam e consultam pelo celular. Só o estúdio (admin) faz login.
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

// Avatar do artista (público; a URL leva ?v=<versão>, então pode ficar em cache para sempre).
api.get('/artists/:id/avatar', wrap(async (req, res) => {
  const a = await prisma.artist.findUnique({ where: { id: req.params.id }, select: { avatar: true, avatarMime: true } });
  if (!a?.avatar || !a.avatarMime) throw new HttpError(404, 'Sem foto');
  res.set('Content-Type', a.avatarMime).set('Cache-Control', 'public, max-age=31536000, immutable').send(Buffer.from(a.avatar));
}));

// ---------- Artistas e serviços (públicos) ----------
api.get('/artists', wrap(async (req, res) => {
  const q = text(req.query.q, 'Busca', { max: 80 });
  const style = text(req.query.style, 'Estilo', { max: 80 });
  const where = {};
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { style: { contains: q, mode: 'insensitive' } }];
  if (style) where.style = { equals: style, mode: 'insensitive' };
  const [artists, stats, styles] = await Promise.all([
    prisma.artist.findMany({ where, include: artistInclude(true), orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    artistStats(),
    prisma.artist.findMany({ distinct: ['style'], select: { style: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  res.json({ artists: artists.map((a) => serializeArtist(a, stats)), styles: styles.map((s) => s.style) });
}));

api.get('/artists/:id', wrap(async (req, res) => {
  const [a, stats] = await Promise.all([prisma.artist.findUnique({ where: { id: req.params.id }, include: artistInclude(true) }), artistStats()]);
  if (!a) throw new HttpError(404, 'Artista não encontrado');
  const reviews = await prisma.review.findMany({
    where: { artistId: a.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, rating: true, comment: true, createdAt: true, booking: { select: { clientName: true } } },
  });
  res.json({
    artist: serializeArtist(a, stats),
    reviews: reviews.map(({ booking, ...r }) => ({ ...r, name: (booking?.clientName || 'Cliente').split(/\s+/)[0] })),
  });
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

// ---------- Cartão (pagamento simulado: só valida, nada é guardado) ----------
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

function checkCard(body) {
  const num = digits(body?.number);
  if (num.length < 13 || num.length > 19 || !luhn(num)) throw new HttpError(400, 'Número do cartão inválido');
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(String(body?.expiry || '').trim());
  if (!m) throw new HttpError(400, 'Validade inválida (use MM/AA)');
  const [y, mo] = todayStr().split('-').map(Number);
  const ey = 2000 + Number(m[2]);
  if (ey < y || (ey === y && Number(m[1]) < mo)) throw new HttpError(400, 'Cartão vencido');
  text(body?.holder, 'Nome no cartão', { required: true, max: 80 });
  const cvv = digits(body?.cvv);
  if (cvv.length < 3 || cvv.length > 4) throw new HttpError(400, 'CVV inválido');
}

// ---------- Agendamentos do cliente (identificado pelo celular) ----------
/** Dados que o cliente pode ver (sem dados internos do estúdio). */
function clientView(b) {
  const { client, clientId, ...rest } = serializeBooking(b);
  return rest;
}

/** Agendamento cujo celular confere com o informado. */
async function bookingForPhone(id, rawPhone, include = bookingInclude) {
  const key = phoneKey(rawPhone);
  if (key.length < 10) throw new HttpError(400, 'Informe o celular usado no agendamento');
  const b = await prisma.booking.findUnique({ where: { id }, include });
  if (!b || b.phoneKey !== key) throw new HttpError(404, 'Agendamento não encontrado para esse celular');
  return b;
}

api.post('/bookings', wrap(async (req, res) => {
  limitLookup(`book:${req.ip}`, 20);
  const { raw, key } = mobile(req.body.clientPhone);
  const name = text(req.body.clientName, 'Nome', { max: 100 });
  const { artist, service } = await checkBookable(req.body);
  const notes = text(req.body.notes, 'Detalhes', { max: 1000 });
  const settings = await getSettings();
  const deposit = Math.min(settings.depositCents, service.priceCents);
  const method = deposit > 0 ? oneOf(req.body.paymentMethod, 'Forma de pagamento', ['card', 'pix', 'tap', 'studio']) : 'studio';
  if (method === 'card') checkCard(req.body.card);

  const paysNow = deposit > 0 && method !== 'studio';
  const status = deposit === 0 || paysNow ? 'confirmed' : 'requested';
  const clientName = name || `Cliente ${formatPhone(key)}`;
  const booking = await createBooking(
    {
      clientName,
      clientPhone: raw,
      phoneKey: key,
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
    await notifyAdmins('Nova solicitação de agendamento', `${clientName} · ${service.name} com ${artist.name} · ${when}`, '/admin/agenda');
  } else {
    await notifyAdmins('Novo agendamento confirmado', `${clientName} · ${service.name} com ${artist.name} · ${when}${paysNow ? ` · sinal ${brl(deposit)} pago` : ''}`, '/admin/agenda');
  }
  const full = await prisma.booking.findUnique({ where: { id: booking.id }, include: bookingInclude });
  res.status(201).json({ booking: clientView(full) });
}));

api.get('/bookings/by-phone', wrap(async (req, res) => {
  limitLookup(`list:${req.ip}`);
  const { key } = mobile(req.query.phone);
  const list = await prisma.booking.findMany({
    where: { phoneKey: key },
    include: bookingInclude,
    orderBy: [{ date: 'desc' }, { time: 'desc' }],
    take: 100,
  });
  res.json({ bookings: list.map(clientView), today: todayStr(), now: nowTime() });
}));

api.get('/bookings/:id', wrap(async (req, res) => {
  limitLookup(`get:${req.ip}`);
  const b = await bookingForPhone(req.params.id, req.query.phone, { ...bookingInclude, references: { select: { id: true, note: true } } });
  res.json({ booking: clientView(b) });
}));

api.post('/bookings/:id/cancel', wrap(async (req, res) => {
  const b = await bookingForPhone(req.params.id, req.body.phone);
  if (!ACTIVE_STATUSES.includes(b.status)) throw new HttpError(400, 'Esse agendamento não pode ser cancelado');
  if (b.date < todayStr()) throw new HttpError(400, 'Esse agendamento já passou');
  const reason = text(req.body.reason, 'Motivo', { max: 300 });
  await prisma.booking.update({ where: { id: b.id }, data: { status: 'cancelled', cancelReason: reason || 'Cancelado pelo cliente' } });
  await notifyAdmins('Agendamento cancelado pelo cliente', `${b.clientName} · ${b.service.name} com ${b.artist.name} · ${shortDate(b.date)}, ${b.time}`, '/admin/agenda');
  res.json({ ok: true });
}));

api.post('/bookings/:id/review', wrap(async (req, res) => {
  const b = await bookingForPhone(req.params.id, req.body.phone);
  if (b.status !== 'completed') throw new HttpError(400, 'Avalie depois que a sessão for concluída');
  if (b.review) throw new HttpError(409, 'Você já avaliou esta sessão');
  const rating = int(req.body.rating, 'Nota', { min: 1, max: 5 });
  const comment = text(req.body.comment, 'Comentário', { max: 500 });
  await prisma.review.create({ data: { bookingId: b.id, artistId: b.artistId, rating, comment } });
  res.status(201).json({ ok: true });
}));

// ---------- Referências (imagens anexadas ao agendamento) ----------
api.post('/bookings/:id/references', wrap(async (req, res) => {
  const b = await bookingForPhone(req.params.id, req.body.phone);
  const { mime, data } = image(req.body.image);
  const note = text(req.body.note, 'Descrição', { max: 300 });
  if ((await prisma.reference.count({ where: { bookingId: b.id } })) >= 10) throw new HttpError(400, 'Limite de 10 referências por agendamento');
  const ref = await prisma.reference.create({ data: { bookingId: b.id, note, mime, data }, select: { id: true } });
  res.status(201).json({ reference: ref });
}));

/** Imagem de referência: o admin (token) ou o dono do agendamento (?phone=). */
api.get('/references/:id/image', wrap(async (req, res) => {
  const r = await prisma.reference.findUnique({ where: { id: req.params.id }, include: { booking: { select: { phoneKey: true } } } });
  if (!r) throw new HttpError(404, 'Imagem não encontrada');
  const ok = (await isAdminRequest(req)) || (r.booking && phoneKey(req.query.phone) === r.booking.phoneKey && r.booking.phoneKey.length >= 10);
  if (!ok) throw new HttpError(404, 'Imagem não encontrada');
  res.set('Content-Type', r.mime).set('Cache-Control', 'private, max-age=86400').send(Buffer.from(r.data));
}));

// ---------- Login do estúdio (somente administradores) ----------
api.post('/auth/login', wrap(async (req, res) => {
  const login = email(req.body.login ?? req.body.email);
  const pass = typeof req.body.password === 'string' ? req.body.password : '';
  if (!pass) throw new HttpError(400, 'Informe a senha');
  const key = `${req.ip}:${login}`;
  if (tooManyAttempts(key)) throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos.');
  const user = await prisma.user.findUnique({ where: { email: login } });
  if (!user || user.role !== 'admin' || !(await bcrypt.compare(pass, user.passwordHash))) {
    recordFailure(key);
    throw new HttpError(401, 'E-mail ou senha incorretos');
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
  const tel = phone(req.body.phone);
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

// ---------- Notificações do estúdio ----------
api.get('/notifications', wrap(async (req, res) => {
  const list = await prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ notifications: list });
}));

api.post('/notifications/read-all', wrap(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  res.json({ ok: true });
}));

api.use('/admin', admin);
