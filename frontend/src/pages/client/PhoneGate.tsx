import { useState, type FormEvent } from 'react';
import { Smartphone } from 'lucide-react';
import { isValidPhone, maskPhone } from '../../client';
import { FormError } from '../../ui';

/** Pede o celular usado no agendamento para mostrar os agendamentos do cliente. */
export default function PhoneGate({ onSubmit, text }: { onSubmit: (phone: string) => void; text?: string }) {
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) return setErr('Informe o celular com DDD, ex.: (11) 91234-5678');
    onSubmit(phone);
  }

  return (
    <form onSubmit={submit} className="card mx-auto flex max-w-md flex-col gap-4 p-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tint2 text-accent">
        <Smartphone size={26} />
      </div>
      <div>
        <p className="text-lg font-bold">Qual é o seu celular?</p>
        <p className="mt-1 text-muted">{text || 'Use o mesmo número informado no agendamento para ver suas sessões.'}</p>
      </div>
      <input
        className="input"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(11) 91234-5678"
        aria-label="Celular com DDD"
        value={phone}
        onChange={(e) => setPhone(maskPhone(e.target.value))}
      />
      <FormError message={err} />
      <button className="btn-primary">Ver agendamentos</button>
    </form>
  );
}
