# NewSec — checkpoint de progresso

Formato de checkpoint conforme especificação, seção 20. Atualizar ao final
de cada ciclo de trabalho — este arquivo precisa permitir retomar o projeto
sem depender de memória de conversa anterior.

---

## Checkpoint 2026-09-22 — início do projeto (Fase 0 em andamento)

**Fase e tarefa atual:** Fase 0 (inventário e baseline). Ver `TASKS.md`.

**Branch e commit base:** `main`, commit `0fb852aab2703459de76f08be775f58be7c7f0cb`
(idêntico ao HEAD do GRSCRM no momento do clone — nenhum commit próprio do
newseccrm ainda).

**Mudanças concluídas:**

- Repositório `newseccrm` criado localmente em
  `C:\Users\Useer\Documents\GitHub\newseccrm` como clone completo do GRSCRM
  (histórico Git preservado, sem cópia cega de arquivos soltos).
- Remote `origin` repontado de GRSCRM para
  `https://github.com/GabrielSchandler/newseccrm.git` (confirmado vazio via
  `git ls-remote` antes do repoint). Remote `grscrm-upstream` mantido
  apontando para o GRSCRM original, só para referência futura — **nenhum
  push feito ainda**.
- `package.json`: `name` e `repository`/`bugs`/`homepage` atualizados de
  `crm-saas-multiempresa`/GRSCRM para `newseccrm`. Nenhuma dependência
  alterada.
- `README.md`: adicionado aviso no topo apontando para `CLAUDE.md` e
  `docs/PROJECT_SPEC.md`; conteúdo original preservado abaixo (está
  desatualizado — descreve só o scaffold inicial do CRM, não o app real de
  339+ arquivos — não foi reescrito nesta entrega).
- Especificação completa e roteiro de início salvos na raiz:
  `NEWSEC-ESPECIFICACAO-E-PROMPT-CLAUDE.md`, `COMECE-AQUI-CLAUDE-CODE.md`.
- `CLAUDE.md` e `AGENTS.md` criados na raiz (não existiam antes — GRSCRM não
  tinha nenhum dos dois).
- `docs/PROJECT_SPEC.md`, `docs/TASKS.md`, `docs/PROGRESS.md` (este arquivo)
  criados.
- `docs/reference-images/`: 10 das 11 imagens recebidas salvas e renomeadas
  (uma delas era duplicata exata de outra — descartada). Nenhuma imagem
  corresponde às Telas 07 (cliente completo) ou 08 (plataforma/master) da
  tabela original — **essas duas não têm referência visual**. As imagens
  recebidas misturam três marcas fictícias diferentes (NewSec, "AtendoAI",
  "WorkHub") e dois padrões de navegação (sidebar vs. nav horizontal); a
  família mais consistente — sidebar escura com logo NewSec, presente em
  Atendimento, Gestão, Produtividade, Editor de dashboards e Academia — foi
  marcada como referência canônica, o resto como fora de marca. Detalhe em
  `../COMECE-AQUI-CLAUDE-CODE.md`.
- Três agentes de exploração (read-only) disparados em paralelo para o
  inventário factual profundo de GRSCRM, newsecchat e newsecfocus, seguindo
  os pontos de partida listados na seção 3 da especificação. Ainda em
  execução no momento deste checkpoint — resultado não incorporado.

**Arquivos relevantes:**

- `CLAUDE.md`, `AGENTS.md`, `README.md`, `package.json` (raiz)
- `docs/PROJECT_SPEC.md`, `docs/TASKS.md`, `docs/PROGRESS.md`
- `docs/reference-images/*.png`

**Migrações criadas/aplicadas e ambiente:** nenhuma ainda. Nenhum ambiente
de homologação configurado nesta sessão — não verificado se já existe um
separado do banco de produção do CRM.

**Comandos executados e resultados:**

- `git ls-remote https://github.com/GabrielSchandler/newseccrm.git` → saída
  vazia, confirmando repositório remoto vazio antes de qualquer push.
