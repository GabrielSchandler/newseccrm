# NewSec — tarefas por fase

Formato: `[x]` feito e verificado, `[~]` em andamento, `[ ]` não iniciado.
Ver critério de aceite de cada fase na especificação, seção 17.

## Fase 0 — Inventário e baseline

- [x] Registrar SHAs dos três repositórios de origem (ver `PROGRESS.md`).
- [x] Confirmar stack real do CRM via `package.json` (Next 15.5.24, React
      19.1, Tailwind 4.3.3, Supabase SSR, React Hook Form, Zod, Vitest).
- [x] Clonar GRSCRM como base local `newseccrm`, preservando histórico Git;
      remote `origin` repontado para `github.com/GabrielSchandler/newseccrm`
      (ainda sem push), `grscrm-upstream` mantido como referência ao CRM
      original.
- [x] Salvar especificação e roteiro de início na raiz do projeto.
- [x] Salvar as 11 imagens de referência recebidas em `docs/reference-images/`,
      com nota sobre marca/nav inconsistentes e telas 07/08 sem referência
      visual (ver `../COMECE-AQUI-CLAUDE-CODE.md`).
- [~] Inventário factual profundo do CRM (papéis/permissões, schema de
      cliente, análise sem cliente vs pré-venda com cliente, integração
      Totalk, Academia, mapa de rotas) — agente de exploração em execução,
      resultado ainda não incorporado a `SOURCE_INVENTORY.md`.
- [~] Inventário factual profundo do newsecchat (máquina de estados,
      contexto por IA, credencial OpenAI, envio/webhook, transcrição) —
      agente de exploração em execução.
- [~] Inventário factual profundo do newsecfocus (agregação, liderança
      multi-equipe, ingestão, limites de coleta, catálogo de indicadores) —
      agente de exploração em execução.
- [ ] Consolidar os três inventários em `SOURCE_INVENTORY.md`.
- [ ] Mapa de permissões (`PERMISSIONS.md`): equivalência entre
      `admin`/`manager`/`seller` do CRM atual e o modelo alvo
      Master/Gerente/Supervisor/Consultor.
- [ ] Mapa de paridade (`FEATURE_PARITY.md`): toda função hoje existente nos
      três sistemas, com origem e destino proposto.
- [ ] Catálogo inicial de métricas (`METRICS_CATALOG.md`).
- [ ] Documento de arquitetura (`ARCHITECTURE.md`) com riscos concretos.

## Fase 1 — Base unificada e sistema visual

- [ ] Tokens de tema claro/escuro (CSS custom properties), sem flash de tema,
      persistência por usuário.
- [ ] Shell/navegação: menu lateral canônico (baseado nas imagens 02/05/06/09/10
      — família NewSec sidebar escura, ver `reference-images/`), preservando
      todas as rotas existentes do CRM.
- [ ] Tela de atendimento navegável (`/atendimento`) com dados sintéticos em
      modo demo explícito: lista de conversas, conversa, painel de contexto.
- [ ] Drawer de ações (pré-venda/cadastro/análise) com estados de
      loading/vazio/erro reais, sem simular backend concluído.
- [ ] Fundação de identidade/empresa/permissão: modelo de vínculos
      usuário↔empresa↔equipe, migrações aditivas em homologação (ou SQL
      preparado + execução pendente registrada se não houver ambiente).
- [ ] Build, typecheck e lint passando; regressões relevantes do CRM
      verificadas.
- [ ] Atualizar `PROGRESS.md` com checkpoint completo ao final da fase.

## Fases 2–6

Não iniciar automaticamente. Detalhar cada uma em `TASKS.md` só quando a
fase anterior estiver com critério de aceite cumprido e Gabriel autorizar a
próxima entrega concreta (ver `../COMECE-AQUI-CLAUDE-CODE.md`, "Prompt de
continuidade").
