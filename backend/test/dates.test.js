import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, isDay, isMonth, monthRange, nowTime, shortDate, toMin, todayStr, weekStart, weekday } from '../src/dates.js';

test('todayStr e nowTime: fuso de São Paulo', () => {
  const d = new Date('2026-11-16T01:15:00Z');
  assert.equal(todayStr(d), '2026-11-15');
  assert.equal(nowTime(d), '22:15');
});

test('isDay e isMonth', () => {
  assert.equal(isDay('2026-11-15'), true);
  assert.equal(isDay('2026/11/15'), false);
  assert.equal(isMonth('2026-12'), true);
  assert.equal(isMonth('2026-00'), false);
});

test('weekday e weekStart: semana começa na segunda', () => {
  assert.equal(weekday('2026-11-15'), 0);
  assert.equal(weekStart('2026-11-15'), '2026-11-09'); // domingo → segunda anterior
  assert.equal(weekStart('2026-11-16'), '2026-11-16');
  assert.equal(weekStart('2026-11-21'), '2026-11-16');
});

test('addDays e monthRange', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.deepEqual(monthRange('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(monthRange('2026-12'), { from: '2026-12-01', to: '2026-12-31' });
});

test('toMin e shortDate', () => {
  assert.equal(toMin('09:30'), 570);
  assert.equal(shortDate('2026-11-05'), '5 nov');
  assert.equal(shortDate('2026-01-31'), '31 jan');
});
