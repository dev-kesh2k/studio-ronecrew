// Recursos do cliente sem conta (identificado pelo celular salvo no aparelho):
// perfil e avatar, feedback, curtidas e comentários da galeria.
import express from 'express';
import { prisma, HttpError, wrap, text, oneOf, image, mobile, limitLookup, notifyAdmins, isAdminRequest, formatPhone } from './util.js';

export const social = express.Router();

/** URL relativa do avatar do cliente (id opaco, nunca o número). */
export const avatarOf = (p) => (p?.avatarMime && p.avatarVersion ? `client-avatars/${p.id}?v=${p.avatarVersion}` : null);

export async function profilesByPhone(keys) {
  const list = [...new Set(keys.filter(Boolean))];
  if (!list.length) return new Map();
  const rows = await prisma.clientProfile.findMany({ where: { phoneKey: { in: list } } });
  return new Map(rows.map((r) => [r.phoneKey, r]));
}

const profileView = (p) => ({ name: p?.name || '', avatar: avatarOf(p) });

// ---------- Perfil e avatar ----------
social.get('/client-profile', wrap(async (req, res) => {
  limitLookup(`prof:${req.ip}`);
  const { key } = mobile(req.query.phone);
  res.json({ profile: profileView(await prisma.clientProfile.findUnique({ where: { phoneKey: key } })) });
}));

social.put('/client-profile', wrap(async (req, res) => {
  limitLookup(`prof:${req.ip}`);
  const { key } = mobile(req.body.phone);
  const name = text(req.body.name, 'Nome', { max: 100 });
  const p = await prisma.clientProfile.upsert({ where: { phoneKey: key }, update: { name }, create: { phoneKey: key, name } });
  res.json({ profile: profileView(p) });
}));

social.post('/client-profile/avatar', wrap(async (req, res) => {
  limitLookup(`avatar:${req.ip}`, 20);
  const { key } = mobile(req.body.phone);
  const { mime, data } = image(req.body.image);
  if (data.length > 600_000) throw new HttpError(413, 'Foto muito grande (máx. 600 KB)');
  const p = await prisma.clientProfile.upsert({
    where: { phoneKey: key },
    update: { avatar: data, avatarMime: mime, avatarVersion: { increment: 1 } },
    create: { phoneKey: key, avatar: data, avatarMime: mime, avatarVersion: 1 },
  });
  res.json({ profile: profileView(p) });
}));

social.delete('/client-profile/avatar', wrap(async (req, res) => {
  const { key } = mobile(req.body?.phone ?? req.query.phone);
  const p = await prisma.clientProfile.update({ where: { phoneKey: key }, data: { avatar: null, avatarMime: '' } }).catch(() => null);
  res.json({ profile: profileView(p) });
}));

social.get('/client-avatars/:id', wrap(async (req, res) => {
  const p = await prisma.clientProfile.findUnique({ where: { id: req.params.id }, select: { avatar: true, avatarMime: true } });
  if (!p?.avatar || !p.avatarMime) throw new HttpError(404, 'Sem foto');
  res.set('Content-Type', p.avatarMime).set('Cache-Control', 'public, max-age=31536000, immutable').send(Buffer.from(p.avatar));
}));

// ---------- Feedback ----------
const KINDS = ['elogio', 'sugestao', 'reclamacao', 'outro'];
const KIND_LABEL = { elogio: 'Elogio', sugestao: 'Sugestão', reclamacao: 'Reclamação', outro: 'Mensagem' };

social.post('/feedback', wrap(async (req, res) => {
  limitLookup(`fb:${req.ip}`, 10);
  const kind = oneOf(req.body.kind, 'Tipo', KINDS);
  const message = text(req.body.message, 'Mensagem', { required: true, max: 2000 });
  const name = text(req.body.name, 'Nome', { max: 100 });
  const key = req.body.phone ? mobile(req.body.phone).key : '';
  await prisma.feedback.create({ data: { kind, message, name, phoneKey: key } });
  await notifyAdmins(`Feedback: ${KIND_LABEL[kind]}`, `${name || (key ? formatPhone(key) : 'Anônimo')}: ${message.slice(0, 140)}`, '/admin/feedback');
  res.status(201).json({ ok: true });
}));

