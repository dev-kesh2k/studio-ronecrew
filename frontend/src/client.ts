import { useCallback, useState } from 'react';

// O cliente não tem conta: celular, nome e favoritos ficam salvos neste aparelho.
const PHONE_KEY = 'ronecrew:phone';
const NAME_KEY = 'ronecrew:name';
const FAV_KEY = 'ronecrew:favorites';

export const phoneDigits = (v: string) => {
  let d = v.replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d;
};
export const isValidPhone = (v: string) => {
  const d = phoneDigits(v);
  return d.length === 10 || d.length === 11;
};

/** (11) 91234-5678 enquanto digita */
export function maskPhone(v: string) {
  let d = v.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const getSavedPhone = () => localStorage.getItem(PHONE_KEY) || '';
export const getSavedName = () => localStorage.getItem(NAME_KEY) || '';
export function saveClient(phone: string, name?: string) {
  localStorage.setItem(PHONE_KEY, maskPhone(phoneDigits(phone)));
  if (name !== undefined) {
    if (name.trim()) localStorage.setItem(NAME_KEY, name.trim());
    else localStorage.removeItem(NAME_KEY);
  }
}
export function forgetClient() {
  localStorage.removeItem(PHONE_KEY);
  localStorage.removeItem(NAME_KEY);
}

/** Celular salvo no aparelho, com setter que persiste. */
export function useSavedPhone() {
  const [phone, setPhone] = useState(getSavedPhone);
  const save = useCallback((p: string) => {
    if (p) saveClient(p);
    else localStorage.removeItem(PHONE_KEY);
    setPhone(p ? getSavedPhone() : '');
  }, []);
  return [phone, save] as const;
}

export function getFavorites(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
export function toggleFavorite(id: string) {
  const list = getFavorites();
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next.includes(id);
}

/** Bytes aleatórios do gerador seguro do navegador, em hexadecimal (funciona também fora de HTTPS). */
function randomHex(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Id aleatório do aparelho (uma curtida por foto em cada aparelho). */
export function deviceId() {
  let id = localStorage.getItem('ronecrew:device') || '';
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    id = crypto.randomUUID?.() || `dev-${Date.now().toString(36)}-${randomHex(4)}`;
    localStorage.setItem('ronecrew:device', id);
  }
  return id;
}

