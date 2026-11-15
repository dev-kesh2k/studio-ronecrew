import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_STATUSES, BLOCKING_STATUSES, DEFAULT_SCHEDULE, SLOTS, checkSchedule, parseSchedule, slotsOf } from '../src/schedule.js';
import { HttpError } from '../src/validate.js';

test('SLOTS e expediente padrão', () => {
  assert.equal(SLOTS.length, 24);
  assert.equal(SLOTS[9], '09:00');
  assert.equal(DEFAULT_SCHEDULE[0].open, false); // domingo fechado
  assert.ok(DEFAULT_SCHEDULE.slice(1).every((d) => d.open));
});

test('parseSchedule: texto inválido volta ao padrão e horário ruim é corrigido', () => {
  assert.equal(parseSchedule('{'), DEFAULT_SCHEDULE);
  assert.equal(parseSchedule('[]'), DEFAULT_SCHEDULE);
  const dias = Array.from({ length: 7 }, () => ({ open: 1, from: '25:00', to: '20:00' }));
  const r = parseSchedule(JSON.stringify(dias));
  assert.deepEqual(r[3], { open: true, from: '09:00', to: '20:00' });
});

test('checkSchedule: valida dias abertos e ignora horários de dias fechados', () => {
  const ok = DEFAULT_SCHEDULE.map((d, i) => (i === 0 ? { open: false, from: 'x', to: 'y' } : d));
  const salvo = JSON.parse(checkSchedule(ok));
  assert.deepEqual(salvo[0], { open: false, from: '09:00', to: '18:00' });
  const ruim = DEFAULT_SCHEDULE.map((d, i) => (i === 2 ? { open: true, from: '18:00', to: '09:00' } : d));
  assert.throws(() => checkSchedule(ruim), (e) => e instanceof HttpError && /terça/.test(e.message));
  const semHora = DEFAULT_SCHEDULE.map((d, i) => (i === 5 ? { open: true, from: '9h', to: '18:00' } : d));
  assert.throws(() => checkSchedule(semHora), /sexta/);
});

test('checkSchedule: lista com outro tamanho ou JSON quebrado dá 400', () => {
  assert.throws(() => checkSchedule([]), (e) => e.status === 400);
  assert.throws(() => checkSchedule('{quebrado'), (e) => e instanceof HttpError && e.status === 400);
});

test('slotsOf: horários do expediente do dia e vazio quando fechado', () => {
  const agenda = DEFAULT_SCHEDULE.map((d, i) => (i === 6 ? { open: true, from: '10:00', to: '13:00' } : d));
  assert.deepEqual(slotsOf(agenda, '2026-11-21'), ['10:00', '11:00', '12:00']); // sábado
  assert.deepEqual(slotsOf(agenda, '2026-11-15'), []); // domingo
  assert.equal(slotsOf(agenda, '2026-11-16').length, 9);
});

test('status: os que bloqueiam a agenda incluem os ativos e os concluídos', () => {
  for (const s of ACTIVE_STATUSES) assert.ok(BLOCKING_STATUSES.includes(s));
  assert.ok(BLOCKING_STATUSES.includes('completed'));
  assert.ok(!BLOCKING_STATUSES.includes('cancelled'));
});
