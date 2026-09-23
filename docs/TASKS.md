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
- [x] Inventário factual profundo do CRM (papéis/permissões, schema de
      cliente, análise sem cliente vs pré-venda com cliente, integração
      Totalk, Academia, mapa de rotas) — em `SOURCE_INVENTORY.md` §1.
- [x] Inventário factual profundo do newsecchat (máquina de estados,
      contexto por IA, credencial OpenAI, envio/webhook, transcrição) —
      em `SOURCE_INVENTORY.md` §2.
- [x] Inventário factual profundo do newsecfocus (agregação, liderança
      multi-equipe, ingestão, limites de coleta, catálogo de indicadores) —
      em `SOURCE_INVENTORY.md` §3.
- [x] Consolidar os três inventários em `SOURCE_INVENTORY.md`.
- [x] Mapa de permissões (`PERMISSIONS.md`): equivalência entre o modelo
      atual de cada sistema (CRM: role/business_area/legal_role, 1:1
      empresa; Chat: papel SUPERVISOR + departamentos; Focus:
      OWNER/MANAGER/TEAM_LEAD/VIEWER, 1:1 equipe) e o modelo alvo
      Master/Gerente/Supervisor/Consultor com vínculos N:N.
- [x] Mapa de paridade (`FEATURE_PARITY.md`): funções dos três sistemas com
      origem, status (Base/Portar/Redesenhar/Novo) e observação — Comercial/
      Jurídico/Financeiro do CRM ficaram só no nível de diretório, a
      aprofundar ao tocar cada área.
- [x] Catálogo inicial de métricas (`METRICS_CATALOG.md`) — Atendimento,
      Equipe, Comercial, Financeiro, IA e Produtividade (Focus, integral).
      Nenhuma métrica implementada ainda, é a definição formal pra
      implementar depois sem ambiguidade de fórmula/fonte/coorte.
- [x] Documento de arquitetura (`ARCHITECTURE.md`) com riscos concretos e
      diagrama.
- [x] Baseline do CRM clonado: `npm install` e `npm run typecheck` executados
      com sucesso (exit 0). `npm run build` em execução — ver `PROGRESS.md`
      para o resultado.

## Fase 1 — Base unificada e sistema visual

- [x] Tokens de tema claro/escuro (CSS custom properties escopadas em
      `.ns-shell`, `src/app/globals.css`), sem flash de tema (script inline
      em `ThemeScript`, resolve tema salvo ou preferência do sistema antes
      da primeira pintura), persistência por usuário via `localStorage`
      (`newsec-theme`). `@custom-variant dark` redefinido para seguir
      `data-theme`, não `prefers-color-scheme` puro.
- [x] Shell/navegação: menu lateral (`NewSecSidebarNav`) com os 9 itens da
      especificação seção 8.2, reorganizado num route group `(newsec)`
      reaproveitável (`src/app/(newsec)/layout.tsx`) em vez de duplicado por
      rota. Atendimento/Dashboards/Produtividade abrem o shell novo;
      Clientes/Comercial/Jurídico/Financeiro/Academia linkam pras rotas reais
      já existentes do CRM (fora do shell novo); só Configurações continua
      desabilitado ("ainda não implementado"). Nenhuma rota existente do CRM
      foi tocada.
- [x] Tela de Supervisão (`/atendimento/supervisao`, sub-rota de Atendimento
      conforme especificação Anexo A.5): fila operacional com estado/canal/
      setor/espera, carga dos 5 consultores (disponibilidade + capacidade,
      não só quantidade bruta), dialog de transferência, painel "Atenção
      necessária". Link cruzado com Atendimento nos dois sentidos.
- [x] Tela de Dashboards/Gestão (`/dashboards`): cards de vendas/recebido/
      pré-vendas/SLA, gráfico de vendas por semana, funil comercial,
      desempenho por equipe, insights.
- [x] Tela de Produtividade (`/produtividade`): cards de jornada, barra de
      distribuição (produtivo/neutro/improdutivo/ocioso/sem dados),
      aplicativos e sites, tabela de pessoas da equipe — aviso de "dados
      ilustrativos" explícito, como a especificação pede.