- `git clone https://github.com/GabrielSchandler/GRSCRM.git newseccrm` →
  sucesso, HEAD em `0fb852a`.
- `git remote rename origin grscrm-upstream` + `git remote add origin
  https://github.com/GabrielSchandler/newseccrm.git` → sucesso.
- Leitura de `package.json` do clone → confirma stack (seção 3 da
  especificação já estava correta para o CRM: Next 15.5.24, React 19.1,
  Tailwind 4.3.3, Supabase, React Hook Form, Zod). Scripts disponíveis:
  `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test`
  (`vitest run`).
- `npm install`/`npm run build`/`npm run typecheck` **ainda não executados**
  nesta sessão — build/tipos do CRM clonado não foram validados ainda.
- Não foi possível usar `gh` (CLI do GitHub não está no PATH, nem em Git
  Bash nem em PowerShell) — inspeção do repositório remoto feita só via
  `git ls-remote`.

**Atualização (mesmo dia, após os três inventários retornarem):**

- Os três agentes de inventário retornaram e foram incorporados a
  `SOURCE_INVENTORY.md` (seções 1, 2 e 3 completas), `PERMISSIONS.md` e
  `FEATURE_PARITY.md`.
- `npm install`, `npm run typecheck` e `npm run build` do newseccrm clonado
  rodaram **limpos** (exit 0 nos três). Build gerou 61 rotas sem erro,
  nenhum warning de tipo. Baseline do CRM confirmado antes de qualquer
  edição de código de produto.
- Achados que mudam decisão de arquitetura (detalhe em
  `SOURCE_INVENTORY.md`/`PERMISSIONS.md`): (1) nenhum dos três sistemas
  suporta hoje usuário multiempresa nem supervisor multiequipe — é 1:1 em
  todos, com a restrição do Focus imposta em RLS real; (2) o Chat sobrescreve
  silenciosamente campo de contato confirmado manualmente quando a IA
  diverge — sem proteção hoje, apesar da coluna `origem` já existir; (3)
  credencial OpenAI do Chat é singleton global por processo, não por
  empresa; (4) suspensão administrativa de conta no Focus é decorativa —
  campo existe de ponta a ponta mas nada o lê no agente nem o servidor
  rejeita ingestão; (5) confirmado positivamente que o Focus não coleta
  tecla digitada, captura de tela nem conteúdo de conversa; (6) integração
  Totalk do CRM tem superfície pequena (2 chamadas de API, 1 arquivo
  central) — bom sinal para o prazo de 07/10.

**Pendências externas reais:**

- Nenhum ambiente Supabase de homologação confirmado — precisa decidir/achar
  antes de qualquer migração real (mesmo aditiva).
- Push do commit inicial para `github.com/GabrielSchandler/newseccrm` ainda
  não feito — aguardando confirmação do Gabriel.
- Acesso à documentação/API do Totalk (`flwchat.readme.io`) ainda não
  revalidado nesta sessão.
- `docs/ARCHITECTURE.md` e `docs/METRICS_CATALOG.md` ainda não escritos como
  documentos formais (o conteúdo factual já existe espalhado em
  `SOURCE_INVENTORY.md`/`PERMISSIONS.md`/`FEATURE_PARITY.md`).
- Decisões de arquitetura propostas em `PERMISSIONS.md` seção 3 ainda não
  confirmadas pelo Gabriel (não bloqueiam início da Fase 1, mas valem
  revisão).

**Decisões tomadas e justificativa:**

- Clonar GRSCRM direto do GitHub (não da cópia local em
  `Documents\GitHub\GRSCRM`) para não arrastar arquivos não commitados que
  estavam soltos na working copy local do Gabriel (ex: `academia-grs/`,
  `whatsapp-provas/`, gráficos de benchmark) — são trabalho em andamento
  dele, sem relação com o NewSec, e um clone via remoto já os exclui
  naturalmente por não estarem commitados.
