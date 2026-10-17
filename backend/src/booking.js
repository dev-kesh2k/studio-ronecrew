// Regras de agenda compartilhadas entre cliente e administrador.
import {
  prisma,
  HttpError,
  SLOTS,
  BLOCKING_STATUSES,
  todayStr,
  nowTime,
  weekday,
  toMin,
  isDay,
  addDays,
} from './util.js';

const overlaps = (time, duration, list) => {
  const s = toMin(time);
  const e = s + duration;
  return list.some((b) => {
    const bs = toMin(b.time);
    return s < bs + b.durationMin && bs < e;
  });
};

/** Horários do dia para um artista/duração, marcando os indisponíveis. */
export async function daySlots(artistId, date, durationMin) {
  const today = todayStr();
  const closed = weekday(date) === 0 || date < today;
  const booked = closed
    ? []
    : await prisma.booking.findMany({
        where: { artistId, date, status: { in: BLOCKING_STATUSES } },
        select: { time: true, durationMin: true },
      });
  const now = toMin(nowTime());
  return SLOTS.map((time) => ({
    time,
    available: !closed && !(date === today && toMin(time) <= now) && !overlaps(time, durationMin, booked),
  }));
}

/** Valida artista/serviço/data/hora de um novo agendamento. */
export async function checkBookable({ artistId, serviceId, date, time }) {
  if (!isDay(date)) throw new HttpError(400, 'Data inválida');
  if (!SLOTS.includes(time)) throw new HttpError(400, 'Horário inválido');
  const today = todayStr();
  if (date < today) throw new HttpError(400, 'Não é possível agendar em datas passadas');
  if (date > addDays(today, 365)) throw new HttpError(400, 'Agende com no máximo 1 ano de antecedência');
  if (weekday(date) === 0) throw new HttpError(400, 'O estúdio não abre aos domingos');
  if (date === today && toMin(time) <= toMin(nowTime())) throw new HttpError(400, 'Esse horário já passou');

  const artist = await prisma.artist.findUnique({ where: { id: String(artistId || '') }, include: { services: { select: { id: true } } } });
  if (!artist) throw new HttpError(404, 'Artista não encontrado');
  if (!artist.available) throw new HttpError(409, `${artist.name} não está disponível para agendamento`);
  const service = await prisma.service.findUnique({ where: { id: String(serviceId || '') } });
  if (!service || !service.active) throw new HttpError(404, 'Serviço não disponível');
  if (!artist.services.some((s) => s.id === service.id)) throw new HttpError(400, `${artist.name} não faz ${service.name}`);
  return { artist, service };
}

/**
 * Cria o agendamento (e pagamentos) numa transação com trava por artista,
 * para dois clientes não reservarem o mesmo horário ao mesmo tempo.
 */
export async function createBooking(data, payments = []) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${data.artistId}))) AS l`;
    const booked = await tx.booking.findMany({
      where: { artistId: data.artistId, date: data.date, status: { in: BLOCKING_STATUSES } },
      select: { time: true, durationMin: true },
    });
    if (overlaps(data.time, data.durationMin, booked)) {
      throw new HttpError(409, 'Esse horário acabou de ser reservado. Escolha outro.');
    }
    const booking = await tx.booking.create({ data });
    for (const p of payments) {
      await tx.payment.create({ data: { ...p, bookingId: booking.id, day: todayStr() } });
    }
    return booking;
  });
}

export const bookingInclude = {
  artist: { select: { id: true, name: true } },
  service: { select: { id: true, name: true, icon: true } },
  review: { select: { rating: true, comment: true } },
  client: { select: { id: true, name: true, email: true, phone: true } },
  payments: { select: { id: true, kind: true, method: true, amountCents: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
};

export const paidCents = (b) => (b.payments || []).reduce((s, p) => s + p.amountCents, 0);

export function serializeBooking(b) {
  return { ...b, paidCents: paidCents(b) };
}

// ---------- Artistas ----------
export const artistInclude = (onlyActiveServices) => ({
  services: {
    where: onlyActiveServices ? { active: true } : undefined,
    select: { id: true, name: true, priceCents: true, durationMin: true, icon: true, active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  photos: { select: { id: true }, orderBy: { createdAt: 'asc' } },
});

/** Nota média, nº de avaliações e o artista mais requisitado (últimos 60 dias). */
export async function artistStats() {
  const [ratings, demand] = await Promise.all([
    prisma.review.groupBy({ by: ['artistId'], _avg: { rating: true }, _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ['artistId'],
      where: { status: { in: BLOCKING_STATUSES }, date: { gte: addDays(todayStr(), -60) } },
      _count: { _all: true },
    }),
  ]);
  const rating = new Map(ratings.map((r) => [r.artistId, { avg: r._avg.rating, count: r._count._all }]));
  let top = null;
  let best = 0;
  for (const d of demand) {
    if (d._count._all > best) {
      best = d._count._all;
      top = d.artistId;
    }
  }
  return { rating, top };
}

export function serializeArtist(a, stats, favorites = new Set()) {
  const r = stats.rating.get(a.id);
  return {
    id: a.id,
    name: a.name,
    style: a.style,
    years: a.years,
    bio: a.bio,
    available: a.available,
    unavailableNote: a.unavailableNote,
    avatarVersion: a.avatarMime ? a.avatarVersion : null,
    rating: r ? Math.round(r.avg * 10) / 10 : null,
    reviewsCount: r ? r.count : 0,
    topRequested: stats.top === a.id,
    favorite: favorites.has(a.id),
    services: a.services,
    photos: a.photos.map((p) => p.id),
  };
}
