# Studio RoneCrew

App de agendamento do estúdio de tatuagem RoneCrew Tatoo (web e celular, instalável na Tela de Início).

- **Cliente (sem login):** busca de artistas por nome/estilo, perfil do artista (portfólio, serviços, avaliações, favoritos salvos no aparelho), agendamento em 4 etapas (serviço → data → hora → detalhes e sinal) informando o **celular (obrigatório)** e o nome (opcional). Em "Agenda" o cliente informa o celular e vê seus agendamentos (próximos/anteriores/cancelados), cancela, avalia após a sessão e anexa referências. O celular fica salvo no aparelho.
- **Estúdio (login em `/admin/login`):** painel do dia, agenda semanal com aprovar/recusar solicitações, novo agendamento pelo balcão (com o celular do cliente), registrar sinal, concluir sessão com pagamento final, cancelar; equipe (disponibilidade, serviços, portfólio); serviços e preços (ativo/inativo, valor do sinal); financeiro (receita do mês, sinais, gráfico por semana, pagamentos); configurações do estúdio.

## Estrutura
- `frontend/`: React + Vite + TypeScript + Tailwind (fontes Big Shoulders Display e DM Sans, ícones lucide).
- `backend/`: Express + Prisma (PostgreSQL). Regras de agenda em `src/booking.js` (horários 09:00–17:00, domingo fechado, sem sobreposição por artista com trava no banco). O celular é normalizado (só dígitos, sem o 55) em `Booking.phoneKey`; as consultas pelo celular têm limite por IP.

## Regras
- Sinal padrão (configurável): descontado do valor final. Pagar com cartão/Pix/aproximação confirma na hora; "pagar no estúdio" vira solicitação para o admin aprovar (fica com "Sinal pendente" até o estúdio registrar o recebimento).
- O pagamento é **simulado** (sem gateway): o sinal fica registrado e os dados do cartão só são validados, nunca guardados. Para cobrar de verdade, integre um gateway em `POST /api/bookings` (`backend/src/routes.js`).

## Login inicial (estúdio)
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` do `backend/.env.example` (criado no primeiro start; também fica no Cofre do Hub). O catálogo inicial de artistas e serviços é criado uma vez e depois editado pelo painel.
