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

**Pendências externas reais:**

- Resultado dos três agentes de inventário (GRSCRM, newsecchat, newsecfocus)
  ainda não retornou.
- `npm install` / build / typecheck do newseccrm ainda não rodados nesta
  sessão.
- Nenhum ambiente Supabase de homologação confirmado — precisa decidir/achar
  antes de qualquer migração real (mesmo aditiva).
- Push do commit inicial para `github.com/GabrielSchandler/newseccrm` ainda
  não feito.
- Acesso à documentação/API do Totalk (`flwchat.readme.io`) ainda não
  revalidado nesta sessão.

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

**Próximo passo executável:** aguardar os três agentes de inventário,
consolidar os achados em `docs/SOURCE_INVENTORY.md`, `docs/PERMISSIONS.md` e
`docs/FEATURE_PARITY.md`, rodar `npm install` + `npm run build` + `npm run
typecheck` no newseccrm clonado para confirmar baseline antes de qualquer
edição de código, e então iniciar a Fase 1 (shell/tema/navegação/atendimento
demo) conforme `TASKS.md`.

**Cuidados de compatibilidade:** nenhuma edição de código de produto feita
ainda além de `package.json` (nome/URLs) e `README.md` (aviso no topo) — o
CRM clonado está, em comportamento, idêntico ao GRSCRM original.