- [x] Tela de atendimento navegável (`/atendimento`, fora do grupo
      `(authenticated)` — não depende de sessão Supabase) com dados
      sintéticos em `src/lib/demo/atendimento-data.ts`, claramente
      identificados (`DemoBanner` fixo no topo): lista de conversas
      (abas Meus/Equipe/IA, busca, badges de estado), conversa (mensagens,
      documento, nota interna diferenciada, composer com aviso de
      demonstração ao "enviar"), painel de contexto (resumo, telefones,
      pré-venda/pós-venda/vendas, faltantes, ações rápidas).
- [x] Drawer de "Criar pré-venda" com as seções e campos **reais** do CRM
      (Contratante, Titular da dívida, Dados financeiros, Contratação e
      negociação, Dados jurídicos, Pagamentos previstos — espelhando
      `src/components/pre-sales/pre-sales-form.tsx` e a obrigatoriedade real
      de `src/lib/pre-sales/schema.ts`), com marcação de obrigatório e de
      campo sugerido pela IA, e estado de erro recuperável explícito ao
      "salvar" (Fase 1 é só demonstração visual — gravação real é Fase 3).
      Ação "Criar pré-venda" fica desabilitada com explicação quando o
      contato não tem cliente cadastrado.
- [x] Verificado em navegador de verdade (Playwright headless, não só
      build): shell claro e escuro, troca de conversa, abertura/fechamento
      do drawer nos dois temas, zero erros de console. Um bug real de
      hidratação foi encontrado e corrigido nesse processo (faltava
      `suppressHydrationWarning` no wrapper que o script de tema manipula
      via DOM) — ver `PROGRESS.md`.
- [x] Fundação de identidade/empresa/permissão: `supabase/migrations/0001_equipes.sql`
      cria `teams`/`team_memberships` (N:N usuário↔equipe, com RLS
      reaproveitando as funções `current_user_*` já existentes) — resolve a
      metade "supervisor em várias equipes". **Retificado 23/09**: o item
      "falta usuário↔empresa N:N" ficou obsoleto no mesmo dia —
      `PERMISSIONS.md` §2.0 (não §2.1, que é a proposta descartada) confirmou
      que gerente/supervisor/consultor ficam 1:1 com a empresa de propósito,
      sem vínculo N:N nenhum. A Entrega B (ver abaixo) fechou isso testando
      o fluxo de master já existente, não criando `company_memberships`.
      **Ainda pendente, isso sim real**: confirmado em 23/09 que `0001`/
      `0002` nunca foram de fato aplicadas no banco de homologação (SQL
      pronto e versionado, mas as tabelas não existem lá) — aplicar antes
      de qualquer tela consumir `teams`/`team_memberships`.
- [x] Build, typecheck e lint passando; regressões relevantes do CRM
      verificadas (61→62 rotas, nenhuma existente alterada).
- [x] Atualizar `PROGRESS.md` com checkpoint completo ao final da fase.

## Entrega A — correções da revisão externa (23/09/2026)

Ver `NEWSEC-CORRECOES-E-CONTINUACAO-CLAUDE.md` na raiz e checkpoint
`docs/PROGRESS.md` "Entrega A" pra evidência completa.

- [x] Integridade equipe/empresa: trigger estrutural em
      `supabase/migrations/0002_equipes_integridade_empresa.sql`, testado
      com 9/9 casos passando num Postgres real (não mock) — suíte
      reexecutável em `supabase/tests/`.
- [x] Rascunho por conversa não some mais ao trocar (A→B→A), testado com
      Playwright.
- [x] Script de homologação verifica exit code de verdade, gera saída
      única por execução, confirma origem≠destino antes de aplicar.
- [x] Colisão de prefixo `/dashboard` vs `/dashboards` corrigida
      (`matchesPathPrefix`), testada isoladamente.
- [x] Linguagem interna (Fase 1/Fase 3, caminho de arquivo) removida da UI
      do drawer de pré-venda.
