# Studio RoneCrew

App de agendamento do estúdio de tatuagem RoneCrew Tatoo (web e celular, instalável na Tela de Início).

- **Cliente:** cadastro/login (e-mail ou telefone), busca de artistas por nome/estilo, perfil do artista (portfólio, serviços, avaliações, favoritar), agendamento em 4 etapas (serviço → data → hora → detalhes e pagamento do sinal), meus agendamentos (próximos/anteriores/cancelados), cancelamento, avaliação após a sessão, referências (imagens), cartões salvos, notificações, cuidados pós-tattoo e ajuda.
- **Administrador:** painel do dia, agenda semanal com aprovar/recusar solicitações, novo agendamento pelo balcão, registrar sinal, concluir sessão com pagamento final, cancelar; equipe (disponibilidade, serviços, portfólio); serviços e preços (ativo/inativo, valor do sinal); financeiro (receita do mês, sinais, gráfico por semana, pagamentos); configurações do estúdio e redefinição de senha de cliente.

## Estrutura
- `frontend/`: React + Vite + TypeScript + Tailwind (fontes Big Shoulders Display e DM Sans, ícones lucide).
- `backend/`: Express + Prisma (PostgreSQL). Regras de agenda em `src/booking.js` (horários 09:00–17:00, domingo fechado, sem sobreposição por artista com trava no banco).

## Regras
- Sinal padrão (configurável): descontado do valor final. Pagar com cartão/Pix/aproximação confirma na hora; "pagar no estúdio" vira solicitação para o admin aprovar (fica com "Sinal pendente" até o estúdio registrar o recebimento).
- O pagamento é **simulado** (sem gateway): o sinal fica registrado; do cartão só se guarda bandeira, 4 últimos dígitos e validade. Para cobrar de verdade, integre um gateway em `POST /api/bookings` (`backend/src/routes.js`).

## Login inicial
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` do `backend/.env.example` (criado no primeiro start; também fica no Cofre do Hub). O catálogo inicial de artistas e serviços é criado uma vez e depois editado pelo painel.
