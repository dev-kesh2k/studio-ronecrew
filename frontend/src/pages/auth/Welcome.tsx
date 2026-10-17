import { useState } from 'react';
import { CalendarCheck, Droplet, Users } from 'lucide-react';
import { markIntroSeen } from '../../client';

const SLIDES = [
  { icon: Droplet, title: 'Agende sua tattoo com tranquilidade', text: 'Escolha artista, serviço, data e horário em poucos toques.' },
  { icon: Users, title: 'Encontre o artista do seu estilo', text: 'Fine line, blackwork, realismo, aquarela: veja portfólio e avaliações.' },
  { icon: CalendarCheck, title: 'Sem cadastro, só o celular', text: 'Informe seu celular no agendamento e acompanhe suas sessões por ele.' },
];

export default function Welcome({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  const done = () => {
    markIntroSeen();
    onDone();
  };

  return (
    <div className="stripes flex min-h-[100dvh] flex-col">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[32px] bg-bg shadow-2xl">
            <svg viewBox="0 0 512 512" className="h-16 w-16" aria-hidden>
              <path d="M256 60c-66 92-134 168-134 250a134 134 0 0 0 268 0c0-82-68-158-134-250z" fill="#F0553A" />
              <path d="M208 330a50 50 0 0 0 50 50" stroke="#0D0D0E" strokeWidth="24" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <p className="font-display text-[clamp(3.5rem,19vw,6rem)] font-extrabold uppercase leading-[0.85]">RoneCrew</p>
          <p className="font-display text-[clamp(2.4rem,13vw,4rem)] font-extrabold uppercase leading-[0.9] text-accent">Tatoo</p>

          <div className="mt-10 min-h-[9rem]" aria-live="polite">
            <s.icon className="mx-auto mb-4 text-accent" size={28} />
            <h1 className="font-display text-[clamp(1.8rem,8vw,2.4rem)] font-bold uppercase leading-none">{s.title}</h1>
            <p className="mx-auto mt-3 max-w-sm text-base text-soft">{s.text}</p>
          </div>
        </div>

        <div className="mb-6 flex justify-center gap-2" role="tablist" aria-label="Apresentação">
          {SLIDES.map((_, k) => (
            <button
              key={k}
              role="tab"
              aria-selected={k === i}
              aria-label={`Tela ${k + 1}`}
              onClick={() => setI(k)}
              className="flex h-11 w-8 items-center justify-center"
            >
              <span className={`h-2 rounded-full transition-all ${k === i ? 'w-6 bg-accent' : 'w-2 bg-line2'}`} />
            </button>
          ))}
        </div>
        <button className="btn-primary w-full" onClick={() => (last ? done() : setI(i + 1))}>
          {last ? 'Começar' : 'Continuar'}
        </button>
        <button onClick={done} className="mt-3 flex min-h-[48px] w-full items-center justify-center text-base text-soft">
          Pular
        </button>
      </div>
    </div>
  );
}
