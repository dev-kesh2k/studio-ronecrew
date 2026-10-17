import express from 'express';
import {
  prisma,
  HttpError,
  wrap,
  requireAdmin,
  todayStr,
  nowTime,
  isDay,
  isMonth,
  addDays,
  weekStart,
  monthRange,
  toMin,
  text,
  phone,
  mobile,
  int,
  oneOf,
  image,
  getSettings,
  SETTING_DEFAULTS,
  ACTIVE_STATUSES,
  BLOCKING_STATUSES,
} from './util.js';
import { checkBookable, createBooking, bookingInclude, serializeBooking, paidCents, artistInclude, artistStats, serializeArtist } from './booking.js';

export const admin = express.Router();
admin.use(requireAdmin);

const sumPayments = async (where) => (await prisma.payment.aggregate({ where, _sum: { amountCents: true } }))._sum.amountCents || 0;
const PAY_METHODS = ['cash', 'pix', 'card', 'tap'];

// ---------- Painel ----------
admin.get('/dashboard', wrap(async (req, res) => {
  const today = todayStr();
  const now = toMin(nowTime());
  const [todays, revenueToday, revenueLastWeek, pendingRequests, dueList, upcomingRaw, settings, unread] = await Promise.all([
    prisma.booking.findMany({ where: { date: today, status: { in: ['pending_deposit', 'confirmed', 'completed'] } }, select: { status: true } }),
    sumPayments({ day: today }),
    sumPayments({ day: addDays(today, -7) }),
    prisma.booking.count({ where: { status: 'requested', date: { gte: today } } }),
    prisma.booking.findMany({ where: { status: 'pending_deposit', date: { gte: today } }, select: { depositCents: true, clientName: true, clientId: true } }),
    prisma.booking.findMany({
      where: { status: { in: ['pending_deposit', 'confirmed'] }, date: { gte: today } },
      include: bookingInclude,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 12,
    }),
    getSettings(),
    prisma.notification.count({ where: { userId: req.user.id, read: false } }),
  ]);
  const upcoming = upcomingRaw.filter((b) => b.date > today || toMin(b.time) + b.durationMin > now).slice(0, 5);
  res.json({
    today,
    studioName: settings.studioName,
    sessionsToday: todays.length,
    completedToday: todays.filter((b) => b.status === 'completed').length,
    revenueToday,
    revenueLastWeek,
    revenueChange: revenueLastWeek > 0 ? Math.round(((revenueToday - revenueLastWeek) / revenueLastWeek) * 100) : null,
    pendingRequests,
    depositsDue: dueList.reduce((s, b) => s + b.depositCents, 0),
    depositsDueClients: new Set(dueList.map((b) => b.clientId || b.clientName)).size,
    upcoming: upcoming.map(serializeBooking),
    unread,
  });
}));

// ---------- Agenda ----------
admin.get('/bookings', wrap(async (req, res) => {
  const from = String(req.query.from || '');
  const to = String(req.query.to || from);
  if (!isDay(from) || !isDay(to) || to < from || to > addDays(from, 62)) throw new HttpError(400, 'Período inválido');
  const list = await prisma.booking.findMany({
    where: { date: { gte: from, lte: to }, status: { in: [...BLOCKING_STATUSES, 'cancelled', 'rejected'] } },
    include: bookingInclude,
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  });
  res.json({ bookings: list.map(serializeBooking), today: todayStr() });
}));

admin.get('/requests', wrap(async (_req, res) => {
  const list = await prisma.booking.findMany({
    where: { status: 'requested', date: { gte: todayStr() } },
    include: bookingInclude,
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  });
  res.json({ requests: list.map(serializeBooking) });
}));

