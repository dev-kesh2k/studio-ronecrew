import { useCallback, useEffect, useState } from 'react';

export const API_BASE = `${import.meta.env.BASE_URL}api`;
const TOKEN_KEY = 'ronecrew:token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, data.error || `Erro ${res.status}`);
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b: unknown = {}) => request<T>('POST', p, b),
  put: <T>(p: string, b: unknown) => request<T>('PUT', p, b),
  patch: <T>(p: string, b: unknown) => request<T>('PATCH', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
};

/** Imagem protegida (referências): baixa com o token e devolve uma URL local. */
export async function fetchImageUrl(path: string): Promise<string> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, 'Imagem indisponível');
  return URL.createObjectURL(await res.blob());
}

/** Baixa um arquivo da API com o token (ex.: agenda .ics) e abre o "salvar como" do navegador. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => {
    throw new ApiError(0, 'Sem conexão com o servidor');
  });
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error || `Erro ${res.status}`);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const photoUrl = (id: string) => `${API_BASE}/photos/${id}`;

/** Foto do artista: o avatar; sem avatar, a 1ª foto do portfólio; sem nenhuma, undefined (iniciais). */
export const avatarUrl = (a: { id: string; avatarVersion: number | null; photos?: string[] }) =>
  a.avatarVersion ? `${API_BASE}/artists/${a.id}/avatar?v=${a.avatarVersion}` : a.photos?.[0] ? photoUrl(a.photos[0]) : undefined;

/** Foto do serviço (undefined = usa o ícone). */
export const serviceUrl = (s: { id: string; photoVersion?: number }) => (s.photoVersion ? `${API_BASE}/services/${s.id}/photo?v=${s.photoVersion}` : undefined);

export interface GalleryPhoto {
  id: string;
  createdAt: string;
  artist: { id: string; name: string; style: string; available: boolean };
  likes: number;
  comments: number;
  liked: boolean;
}

export interface PhotoComment {
  id: string;
  name: string;
  avatar: string | null;
  text: string;
  createdAt: string;
  mine: boolean;
}

export const downloadUrl = (photoId: string) => `${API_BASE}/photos/${photoId}?download=1`;

/** Carrega um recurso da API; `reload` busca de novo sem piscar a tela. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!path);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api.get<T>(path));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

// ---------- Tipos ----------
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'client' | 'admin';
  createdAt: string;
}

/** Expediente de um dia da semana (índice 0 = domingo). */
export interface DaySchedule {
  open: boolean;
  from: string;
  to: string;
}

export interface Config {
  studioName: string;
  depositCents: number;
  phone: string;
  whatsapp: string;
  address: string;
  hours: string;
  schedule: DaySchedule[];
  logoVersion: number;
  about: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
  website: string;
  googleReviewUrl: string;
  today: string;
  now: string;
}

/** Caminho relativo devolvido pela API (ex.: "client-avatars/<id>?v=2") → URL completa. */
export const apiUrl = (rel: string | null | undefined) => (rel ? `${API_BASE}/${rel}` : undefined);

export interface ServiceLite {
  id: string;
  name: string;
  priceCents: number;
  durationMin: number;
  icon: string;
  photoVersion?: number;
  active: boolean;
}

export interface Artist {
  id: string;
  name: string;
  style: string;
  years: number;
  bio: string;
  available: boolean;
  unavailableNote: string;
  avatarVersion: number | null;
  rating: number | null;
  reviewsCount: number;
  topRequested: boolean;
  favorite: boolean;
  services: ServiceLite[];
  photos: string[];
  weekSessions?: number;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  durationMin: number;
  icon: string;
  photoVersion?: number;
  active: boolean;
  artists?: { id: string; name: string }[];
}

export type BookingStatus = 'requested' | 'pending_deposit' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';

export interface Payment {
  id: string;
  kind: 'deposit' | 'final';
  method: string;
  amountCents: number;
  createdAt: string;
}

export interface Booking {
  id: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string;
  artistId: string;
  serviceId: string;
  artist: { id: string; name: string };
  service: { id: string; name: string; icon: string };
  client: { id: string; name: string; email: string; phone: string } | null;
  review: { rating: number; comment: string } | null;
  payments: Payment[];
  references?: { id: string; note: string }[];
  date: string;
  time: string;
  durationMin: number;
  priceCents: number;
  depositCents: number;
  paidCents: number;
  status: BookingStatus;
  paymentMethod: string;
  depositPaid: boolean;
  notes: string;
  cancelReason: string;
  createdAt: string;
}

export interface Card {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  holder: string;
  isDefault: boolean;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Slot {
  time: string;
  available: boolean;
}