- Manter o GRSCRM original acessível como remote `grscrm-upstream` (não
  removido) para eventual referência futura, sem que isso implique
  sincronização automática — o CRM em produção continua seu próprio
  repositório independente.
- Nome local/remoto definido como `newseccrm` (não o `newsec-unified`
  sugerido como provisório na especificação), porque o Gabriel já criou e
  informou o repositório real `github.com/GabrielSchandler/newseccrm`.

**Próximo passo executável (histórico — superado pelo checkpoint abaixo):**
iniciar a Fase 1. Ver checkpoint seguinte para o que foi de fato entregue.

---

## Checkpoint 2026-09-22 (2) — Fase 1: shell, tema e atendimento demo

**Fase e tarefa atual:** Fase 1 em andamento. Entregue: tokens de tema,
shell/navegação, `/atendimento` navegável com dados sintéticos, drawer de
pré-venda. Pendente: fundação real de empresa/vínculo/permissão (schema),
`ARCHITECTURE.md` e `METRICS_CATALOG.md` formais.

**Branch e commit base:** `main`, a partir do commit `0641b48` (fim do
checkpoint anterior).

**Mudanças concluídas:**

- `src/app/globals.css`: tokens de tema claro/escuro escopados em
  `.ns-shell` (não colide com `--background`/`--foreground` do CRM
  existente), seguindo a tabela da especificação seção 8.3.
  `@custom-variant dark` redefinido para seguir `[data-theme="dark"]` em vez
  do `prefers-color-scheme` padrão do Tailwind (conferido antes: nenhum
  outro arquivo do projeto usava `dark:`, seguro redefinir globalmente).
- `src/components/newsec/`: novos componentes —
  `theme-script.tsx` (script inline sem flash, resolve tema salvo ou do
  sistema antes da 1ª pintura), `theme-toggle.tsx`, `sidebar-nav.tsx` (9
  itens da especificação §8.2; Atendimento abre o novo shell, Clientes/
  Comercial/Jurídico/Financeiro/Academia linkam para as rotas reais do CRM
  atual, Dashboards/Produtividade/Configurações aparecem desabilitados com
  indicador visual em vez de link morto), `top-bar.tsx`, `demo-banner.tsx`,
  `estado-badge.tsx`, `conversation-list.tsx`, `conversation-view.tsx`,
  `context-panel.tsx`, `pre-sale-drawer.tsx`, `atendimento-workspace.tsx`
  (orquestrador client-side).
- `src/lib/demo/atendimento-data.ts`: dados sintéticos (5 conversas, estados
  variados — IA/aguardando humano/humano/aguardando cliente/encerrada) e as
  seções/campos **reais** do drawer de pré-venda, extraídos de
  `src/components/pre-sales/pre-sales-form.tsx` (títulos das seções:
  Contratante, Titular da dívida, Dados financeiros, Contratação e
  negociação, Dados jurídicos, Pagamentos previstos) e da obrigatoriedade
  real em `src/lib/pre-sales/schema.ts` (só `snapshot_full_name`,
  `snapshot_cpf`, `financer_name`, `pre_sale_type`, `contract_value`,
  `payment_description` são de fato obrigatórios no Zod — o resto, inclusive
  toda a seção jurídica, é opcional hoje).
- `src/app/atendimento/layout.tsx` + `page.tsx`: nova rota **fora** do grupo
  `(authenticated)` — não depende de sessão Supabase nem de `.env.local`,
  então abre sem nenhuma configuração. Link "← voltar ao CRM atual" aponta
  para `/dashboard`.
- Nenhum arquivo do CRM existente foi alterado nesta entrega (além do que já
  constava do checkpoint anterior).

**Arquivos relevantes:** listados acima; todos novos, nenhum edita rota
existente do CRM.

**Migrações criadas/aplicadas e ambiente:** nenhuma — a fundação de
empresa/vínculo/permissão (spec seção 5) ainda não foi iniciada.

**Comandos executados e resultados:**

- `npm run typecheck` → limpo (exit 0), duas vezes (antes e depois do
  polish final).
