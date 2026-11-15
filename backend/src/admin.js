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
  checkSchedule,
  url,
  formatPhone,
  ACTIVE_STATUSES,
  BLOCKING_STATUSES,
} from './util.js';
import { isConfigured, notifyClientWA, sendWhatsApp } from './whatsapp.js';
import { agendaIcs } from './agenda-ics.js';
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
    feedbackUnread: await prisma.feedback.count({ where: { read: false } }),
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

/** Sessões do período em .ics (Google Agenda, calendário do celular). Padrão: mês atual. */
admin.get('/agenda.ics', wrap(async (req, res) => {
  const month = String(req.query.month || todayStr().slice(0, 7));
  if (!isMonth(month)) throw new HttpError(400, 'Mês inválido');
  const { from, to } = monthRange(month);
  const [list, settings] = await Promise.all([
    prisma.booking.findMany({
      where: { date: { gte: from, lte: to }, status: { in: BLOCKING_STATUSES } },
      include: bookingInclude,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    }),
    getSettings(),
  ]);
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="agenda-${month}.ics"`);
  res.send(agendaIcs(list, { studioName: settings.studioName }));
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
  notifyClientWA(full.status === 'confirmed' ? 'confirmed' : 'approved', full);
  res.status(201).json({ booking: serializeBooking(full) });
}));

async function loadBooking(id) {
  const b = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!b) throw new HttpError(404, 'Agendamento não encontrado');
  return b;
}

/** Avisa o cliente pelo WhatsApp com os dados já atualizados (sem atrasar a resposta). */
const waAfter = (id, event) =>
  loadBooking(id)
    .then((b) => notifyClientWA(event, b))
    .catch(() => undefined);

admin.post('/bookings/:id/approve', wrap(async (req, res) => {
  const b = await loadBooking(req.params.id);
  if (b.status !== 'requested') throw new HttpError(400, 'Essa solicitação já foi respondida');
  const status = b.depositPaid || b.depositCents === 0 ? 'confirmed' : 'pending_deposit';
  await prisma.booking.update({ where: { id: b.id }, data: { status } });
  waAfter(b.id, 'approved');
  res.json({ status });
}));

admin.post('/bookings/:id/reject', wrap(async (req, res) => {
  const b = await loadBooking(req.params.id);
  if (b.status !== 'requested') throw new HttpError(400, 'Essa solicitação já foi respondida');
  const reason = text(req.body.reason, 'Motivo', { max: 300 });
  await prisma.booking.update({ where: { id: b.id }, data: { status: 'rejected', cancelReason: reason || 'Horário indisponível' } });
  waAfter(b.id, 'rejected');
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
  waAfter(b.id, 'deposit');
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
  waAfter(b.id, 'completed');
  res.json({ status: 'completed', paidCents: paidCents(b) + amount });
}));

admin.post('/bookings/:id/cancel', wrap(async (req, res) => {
  const b = await loadBooking(req.params.id);
  if (!ACTIVE_STATUSES.includes(b.status)) throw new HttpError(400, 'Esse agendamento não pode ser cancelado');
  const reason = text(req.body.reason, 'Motivo', { max: 300 });
  await prisma.booking.update({ where: { id: b.id }, data: { status: 'cancelled', cancelReason: reason || 'Cancelado pelo estúdio' } });
  waAfter(b.id, 'cancelled');
  res.json({ status: 'cancelled' });
}));

// ---------- Equipe ----------
admin.get('/artists', wrap(async (_req, res) => {
  const from = weekStart(todayStr());
  const [artists, stats, week] = await Promise.all([
    prisma.artist.findMany({ where: { archived: false }, include: artistInclude(false), orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
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

/**
 * Exclui da equipe. Sem histórico: apaga de vez. Com histórico: arquiva (some do app, mas os
 * agendamentos e pagamentos antigos continuam com o nome do artista). Agendamentos futuros ativos bloqueiam.
 */
admin.delete('/artists/:id', wrap(async (req, res) => {
  const artist = await prisma.artist.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, archived: true } });
  if (!artist || artist.archived) throw new HttpError(404, 'Artista não encontrado');
  const upcoming = await prisma.booking.count({ where: { artistId: artist.id, status: { in: ACTIVE_STATUSES }, date: { gte: todayStr() } } });
  if (upcoming) {
    throw new HttpError(
      409,
      `${artist.name} tem ${upcoming} ${upcoming === 1 ? 'agendamento futuro' : 'agendamentos futuros'}. Cancele ou remarque na Agenda antes de excluir.`,
    );
  }
  if (await prisma.booking.count({ where: { artistId: artist.id } })) {
    await prisma.$transaction([
      prisma.artistPhoto.deleteMany({ where: { artistId: artist.id } }),
      prisma.artist.update({
        where: { id: artist.id },
        data: { archived: true, available: false, avatar: null, avatarMime: '', services: { set: [] } },
        select: { id: true },
      }),
    ]);
    return res.json({ ok: true, archived: true });
  }
  await prisma.artist.delete({ where: { id: artist.id } });
  res.json({ ok: true, archived: false });
}));

admin.post('/artists/:id/photos', wrap(async (req, res) => {
  const { mime, data } = image(req.body.image);
  if (!(await prisma.artist.findUnique({ where: { id: req.params.id }, select: { id: true } }))) throw new HttpError(404, 'Artista não encontrado');
  if ((await prisma.artistPhoto.count({ where: { artistId: req.params.id } })) >= 30) throw new HttpError(400, 'Limite de 30 fotos no portfólio');
  const photo = await prisma.artistPhoto.create({ data: { artistId: req.params.id, mime, data, status: 'APPROVED' }, select: { id: true } });
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
    omit: { photo: true },
    include: { artists: { where: { archived: false }, select: { id: true, name: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ services, icons: ICONS });
}));

async function artistIds(v) {
  if (!Array.isArray(v)) return [];
  const found = await prisma.artist.findMany({ where: { id: { in: v.map(String).slice(0, 50) }, archived: false }, select: { id: true } });
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
    omit: { photo: true },
  });
  res.status(201).json({ service });
}));

admin.put('/services/:id', wrap(async (req, res) => {
  const data = serviceData(req.body);
  const service = await prisma.service.update({
    where: { id: req.params.id },
    data: { ...data, artists: { set: await artistIds(req.body.artistIds) } },
    omit: { photo: true },
  });
  res.json({ service });
}));

admin.post('/services/:id/photo', wrap(async (req, res) => {
  const { mime, data } = image(req.body.image);
  if (data.length > 600_000) throw new HttpError(413, 'Foto muito grande (máx. 600 KB)');
  const s = await prisma.service.update({
    where: { id: req.params.id },
    data: { photo: data, photoMime: mime, photoVersion: { increment: 1 } },
    select: { photoVersion: true },
  });
  res.json({ photoVersion: s.photoVersion });
}));

admin.delete('/services/:id/photo', wrap(async (req, res) => {
  await prisma.service.update({ where: { id: req.params.id }, data: { photo: null, photoMime: '', photoVersion: 0 }, select: { id: true } });
  res.json({ photoVersion: 0 });
}));

admin.patch('/services/:id/active', wrap(async (req, res) => {
  const service = await prisma.service.update({ where: { id: req.params.id }, data: { active: req.body.active === true }, omit: { photo: true } });
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
/** O token do WhatsApp nunca volta inteiro para o navegador. */
async function settingsView() {
  const s = await getSettings();
  const { waToken, ...rest } = s;
  return { ...rest, waTokenSet: !!waToken, waTokenHint: waToken ? `••••${waToken.slice(-4)}` : '', waConfigured: isConfigured(s) };
}

admin.get('/settings', wrap(async (_req, res) => {
  res.json({ settings: await settingsView() });
}));

const handle = (v) => text(v, 'Rede social', { max: 120 }).replace(/^@/, '');
// Validação de cada campo; só os campos enviados são gravados.
const SETTING_FIELDS = {
  studioName: (v) => text(v, 'Nome do estúdio', { required: true, max: 60 }),
  depositCents: (v) => String(int(v, 'Valor do sinal', { min: 0, max: 10_000_000 })),
  phone: (v) => phone(v),
  whatsapp: (v) => phone(v),
  address: (v) => text(v, 'Endereço', { max: 200 }),
  hours: (v) => text(v, 'Observação do horário', { max: 300 }),
  schedule: (v) => checkSchedule(v),
  about: (v) => text(v, 'Sobre o estúdio', { max: 3000 }),
  instagram: handle,
  facebook: (v) => url(v, 'Facebook'),
  tiktok: handle,
  youtube: (v) => url(v, 'YouTube'),
  website: (v) => url(v, 'Site'),
  googleReviewUrl: (v) => url(v, 'Link de avaliação do Google'),
  appUrl: (v) => url(v, 'Endereço do app'),
  waEnabled: (v) => String(v === true || v === 'true'),
  waPhoneNumberId: (v) => {
    const s = text(v, 'ID do número', { max: 40 });
    if (s && !/^\d{6,30}$/.test(s)) throw new HttpError(400, 'ID do número do WhatsApp: só números (veja no painel da Meta)');
    return s;
  },
  waMode: (v) => oneOf(v, 'Modo de envio', ['text', 'template']),
  waTemplate: (v) => {
    const s = text(v, 'Nome do modelo', { max: 120 });
    if (s && !/^[a-z0-9_]+$/.test(s)) throw new HttpError(400, 'Nome do modelo: letras minúsculas, números e _');
    return s;
  },
  waLanguage: (v) => {
    const s = text(v, 'Idioma do modelo', { max: 10 }) || 'pt_BR';
    if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(s)) throw new HttpError(400, 'Idioma do modelo inválido (ex.: pt_BR)');
    return s;
  },
  waNotifyStudio: (v) => String(v === true || v === 'true'),
  waReminders: (v) => String(v === true || v === 'true'),
};

admin.post('/logo', wrap(async (req, res) => {
  const { mime, data } = image(req.body.image);
  if (data.length > 600_000) throw new HttpError(413, 'Logo muito grande (máx. 600 KB)');
  const cur = Number((await prisma.setting.findUnique({ where: { key: 'logoVersion' } }))?.value) || 0;
  const version = String(cur + 1);
  await prisma.$transaction([
    prisma.setting.upsert({ where: { key: 'logo' }, update: { value: `data:${mime};base64,${data.toString('base64')}` }, create: { key: 'logo', value: `data:${mime};base64,${data.toString('base64')}` } }),
    prisma.setting.upsert({ where: { key: 'logoVersion' }, update: { value: version }, create: { key: 'logoVersion', value: version } }),
  ]);
  res.json({ logoVersion: Number(version) });
}));

admin.delete('/logo', wrap(async (_req, res) => {
  await prisma.setting.deleteMany({ where: { key: { in: ['logo', 'logoVersion'] } } });
  res.json({ logoVersion: 0 });
}));

admin.put('/settings', wrap(async (req, res) => {
  const values = {};
  for (const [key, fn] of Object.entries(SETTING_FIELDS)) if (key in req.body) values[key] = fn(req.body[key]);
  if (req.body.waTokenClear) values.waToken = '';
  else if (typeof req.body.waToken === 'string' && req.body.waToken.trim()) values.waToken = text(req.body.waToken, 'Token', { max: 1000 });
  const next = { ...(await getSettings()), ...values };
  if (next.waEnabled === 'true' && (!next.waToken || !next.waPhoneNumberId)) {
    throw new HttpError(400, 'Para ligar o WhatsApp informe o token e o ID do número');
  }
  if (next.waEnabled === 'true' && next.waMode === 'template' && !next.waTemplate) throw new HttpError(400, 'Informe o nome do modelo aprovado');
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) => prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })),
  );
  res.json({ settings: await settingsView() });
}));

// ---------- WhatsApp: teste e histórico ----------
admin.post('/whatsapp/test', wrap(async (req, res) => {
  const s = await getSettings();
  if (!isConfigured(s)) throw new HttpError(400, 'Ligue o WhatsApp e salve o token e o ID do número antes de testar');
  const to = req.body.to ? phone(req.body.to) : s.whatsapp;
  if (!to) throw new HttpError(400, 'Informe o número para o teste');
  const r = await sendWhatsApp(to, `Teste do ${s.studioName}: as notificações pelo WhatsApp estão funcionando.`, 'test', s);
  if (!r.ok) throw new HttpError(422, `A API do WhatsApp recusou: ${r.error}`);
  res.json({ ok: true });
}));

admin.get('/whatsapp/log', wrap(async (_req, res) => {
  res.json({ log: await prisma.whatsAppLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }) });
}));

// ---------- Feedback, avaliações e comentários dos clientes ----------
admin.get('/feedback', wrap(async (_req, res) => {
  const [feedback, reviews, comments] = await Promise.all([
    prisma.feedback.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        artist: { select: { name: true } },
        booking: { select: { clientName: true, clientPhone: true, date: true, service: { select: { name: true } } } },
      },
    }),
    prisma.photoComment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, name: true, text: true, createdAt: true, phoneKey: true, photo: { select: { id: true, artist: { select: { name: true } } } } },
    }),
  ]);
  const avg = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null;
  res.json({
    feedback: feedback.map((f) => ({ ...f, phone: f.phoneKey ? formatPhone(f.phoneKey) : '' })),
    reviews,
    comments: comments.map(({ phoneKey: k, ...c }) => ({ ...c, phone: formatPhone(k) })),
    stats: { reviews: reviews.length, average: avg, unreadFeedback: feedback.filter((f) => !f.read).length },
  });
}));

admin.patch('/feedback/:id', wrap(async (req, res) => {
  await prisma.feedback.update({ where: { id: req.params.id }, data: { read: req.body.read !== false } });
  res.json({ ok: true });
}));

admin.delete('/feedback/:id', wrap(async (req, res) => {
  await prisma.feedback.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));