// ---------- Galeria: curtidas e comentários ----------
const voterOf = (v) => {
  const s = String(v || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(s)) throw new HttpError(400, 'Aparelho inválido');
  return s;
};

social.get('/gallery', wrap(async (req, res) => {
  const artistId = text(req.query.artistId, 'Artista', { max: 40 });
  const voter = /^[A-Za-z0-9-]{8,64}$/.test(String(req.query.voter || '')) ? String(req.query.voter) : '';
  const photos = await prisma.artistPhoto.findMany({
    where: { status: 'APPROVED', artist: { archived: false }, ...(artistId ? { artistId } : {}) },
    select: {
      id: true,
      createdAt: true,
      artist: { select: { id: true, name: true, style: true, available: true } },
      _count: { select: { likes: true, comments: true } },
      ...(voter ? { likes: { where: { voter }, select: { voter: true } } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json({
    photos: photos.map(({ _count, likes, ...p }) => ({ ...p, likes: _count.likes, comments: _count.comments, liked: !!likes?.length })),
  });
}));

// Upload de fotos pendentes de aprovação (cliente)
social.post('/gallery/upload', wrap(async (req, res) => {
  limitLookup(`upload:${req.ip}`, 20);
  const artistId = text(req.body.artistId, 'Artista', { max: 40 });
  const name = text(req.body.name, 'Seu nome', { max: 60 });
  const { mime, data } = image(req.body.image);
  if (data.length > 3_000_000) throw new HttpError(413, 'Foto muito grande (máx. 3 MB)');

  const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true, name: true } });
  if (!artist) throw new HttpError(404, 'Artista não encontrado');

  const photo = await prisma.artistPhoto.create({
    data: { artistId, mime, data, status: 'PENDING', uploadedBy: name }
  });

  await notifyAdmins('📸 Nova foto aguardando aprovação', `${name} enviou uma foto para ${artist.name}`, '/admin/feedback?tab=fotos');
  res.status(201).json({ photoId: photo.id, ok: true });
}));

social.post('/gallery/:id/like', wrap(async (req, res) => {
  limitLookup(`like:${req.ip}`, 300);
  const voter = voterOf(req.body.voter);
  const photo = await prisma.artistPhoto.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!photo) throw new HttpError(404, 'Foto não encontrada');
  const where = { photoId_voter: { photoId: photo.id, voter } };
  let liked;
  if (await prisma.photoLike.findUnique({ where })) {
    await prisma.photoLike.delete({ where });
    liked = false;
  } else {
    await prisma.photoLike.create({ data: { photoId: photo.id, voter } }).catch((e) => {
      if (e?.code !== 'P2002') throw e; // dois toques ao mesmo tempo
    });
    liked = true;
  }
  res.json({ liked, likes: await prisma.photoLike.count({ where: { photoId: photo.id } }) });
}));

async function commentsView(photoId, viewerKey) {
  const list = await prisma.photoComment.findMany({ where: { photoId }, orderBy: { createdAt: 'asc' }, take: 200 });
  const profiles = await profilesByPhone(list.map((c) => c.phoneKey));
  return list.map((c) => {
    const p = profiles.get(c.phoneKey);
    return { id: c.id, name: p?.name || c.name, avatar: avatarOf(p), text: c.text, createdAt: c.createdAt, mine: !!viewerKey && c.phoneKey === viewerKey };
  });
}

social.get('/gallery/:id/comments', wrap(async (req, res) => {
  const key = req.query.phone ? mobile(req.query.phone).key : '';
  res.json({ comments: await commentsView(req.params.id, key) });
}));

social.post('/gallery/:id/comments', wrap(async (req, res) => {
  limitLookup(`cmt:${req.ip}`, 30);
  const { key } = mobile(req.body.phone);
  const name = text(req.body.name, 'Nome', { required: true, max: 60 });
  const body = text(req.body.text, 'Comentário', { required: true, max: 500 });
  const photo = await prisma.artistPhoto.findUnique({ where: { id: req.params.id }, select: { id: true, artist: { select: { name: true } } } });
  if (!photo) throw new HttpError(404, 'Foto não encontrada');
  await prisma.photoComment.create({ data: { photoId: photo.id, phoneKey: key, name, text: body } });
  // O nome usado no comentário vira o nome do perfil, se ainda não houver um.
  await prisma.clientProfile.upsert({ where: { phoneKey: key }, update: {}, create: { phoneKey: key, name } });
  await notifyAdmins('Novo comentário na galeria', `${name} em ${photo.artist.name}: "${body.slice(0, 120)}"`, '/admin/feedback?tab=comentarios');
  res.status(201).json({ comments: await commentsView(photo.id, key) });
}));

social.delete('/gallery/comments/:id', wrap(async (req, res) => {
  const c = await prisma.photoComment.findUnique({ where: { id: req.params.id } });
  if (!c) throw new HttpError(404, 'Comentário não encontrado');
  const key = req.body?.phone || req.query.phone ? mobile(req.body?.phone ?? req.query.phone).key : '';
  if (c.phoneKey !== key && !(await isAdminRequest(req))) throw new HttpError(403, 'Só quem escreveu (ou o estúdio) pode apagar');
  await prisma.photoComment.delete({ where: { id: c.id } });
  res.json({ ok: true });
}));

// ---------- Admin: Aprovação de fotos ----------
// Listar fotos pendentes
social.get('/admin/gallery/pending', wrap(async (req, res) => {
  if (!(await isAdminRequest(req))) throw new HttpError(403, 'Acesso negado');
  const photos = await prisma.artistPhoto.findMany({
    where: { status: 'PENDING' },
    include: { artist: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    photos: photos.map(({ data, ...p }) => ({ ...p, mime: p.mime })),
  });
}));

// Ver uma foto pendente (com dados)
social.get('/admin/gallery/:id', wrap(async (req, res) => {
  if (!(await isAdminRequest(req))) throw new HttpError(403, 'Acesso negado');
  const photo = await prisma.artistPhoto.findUnique({
    where: { id: req.params.id },
    include: { artist: { select: { id: true, name: true } } },
  });
  if (!photo) throw new HttpError(404, 'Foto não encontrada');
  res.set('Content-Type', photo.mime).set('Cache-Control', 'public, max-age=3600').send(Buffer.from(photo.data));
}));

// Aprovar foto
social.post('/admin/gallery/:id/approve', wrap(async (req, res) => {
  if (!(await isAdminRequest(req))) throw new HttpError(403, 'Acesso negado');
  const photo = await prisma.artistPhoto.findUnique({
    where: { id: req.params.id },
    include: { artist: { select: { name: true } } },
  });
  if (!photo) throw new HttpError(404, 'Foto não encontrada');
  if (photo.status !== 'PENDING') throw new HttpError(400, 'Foto já foi processada');

  await prisma.artistPhoto.update({ where: { id: photo.id }, data: { status: 'APPROVED' } });
  res.json({ ok: true });
}));

// Rejeitar foto
social.post('/admin/gallery/:id/reject', wrap(async (req, res) => {
  if (!(await isAdminRequest(req))) throw new HttpError(403, 'Acesso negado');
  const photo = await prisma.artistPhoto.findUnique({
    where: { id: req.params.id },
    include: { artist: { select: { name: true } } },
  });
  if (!photo) throw new HttpError(404, 'Foto não encontrada');
  if (photo.status !== 'PENDING') throw new HttpError(400, 'Foto já foi processada');

  await prisma.artistPhoto.delete({ where: { id: photo.id } });
  res.json({ ok: true });
}));