- `npm run lint` → limpo (exit 0).
- `npm run build` → limpo (exit 0), 62 rotas (61 anteriores + `/atendimento`
  nova, estática `○`), nenhuma rota existente alterada de tamanho/tipo.
- Verificação em navegador de verdade via Playwright headless (Chromium
  baixado localmente para isso, não é dependência do projeto): `npm run dev`
  + navegação real em `/atendimento`. Cobriu: carregamento inicial, troca de
  conversa (lista + contexto atualizam), abertura/preenchimento/fechamento
  do drawer de pré-venda, alternância de tema claro↔escuro, drawer reaberto
  no tema escuro. Screenshots tiradas (ficaram no scratchpad da sessão, não
  fazem parte do repositório).
  - **Bug real encontrado e corrigido**: primeira rodada acusou erro de
    hidratação no console (`data-theme` divergente entre servidor e
    cliente) — faltava `suppressHydrationWarning` no wrapper `#ns-shell-root`
    que o `ThemeScript` manipula via `setAttribute` fora do controle do
    React. Corrigido em `src/app/atendimento/layout.tsx`; reverificado,
    console limpo (0 erros) depois.
  - **Achado de polish**: rótulos "Dashboards"/"Produtividade"/
    "Configurações" truncavam feio com o badge "em breve" nos 200px do
    menu — trocado por um indicador de ponto pequeno; reverificado
    visualmente, ok.
  - Dev server parado ao final (`lsof -ti:3000 | xargs kill`) — nada ficou
    rodando em segundo plano.

**Pendências externas reais:**

- Fundação de empresa/vínculo/permissão (schema real, migrações) — não
  iniciada. É o maior item restante da Fase 1 conforme a especificação.
- `docs/ARCHITECTURE.md` e `docs/METRICS_CATALOG.md` formais.
- Nenhum ambiente de homologação Supabase configurado ainda.
- ~~Push para `github.com/GabrielSchandler/newseccrm` continua não feito~~
  — **feito em 22/09/2026**, autorizado pelo Gabriel pra conectar a Vercel e
  acompanhar o desenvolvimento. `main` empurrado (3 commits: base clonada,
  inventário Fase 0, shell/tema/atendimento demo Fase 1). Nenhum ambiente
  configurado na Vercel ainda por mim — Gabriel vai conectar pelo painel.
  ⚠️ Sem `.env.local`/variáveis configuradas no projeto Vercel, todas as
  rotas que dependem de Supabase (praticamente todo o CRM, exceto
  `/atendimento`) vão dar erro em produção — isso é esperado até as env vars
  serem cadastradas lá, não é regressão de código.

**Decisões tomadas e justificativa:**

- Construir o novo shell como rota **isolada** (`/atendimento`, fora de
  `(authenticated)`) em vez de modificar `AppSidebar`/`AuthenticatedShell`
  existentes: o shell atual é compartilhado por todas as 61 rotas do CRM em
  uso; uma mudança nele tem alcance grande demais para validar sem o Gabriel
  por perto. A troca definitiva de shell (fazer `/atendimento` virar a tela
  principal de fato, integrada com o CRM) é decisão de produto para a Fase 2
  em diante, não algo a fazer silenciosamente agora.
- Itens de menu para áreas que já existem no CRM (Clientes, Comercial,
  Jurídico, Financeiro, Academia) linkam para as rotas reais atuais em vez
  de ficarem desabilitados ou de ganhar uma versão fake dentro do novo
  shell — evita link morto e demonstra concretamente a coexistência dos
  dois shells durante a transição.
- Drawer de pré-venda mostra as seções/campos reais (não a versão
  simplificada dos mockups) mas não tenta replicar a validação/gravação
  completa — isso é textualmente Fase 3 na especificação. O botão "Salvar"
  sempre mostra um erro recuperável explicando isso, para não fingir que a
  gravação funciona.
