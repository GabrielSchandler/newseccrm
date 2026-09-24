# NewSec — checkpoint de progresso

Formato de checkpoint conforme especificação, seção 20. Atualizar ao final
de cada ciclo de trabalho — este arquivo precisa permitir retomar o projeto
sem depender de memória de conversa anterior.

**Resumo no topo (o que importa agora, sem precisar ler o histórico
abaixo):** Fase 0 e Fase 1 completas, deploy funcionando com login real
(`newseccrm.vercel.app`), Entrega A (correções da revisão de 23/09) também
completa e testada. **`/atendimento` deixou de ser demonstração e a
Entrega C (fatia funcional do chat real) está fechada e comprovada**:
cenário de aceite completo (2 empresas, webhook → banco → worker → UI →
transferência → isolamento → replay → resiliência) rodou contra
homologação real, 19/19 etapas, dois bugs reais achados e corrigidos nesse
processo (`0006_atendimento_outbound_jobs_policy.sql`) — ver checkpoint
"Entrega C fechada" mais abaixo. `/atendimento/supervisao`, `/dashboards`,
`/produtividade` continuam demonstração com dados sintéticos,
deliberadamente. **Nenhum bloqueio real restante nesta fatia** — próximo
trabalho é escolha de prioridade (ações do CRM no atendimento, IA,
Totalk conectado, WhatsApp de teste real, ou itens da Entrega F). **Revisão de
fidelidade visual concluída em 23/09** — as 5 telas da Fase 1
(`/dashboards`, `/dashboards/personalizar`, `/produtividade`,
`/atendimento/supervisao`, `/atendimento`) foram comparadas contra as
imagens de referência originais e ajustadas; ver checkpoint "fidelidade
visual" mais abaixo para o detalhe de cada uma. **Entrega E (importador
Totalk) entregue em dry-run em 23/09** — pronto e testado, só falta o
token real do Totalk pra sair do modo fixture. **Entrega B concluída em
23/09** — fluxo de master testado ponta a ponta de verdade (Playwright
contra o app publicado), 8/8 etapas; um bug real foi encontrado e
corrigido nesse processo (suspender empresa não bloqueava ninguém) — ver
checkpoint "Entrega B concluída" mais abaixo. **Retificação (23/09,
posterior ao texto acima): Entrega C não estava de fato bloqueada** — só
a escolha de hospedagem paga/Redis pago/número real de WhatsApp depende do
Gabriel. Redis/worker local (ou alternativa local documentada) e adaptador
de WhatsApp simulado não dependem de nenhuma decisão externa — dá pra
construir e testar o pipeline inteiro agora. Ver checkpoint "Entrega C"
mais abaixo para o que foi de fato entregue nesse modelo. **Retificação
(24/09): Entrega C ganhou uma rodada de confiabilidade** (transação atômica
no envio, reenvio idempotente, lease de job travado, fail-closed de
provedor — migração `0007_atendimento_confiabilidade.sql`) e **Entrega E
(importador Totalk) saiu do dry-run — grava de verdade em homologação**
desde 24/09 (`--destino=homologacao`), idempotente por consulta direta ao
banco, comprovado com 4 rodadas reais (incluindo 2 quebradas de propósito
no meio de uma sessão e 1 com checkpoint local apagado) sem nenhuma
duplicata. Ver checkpoint "Prioridade 0 fechada + Totalk grava em
homologação" mais abaixo para o detalhe completo.

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

---

## Checkpoint 2026-09-23 (2) — Entrega A: correções da revisão externa

**Entrega e tarefa:** Entrega A completa (`NEWSEC-CORRECOES-E-CONTINUACAO-CLAUDE.md`,
seções 3–8). Entregas B–F não iniciadas — ver "Próximo passo executável".

**Branch e HEAD:** `main`, commit `ecebcb3` (a partir de `9065dc9`).

**Mudanças implementadas:**

1. **Integridade equipe/empresa** (`supabase/migrations/0002_equipes_integridade_empresa.sql`):
   trigger estrutural `enforce_team_membership_company` impede vincular
   `user_profile` de empresa diferente da equipe — roda mesmo com bypass de
   RLS (service role), não só via policy. Trigger adicional
   `prevent_team_company_change` torna `teams.company_id` imutável após
   criado. Helper `user_belongs_to_company()` isolado (será redirecionado
   pra `company_memberships` quando essa tabela existir, sem tocar no
   trigger).
2. **Rascunho por conversa** (`atendimento-workspace.tsx`,
   `conversation-view.tsx`): estado movido do `ConversationView` (que
   desmontava a cada troca via `key={conversa.id}`) pro workspace pai,
   indexado por `conversa.id`.
3. **Script de homologação** (`copiar-schema-producao.ps1`): checa
   `$LASTEXITCODE` de `pg_dump`/`psql` imediatamente, `-v ON_ERROR_STOP=1`
   no psql, arquivo de saída com timestamp único por execução, extrai e
   exibe o identificador do projeto origem/destino com confirmação
   explícita antes de aplicar (bloqueia se forem o mesmo projeto), nunca
   propaga "Pronto" depois de erro.
4. **Colisão de prefixo de rota** (`workspace.ts`, `middleware.ts`): nova
   `matchesPathPrefix()`/`matchesAnyPathPrefix()` com fronteira de
   segmento, substituindo `pathname.startsWith(prefixo)` cru em 6 pontos
   (`isProtectedRoute`, `isDashboardRoute`, `isPublicTrackingRoute`, checagem
   de `/empresas`, e os 5 arrays de prefixo em `classifyWorkspacePath`).
5. **Linguagem interna na UI** (`pre-sale-drawer.tsx`): removidas
   referências a "Fase 1"/"Fase 3" e caminho de arquivo do código, texto
   reescrito mantendo a honestidade de que a gravação real não existe
   ainda.
6. **Decisão documentada** (`docs/decisions/0001-rotas-demo-nao-renomeadas.md`):
   por que as rotas do shell novo continuam em `/atendimento` em vez de
   `/demo/...`.

**Migrações criadas:** `0002_equipes_integridade_empresa.sql` (correção
incremental sobre `0001_equipes.sql`, idempotente — funciona seja `0001`
já aplicada em algum ambiente ou não).

**Migrações aplicadas, em qual ambiente e com qual evidência:** Nenhuma
aplicada em homologação ou produção ainda — só testadas localmente (ver
abaixo). `0001`/`0002` continuam pendentes de aplicação real; Gabriel não
confirmou ter rodado `0001` ainda.

**Comandos/testes executados e resultados:**

