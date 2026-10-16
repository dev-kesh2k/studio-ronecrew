import { Ban, Droplet, Hand, ShieldCheck, Sun, Timer } from 'lucide-react';
import { PageHead } from '../../ui';

const STEPS = [
  { icon: Timer, title: 'Primeiras horas', text: 'Mantenha o curativo pelo tempo indicado pelo artista (geralmente de 2 a 4 horas). Depois, retire com as mãos limpas.' },
  { icon: Droplet, title: 'Lavagem', text: 'Lave 2 a 3 vezes ao dia com água morna e sabonete neutro, sem esfregar. Seque com papel toalha, dando leves batidinhas.' },
  { icon: Hand, title: 'Hidratação', text: 'Aplique uma camada fina da pomada ou hidratante recomendado. Excesso de produto abafa a pele e atrasa a cicatrização.' },
  { icon: Ban, title: 'Não coce nem arranque', text: 'É normal descascar e coçar. Não retire as casquinhas: isso pode falhar o traço e manchar a tinta.' },
  { icon: Sun, title: 'Sol, piscina e mar', text: 'Evite sol direto, piscina, mar e sauna por pelo menos 30 dias. Depois de cicatrizada, use protetor solar FPS 50 sempre.' },
  { icon: ShieldCheck, title: 'Quando procurar o estúdio', text: 'Vermelhidão que aumenta depois de 3 dias, pus, febre ou dor forte: fale com o estúdio e procure um médico.' },
];

export default function Aftercare() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHead back="/perfil" title="Cuidados pós-tattoo" subtitle="A cicatrização completa leva de 3 a 4 semanas." />
      <ol className="flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card flex gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-tint2 text-accent">
              <s.icon size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold">
                {i + 1}. {s.title}
              </p>
              <p className="mt-1 text-soft">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