- Escopei os tokens de tema em `.ns-shell` (classe) em vez de `:root`
  para garantir zero risco de regressão visual nas 61 rotas existentes do
  CRM, que usam `--background`/`--foreground` próprios.

**Próximo passo executável:** com o Gabriel — decidir se revisa
`PERMISSIONS.md` antes de eu tocar em schema de permissão, e se autoriza o
push do repositório. Sem depender dessa resposta, o próximo trabalho local
seguro é a fundação de empresa/vínculo/permissão (migrações aditivas) e/ou
`docs/ARCHITECTURE.md`/`docs/METRICS_CATALOG.md`.

**Cuidados de compatibilidade:** confirmado por build que nenhuma das 61
rotas existentes do CRM mudou de tamanho ou tipo — a única rota nova é
`/atendimento`. `globals.css` só recebeu adições (nenhuma variável/regra
existente foi removida ou redefinida).

**Cuidados de compatibilidade:** nenhuma edição de código de produto feita
ainda além de `package.json` (nome/URLs) e `README.md` (aviso no topo) — o
CRM clonado está, em comportamento, idêntico ao GRSCRM original.

---

## Checkpoint 2026-09-23 — deploy funcionando, login real, 3 telas novas

**Fase e tarefa atual:** Fase 1 quase completa. Falta só a parte de
usuário↔empresa N:N (adiada de propósito, ver `PERMISSIONS.md` §2.1).

**Branch e commit base:** `main`, commit `53b5286` (a partir de `d4bf1c3`,
fim do checkpoint anterior).

**Mudanças concluídas:**

