import { MessageCircle, Phone } from 'lucide-react';
import { useConfig } from '../../config';
import { PageHead } from '../../ui';
import { waLink } from '../../util';

export default function Forgot() {
  const config = useConfig();
  const hasContact = !!(config?.whatsapp || config?.phone);
  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-md px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.25rem,env(safe-area-inset-top))]">
      <PageHead back="/login" title="Esqueci a senha" />
      <div className="card p-5">
        <p className="text-base text-soft">
          Por segurança, a senha é redefinida pelo estúdio. Fale com a equipe informando o e-mail da sua conta: você recebe uma senha
          temporária e pode trocá-la em <b className="text-ink">Perfil → Informações pessoais</b>.
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {config?.whatsapp && (
          <a className="btn-primary" href={waLink(config.whatsapp, 'Olá! Esqueci a senha da minha conta no app RoneCrew.')} target="_blank" rel="noreferrer">
            <MessageCircle size={20} /> Chamar no WhatsApp
          </a>
        )}
        {config?.phone && (
          <a className="btn-secondary" href={`tel:${config.phone.replace(/[^\d+]/g, '')}`}>
            <Phone size={20} /> Ligar para o estúdio
          </a>
        )}
        {config && !hasContact && <p className="text-center text-muted">Procure a recepção do estúdio para redefinir sua senha.</p>}
      </div>
    </div>
  );
}