- [x] Decisão documentada de manter rotas do shell novo em `/atendimento`
      em vez de mover pra `/demo/...`.
- [ ] Responsividade nos breakpoints pedidos (1920/1366/1280/768/390) —
      não testada nesta entrega, sem bloquear o resto.

## Fidelidade visual — revisão contra imagens de referência (pedido 23/09)

Não é entrega do roadmap B–F, é polish sobre a Fase 1 já entregue. Ver
checkpoint `docs/PROGRESS.md` "fidelidade visual: editor de dashboards +
dashboards" pra evidência completa.

- [x] Tela de Editor de dashboards (`/dashboards/personalizar`, Tela 09) —
      construída do zero, não existia antes.
- [x] `/dashboards` revisado contra `05-gestao-newsec-sidebar-escuro-canonico.png`
      (título, filtros, eixo R$, funil trapezoidal, botões de insight).
- [x] `/produtividade` revisado contra `06-produtividade-newsec-sidebar-escuro-canonico.png`.
- [x] `/atendimento/supervisao` revisado contra `04-supervisao-atendoai-offbrand.png` (imagem
      fora de marca — conteúdo/layout usados como fonte, marca AtendoAI ignorada).
- [x] `/atendimento` revisado contra `01-atendimento-claro-newsec-com-drawer-prevenda.png`
      e `02-atendimento-escuro-newsec-sidebar-canonico.png`.

## Entregas B–F — backlog ordenado, não iniciado

Detalhar cada uma quando for começar de verdade, não com antecedência —
documento fonte é `NEWSEC-CORRECOES-E-CONTINUACAO-CLAUDE.md` seções 7–13.

- **B — Fundação multiempresa (escopo corrigido em 23/09, ver
  `PERMISSIONS.md` §2.0)** — **concluída em 23/09/2026**: o fluxo de master
  já existente foi testado ponta a ponta de verdade (Playwright contra
  `newseccrm.vercel.app`, ver `scripts/testes-homologacao/`), 8/8 etapas em
  duas rodadas seguidas: login do master → criar empresa → configurar
  módulos/limite e persistir → criar usuário na empresa → suspender a
  empresa e persistir → usuário da empresa suspensa é bloqueado → master
  nunca é bloqueado. Gabriel liberou `SUPABASE_SERVICE_ROLE_KEY` no
  `.env.local` local pra viabilizar (ver histórico do incidente de segredo
  colado no chat em `../CLAUDE.md`, repetido em 23/09).
  **Bug real encontrado e corrigido nesse processo**: suspender uma empresa
  não tirava o acesso de ninguém — `company_platform_settings.status` só
  era lido pra exibir o badge no painel do master, nunca checado em
  `current-user.ts`/`middleware.ts`. Corrigido em `current-user.ts`
  (redirect pra `/empresa-suspensa`, página nova, pro usuário não-master de
  uma empresa suspensa/cancelada) — o master nunca é bloqueado por isso.
- **C — Chat humano real**: **retificado 23/09** — só a escolha de
  hospedagem paga/Redis pago/número real de WhatsApp depende do Gabriel.
  Worker/fila local e adaptador de WhatsApp simulado não dependem de
  decisão nenhuma — ver checkpoint "Entrega C" em `PROGRESS.md` para a
  fatia funcional entregue nesse modelo.
- **D — Ações do CRM no atendimento**: depende de B e C.
- **E — Importador Totalk**: **dry-run entregue em 23/09**
  (`scripts/totalk-importer/`) — cliente da API real (consultada em
  https://flwchat.readme.io/), fixtures representativas, checkpoint/resume,
  retry com backoff, relatório de reconciliação. Testado (duas importações
  seguidas não duplicam, retomada após queda simulada não reprocessa sessão
  concluída, mídia indisponível e agente sem mapeamento ficam explícitos no
  relatório). Falta só o token real do Totalk (decisão do Gabriel) pra sair
  do modo fixture — ver `scripts/totalk-importer/README.md`.
- **F — Focus completo, dashboards reais, Academia ampliada**: último da
  fila, não atrasar B/C/D por isso.
