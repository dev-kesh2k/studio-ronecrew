import { useState } from 'react';
import { CreditCard, Plus, Trash2 } from 'lucide-react';
import { api, useApi, type Card } from '../../api';
import { Empty, ErrorBox, FormError, Loading, PageHead, Sheet, toast } from '../../ui';
import { emptyCard, NewCardFields, type NewCard } from './BookPayment';

export default function PaymentMethods() {
  const { data, error, loading, reload } = useApi<{ cards: Card[] }>('/cards');
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<NewCard>(emptyCard);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    setErr('');
    try {
      await api.post('/cards', card);
      setOpen(false);
      setCard(emptyCard);
      toast('Cartão salvo');
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast(ok);
      reload();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHead
        back="/perfil"
        title="Pagamento"
        subtitle="Cartões salvos para pagar o sinal."
        action={
          <button className="btn-pill" onClick={() => setOpen(true)} aria-label="Adicionar cartão">
            <Plus size={20} /> <span className="hidden min-[380px]:inline">Cartão</span>
          </button>
        }
      />
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.cards.length === 0 && <Empty icon={CreditCard} title="Nenhum cartão salvo" text="Você também pode pagar com Pix, por aproximação ou no estúdio." />}
      <div className="flex flex-col gap-3">
        {data?.cards.map((c) => (
          <div key={c.id} className="card flex items-center gap-4 p-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface2 text-accent">
              <CreditCard size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">
                {c.brand} •••• {c.last4}
              </p>
              <p className="truncate text-sm text-muted">
                {c.holder} · vence {c.expiry}
              </p>
              {c.isDefault ? (
                <span className="mt-1 inline-block rounded-full bg-tint2 px-2.5 py-0.5 text-sm font-bold text-accent">Principal</span>
              ) : (
                <button className="mt-1 min-h-[36px] text-sm font-bold text-accent" onClick={() => act(() => api.post(`/cards/${c.id}/default`), 'Cartão principal atualizado')}>
                  Tornar principal
                </button>
              )}
            </div>
            <button
              className="icon-btn h-11 w-11"
              aria-label={`Remover cartão final ${c.last4}`}
              onClick={() => confirm('Remover este cartão?') && act(() => api.del(`/cards/${c.id}`), 'Cartão removido')}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm text-muted">Guardamos apenas a bandeira, os 4 últimos dígitos e a validade. O número completo e o CVV nunca são armazenados.</p>

      <Sheet open={open} onClose={() => setOpen(false)} title="Novo cartão">
        <NewCardFields card={card} setCard={setCard} />
        <div className="mt-4">
          <FormError message={err} />
        </div>
        <button className="btn-primary mt-4 w-full" disabled={busy} onClick={add}>
          Salvar cartão
        </button>
      </Sheet>
    </div>
  );
}
