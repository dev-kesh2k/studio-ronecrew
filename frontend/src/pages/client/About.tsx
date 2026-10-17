import { Clock, MapPin, Navigation, Phone } from 'lucide-react';
import { useConfig } from '../../config';
import { Loading, PageHead } from '../../ui';
import Social from './Social';

/** Sobre o estúdio: texto, horário, endereço com mapa e redes sociais. */
export default function About() {
  const c = useConfig();
  if (!c) return <Loading />;
  const q = encodeURIComponent(c.address);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHead back="/perfil" title="Sobre" subtitle={c.studioName} />

      {c.about ? (
        <p className="card whitespace-pre-line break-words p-5 text-base leading-relaxed text-soft">{c.about}</p>
      ) : (
        <p className="card p-5 text-muted">Estúdio de tatuagem. Em breve mais informações por aqui.</p>
      )}

      {(c.hours || c.phone) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {c.hours && (
            <div className="card flex items-start gap-3 p-4">
              <Clock size={20} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="font-bold">Horário</p>
                <p className="whitespace-pre-line text-soft">{c.hours}</p>
              </div>
            </div>
          )}
          {c.phone && (
            <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="card flex items-start gap-3 p-4">
              <Phone size={20} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="font-bold">Telefone</p>
                <p className="text-soft">{c.phone}</p>
              </div>
            </a>
          )}
        </div>
      )}

      <section className="mt-8">
        <h2 className="h2 mb-3">Localização</h2>
        {c.address ? (
          <div className="card overflow-hidden">
            <iframe
              title={`Mapa: ${c.address}`}
              src={`https://maps.google.com/maps?q=${q}&z=16&output=embed`}
              className="block h-[clamp(14rem,60vw,22rem)] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <p className="flex min-w-0 flex-1 items-start gap-2 text-soft">
                <MapPin size={20} className="mt-0.5 shrink-0 text-accent" />
                <span className="break-words">{c.address}</span>
              </p>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${q}`} target="_blank" rel="noreferrer" className="btn-primary min-h-[48px] shrink-0">
                <Navigation size={18} /> Como chegar
              </a>
            </div>
          </div>
        ) : (
          <p className="card p-5 text-muted">O endereço do estúdio ainda não foi cadastrado.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="h2 mb-3">Redes sociais</h2>
        <Social config={c} />
        {!c.instagram && !c.facebook && !c.tiktok && !c.youtube && !c.website && !c.whatsapp && <p className="text-muted">Nenhuma rede cadastrada ainda.</p>}
      </section>
    </div>
  );
}
