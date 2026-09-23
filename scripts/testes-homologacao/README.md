# Testes de homologação — fluxo de master/platform owner

Verificação ponta a ponta da Entrega B (`docs/PERMISSIONS.md` §2.0): não é
criar um sistema novo de vínculo multiempresa — o modelo já existe
(`is_platform_owner`, `/empresas`, `ACTIVE_COMPANY_COOKIE_NAME`). O que
faltava era **testar de verdade** que esse fluxo funciona ponta a ponta:
criar empresa → configurar módulos/limite → criar usuário dentro dela →
suspender → confirmar que o usuário da empresa perde acesso.

## Como rodar

```
node scripts/testes-homologacao/verificar-fluxo-master.mjs
```

Precisa de `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` (só pra
criar/promover o usuário master de teste e limpar os artefatos no final —
a verificação do fluxo em si é sempre via UI/sessão normal, sem bypass de
RLS). Roda contra `https://newseccrm.vercel.app` por padrão; pra apontar
pra outro lugar (ex. `next dev`/`next start` local), defina
`TESTE_MASTER_APP_URL`.

Usa Playwright de verdade (browser real, não chamada direta de API) contra
os mesmos formulários que um usuário real usa — `npx playwright install
chromium` na primeira vez, se ainda não tiver o binário baixado.

## O que o script cria e o que ele limpa sozinho

- **Reaproveitável entre rodadas** (não apaga): a empresa
  "Sede Master (infra de teste automatizado)" (só existe pra dar
  `company_id` ao perfil do master, já que a coluna é `NOT NULL` mesmo
  pra platform owner) e o usuário `master.teste.automatizado`
  (`is_platform_owner=true`) — a senha é regenerada a cada rodada via
  Admin API, nunca fica salva em lugar nenhum.
- **Criado e apagado a cada rodada**: uma empresa de teste com nome único
  (`Empresa Teste Playwright <timestamp>`) e um usuário dentro dela
  (`usuario.teste.<timestamp>`) — apagados no `finally` do script, mesmo
  se algum passo falhar no meio. Se o script for interrompido de um jeito
  que pule o `finally` (ex. `Ctrl+C` bruto), os IDs ficam impressos no
  console pra limpeza manual.

## Resultado (23/09/2026, contra `newseccrm.vercel.app` real)

8/8 etapas passando, em duas rodadas seguidas (login do master, criar
empresa, configurar módulos/limite e persistir, criar usuário na empresa,
suspender e persistir, usuário da empresa suspensa bloqueado, master nunca
bloqueado). Achado de robustez no processo: o client admin (processo local)
às vezes lia uma linha recém-criada pela Server Action (processo da Vercel)
antes dela ficar visível — não é bug de aplicação, é leitura rápida demais
logo depois de uma escrita feita por outro processo. Corrigido com
`reconsultarAteAchar()` (retry curto, até 6 tentativas / ~1s de intervalo)
em vez de assumir visibilidade imediata.

## Achado real desta verificação (23/09/2026)

A primeira rodada revelou que **suspender uma empresa não tirava o acesso
de ninguém** — `company_platform_settings.status` só era usado pra exibir
o badge "Suspensa"/"Cancelada" no painel do master, nunca era checado em
`current-user.ts` nem em `middleware.ts`. Corrigido em
`src/lib/auth/current-user.ts`: usuários que não são platform owner agora
são redirecionados pra `/empresa-suspensa` (página nova,
`src/app/empresa-suspensa/page.tsx`, mesmo padrão de `/conta-inativa`) se
a empresa deles estiver com `status` `suspended` ou `cancelled`. O
platform owner nunca é bloqueado por isso — ele precisa continuar
acessando (inclusive a própria empresa suspensa) pra revisar/reativar.

Decisão consciente de escopo: o bloqueio roda só em `current-user.ts` (não
em `middleware.ts`), no mesmo padrão já usado pelo check de
`is_active` → `/conta-inativa` — mantém a mudança isolada num arquivo só,
sem mexer no `middleware.ts` (mais denso, com bastante lógica de rota já
encadeada).
