# Studio RoneCrew

[![Testes](https://github.com/dev-kesh2k/studio-ronecrew/actions/workflows/ci.yml/badge.svg)](https://github.com/dev-kesh2k/studio-ronecrew/actions/workflows/ci.yml)

App de agendamento do estúdio de tatuagem RoneCrew Tatoo (web e celular, instalável na Tela de Início).

- **Cliente (sem login):** busca de artistas por nome/estilo, perfil do artista (portfólio, serviços, avaliações, favoritos salvos no aparelho), agendamento em 4 etapas (serviço → data → hora → detalhes e sinal) informando o **celular (obrigatório)** e o nome (opcional). Em "Agenda" o cliente informa o celular e vê seus agendamentos (próximos/anteriores/cancelados), cancela, avalia após a sessão e anexa referências. O celular fica salvo no aparelho.
- **Estúdio (login em `/admin/login`):** painel do dia, agenda semanal com aprovar/recusar solicitações, novo agendamento pelo balcão (com o celular do cliente), registrar sinal, concluir sessão com pagamento final, cancelar; equipe (disponibilidade, serviços, portfólio); serviços e preços (ativo/inativo, valor do sinal); financeiro (receita do mês, sinais, gráfico por semana, pagamentos); configurações do estúdio.

## Estrutura
- `frontend/`: React + Vite + TypeScript + Tailwind (fontes Big Shoulders Display e DM Sans, ícones lucide).
- `backend/`: Express + Prisma (PostgreSQL). Regras de agenda em `src/booking.js` (horários 09:00–17:00, domingo fechado, sem sobreposição por artista com trava no banco). O celular é normalizado (só dígitos, sem o 55) em `Booking.phoneKey`; as consultas pelo celular têm limite por IP.

## Regras
- Sinal padrão (configurável): descontado do valor final. Pagar com cartão/Pix/aproximação confirma na hora; "pagar no estúdio" vira solicitação para o admin aprovar (fica com "Sinal pendente" até o estúdio registrar o recebimento).
- O pagamento é **simulado** (sem gateway): o sinal fica registrado e os dados do cartão só são validados, nunca guardados. Para cobrar de verdade, integre um gateway em `POST /api/bookings` (`backend/src/routes.js`).

## Cliente: avaliação, feedback, galeria
- Avaliação da sessão (1 a 5 estrelas) depois de concluída; com 4 ou 5 estrelas o cliente é convidado a avaliar no Google (link em Configurações → Avaliação no Google).
- Feedback (elogio, sugestão, reclamação) em Perfil → Enviar feedback; o estúdio lê em Painel → Feedback (com as avaliações e a moderação dos comentários).
- Avatar do cliente ligado ao celular (`ClientProfile`, a URL usa um id opaco, nunca o número).
- Galeria com curtidas (uma por aparelho), comentários (celular + nome) e download (`/api/photos/:id?download=1`).
- Página Sobre com mapa (Google Maps), horário e redes sociais (Configurações).

## WhatsApp (Cloud API da Meta)
1. Em developers.facebook.com crie um app do tipo Business com o produto WhatsApp e cadastre o número do estúdio.
2. Gere um token permanente (usuário do sistema com permissão `whatsapp_business_messaging`) e copie o ID do número de telefone.
3. Crie um modelo de mensagem de categoria Utilidade, idioma pt_BR, cujo corpo seja só a variável `{{1}}`, e espere a aprovação.
4. No app: Configurações → WhatsApp: token, ID do número, "Modelo aprovado" com o nome do modelo, ligue e salve. Use "Enviar teste" e confira "Últimos envios".
- Eventos: confirmação, solicitação recebida, aprovação, recusa, sinal recebido, cancelamento pelo estúdio, sessão concluída (link para avaliar), lembrete na véspera (a partir das 10h) e avisos ao WhatsApp do estúdio.
- Código em `backend/src/whatsapp.js`; `WHATSAPP_API_BASE` permite apontar para um servidor de testes.

## Login inicial (estúdio)
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` do `backend/.env.example` (criado no primeiro start; também fica no Cofre do Hub). O catálogo inicial de artistas e serviços é criado uma vez e depois editado pelo painel.

## Testes

Testes do backend com o executor nativo do Node (`node:test`), sem banco e sem servidor rodando:

```bash
node --test backend/test/*.test.js
```

Cobrem as regras puras do backend (dates, schedule, validate). O GitHub Actions roda os mesmos testes em cada push e pull request (workflow `Testes`); mudanças só em `backend/test/` não republicam o app.
