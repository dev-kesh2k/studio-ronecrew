# Changelog

Mudanças relevantes do app, da mais nova para a mais antiga. Cada item é um pull request mesclado na `main` (que publica o app).

## 2026-11-15

- **Correção:** valor digitado com ponto decimal ("350.50") agora vale R$ 350,50; antes virava R$ 35.050,00
- **CI:** testes do frontend (TypeScript direto no Node 22) e lint no-undef do backend
- **Novo:** cliente pode *Adicionar ao calendário* a própria sessão (.ics) (#26–#29)
- **Novo:** Agenda do estúdio → botão para baixar as sessões do mês no Google Agenda (.ics) (#21–#25)
- **Saúde:** /health testa o banco e responde 503 se o Postgres cair (#20)
- Segurança: react-router v7 no frontend (corrige open redirect GHSA-wrjc-x8rr-h8h6) (#17)
- Frontend: dependências atualizadas pelo npm audit (versões compatíveis) (#16)
- Segurança: body-parser e qs atualizados no backend (npm audit) (#15)
- CI: roda os testes do backend no GitHub Actions (#14)
- Testes: expediente, horários livres e status que bloqueiam a agenda (#13)
- Testes: validação de e-mail, telefone, celular, números, links e imagens (#12)
- Testes: datas, semana e mês no fuso do estúdio (#11)
- Agenda: horário salvo com JSON inválido dá erro 400 (antes 500) (#10)
- Backend: expediente e horários da agenda em schedule.js (#9)
- Backend: validação de campos e HttpError em validate.js (#8)
- Backend: datas do estúdio em dates.js (testáveis sem o banco) (#7)
- Deploy: mudanças só em testes não republicam o app (#6)