- **Teste de banco real, não mock**: subi um Postgres 17 local descartável
  (`initdb`/`pg_ctl`, limpo depois), apliquei uma fixture mínima que copia
  verbatim as 4 funções `current_user_*` do dump real de produção
  (`scripts/homologacao/schema-producao.sql` linhas 189–280) trocando só
  `auth.uid()` por um mock via GUC de sessão (`app.test_uid`), depois
  `0001_equipes.sql` + `0002_equipes_integridade_empresa.sql` +
  `supabase/tests/0002_equipes_integridade_empresa.test.sql` — **9/9 casos
  do checklist de aceite passaram**, incluindo os 8 do documento de correção
  (gerente vincula membro da própria empresa: sucesso; vincula de empresa
  diferente: bloqueado pelo trigger; administra equipe alheia: bloqueado
  por RLS; consultor se autopromove: bloqueado por RLS; UPDATE contornando
  empresa: bloqueado pelo trigger; revogação remove acesso: confirmado;
  inserção direta sem `SET ROLE` simulando bypass de RLS: bloqueada pelo
  trigger mesmo assim) mais 1 bônus (mudar `company_id` de equipe
  existente: bloqueado). Script e fixture ficaram versionados em
  `supabase/tests/` pra rodar de novo quando a migração mudar — não é
  print, é suíte reexecutável.
- `npm run typecheck` / `npm run lint` / `npm run build` — limpos (exit 0)
  depois de todas as mudanças de código.
- Playwright contra build de produção local (`next start`, processo
  confirmado único via `Get-NetTCPConnection`/`Get-Process node` no
  PowerShell antes de testar — lição da sessão anterior sobre processo
  zombie): troca A→B→A preserva os dois rascunhos independentes, zero erro
  de console.
- Teste direto da função `matchesPathPrefix` (script Node isolado): confirma
  que `"/dashboards".startsWith("/dashboard")` era `true` (o bug) e que
  `matchesPathPrefix("/dashboards", "/dashboard")` agora é `false`.
- Deploy na Vercel (`newseccrm.vercel.app`) conferido depois do push: `/`,
  `/login`, `/atendimento`, `/atendimento/supervisao`, `/dashboards`,
  `/produtividade` todos 200/307 como esperado.

**Integrações reais versus simuladas:** Tudo nesta entrega é correção de
código/schema já existente, não integração nova. `/atendimento` e as
telas irmãs continuam 100% dado sintético — nenhuma chamada a Supabase
nelas (confirmado por busca de import, registrado na decisão 0001). O
trigger de integridade é real e testado, mas as tabelas `teams`/
`team_memberships` que ele protege ainda não têm nenhuma tela/ação
gravando nelas.

**Pendências e bloqueios externos:**

- `0001`/`0002` não aplicadas em homologação — depende do Gabriel rodar
  (SQL Editor do Supabase, sem segredo envolvido).
- Testes de RLS validam a **lógica** das policies com papéis simulados;
  não substituem testar com o usuário real de homologação depois de
  aplicado.
- Responsividade (seção 8 do documento de correção) não testada nos
  breakpoints pedidos (1920/1366/1280/768/390) — adiado, não bloqueia nada
  a seguir.
- **Bloqueio real pra Entrega C (chat humano)**: precisa de decisões de
  infraestrutura que só o Gabriel pode tomar — onde roda o worker
  (BullMQ/Redis precisa de um processo de vida longa, não serverless da
  Vercel), qual Redis usar, e se já existe (ou como conseguir) acesso a um
  adapter de WhatsApp de teste antes de sequer pensar nos dois números
  reais. Sem isso, Entrega C fica limitada a schema/contratos preparados,
  sem pipeline de verdade rodando ponta a ponta.

**Compatibilidade com o CRM antigo:** build confirma que nenhuma rota
existente mudou de tamanho/tipo. A mudança em `middleware.ts`/`workspace.ts`
(prefixo com fronteira de segmento) é estritamente mais restritiva que o
`startsWith` cru só no sentido de não capturar rotas que não deveriam —
todo caminho que baixa hoje (`/dashboard`, `/dashboard/x`, `/financeiro`
etc.) continua batendo exatamente igual; só `/dashboards` (que antes
`/dashboard` capturava por engano) para de ser afetado pelas regras do CRM
antigo.

**Próximo passo executável:** Duas opções concretas, sem depender uma da
outra:
1. **Entrega B (fundação multiempresa)** — pode começar sem nenhuma decisão
   externa do Gabriel: criar `company_memberships`, fazer backfill do
   `company_id` legado, atualizar `current-user.ts`/`middleware.ts` pra ler
   vínculos em vez de 1 campo, com os mesmos testes de dois usuários/duas
   empresas que já uso pra equipes. É código crítico de auth — pede sessão
   dedicada com o tempo certo pra testar direito, não uma mudança de
   passagem.
2. **Entrega C (chat humano)** — só pode avançar de verdade depois do
   Gabriel decidir onde roda o worker/Redis e confirmar acesso a um
   adapter de WhatsApp de teste. Sem isso, o que dá pra fazer é preparar
   schema/contratos (tabelas de conversa/mensagem, idempotência,
   outbox) sem pipeline real — valor limitado sem a infraestrutura.

---

## Checkpoint 2026-09-23 (3) — fidelidade visual: editor de dashboards + dashboards

**Fase e tarefa atual:** revisão de fidelidade visual das telas da Fase 1
contra as imagens de referência originais, pedido explícito do Gabriel
("Preciso dela o mais proximo possivel das telas"). Não é uma entrega nova
do roadmap B–F — é polish sobre o que já existe.

**Branch e commits:** `main`, `2a6b43e` (tela nova) e `8d36f37` (rewrite de
fidelidade), a partir de `29a4b90`.

**Mudanças concluídas:**

1. **Tela nova: Editor de dashboards** (`/dashboards/personalizar`, Tela 09
   da especificação) — `2a6b43e`. Layout de 3 painéis: catálogo de
   indicadores arrastável (visual, não funcional) à esquerda, grade de
   cards com preview real (`src/components/newsec/mini-charts.tsx`:
   `MiniLineChart`/`MiniBarChart`/`MiniDonutChart`, SVG puro sem lib
   externa) ao centro, painel de configuração do card selecionado
   (fórmula, compartilhamento, tamanho) à direita. Dados em
   `src/lib/demo/editor-dashboards-data.ts`. Link de entrada adicionado em
   `/dashboards` ("Personalizar").
2. **Rewrite de fidelidade: `/dashboards`** (Tela 05) — `8d36f37`,
   comparado contra `docs/reference-images/05-gestao-newsec-sidebar-escuro-canonico.png`.
   Adicionado: título "Visão da empresa" + subtítulo, 3 filtros pill (Este
   mês/Todas as equipes/Comercial e Jurídico), eixo Y em R$ no gráfico de
   vendas por semana (antes só tinha o valor em cima da barra, sem escala),
   funil comercial com formato de trapézio de verdade via `clip-path`
   (antes eram barras retangulares de uma cor só) e cores distintas por
   etapa, botões de ação por insight ("Ver conversas"/"Ver lista") e "Ver
   todos →" no cabeçalho do painel.

**Comandos executados e resultados:**

- `npm run typecheck` / `npm run lint` — limpos (exit 0) nas duas entregas.
- `npm run build` — limpo, rotas novas (`/dashboards/personalizar`) e
  alteradas geradas sem erro (confirmado por timestamp dos artefatos em
  `.next/server/app/(newsec)/` quando o log do build ficou vazio por uma
  particularidade de buffering da ferramenta).
