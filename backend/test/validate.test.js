import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, digits, email, formatPhone, image, int, mobile, oneOf, password, phone, phoneKey, text, url } from '../src/validate.js';

const erro = (status, re) => (e) => e instanceof HttpError && e.status === status && re.test(e.message);

test('text e password', () => {
  assert.equal(text('  Rone  ', 'Nome'), 'Rone');
  assert.throws(() => text('', 'Nome', { required: true }), erro(400, /obrigatório/));
  assert.throws(() => password('curta'), erro(400, /8 caracteres/));
  assert.equal(password('senhaforte'), 'senhaforte');
});

test('email: opcional quando required=false', () => {
  assert.equal(email('Cliente@Mail.com'), 'cliente@mail.com');
  assert.equal(email('', { required: false }), '');
  assert.throws(() => email('', {}), erro(400, /obrigatório/));
  assert.throws(() => email('x@y'), erro(400, /inválido/));
});

test('phone: caracteres de telefone e tamanho', () => {
  assert.equal(phone('+55 (45) 3333-4444'), '+55 (45) 3333-4444');
  assert.equal(phone(''), '');
  assert.throws(() => phone('abc12345'), erro(400, /Telefone inválido/));
  assert.throws(() => phone('', { required: true }), erro(400, /obrigatório/));
});

test('digits, phoneKey, mobile e formatPhone', () => {
  assert.equal(digits('(45) 9.9999-8888'), '45999998888');
  assert.equal(digits(null), '');
  assert.equal(phoneKey('5545999998888'), '45999998888');
  assert.equal(mobile('(45) 99999-8888').key, '45999998888');
  assert.throws(() => mobile('8888-9999'), erro(400, /DDD/));
  assert.equal(formatPhone('45999998888'), '(45) 99999-8888');
});

test('int, oneOf e url', () => {
  assert.equal(int('150', 'Valor'), 150);
  assert.throws(() => int(-1, 'Valor'), erro(400, /entre 0/));
  assert.throws(() => oneOf('x', 'Status', ['confirmed']), erro(400, /Status inválido/));
  assert.equal(url('https://instagram.com/ronecrew', 'Instagram'), 'https://instagram.com/ronecrew');
  assert.throws(() => url('instagram.com', 'Instagram'), erro(400, /https:\/\//));
});

test('image: tipos aceitos e limite de 2,5 MB', () => {
  const webp = `data:image/webp;base64,${Buffer.from('x').toString('base64')}`;
  assert.equal(image(webp).mime, 'image/webp');
  assert.throws(() => image('data:image/svg+xml;base64,PHN2Zz4='), erro(400, /Imagem inválida/));
  assert.throws(() => image(`data:image/png;base64,${Buffer.alloc(2_600_000).toString('base64')}`), erro(413, /grande/));
});
