import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMinutes, agendaIcs, foldLine, icsLocal, icsText } from '../src/agenda-ics.js';

const sessao = (p) => ({
  id: 'b1', status: 'confirmed', date: '2026-11-20', time: '14:00', durationMin: 120, clientName: 'Ana',
  clientPhone: '', notes: '', service: { name: 'Fine line' }, artist: { name: 'Rone' }, ...p,
});

test('icsText: escapa barra, ponto e vírgula, vírgula e quebra de linha', () => {
  assert.equal(icsText('a\\b;c,d\ne'), 'a\\\\b\;c\\,d\\ne');
  assert.equal(icsText(null), '');
});

test('foldLine: linhas acima de 75 bytes viram continuação com espaço', () => {
  assert.equal(foldLine('curta'), 'curta');
  const longa = `SUMMARY:${'é'.repeat(60)}`;
  const partes = foldLine(longa).split('\r\n');
  assert.ok(partes.length > 1);
  assert.ok(partes.every((p) => Buffer.byteLength(p, 'utf8') <= 75));
  assert.ok(partes.slice(1).every((p) => p.startsWith(' ')));
  assert.equal(partes.map((p, i) => (i ? p.slice(1) : p)).join(''), longa);
});

test('icsLocal e addMinutes: horário local e virada de dia', () => {
  assert.equal(icsLocal('2026-11-20', '09:05'), '20261120T090500');
  assert.deepEqual(addMinutes('2026-11-20', '23:30', 90), { day: '2026-11-21', time: '01:00' });
  assert.deepEqual(addMinutes('2026-12-31', '23:00', 60), { day: '2027-01-01', time: '00:00' });
});

test('agendaIcs: evento com início, fim, status e artista', () => {
  const ics = agendaIcs([sessao({ clientPhone: '(45) 99999-8888' })], { studioName: 'RoneCrew', now: new Date('2026-11-15T12:00:00Z') });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.match(ics, /DTSTART;TZID=America\/Sao_Paulo:20261120T140000/);
  assert.match(ics, /DTEND;TZID=America\/Sao_Paulo:20261120T160000/);
  assert.match(ics, /SUMMARY:Fine line — Ana/);
  assert.match(ics, /STATUS:CONFIRMED/);
  assert.match(ics, /LOCATION:Artista: Rone/);
  assert.match(ics, /DESCRIPTION:Telefone: \(45\) 99999-8888/);
  assert.match(ics, /DTSTAMP:20261115T120000Z/);
});

test('agendaIcs: pendentes como TENTATIVE e canceladas/recusadas fora', () => {
  const ics = agendaIcs([
    sessao({ id: 'a', status: 'requested' }),
    sessao({ id: 'b', status: 'cancelled' }),
    sessao({ id: 'c', status: 'rejected' }),
  ]);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(ics, /UID:a@ronecrew/);
  assert.match(ics, /STATUS:TENTATIVE/);
});

test('agendaIcs (cliente): título com artista e estúdio, endereço e sem telefone', () => {
  const ics = agendaIcs([sessao({ clientPhone: '(45) 99999-8888', notes: 'braço' })], { studioName: 'RoneCrew', client: true, address: 'Rua A, 10' });
  assert.match(ics, /SUMMARY:Fine line com Rone — RoneCrew/);
  assert.match(ics, /LOCATION:Rua A\\, 10/);
  assert.match(ics, /DESCRIPTION:Obs.: braço/);
  assert.ok(!ics.includes('99999'));
});

test('agendaIcs (cliente): sem endereço não manda LOCATION', () => {
  assert.ok(!agendaIcs([sessao({})], { client: true }).includes('LOCATION'));
});