- Playwright contra `next start` real (processo único confirmado via
  `Get-Process node`/`Get-NetTCPConnection -LocalPort 3000` antes de
  testar, lição já registrada nos checkpoints anteriores): screenshot
  claro e escuro das duas telas, zero erro de console. Comparação visual
  direta contra a imagem de referência confirmou: título, filtros, botão
  Personalizar, eixo R$ com valores corretos, funil com cores e números
  batendo, insights com botões de ação — tudo presente nos dois temas.

**Integrações reais versus simuladas:** nenhuma — ambas continuam 100%
dado sintético (`src/lib/demo/`), sem chamada a Supabase.

**Pendências externas reais:** nenhuma nova.

**Próximo passo executável:** continuar a mesma revisão de fidelidade nas
telas restantes, comparando contra a imagem de referência de cada uma:
`/produtividade` (`06-produtividade-newsec-sidebar-escuro-canonico.png`),
`/atendimento/supervisao` (`04-supervisao-atendoai-offbrand.png`),
`/atendimento` (`01-atendimento-claro-newsec-com-drawer-prevenda.png` e
`02-atendimento-escuro-newsec-sidebar-canonico.png`).

---

## Checkpoint 2026-09-23 (4) — fidelidade visual: produtividade, supervisão, atendimento

**Fase e tarefa atual:** conclui a revisão de fidelidade visual iniciada
no checkpoint anterior — as 5 telas da Fase 1 estão todas comparadas
contra a imagem de referência original.

**Branch e commits:** `main`, `f12956b` (produtividade), `44c8d5e`
(supervisão), `eda2e54` (atendimento), a partir de `15d2943`.

**Mudanças concluídas:**

1. **`/produtividade`** (`f12956b`) — comparado contra
   `06-produtividade-newsec-sidebar-escuro-canonico.png`. Adicionado
   título+subtítulo, botões Exportar/Dispositivos, abas (só "Visão geral"
   navegável) e filtros, seguindo o mesmo padrão já usado em
   `/dashboards`. Cards ganham ícone colorido por tipo; painel de
   aplicativos ganha ícone por app e cabeçalho de coluna; tabela de
   pessoas ganha coluna "Ações" e cor de avatar distinta por pessoa;
   aviso de dados ilustrativos migrado pro rodapé como card informativo,
   igual à referência. **Correção de contraste**: texto branco sobre
   fundo quase branco no segmento "Sem dados" do gráfico de distribuição
   — trocado pra texto escuro nesse segmento específico. `FiltroPill`
   extraído de `dashboards-workspace.tsx` (agora duplicado em 2 lugares)
   pra um componente compartilhado; `StatCard` ganha variante de cor
   "info" (roxo) pro card Cobertura.
2. **`/atendimento/supervisao`** (`44c8d5e`) — comparado contra
   `04-supervisao-atendoai-offbrand.png`. Essa imagem é da marca fictícia
   "AtendoAI", fora do padrão NewSec adotado como canônico (ver nota em
   `COMECE-AQUI-CLAUDE-CODE.md`) — o conteúdo/layout foi usado como
   fonte, sem copiar a marca (logo, sidebar própria, relógio do canto).
   Adicionado título+subtítulo, abas e filtros no topo. Fila de
   atendimento ganha coluna "Tipo" (Humano/IA) que existia no dado mas
   nunca era exibida. Carga da equipe vira tabela com a coluna "mais
   antigo" (dado que já existia sem lugar pra aparecer) e ganha o botão
   "Distribuir atendimentos". Atenção necessária ganha link "Ver todos",
   ícone e botão de ação por item. **Seção inteira nova**: "Tempo de
   primeira resposta", com gráfico de linha (SVG próprio, eixo Y em
   minutos) por hora do dia e card "Tempo médio hoje" — não existia
   nenhuma versão antes. Diálogo de transferência ganha campo de
   mensagem opcional com contador de caracteres.
