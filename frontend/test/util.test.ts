import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duration, firstName, initials, parseMoney, priceFrom, scheduleLines, waLink, weekStart } from '../src/util.ts';

test('parseMoney: vírgula, milhar e ponto decimal', () => {
  assert.equal(parseMoney('150'), 15000);
  assert.equal(parseMoney('150,00'), 15000);
  assert.equal(parseMoney('1.500,50'), 150050);
  assert.equal(parseMoney('1.500'), 150000);
  assert.equal(parseMoney('150.50'), 15050);
  assert.equal(parseMoney(''), null);
});

test('duration, priceFrom e weekStart', () => {
  assert.equal(duration(45), '45 min');
  assert.equal(duration(60), '1 h');
  assert.equal(duration(150), '2 h 30');
  assert.equal(priceFrom(0), 'Grátis');
  assert.match(priceFrom(15000), /^a partir de R\$\s150$/);
  assert.match(priceFrom(15050), /^a partir de R\$\s150,50$/);
  assert.equal(weekStart('2026-11-15'), '2026-11-09');
  assert.equal(weekStart('2026-11-16'), '2026-11-16');
});

test('initials e firstName', () => {
  assert.equal(initials('Rone Crew Silva'), 'RS');
  assert.equal(initials('  ana  '), 'A');
  assert.equal(initials(''), '?');
  assert.equal(firstName('  Ana Paula '), 'Ana');
});

test('scheduleLines: agrupa dias seguidos iguais e pula fechados', () => {
  const dia = { open: true, from: '09:00', to: '18:00' };
  const sched = [{ open: false, from: '09:00', to: '18:00' }, dia, dia, dia, dia, dia, { open: true, from: '09:00', to: '13:00' }];
  assert.deepEqual(scheduleLines(sched), ['Seg a Sex: 09:00 às 18:00', 'Sáb: 09:00 às 13:00']);
});

test('waLink: põe o 55', () => {
  assert.equal(waLink('(45) 99999-8888', 'oi'), 'https://wa.me/5545999998888?text=oi');
});
