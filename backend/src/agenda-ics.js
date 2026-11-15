// Agenda do estúdio em iCalendar (.ics, RFC 5545) para importar no Google Agenda / calendário do celular.
// Sem banco: testável.

const STATUS = { requested: 'TENTATIVE', pending_deposit: 'TENTATIVE', confirmed: 'CONFIRMED', completed: 'CONFIRMED' };

/** Escapa texto do iCalendar (\ ; , e quebras de linha). */
export function icsText(v) {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Dobra linhas longas em 75 octetos, como pede a RFC (continuação começa com espaço). */
export function foldLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, 'utf8') > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = '';
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

/** Data/hora local do estúdio no formato do iCalendar (20261115T143000), com o fuso no TZID. */
export const icsLocal = (day, time) => `${day.replace(/-/g, '')}T${time.replace(':', '')}00`;

/** Soma minutos a dia + hora (sem fuso: o horário é sempre o local do estúdio). */
export function addMinutes(day, time, min) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCMinutes(h * 60 + m + min);
  return { day: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

/** Calendário com uma sessão por evento; canceladas e recusadas ficam de fora. */
export function agendaIcs(bookings, { studioName = 'Estúdio', tz = 'America/Sao_Paulo', now = new Date() } = {}) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RoneCrew//Agenda//PT-BR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${icsText(studioName)}`, `X-WR-TIMEZONE:${tz}`];
  for (const b of bookings) {
    const status = STATUS[b.status];
    if (!status) continue;
    const end = addMinutes(b.date, b.time, b.durationMin || 60);
    const desc = [b.clientPhone && `Telefone: ${b.clientPhone}`, b.notes && `Obs.: ${b.notes}`].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.id}@ronecrew`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${tz}:${icsLocal(b.date, b.time)}`,
      `DTEND;TZID=${tz}:${icsLocal(end.day, end.time)}`,
      `SUMMARY:${icsText(`${b.service?.name || 'Sessão'} — ${b.clientName}`)}`,
      `STATUS:${status}`,
      ...(b.artist?.name ? [`LOCATION:${icsText(`Artista: ${b.artist.name}`)}`] : []),
      ...(desc ? [`DESCRIPTION:${icsText(desc)}`] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
