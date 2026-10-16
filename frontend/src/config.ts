import { useEffect, useState } from 'react';
import { api, type Config } from './api';

let cache: Config | null = null;
let pending: Promise<Config> | null = null;
const listeners = new Set<(c: Config) => void>();

/** Recarrega a configuração do estúdio (após o admin salvar). */
export async function reloadConfig() {
  pending = api.get<Config>('/config');
  cache = await pending;
  listeners.forEach((l) => l(cache!));
  return cache;
}

/** Configuração pública do estúdio (nome, sinal, contatos e a data de hoje no fuso do estúdio). */
export function useConfig() {
  const [config, setConfig] = useState<Config | null>(cache);
  useEffect(() => {
    listeners.add(setConfig);
    if (!cache) (pending || reloadConfig()).then(setConfig).catch(() => (pending = null));
    return () => {
      listeners.delete(setConfig);
    };
  }, []);
  return config;
}