admin.post('/bookings', wrap(async (req, res) => {
  const { artist, service } = await checkBookable(req.body);
  const clientName = text(req.body.clientName, 'Nome do cliente', { required: true, max: 100 });
  const { raw: clientPhone, key } = mobile(req.body.clientPhone);
  const notes = text(req.body.notes, 'Observações', { max: 1000 });
  const settings = await getSettings();
  const deposit = Math.min(settings.depositCents, service.priceCents);
  const received = deposit > 0 && !!req.body.depositReceived;
  const method = received ? oneOf(req.body.depositMethod || 'cash', 'Forma de pagamento', PAY_METHODS) : 'studio';
  const booking = await createBooking(
    {
      clientName,
      clientPhone,
      phoneKey: key,
      artistId: artist.id,
      serviceId: service.id,
      date: req.body.date,
      time: req.body.time,
      durationMin: service.durationMin,
      priceCents: service.priceCents,
      depositCents: deposit,
      status: deposit === 0 || received ? 'confirmed' : 'pending_deposit',
      paymentMethod: method,
      depositPaid: received,
      notes,
    },
    received ? [{ kind: 'deposit', method, amountCents: deposit }] : [],
  );
  const full = await prisma.booking.findUnique({ where: { id: booking.id }, include: bookingInclude });
  res.status(201).json({ booking: serializeBooking(full) });
}));

async function loadBooking(id) {
  const b = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!b) throw new HttpError(404, 'Agendamento não encontrado');
  return b;
}

admin.post('/bookings/:id/approve', wrap(async (req, res) => {
  const b = await loadBooking(req.params.id);
  if (b.status !== 'requested') throw new HttpError(400, 'Essa solicitação já foi respondida');
  const status = b.depositPaid || b.depositCents === 0 ? 'confirmed' : 'pending_deposit';
  await prisma.booking.update({ where: { id: b.id }, data: { status } });
  res.json({ status });
}));

admin.post('/bookings/:id/reject', wrap(async (req, res) => {
  const b = await loadBooking(req.params.id);
  if (b.status !== 'requested') throw new HttpError(400, 'Essa solicitação já foi respondida');
  const reason = text(req.body.reason, 'Motivo', { max: 300 });
  await prisma.booking.update({ where: { id: b.id }, data: { status: 'rejected', cancelReason: reason || 'Horário indisponível' } });
  res.json({ status: 'rejected' });
}));

admin.post('/bookings/:id/deposit', wrap(async (req, res) => {
  const b = await loadBooking(req.params.id);
  if (b.status !== 'pending_deposit') throw new HttpError(400, 'Esse agendamento não está com sinal pendente');
  const method = oneOf(req.body.method || 'cash', 'Forma de pagamento', PAY_METHODS);
  await prisma.$transaction([
    prisma.booking.update({ where: { id: b.id }, data: { status: 'confirmed', depositPaid: true } }),
    prisma.payment.create({ data: { bookingId: b.id, kind: 'deposit', method, amountCents: b.depositCents, day: todayStr() } }),
  ]);
  res.json({ status: 'confirmed' });
}));

admin.post('/bookings/:id/complete', wrap(async (req, res) => {
  const b = await loadBooking(req.params.id);
  if (!['pending_deposit', 'confirmed'].includes(b.status)) throw new HttpError(400, 'Só sessões confirmadas podem ser concluídas');
  if (b.date > todayStr()) throw new HttpError(400, 'A sessão ainda não aconteceu');
  const amount = int(req.body.amountCents, 'Valor recebido', { min: 0, max: 100_000_000 });
  const method = oneOf(req.body.method || 'cash', 'Forma de pagamento', PAY_METHODS);
  await prisma.$transaction([
    prisma.booking.update({ where: { id: b.id }, data: { status: 'completed', completedAt: new Date() } }),
    ...(amount > 0 ? [prisma.payment.create({ data: { bookingId: b.id, kind: 'final', method, amountCents: amount, day: todayStr() } })] : []),
  ]);
  res.json({ status: 'completed', paidCents: paidCents(b) + amount });
}));

admin.post('/bookings/:id/cancel', wrap(async (req, res) => {
  const b = await loadBooking(req.params.id);
  if (!ACTIVE_STATUSES.includes(b.status)) throw new HttpError(400, 'Esse agendamento não pode ser cancelado');
  const reason = text(req.body.reason, 'Motivo', { max: 300 });
  await prisma.booking.update({ where: { id: b.id }, data: { status: 'cancelled', cancelReason: reason || 'Cancelado pelo estúdio' } });
  res.json({ status: 'cancelled' });
}));

