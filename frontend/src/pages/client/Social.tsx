import { Facebook, Globe, Instagram, MessageCircle, Music2, Youtube, type LucideIcon } from 'lucide-react';
import type { Config } from '../../api';
import { waLink } from '../../util';

interface Link {
  key: string;
  label: string;
  handle: string;
  href: string;
  icon: LucideIcon;
}

/** Redes do estúdio cadastradas em Configurações (Instagram e TikTok pelo @; os outros por link). */
export function socialLinks(c: Config): Link[] {
  const at = (v: string) => v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/i, '').replace(/\/.*$/, '');
  const list: Link[] = [];
  if (c.instagram) list.push({ key: 'ig', label: 'Instagram', handle: `@${at(c.instagram)}`, href: `https://instagram.com/${at(c.instagram)}`, icon: Instagram });
  if (c.tiktok) list.push({ key: 'tt', label: 'TikTok', handle: `@${at(c.tiktok)}`, href: `https://www.tiktok.com/@${at(c.tiktok)}`, icon: Music2 });
  if (c.facebook) list.push({ key: 'fb', label: 'Facebook', handle: c.facebook.replace(/^https?:\/\/(www\.)?/, ''), href: c.facebook, icon: Facebook });
  if (c.youtube) list.push({ key: 'yt', label: 'YouTube', handle: c.youtube.replace(/^https?:\/\/(www\.)?/, ''), href: c.youtube, icon: Youtube });
  if (c.whatsapp) list.push({ key: 'wa', label: 'WhatsApp', handle: c.whatsapp, href: waLink(c.whatsapp), icon: MessageCircle });
  if (c.website) list.push({ key: 'web', label: 'Site', handle: c.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), href: c.website, icon: Globe });
  return list;
}

/** Lista de redes (cartões) ou ícones compactos. */
export default function Social({ config, compact }: { config: Config; compact?: boolean }) {
  const links = socialLinks(config);
  if (!links.length) return null;
  if (compact)
    return (
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a key={l.key} href={l.href} target="_blank" rel="noreferrer" aria-label={l.label} className="icon-btn text-accent">
            <l.icon size={22} />
          </a>
        ))}
      </div>
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {links.map((l) => (
        <a key={l.key} href={l.href} target="_blank" rel="noreferrer" className="card flex min-h-[64px] items-center gap-4 px-4 py-3 transition active:scale-[0.99]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tint2 text-accent">
            <l.icon size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{l.label}</span>
            <span className="block truncate text-sm text-muted">{l.handle}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
