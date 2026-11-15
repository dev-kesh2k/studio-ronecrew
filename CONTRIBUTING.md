# Contribuindo

Sugestões e correções são bem-vindas. Mantenha cada pull request pequeno e com um assunto só.

## Antes de enviar

```bash
node --test backend/test/*.test.js        # testes do backend (sem banco)
node --test frontend/test/*.test.ts       # testes do frontend (Node 22 roda o TypeScript direto)
(cd backend && npx --yes eslint@9 .)      # variável usada sem declarar/importar
(cd frontend && npx tsc -b)               # tipos do frontend
```

O GitHub Actions roda os mesmos passos (workflow **Testes**) em cada push e pull request.

## Como as mudanças vão para o ar

- Só existe produção: todo merge na `main` dispara o workflow **Deploy**, que publica o app pelo Central Apps Hub.
- Mudanças só em testes (`backend/test/`, `frontend/test/`), na documentação (`*.md`) ou no CI de testes não republicam o app.
- Mexer em `backend/package.json` ou no lockfile faz o container reinstalar as dependências (~30 s fora do ar): evite quando não precisar.

## Padrões

- Código, mensagens e textos da tela em português do Brasil.
- Regra de negócio nova vai num módulo puro (sem Prisma/banco) com teste ao lado, como `validate.js` e `dates.js`.
- Nunca coloque senha, token ou chave no código ou no `.env.example` (o repositório é público). O deploy gera e guarda os segredos no servidor.

## Commits em dupla

Os envios feitos pelo Central Apps Hub levam a linha `Co-Authored-By` do Claude, que participou da mudança. O autor do commit é o dono da conta do GitHub que enviou.
