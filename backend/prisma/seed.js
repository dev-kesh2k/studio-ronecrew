// Idempotente: roda a cada publicação. Cria o admin inicial e o catálogo inicial do estúdio
// (artistas e serviços) só quando ainda não existem; depois tudo é editado pelo painel.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ARTISTS = [
  { name: 'Rafa Monteiro', style: 'Fine line', years: 8, bio: 'Traços finos e delicados, florais e lettering minimalista.', services: ['Fine line', 'Cobertura', 'Consulta de projeto'] },
  { name: 'Duda Kaneshiro', style: 'Blackwork', years: 6, bio: 'Blackwork, ornamental e geométrico com preto sólido.', services: ['Blackwork', 'Consulta de projeto'] },
  { name: 'Theo Barreto', style: 'Realismo', years: 10, bio: 'Realismo em preto e cinza e colorido, retratos e fauna.', services: ['Fine line', 'Realismo', 'Piercing', 'Consulta de projeto'] },
  { name: 'Lia Vasconcelos', style: 'Aquarela', years: 5, bio: 'Aquarela e cores vibrantes com efeito de pincel.', services: ['Consulta de projeto'], available: false, unavailableNote: 'De férias até 30 out' },
];

const SERVICES = [
  { name: 'Fine line', description: 'Traços finos, delicados e minimalistas.', priceCents: 35000, durationMin: 120, icon: 'pen' },
  { name: 'Blackwork', description: 'Preto sólido, ornamental e geométrico.', priceCents: 50000, durationMin: 180, icon: 'diamond' },
  { name: 'Realismo', description: 'Retratos e imagens com efeito fotográfico.', priceCents: 90000, durationMin: 240, icon: 'eye' },
  { name: 'Cobertura', description: 'Cobrimos ou reformamos uma tattoo antiga.', priceCents: 70000, durationMin: 240, icon: 'refresh' },
  { name: 'Piercing', description: 'Aplicação com joia de titânio inclusa.', priceCents: 15000, durationMin: 45, icon: 'ring', active: false },
  { name: 'Consulta de projeto', description: 'Conversa para criar o desenho com o artista.', priceCents: 0, durationMin: 30, icon: 'chat' },
];

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@ronecrew.com').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || 'Administrador';
  if (!password) throw new Error('SEED_ADMIN_PASSWORD não definido');

  if ((await prisma.user.count({ where: { role: 'admin' } })) === 0) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'admin' },
      create: { email, name, role: 'admin', passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Admin criado: ${email}`);
  }

  if ((await prisma.service.count()) === 0 && (await prisma.artist.count()) === 0) {
    const ids = {};
    for (const [i, s] of SERVICES.entries()) {
      const created = await prisma.service.create({ data: { ...s, active: s.active !== false, sortOrder: i } });
      ids[s.name] = created.id;
    }
    for (const [i, a] of ARTISTS.entries()) {
      const { services, ...data } = a;
      await prisma.artist.create({
        data: { ...data, sortOrder: i, services: { connect: services.map((n) => ({ id: ids[n] })) } },
      });
    }
    console.log('Catálogo inicial criado');
  }

  await prisma.setting.upsert({ where: { key: 'studioName' }, update: {}, create: { key: 'studioName', value: 'RoneCrew Tatoo' } });
  await prisma.setting.upsert({ where: { key: 'depositCents' }, update: {}, create: { key: 'depositCents', value: '10000' } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