- **Deploy na Vercel resolvido de ponta a ponta** (`newseccrm.vercel.app`),
  com banco de homologação Supabase próprio (schema copiado da produção via
  `scripts/homologacao/`, sem nenhum dado de cliente). Gabriel já loga de
  verdade e navega. Causa raiz de uma sessão de debugging longa: as três
  variáveis `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/
  `SUPABASE_SERVICE_ROLE_KEY` foram criadas no tipo **"Secret"** na Vercel,
  que por design não expõe o valor no momento da compilação — variáveis
  `NEXT_PUBLIC_*` **precisam** disso, então chegavam vazias em produção,
  causando "Missing Supabase environment variables" em toda página que
  toca `getCurrentUserContext()`. **Precisam ser tipo "Config"**, não
  "Secret" — guardar essa regra, ela não é óbvia e não aparece em nenhum
  aviso claro da Vercel até você tentar editar o valor depois de criado.
  Diagnosticado com uma rota temporária (`/api/diagnostico-env`, já
  removida) que reporta presença/tamanho/prefixo de cada variável sem
  nunca expor o valor — útil de recriar se isso voltar a acontecer.
- Script `scripts/homologacao/copiar-schema-producao.ps1` corrigido duas
  vezes: (1) um travessão especial quebrava o parser do PowerShell 5.1 sem
  BOM UTF-8 (mesma causa raiz já documentada pro `Instalar.ps1` do NewSec
  Focus); (2) trocado de `supabase db dump` (exige Docker) para
  `pg_dump`/`psql` nativos, com detecção automática em
  `C:\Program Files\PostgreSQL\*\bin` e instruções de instalação leve
  quando não encontrado.
- Layout novo reorganizado num route group `src/app/(newsec)/`
  reaproveitável — antes o shell (sidebar + tema + banner) estava duplicado
  dentro de `atendimento/layout.tsx`; agora qualquer rota nova só precisa
  de um `page.tsx`.
- Três telas novas (dados sintéticos, ver `TASKS.md` para detalhe):
  `/atendimento/supervisao`, `/dashboards`, `/produtividade`. Menu lateral
  atualizado — Dashboards e Produtividade deixam de estar desabilitados.
- `supabase/migrations/0001_equipes.sql`: fundação aditiva de equipes
  (`teams`/`team_memberships`, N:N, RLS reaproveitando funções
  `current_user_*` já existentes no CRM). Não aplicada em nenhum banco
  ainda — SQL pronto pra colar no SQL Editor quando Gabriel quiser.

**Comandos executados e resultados:**

- `npm run typecheck` / `npm run lint` / `npm run build` — limpos (exit 0)
  depois da reorganização em route group e das 3 telas novas. 62→65 rotas,
  nenhuma existente alterada.
- Verificação em navegador real (Playwright) das 3 telas novas, claro e
  escuro, navegação cruzada Atendimento↔Supervisão, zero erros de console.
- **Bug real pego nesse processo**: o gráfico "Vendas por semana" em
  `/dashboards` usava `height` em `%` num elemento cujo pai não tinha
  altura própria definida (só `align-items: flex-end` no avô) — a barra
  sempre resolvia pra `0px`. Corrigido pra altura em `px` calculada a
  partir do maior valor da série. Only found because o build/typecheck não
  pega isso — só apareceu ao inspecionar o DOM renderizado de verdade
  (`getBoundingClientRect()`), a screenshot sozinha já mostrava o sintoma
  mas não a causa.
- **Armadilha local registrada**: depois de matar processos `node` via
  `lsof -ti:3000 | xargs kill` (Git Bash), o processo real do Windows
  às vezes continua vivo e servindo a versão antiga por baixo — mesmo com
  `.next` limpo e rebuild novo, o navegador continuava vendo o código
  velho porque o `npm run start` antigo nunca tinha realmente morrido.
  Confirmar sempre via `Get-Process node`/`Get-NetTCPConnection -LocalPort
  3000` no PowerShell antes de concluir "não reproduz" — `lsof`/`kill` do
  Git Bash não é confiável pra matar processos nativos do Windows.

**Pendências externas reais:**

- Gabriel ainda não aplicou `supabase/migrations/0001_equipes.sql` no
  banco de homologação (opcional, sem tela consumindo ainda).
- Vínculo usuário↔empresa N:N continua não implementado, de propósito —
  precisa de sessão dedicada mexendo em `current-user.ts`/`middleware.ts`.
- `docs/METRICS_CATALOG.md` formal ainda não escrito.
- Nenhum teste do fluxo real de Chat/Focus — Fase 2/5, não começou.
- Chaves `sb_secret_...`/`service_role` antigas coladas no chat durante o
  debugging foram invalidadas pela recriação do projeto Supabase — nada a
  fazer aqui, já resolvido por consequência, só registrando o que
  aconteceu.

**Decisões tomadas e justificativa:**

- Diagnosticar a variável de ambiente quebrada com uma rota HTTP temporária
  em vez de continuar tentando ler o painel da Vercel a distância — depois
  de várias rodadas de mal-entendido sobre qual campo tinha qual valor,
  uma fonte de verdade única (o próprio runtime respondendo) resolveu em
  um request o que quatro rodadas de "confere isso no painel" não
  resolveram.
- Supervisão entra como sub-rota de Atendimento (`/atendimento/supervisao`),
  não item novo no menu principal — é o que a especificação define
  (Anexo A.5) e evita um 10º item que não está no desenho original.
- Academia continua linkando pro CRM real em vez de ganhar uma versão de
  demonstração — já tem conteúdo/progresso reais funcionando lá, duplicar
  seria regressão de valor, não ganho.

**Próximo passo executável:** aplicar `0001_equipes.sql` em homologação
(Gabriel, quando quiser) e, com isso testado, seguir pra fundação
usuário↔empresa N:N com sessão dedicada de teste (dois usuários, duas
empresas). Em paralelo, `docs/METRICS_CATALOG.md` pode ser escrito a
qualquer momento — não depende de nada pendente.

**Cuidados de compatibilidade:** build confirma 65 rotas totais, nenhuma
das rotas antigas do CRM mudou de tamanho/tipo. `sidebar-nav.tsx` e
`top-bar.tsx` foram os únicos arquivos do shell novo *editados* (não
criados) nesta entrega — ambos só receberam extensões (props novas com
default seguro), nenhum comportamento anterior removido.