3. **`/atendimento`** (`eda2e54`) — última tela, comparada contra as duas
   imagens (`01-...-com-drawer-prevenda.png` claro e
   `02-...-sidebar-canonico.png` escuro). Lista de conversas ganha
   cabeçalho "Atendimento"+subtítulo e contador por aba. Painel de
   contexto ganha abas (só "Resumo" tem conteúdo, as outras mostram "em
   breve"), telefone rotulado (Principal/Outro + final do número),
   email/localização (campo novo em `atendimento-data.ts`), "cliente
   desde", cards de venda com indicador de status, e "Ações rápidas"
   reorganizado num grid de 3 botões compactos mantendo "Criar pré-venda"
   como botão largo separado (por causa do estado condicional que já
   tinha). **Tipo de mensagem "áudio"**: existia no schema de dados mas
   nunca era renderizado nem usado em nenhum exemplo — agora tem
   player+forma de onda+transcrição, com uma mensagem de exemplo nova.
   Drawer de pré-venda ganha estado de erro visual (borda vermelha +
   texto) nos campos obrigatórios sem valor — sem mudar a decisão já
   tomada (`docs/decisions/`) de manter as seções reais do CRM em vez de
   reagrupar como o mockup faz (Obrigatórios/Jurídico/Opcionais).

**Comandos executados e resultados:**

- `npm run typecheck` / `npm run lint` / `npm run build` — limpos (exit 0)
  em cada uma das 3 entregas, sequencialmente.
- Playwright contra `next start` real (processo único confirmado via
  `Get-Process node`/`Get-NetTCPConnection -LocalPort 3000` antes de
  cada rodada) — claro e escuro em cada tela, mais o diálogo de
  transferência aberto (supervisão), o drawer de pré-venda aberto e um
  contato sem cliente cadastrado (Clara Nunes, atendimento). Zero erro
  de console em todas as rodadas. Comparação visual direta contra as
  imagens de referência confirmou os elementos de cada lista acima.

**Integrações reais versus simuladas:** nenhuma — as 3 telas continuam
100% dado sintético (`src/lib/demo/`), sem chamada a Supabase.

**Pendências externas reais:** nenhuma nova.

**Próximo passo executável:** a revisão de fidelidade visual pedida pelo
Gabriel está completa. Retomar o roadmap: Entrega B (fundação
multiempresa, pode começar sem decisão externa) ou Entrega C (chat
humano real, bloqueada até o Gabriel decidir infraestrutura de
worker/Redis e confirmar acesso a um adapter de WhatsApp de teste) — ver
"Bloqueios reais" no checkpoint da Entrega A.

---

## Checkpoint 2026-09-23 (5) — Entrega E: importador Totalk em dry-run; Entrega B bloqueada

**Fase e tarefa atual:** continuando o roadmap depois da revisão de
fidelidade visual. Entrega B verificada e bloqueada (não executável sem
input do Gabriel); Entrega E executada e entregue (não dependia de nada
externo).

**Branch e commit:** `main`, `9f8b562`, a partir de `f4498bc`.

**Entrega B — por que não avancei:**

Fui checar o que faltava pra "testar ponta a ponta o fluxo de master"
(`docs/PERMISSIONS.md` §2.0) e confirmei por busca no código
(`current-user.ts`, `middleware.ts`, `actions/auth.ts`) que
`is_platform_owner` **só é lido**, nunca escrito — não existe nenhuma tela
no CRM pra promover um usuário a master, isso sempre foi feito via SQL
direto (provavelmente na criação da conta do próprio Gabriel). Pra criar um
segundo usuário de teste `is_platform_owner=true` eu precisaria de
`SENHA_BANCO` (mesmo padrão já usado em `supabase/aplicar.mjs`) ou
`SUPABASE_SERVICE_ROLE_KEY` — conferi o `.env.local` local (só nomes de
variável, sem imprimir valor) e **nenhum dos dois está presente**, só
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Isso não é algo
pra resolver pedindo o segredo pelo chat (regra já registrada mais acima
neste arquivo, do incidente de 14/09). Registrei como bloqueio explícito em
`docs/TASKS.md` com as duas saídas possíveis, nenhuma delas tomada ainda.

**Entrega E — importador de histórico do Totalk (dry-run):**

Antes de desenhar qualquer coisa, consultei a documentação real da API
(https://flwchat.readme.io/, via `llms.txt`/`llms-full.txt` e as páginas de
referência de sessão/mensagem/contato/nota/paginação/rate-limit) — a
integração Totalk que já existe no CRM (`src/lib/totalk/api.ts`) é só 2
chamadas (buscar contato por telefone, enviar PDF) e **não tem nada** de
listar histórico de conversa, então o formato do importador precisava vir
da API de verdade, não de suposição.

Entregue em `scripts/totalk-importer/`:

- `cliente-totalk.mjs` — cliente com dois modos (`fixture`/`real`),
  paginação por `pageNumber`/`pageSize` até `hasMorePages=false`, retry com
  backoff exponencial em `429`/5xx (limites reais documentados:
  1000 req/5min contínuo, rajada 200 req/5s).
- `fixtures/` — 3 sessões representativas (reaproveitando os nomes já
  usados nas telas de demonstração de `/atendimento`, de propósito, pra
  manter a história consistente): Mariana (concluída, com documento, áudio
  com mídia propositalmente ausente, e nota interna), Rafael (em
  andamento), Clara (pendente, sem agente designado).
- `mapeamento-agentes.json` — mapeamento manual de agente Totalk → usuário
  NewSec; um agente mapeado (exemplo, UUID fictício) e um deliberadamente
  não mapeado, pra provar que o importador nunca cria usuário novo sozinho.
- `importar.mjs` — pipeline completo (departamentos → agentes → contatos →
  sessões → mensagens/notas por sessão), checkpoint em
  `.checkpoint/estado.json` (fora do git), saída normalizada em `saida/*`
  (fora do git) + relatório de reconciliação (`.json` e `.md`).
- `testar-retry.mjs` — teste isolado do backoff (fixture nunca toca rede,
  então esse caminho não seria exercido de outro jeito).
- `README.md` — runbook completo: como funciona, como habilitar o modo real
  mais tarde (variável de ambiente, nunca token colado no chat), as duas
  suposições não confirmadas contra a API real (semântica de
  `FROM_HUB`/`TO_HUB`; endpoint de arquivo por ID), e o que muda quando a
  Entrega C existir (só a etapa final de escrita).

**Comandos executados e resultados — testado de verdade, não só inspeção:**

- Rodada limpa: 2 departamentos, 2 agentes, 3 contatos, 3 sessões, 12
  mensagens, 1 nota — todos "novos". Relatório mostra 1 agente sem
  mapeamento e 1 mídia indisponível (esperado, de propósito nas fixtures).
- Rodada repetida sem `--reiniciar`: todos os recursos com `novos: 0`,
  tudo em `jaVistos` — confirma que importar duas vezes não duplica.
- `--reiniciar --falhar-apos-sessao=sessao-mariana-0001`: interrompe de
  propósito logo depois da sessão da Mariana. **Bug real encontrado nesse
  teste**: a primeira versão marcava a sessão como concluída *depois* do
  gancho de interrupção, então na prática nunca marcava nada antes de
  lançar o erro — a rodada seguinte reprocessava (embora sem duplicar,
  porque o dedupe por id de mensagem/nota ainda pegava) a sessão inteira em
  vez de pular. Corrigido: marcar `sessoesConcluidas` **antes** do gancho de
  teste. Reverificado: rodada seguinte mostra a sessão da Mariana inteira
  pulada (nem sequer refaz a chamada de mensagens/notas dela).
- `npm run totalk:testar-retry`: 2 respostas `429` simuladas seguidas de
  sucesso — confirma 3 chamadas e ~1.5s de espera acumulada (backoff
  500ms→1000ms); erro permanente (`401`) simulado confirma 0 retentativas.
- `npm run lint` / `typecheck` / `test` (vitest, 16 testes) / `build` —
  todos limpos depois de tudo.

**Integrações reais versus simuladas:** nenhuma chamada real ao Totalk foi
feita — modo fixture o tempo todo, sem token configurado em lugar nenhum.

**Pendências externas reais:**

- Token de API do Totalk — decisão/acesso do Gabriel, pra sair do modo
  fixture.
- As duas suposições documentadas no README (`FROM_HUB`/`TO_HUB`; endpoint
  de arquivo por ID) precisam ser confirmadas contra uma chamada real assim
  que o token existir.
- `mapeamento-agentes.json` real (hoje só tem um exemplo com UUID fictício).
- Entrega B segue bloqueada — ver acima, decisão do Gabriel entre testar
  manualmente ou me dar acesso à `SUPABASE_SERVICE_ROLE_KEY` local.

**Decisões tomadas e justificativa:**

- Importador escreve em arquivo JSON local, não em tabela nova do Supabase
  — criar schema definitivo antes da Entrega C decidir o desenho real do
  chat arriscaria migração errada/retrabalho; a lógica do importador
  (paginação, dedupe, checkpoint, retry, relatório) é o que precisa existir
  agora, o destino final é só trocar depois.
- Documentei as suposições não confirmadas em vez de apresentá-las como
  certeza — a documentação do Totalk não descreve a semântica de
  `FROM_HUB`/`TO_HUB` explicitamente, e inventar isso silenciosamente
  poderia inverter quem é "cliente" numa mensagem importada.
- Não tentei contornar a falta de `SENHA_BANCO`/`SUPABASE_SERVICE_ROLE_KEY`
  da Entrega B de nenhuma forma (ex: pedir pro Gabriel colar o valor no
  chat) — registrei o bloqueio e segui pra trabalho independente executável
  (Entrega E), como o próprio documento de correção pede seção 14: "avance
  em trabalho independente seguro, deixe explícito o bloqueio".

**Próximo passo executável:** com o Gabriel — decidir como destravar a
Entrega B (testar manualmente vs. me dar acesso à
`SUPABASE_SERVICE_ROLE_KEY` local) e, quando quiser, configurar
`TOTALK_IMPORT_TOKEN`/`TOTALK_IMPORT_BASE_URL` pra validar as duas
suposições da Entrega E contra a API real. Sem depender de nenhuma
resposta, o próximo trabalho local seguro é continuar preparando a Entrega
C (schema/contratos da seção 9, sem pipeline real) ou avançar itens da
Entrega F que não dependem de B/C/D.

---

## Checkpoint 2026-09-23 (6) — Entrega B concluída: fluxo de master testado ponta a ponta

**Fase e tarefa atual:** Entrega B fechada. Gabriel liberou
`SUPABASE_SERVICE_ROLE_KEY` no `.env.local` local (depois de um segundo
incidente de segredo colado direto no chat — ver `../CLAUDE.md`, regra
"Segredo não passa pelo chat" — o Claude Code bloqueou a tentativa de
gravar o valor num arquivo, nada foi persistido a partir do valor colado;
o Gabriel colou o valor definitivo ele mesmo no arquivo depois).

**Branch e commits:** `main`, `f958354` (fix + teste) e `5312bc2` (correção
do teste), a partir de `08fa61c`.

**O que foi verificado, e como:**

Escrevi `scripts/testes-homologacao/verificar-fluxo-master.mjs` — Playwright
de verdade (browser real) contra `newseccrm.vercel.app` publicado, não
contra localhost nem chamada direta de API. Fluxo completo: cria/reaproveita
um usuário master de teste (`master.teste.automatizado`, senha regenerada a
cada rodada via Admin API, nunca persistida) → login via UI → cria empresa
via form real (`Nova empresa`) → configura módulos/limite via form real
(`/empresas/[id]`) e confirma que persiste (reload + reler o DOM) → acessa a
empresa e cria um usuário dentro dela via `/usuarios/novo` real → suspende a
empresa (mesmo form, campo `status`) e confirma que persiste → **usuário
novo da empresa tenta logar → confirma que cai em `/empresa-suspensa`** →
confirma que o master, acessando a mesma empresa suspensa, nunca é
bloqueado. Limpa os artefatos da rodada (empresa + usuário de teste) no
final, mesmo se algo falhar no meio — só a empresa-sede e o master de teste
ficam (reaproveitáveis entre rodadas).

**Bug real encontrado (não hipótese, comportamento observado)**: na
primeira rodada, suspender a empresa **não bloqueava nada** — o usuário
novo conseguia logar e navegar normalmente numa empresa `suspended`.
Investigação confirmou: `company_platform_settings.status` só era lido em
`src/lib/company/platform-settings.ts` (pro badge visual) e em nenhum outro
lugar — `current-user.ts` e `middleware.ts` nunca consultavam essa coluna.
Corrigido em `src/lib/auth/current-user.ts`, logo depois do check já
existente de `is_active` → `/conta-inativa` (mesmo padrão): se o perfil não
é `is_platform_owner` e a empresa dele está `suspended`/`cancelled`,
redireciona pra `/empresa-suspensa` (página nova, mesmo estilo de
`/conta-inativa`). O master nunca é bloqueado por isso — precisa continuar
acessando (inclusive a própria empresa que ele suspendeu) pra revisar/
reativar.

**Comandos executados e resultados:**

- `npm run typecheck` / `npm run lint` / `npm run build` — limpos (exit 0)
  depois da mudança em `current-user.ts` e da página nova.
- Deploy conferido de verdade: fiz polling em
  `https://newseccrm.vercel.app/empresa-suspensa` (esperando sair de 404)
  antes de rodar a verificação, pra garantir que estava testando o código
  novo publicado, não uma versão anterior ainda em cache/propagação.
- `node scripts/testes-homologacao/verificar-fluxo-master.mjs`: **8/8
  etapas em duas rodadas seguidas**. Achado de robustez no processo de
  teste em si (não bug de aplicação): o client admin (rodando aqui local)
  às vezes lia uma linha recém-criada pela Server Action (rodando na
  Vercel) antes dela estar visível pra leitura — corrigido com
  `reconsultarAteAchar()` (retry curto) no script de verificação. Achei
  também um bug de verdade no próprio script de limpeza
  (`.catch()` não existe do jeito que encadeei no query builder do
  supabase-js) — corrigido com try/catch de verdade, e reconferido que a
  limpeza de fato apaga os artefatos da rodada (empresa + usuário de
  teste), checado direto no banco depois.
- Adicionado `playwright` como devDependency de verdade do projeto (antes
  só existia via instalação solta numa pasta de scratch) — infraestrutura
  reutilizável pra qualquer teste ponta a ponta futuro, não só este.

**Integrações reais versus simuladas:** tudo real — Supabase de
homologação de verdade, app publicado de verdade na Vercel, sem mock em
nenhuma camada. Único uso de `SUPABASE_SERVICE_ROLE_KEY` foi pra
criar/promover o usuário master de teste e limpar os artefatos no final; a
verificação do fluxo em si (criar empresa, configurar, criar usuário,
suspender, logar) foi sempre via formulário real/sessão normal.

**Pendências e bloqueios externos:** nenhum novo. A chave de serviço fica
só no `.env.local` local (fora do git, confirmado antes de qualquer commit).

**Decisões tomadas e justificativa:**

- Corrigi o bug de suspensão em vez de só documentá-lo como gap conhecido
  — a Entrega B só podia ser considerada concluída se o fluxo descrito em
  `PERMISSIONS.md` §2.0 ("bloquear → confirmar que bloqueio tira acesso")
  de fato funcionasse; documentar sem corrigir deixaria a entrega
  formalmente aberta pra sempre.
- Coloquei o check em `current-user.ts`, não em `middleware.ts` — mesmo
  padrão arquitetural já usado pro check de `is_active`, mudança isolada
  num arquivo só (menor risco que mexer no `middleware.ts`, mais denso e
  com bastante lógica de rota já encadeada), e o platform owner precisa
  continuar acessando mesmo uma empresa suspensa (pra revisar/reativar) —
  o `middleware.ts` já tem lógica específica que trataria isso de forma
  diferente pro platform owner, então ficaria redundante/conflitante.
- `playwright` virou devDependency de verdade em vez de continuar solto
  numa pasta de scratch — este projeto vai precisar de mais testes ponta a
  ponta reais conforme as próximas entregas (C especialmente) avançam;
  formalizar agora evita reinstalar toda vez.

**Próximo passo executável:** Entrega B fechada. ~~Retomar Entrega C (chat
humano real) só quando o Gabriel decidir infraestrutura de worker/Redis e
confirmar acesso a um adapter de WhatsApp de teste~~ — **retificado em
23/09, mesmo dia**: essa frase misturava "decisão de infra paga/número
real" (do Gabriel) com "ter algum worker/Redis rodando localmente pra
testar" (não depende de ninguém). Entrega C foi iniciada e uma fatia
funcional entregue com worker local + adaptador de WhatsApp simulado — ver
checkpoint "Entrega C" logo abaixo.

---

## Checkpoint 2026-09-23 (7) — Entrega C: fatia funcional do chat humano real

**Fase e tarefa atual:** primeira fatia funcional da Entrega C entregue —
schema, RLS, worker, webhook de teste, actions e UI real de `/atendimento`
existem e foram verificados no que dava pra verificar sem banco aplicado
em homologação. **Não é a Entrega C inteira** — falta aplicar as migrações
em homologação (bloqueio real, ver abaixo) e, depois disso, o teste de
aceite ponta a ponta com 2 empresas ainda precisa rodar de verdade.

**Branch e commits:** `main`, `04f6877` → `88a3d3a` (6 commits), a partir
de `d67dc2e`.

**Decisão de infraestrutura (sem Docker disponível neste ambiente):** em
vez de Redis/BullMQ, a fila é uma tabela Postgres (`outbound_jobs`) com um
worker Node persistente fazendo poll via uma RPC atômica
(`claim_outbound_jobs`, `FOR UPDATE SKIP LOCKED`). É uma decisão consciente
e documentada (não um atalho escondido) — outbox pattern é um padrão real
de produção, evita introduzir uma peça de infra nova (Redis) antes de
precisar dela de verdade, e já usa o Postgres que o projeto já tem
configurado. Redis pode entrar depois se a escala exigir; nada no desenho
impede a troca.

**O que foi construído (código):**

1. `supabase/migrations/0004_atendimento_chat.sql` — `channels`,
   `contacts`, `contact_phone_numbers`, `conversations`,
   `conversation_transfers`, `messages`, `message_attachments`,
   `inbound_events` (dedup de webhook), `outbound_jobs` (fila). RLS no
   MESMO padrão já usado em toda tabela real do CRM (confirmado por
   investigação no dump de produção antes de escrever): duas policies por
   tabela, uma por empresa (`get_my_company_id()`) e uma pro master
   (`current_user_is_platform_owner()`, sem checar empresa — o corte pra
   empresa específica quando o master troca de contexto é responsabilidade
   da aplicação em toda tabela existente, não só nas novas). Visibilidade
   por papel/equipe (admin/manager veem tudo; supervisor vê a equipe que
   supervisiona; consultor vê o que é seu + a fila da própria equipe)
   centralizada em `user_can_access_conversation()`, reaproveitando
   `teams`/`team_memberships` de 0001/0002/0003. Triggers estruturais:
   autor de mensagem tem que ser da mesma empresa (NS010), `company_id` da
   mensagem tem que bater com o da conversa (NS012), nota interna nunca
   pode virar job de envio (NS014).
2. `supabase/migrations/0005_atendimento_worker_rpc.sql` — RPC
   `claim_outbound_jobs()` pro worker reivindicar jobs sem dois processos
   pegarem o mesmo (PostgREST não expõe `FOR UPDATE SKIP LOCKED`
   diretamente).
3. `src/lib/atendimento/` — interface de provedor + adaptador simulado
   (não fala com WhatsApp nenhum) + seleção explícita por
   `ATENDIMENTO_PROVEDOR` (nunca cai num fallback silencioso).
4. `src/app/api/atendimento/webhook-teste/[channelId]/route.ts` —
   ingestão de teste, segredo obrigatório
   (`ATENDIMENTO_WEBHOOK_TESTE_SECRET`), dedup real via
   `inbound_events`, cria/reaproveita contato e conversa.
5. `src/app/(newsec)/atendimento/actions.ts` — enviar (idempotency_key do
   cliente), nota interna, assumir (claim atômico), transferir (RLS
   decide quem pode), concluir/reabrir, reenviar mensagem com falha.
6. `scripts/atendimento-worker/worker.mjs` — poll contínuo, backoff
   exponencial (até 60s), falha definitiva ao esgotar tentativas.
7. `/atendimento` trocado de demonstração pra real — Server Component
   resolve o usuário via `getCurrentUserContext()`, workspace novo
   (`atendimento-workspace-real.tsx`) consulta o banco de verdade via
   client Supabase do navegador (RLS aplica sozinha). `DemoBanner` virou
   client component que se esconde só em `/atendimento` — as outras rotas
   do shell novo continuam demonstração.

**Testes executados e resultados (separando o que foi testado com
Postgres real do que só foi verificado por tipo/build):**

- **Schema + RLS + triggers (0004)**: Postgres 17 real (não mock),
  15/15 casos passando — isolamento entre empresas, visibilidade por
  papel/equipe, transferência indevida bloqueada (0 linhas afetadas) vs.
  autorizada (1 linha), as 3 SQLSTATEs de integridade, idempotência de
  envio e de replay de webhook (unique_violation nas duas), duas
  tentativas concorrentes de "assumir" a mesma conversa (claim atômico).
- **RPC do worker (0005)**: verificado sob concorrência real (não só
  lendo o SQL) — sessão A segura 2 jobs por 4s numa transação aberta,
  sessão B concorrente voltou em 132ms com só o job restante, sem
  overlap. Script reexecutável em
  `supabase/tests/testar-concorrencia-outbound-jobs.sh`.
- **Aplicação (provedor, webhook, actions, UI)**: `npm run typecheck` /
  `lint` / `test` (vitest, 16 testes) / `build` — limpos. **Isso é
  verificação de tipo/sintaxe, não teste funcional contra banco real** —
  ainda não dava pra ir além porque 0004/0005 não estão aplicadas em
  nenhum Supabase alcançável (nem homologação, nem um Supabase local —
  não tem Docker neste ambiente pra subir a stack completa com
  PostgREST).
- **Degradação sem crash (verificado de verdade, navegador real e
  homologação real)**: subi `npm run dev` local apontando pro Supabase de
  homologação de verdade, logei via Playwright com o usuário master de
  teste (reaproveitado da Entrega B) e abri `/atendimento` — a página
  carrega sem quebrar e mostra "Não foi possível carregar as conversas:
  Could not find the table 'public.conversations' in the schema cache"
  (esperado, honesto, sem cair pra dado fictício). Testei também o
  webhook via `curl`: sem o segredo configurado recusa com 503; com o
  segredo certo mas sem a tabela `channels`, responde 404 "Canal não
  encontrado" — nenhum dos dois caminhos derruba o processo.
- **Deploy em produção (Vercel) conferido depois do push**: `/atendimento`
  sem sessão agora responde 307 pro `/login` (antes era 200 aberto, era
  demonstração) — confirmado com `curl -I` direto na URL pública. `/`,
  `/login`, `/dashboards` continuam respondendo normal — sem regressão
  nas rotas que não mudaram.

**O que é dado real de homologação versus simulado:** tudo que já existia
(empresas, usuários, `teams`) é real, no banco de homologação de verdade.
O adaptador de WhatsApp é 100% simulado (não fala com nenhum número real,
nenhuma API de provedor real) — é o que a especificação pede
explicitamente pra essa fatia. Nenhuma mensagem real foi enviada, nenhum
dos dois números de WhatsApp em produção foi tocado ou tem qualquer
conexão com este código.

**Pendências e bloqueios externos (reais, não retórica):**

- **Bloqueio real nº 1**: `0001` a `0005` não aplicadas em homologação —
  mesma situação de sempre, precisa do Gabriel colar no SQL Editor (não
  precisa de nenhum segredo pra isso) ou me dar `SENHA_BANCO` pra eu
  automatizar. **Sem isso, o teste de aceite completo (2 empresas,
  supervisor + consultor, webhook → worker → UI, replay) não pode rodar
  de verdade** — é o próximo passo mais valioso disponível.
- Depois de aplicado: rodar o worker (`npm run atendimento:worker`) e o
  cenário de aceite completo, com evidência real (não só o que já foi
  verificado aqui).
- Ordem definida pra depois da fatia funcional (seção 5 do prompt de
  continuidade): cadastro/análise/pré-venda reais no drawer, IA com
  credencial por empresa, importador Totalk conectado aos registros
  novos, adaptador de WhatsApp de teste real, dashboards com dado real,
  Focus portado, personalização de dashboards, responsividade — nenhuma
  dessas foi iniciada nesta sessão, de propósito (a especificação pede
  não gastar o ciclo em mais telas demonstrativas antes do chat
  funcionar).
- `/atendimento/supervisao` continua demonstração — não foi trocado por
  dado real nesta entrega (escopo já grande o suficiente; fica pro
  próximo incremento depois do teste de aceite).

**Decisões tomadas e justificativa:**

- Fila em tabela Postgres em vez de Redis/BullMQ — ver seção de
  infraestrutura acima.
- RLS das tabelas novas replicando exatamente o padrão do resto do CRM
  (duas policies, sem GUC de sessão nova) — evita fragmentar o modelo de
  segurança do banco; documentado em detalhe no cabeçalho de
  `0004_atendimento_chat.sql`.
- Lógica do provedor simulado duplicada em `worker.mjs` (não importada de
  `src/lib/atendimento/`) — `scripts/` é Node puro sem os imports de alias
  que só o Next.js resolve; nota deixada no próprio arquivo pra quando
  isso deixar de fazer sentido (provedor real, worker vira TypeScript de
  verdade).
- Não tentei nenhum workaround pra testar contra banco real sem Docker
  nem homologação aplicada (ex: mockar PostgREST) — preferi deixar
  explícito o que foi verificado com Postgres real (schema/RLS/RPC, com
  bastante rigor) versus o que só foi verificado por tipo/build
  (aplicação), em vez de fingir uma cobertura que não existe.

**Próximo passo executável:** com o Gabriel — aplicar `0001` a `0005` em
homologação (SQL Editor, sem segredo nenhum, ou `SENHA_BANCO` pra eu
automatizar). Assim que isso acontecer, o próximo trabalho é rodar o
cenário de aceite completo (2 empresas, supervisor + consultor, 2 canais
simulados) com o worker de verdade ligado, e registrar a evidência real
disso no checkpoint seguinte.

---

## Checkpoint 2026-09-24 — Entrega C fechada: teste de aceite completo, 19/19

**Fase e tarefa atual:** a fatia funcional da Entrega C está fechada de
verdade — não só schema testado isoladamente, mas o cenário de aceite
inteiro (webhook → banco → worker → UI → transferência → isolamento →
replay → resiliência) rodando contra homologação real, com o app real
(`next dev` local apontando pro Supabase de homologação) e o worker real.

**Branch e commits:** `main`, `cdc63fd` (fix + teste) até este checkpoint,
a partir de `8c1783a`.

**O que aconteceu:** o Gabriel aplicou `0001`-`0005` em homologação (SQL
Editor). Rodei o cenário de aceite completo pela primeira vez contra banco
de verdade — achou **2 bugs reais** que nenhum teste isolado anterior
pegaria:

1. **RLS de `outbound_jobs` bloqueava o próprio consultor de enfileirar o
   envio da mensagem que ele mesmo estava mandando** — a policy só liberava
   INSERT pra admin/manager/platform-owner, tratando a tabela como "só
   webhook/worker mexem aqui", mas `enviarMensagemAction` roda com a sessão
   do usuário real, não `service_role`. Sintoma: mensagem gravada, nunca
   enviada, presa em "pendente" pra sempre — silencioso, sem erro visível
   pro usuário além do estado que nunca mudava. Corrigido em
   `0006_atendimento_outbound_jobs_policy.sql`: INSERT/SELECT liberados pra
   quem tem acesso à conversa (`user_can_access_conversation`); UPDATE/
   DELETE continuam só admin/manager/platform-owner (o worker usa
   `service_role`, que ignora RLS de qualquer forma).
2. **Conversa nova do webhook nascia sem `team_id`** — nem o membro da
   equipe nem o supervisor viam a fila, só admin/manager. Corrigido: o
   webhook busca a equipe padrão da empresa pra área (comercial/jurídico)
   do canal e atribui na criação.

O Gabriel aplicou `0006` em homologação (mesmo processo, SQL Editor). Depois
disso, mais duas rodadas do teste completo esbarraram num problema
**de ambiente, não de código**: o `next dev` local, depois de muitas horas
ligado com bastante hot-reload, teve o cache `.next` corrompido
("Cannot find module './1331.js'", erro clássico do Next em dev no
Windows depois de sessão longa — mesma família do que já está registrado
mais acima neste arquivo sobre cache/disco). `rm -rf .next` + reiniciar o
servidor resolveu na hora.

**Resultado final: 19/19 etapas do cenário de aceite completo, exit code 0**
(`scripts/testes-homologacao/verificar-fluxo-chat-completo.mjs`, reexecutável):

- Setup real: 2 empresas, 1 supervisora + 2 consultores numa equipe, 1
  consultor numa empresa separada, 1 canal simulado.
- Webhook cria contato + conversa real (sem `team_id` nulo — roteada pra
  equipe certa).
- Consultor da equipe vê a conversa na fila ("Equipe"), assume — atribuição
  confirmada no banco.
- Nota interna gravada; confirmado que **não** gera `outbound_jobs` (nem
  antes nem depois de 0006 — trigger estrutural de 0004 nunca foi o
  problema, só a policy de quem *pode* criar um job legítimo).
- Mensagem real enviada pela UI → gravada → worker (processo separado)
  processa → status final "enviada" confirmado no banco e refletido na UI
  após reload.
- Supervisora vê a conversa mesmo atribuída a outro consultor, transfere
  pra uma terceira pessoa — histórico de transferência com 2 registros.
- Consultora que recebeu a transferência vê a atualização (outro usuário,
  outra sessão).
- Consultor de empresa diferente: não vê a conversa (isolamento) e tem
  tentativa de auto-atribuição bloqueada (0 linhas afetadas via RLS, sem
  erro alto — silenciosamente inofensivo).
- Replay do mesmo evento de webhook: detectado como duplicado, não criou
  segunda mensagem de entrada.
- Job criado por este processo foi processado por um worker rodando num
  **processo separado** (prova de que o estado vive no Postgres, não em
  memória de nenhum processo específico — sobrevive a reinício).

**Comandos executados:** `npm run typecheck` / `lint` / `build` limpos após
cada mudança. Suite `0006_atendimento_outbound_jobs_policy.test.sql` (3/3,
Postgres real) provando a correção sem reabrir buraco de nota interna nem
liberar empresa alheia. Regressão conferida: suite de `0004` (15/15)
continua passando depois de `0006`.

**Integrações reais versus simuladas:** tudo real agora (empresas, canais,
conversas, mensagens, worker rodando de verdade em homologação) — só o
adaptador WhatsApp continua simulado, como sempre foi o objetivo desta
fatia. Empresas/usuários de teste (`Empresa Chat Aceite A/B`,
`ana.supervisora.aceite` etc.) ficam no banco pra reuso em próximas
rodadas — só conversas/canais/contatos são limpos entre execuções.

**Pendências e bloqueios externos:** nenhum bloqueio real restante nesta
fatia. O que segue é o roadmap pós-fatia-funcional (seção 5 do prompt de
continuidade): cadastro/análise/pré-venda reais no drawer, IA, importador
Totalk conectado, WhatsApp de teste real, dashboards reais, Focus, etc. —
nenhum desses foi iniciado, de propósito.

**Decisões tomadas e justificativa:**

- Corrigi os dois bugs achados no teste de aceite em vez de contornar o
  teste pra "passar" — o objetivo era validar o pipeline de verdade, não
  produzir um relatório verde artificialmente.
- Guardei o `.env.local` do problema de cache `.next` como lição registrada
  (mesma família do problema de espaço em disco já documentado) — vale
  lembrar de limpar `.next` se `next dev` ficar rodando muitas horas com
  bastante hot-reload antes de confiar num erro estranho como bug de
  código.

**Próximo passo executável:** com o Gabriel — decidir a próxima prioridade
entre: (a) ações reais do CRM no atendimento (cadastro/análise/pré-venda,
depende desta fatia, que agora está pronta); (b) IA com credencial por
empresa; (c) adaptador de WhatsApp de teste real quando houver acesso; (d)
Totalk conectado aos registros novos do chat; (e) itens da Entrega F
(dashboards reais, Focus, Academia) que não dependem de nada disso.

---

## Checkpoint 2026-09-24 — Prioridade 0 fechada (confiabilidade do chat) + Totalk grava em homologação

**Fase e tarefa atual:** ciclo de revisão externa pós-Entrega C, estruturado
em 3 prioridades. Prioridade 0 (confiabilidade) e o núcleo da Prioridade 1
(importador Totalk até homologação) fechados neste ciclo. Prioridade 2
(runbook de promoção pra produção) não iniciada.

**Branch e commits:** `main`, `48c8a33` (início do ciclo) → `4081629` (fix
confiabilidade) → `e0749ea` (fix resolução de arquivo do Totalk) →
`17ca635` (feat: `conversations.external_id`) → `c684cbf` (feat: importador
grava em homologação).

**Prioridade 0 — 4 lacunas reais corrigidas** (não hipotéticas — cada uma
com caminho de reprodução):

1. `enviarMensagemAction` fazia 2 INSERTs separados (mensagem, depois job)
   — se o segundo falhasse, mensagem ficava presa em "pendente" pra sempre.
   Corrigido: `enviar_mensagem_com_job()` (RPC, uma transação só,
   `0007_atendimento_confiabilidade.sql`).
2. Reenviar mensagem com falha criava um SEGUNDO job pro mesmo
   `message_id` — batia em `outbound_jobs_message_unique` (bug real, não
   hipótese). Corrigido: `reenviar_mensagem_falhada()` reseta o job
   existente via UPDATE.
3. `claim_outbound_jobs()` não recuperava job travado em "processando" se o
   worker morresse no meio. Corrigido: lease de 2min, job com lease vencida
   volta a ser reivindicável.
4. Worker usava o simulador direto sem checar se o canal era mesmo
   simulado — um canal real ligado por engano ao simulador fabricaria um
   "enviada" falso. Corrigido: fail-closed real em `worker.mjs`, verificado
   contra homologação (canal com `provider` real foi recusado sem nunca
   chamar o simulador).

**Testes:** 37/37 SQL locais (Postgres 17 descartável, 0001-0007 do zero,
9+3+15+3+7 por suite) + `verificar-worker-fail-closed.mjs` contra
homologação real + **19/19** no teste de aceite completo
(`verificar-fluxo-chat-completo.mjs`) — que também ganhou correção de um
bug real nele mesmo (3 checagens de visibilidade sem esperar o React
re-renderizar, e processo que ficava pendurado pra sempre se uma etapa
lançasse exceção com o browser do Playwright ainda aberto).

**Prioridade 1 — importador do Totalk, núcleo pronto e verificado:**

- Duas suposições da API resolvidas contra a documentação oficial
  (flwchat.readme.io), não por hipótese: `GET /v2/file/{id}` não existe —
  `GET`/`POST /v2/file` são o fluxo de upload, não consulta. O arquivo de
  uma mensagem já vem embutido nela mesma (`details.file`/`details.files`,
  com `publicUrl`/`publicUrlDownload` prontos) — zero chamada extra
  necessária. `resolverArquivo()` (que chamava um endpoint inexistente,
  sempre falharia com 404 em modo real) foi removida.
- `conversations` ganhou `external_id` (migração `0008`, aditiva, única por
  canal) — sem isso, perder o checkpoint local faria uma reimportação criar
  sessão duplicada.
- `importar.mjs` ganhou `--destino=homologacao` (com `--empresa-id`/
  `--canal-id` explícitos, nunca escolhidos sozinho) e `--dry-run`. Grava
  contato (por telefone)/conversa (por `external_id`)/mensagem (por
  `external_id`) idempotentemente, verificado por consulta ao PRÓPRIO
  BANCO — não só pelo checkpoint local, que pode ser perdido sem duplicar
  nada. Mensagem histórica é INSERT direto, nunca passa por
  `enviar_mensagem_com_job()` nem cria `outbound_jobs`.
- **Verificado contra homologação de verdade**, não só em teoria: empresa
  real "GRS Soluções" (destino informado pelo Gabriel) criada em
  homologação com canal Totalk dedicado. 4 rodadas (2 quebradas de
  propósito no meio do processamento de uma sessão pra testar recuperação
  de queda real, 1 completa, 1 com checkpoint local inteiramente apagado)
  — resultado final sempre 3 contatos/3 conversas/13 mensagens, sem
  duplicata nenhuma, `outbound_jobs` sempre 0 linhas.
- **2 bugs reais encontrados rodando de verdade** (só apareceram contra o
  banco real, não em fixture): responsável mapeado em
  `mapeamento-agentes.json` pra um `user_profiles.id` que não existe no
  ambiente de destino derrubava a criação da conversa inteira (violação de
  FK) — corrigido pra cair sem responsável e ficar registrado no relatório,
  em vez de travar a sessão inteira. Nota interna gravava
  `author_type: "consultor"`, valor que `messages_author_type_check` nem
  aceita — corrigido pra `"humano"` (mesma convenção do sistema ao vivo).

**Integrações reais versus simuladas:** tudo real (chat: empresas, canais,
conversas, mensagens, worker; Totalk: leitura via fixtures — token real
ainda não configurado, decisão do Gabriel — mas a ESCRITA em homologação já
é real). Nenhuma chamada real foi feita ao Totalk; nenhum WhatsApp real foi
conectado.

**Pendências e bloqueios externos:**

- Token de API do Totalk — decisão/acesso do Gabriel, pra confirmar a
  suposição de `direction: FROM_HUB`/`TO_HUB` (a única suposição real ainda
  aberta; resolução de arquivo já não depende mais disso) e sair do modo
  fixture de leitura.
- `mapeamento-agentes.json` de verdade (hoje só tem um exemplo fictício)
  antes de qualquer importação real.
- Prioridade 2 (runbook de promoção pra produção) não iniciada — nenhuma
  decisão de produção foi tomada ou inferida neste ciclo.

**Próximo passo executável:** com o Gabriel — token real do Totalk (se/
quando decidir), preencher `mapeamento-agentes.json` de verdade, ou seguir
pra Prioridade 2 (runbook de promoção pra produção, sem executar nada nela
sem autorização específica por operação).