// ---------- Equipe ----------
admin.get('/artists', wrap(async (_req, res) => {
  const from = weekStart(todayStr());
  const [artists, stats, week] = await Promise.all([
    prisma.artist.findMany({ include: artistInclude(false), orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    artistStats(),
    prisma.booking.groupBy({
      by: ['artistId'],
      where: { date: { gte: from, lte: addDays(from, 6) }, status: { in: BLOCKING_STATUSES } },
      _count: { _all: true },
    }),
  ]);
  const weekMap = new Map(week.map((w) => [w.artistId, w._count._all]));
  res.json({ artists: artists.map((a) => ({ ...serializeArtist(a, stats), weekSessions: weekMap.get(a.id) || 0 })) });
}));

async function serviceIds(v) {
  if (!Array.isArray(v)) return [];
  const ids = v.map(String).slice(0, 50);
  const found = await prisma.service.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return found.map((s) => ({ id: s.id }));
}

function artistData(body) {
  return {
    name: text(body.name, 'Nome', { required: true, max: 80 }),
    style: text(body.style, 'Estilo', { required: true, max: 40 }),
    years: int(body.years ?? 0, 'Anos de experiência', { min: 0, max: 70 }),
    bio: text(body.bio, 'Sobre', { max: 1000 }),
    available: body.available !== false,
    unavailableNote: text(body.unavailableNote, 'Observação', { max: 80 }),
  };
}

admin.post('/artists', wrap(async (req, res) => {
  const data = artistData(req.body);
  const max = await prisma.artist.aggregate({ _max: { sortOrder: true } });
  const artist = await prisma.artist.create({
    data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1, services: { connect: await serviceIds(req.body.serviceIds) } },
  });
  res.status(201).json({ artist });
}));

admin.put('/artists/:id', wrap(async (req, res) => {
  const data = artistData(req.body);
  const artist = await prisma.artist.update({
    where: { id: req.params.id },
    data: { ...data, services: { set: await serviceIds(req.body.serviceIds) } },
  });
  res.json({ artist });
}));

admin.patch('/artists/:id/available', wrap(async (req, res) => {
  const available = req.body.available === true;
  const artist = await prisma.artist.update({
    where: { id: req.params.id },
    data: { available, ...(available ? { unavailableNote: '' } : {}) },
  });
  res.json({ artist });
}));

admin.delete('/artists/:id', wrap(async (req, res) => {
  if (await prisma.booking.count({ where: { artistId: req.params.id } })) {
    throw new HttpError(409, 'Artista tem agendamentos no histórico. Desative a disponibilidade em vez de excluir.');
  }
  await prisma.artist.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

admin.post('/artists/:id/photos', wrap(async (req, res) => {
  const { mime, data } = image(req.body.image);
  if (!(await prisma.artist.findUnique({ where: { id: req.params.id }, select: { id: true } }))) throw new HttpError(404, 'Artista não encontrado');
  if ((await prisma.artistPhoto.count({ where: { artistId: req.params.id } })) >= 12) throw new HttpError(400, 'Limite de 12 fotos no portfólio');
  const photo = await prisma.artistPhoto.create({ data: { artistId: req.params.id, mime, data }, select: { id: true } });
  res.status(201).json({ photo });
}));

admin.post('/artists/:id/avatar', wrap(async (req, res) => {
  const { mime, data } = image(req.body.image);
  if (data.length > 600_000) throw new HttpError(413, 'Foto muito grande (máx. 600 KB)');
  const artist = await prisma.artist.update({
    where: { id: req.params.id },
    data: { avatar: data, avatarMime: mime, avatarVersion: { increment: 1 } },
    select: { id: true, avatarVersion: true },
  });
  res.json({ avatarVersion: artist.avatarVersion });
}));

admin.delete('/artists/:id/avatar', wrap(async (req, res) => {
  await prisma.artist.update({ where: { id: req.params.id }, data: { avatar: null, avatarMime: '' }, select: { id: true } });
  res.json({ avatarVersion: null });
}));

admin.delete('/photos/:id', wrap(async (req, res) => {
  await prisma.artistPhoto.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Serviços ----------
const ICONS = ['pen', 'diamond', 'eye', 'refresh', 'ring', 'chat', 'droplet', 'star'];

admin.get('/services', wrap(async (_req, res) => {
  const services = await prisma.service.findMany({
    include: { artists: { select: { id: true, name: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ services, icons: ICONS });
}));

async function artistIds(v) {
  if (!Array.isArray(v)) return [];
  const found = await prisma.artist.findMany({ where: { id: { in: v.map(String).slice(0, 50) } }, select: { id: true } });
  return found.map((a) => ({ id: a.id }));
}

function serviceData(body) {
  return {
    name: text(body.name, 'Nome', { required: true, max: 60 }),
    description: text(body.description, 'Descrição', { max: 300 }),
    priceCents: int(body.priceCents, 'Preço', { min: 0, max: 100_000_000 }),
    durationMin: int(body.durationMin, 'Duração', { min: 15, max: 600 }),
    icon: ICONS.includes(body.icon) ? body.icon : 'pen',
    active: body.active !== false,
  };
}

admin.post('/services', wrap(async (req, res) => {
  const data = serviceData(req.body);
  const max = await prisma.service.aggregate({ _max: { sortOrder: true } });
  const service = await prisma.service.create({
    data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1, artists: { connect: await artistIds(req.body.artistIds) } },
  });
  res.status(201).json({ service });
}));

admin.put('/services/:id', wrap(async (req, res) => {
  const data = serviceData(req.body);
  const service = await prisma.service.update({
    where: { id: req.params.id },
    data: { ...data, artists: { set: await artistIds(req.body.artistIds) } },
  });
  res.json({ service });
}));

admin.patch('/services/:id/active', wrap(async (req, res) => {
  const service = await prisma.service.update({ where: { id: req.params.id }, data: { active: req.body.active === true } });
  res.json({ service });
}));

admin.delete('/services/:id', wrap(async (req, res) => {
  if (await prisma.booking.count({ where: { serviceId: req.params.id } })) {
    throw new HttpError(409, 'Serviço tem agendamentos no histórico. Desative em vez de excluir.');
  }
  await prisma.service.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ---------- Financeiro ----------
admin.get('/finance', wrap(async (req, res) => {
  const today = todayStr();
  const month = isMonth(req.query.month) ? req.query.month : today.slice(0, 7);
  const { from, to } = monthRange(month);
  const [y, m] = month.split('-').map(Number);
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const prev = monthRange(prevMonth);

  const [payments, prevRevenue, due] = await Promise.all([
    prisma.payment.findMany({
      where: { day: { gte: from, lte: to } },
      include: { booking: { select: { id: true, clientName: true, date: true, service: { select: { name: true } }, artist: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    sumPayments({ day: { gte: prev.from, lte: prev.to } }),
    prisma.booking.findMany({ where: { status: 'pending_deposit' }, select: { depositCents: true } }),
  ]);

  const revenue = payments.reduce((s, p) => s + p.amountCents, 0);
  const deposits = payments.filter((p) => p.kind === 'deposit');

  // Semanas (segunda a domingo) recortadas dentro do mês.
  const weeks = [];
  let start = from;
  while (start <= to) {
    let end = addDays(weekStart(start), 6);
    if (end > to) end = to;
    const total = payments.filter((p) => p.day >= start && p.day <= end).reduce((s, p) => s + p.amountCents, 0);
    weeks.push({ label: `Sem ${weeks.length + 1}`, from: start, to: end, totalCents: total, current: today >= start && today <= end });
    start = addDays(end, 1);
  }

  res.json({
    month,
    revenue,
    prevRevenue,
    revenueChange: prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null,
    depositsReceived: deposits.reduce((s, p) => s + p.amountCents, 0),
    depositsReceivedCount: deposits.length,
    depositsDue: due.reduce((s, b) => s + b.depositCents, 0),
    depositsDueCount: due.length,
    weeks,
    recent: payments.slice(0, 20),
  });
}));

// ---------- Configurações ----------
admin.get('/settings', wrap(async (_req, res) => {
  res.json({ settings: await getSettings() });
}));

admin.put('/settings', wrap(async (req, res) => {
  const values = {
    studioName: text(req.body.studioName, 'Nome do estúdio', { required: true, max: 60 }),
    depositCents: String(int(req.body.depositCents, 'Valor do sinal', { min: 0, max: 10_000_000 })),
    phone: phone(req.body.phone),
    whatsapp: phone(req.body.whatsapp),
    address: text(req.body.address, 'Endereço', { max: 200 }),
    instagram: text(req.body.instagram, 'Instagram', { max: 60 }).replace(/^@/, ''),
  };
  await prisma.$transaction(
    Object.keys(SETTING_DEFAULTS).map((key) =>
      prisma.setting.upsert({ where: { key }, update: { value: values[key] }, create: { key, value: values[key] } }),
    ),
  );
  res.json({ settings: await getSettings() });
}));
