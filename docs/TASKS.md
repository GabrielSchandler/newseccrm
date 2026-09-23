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
- [~] Fundação de identidade/empresa/permissão: `supabase/migrations/0001_equipes.sql`
      cria `teams`/`team_memberships` (N:N usuário↔equipe, com RLS
      reaproveitando as funções `current_user_*` já existentes) — resolve a
      metade "supervisor em várias equipes". SQL pronto, execução no banco
      de homologação depende do Gabriel colar no SQL Editor (não aplicado
      por mim ainda). **Falta**: usuário↔empresa N:N, que exige mudar
      `current-user.ts`/`middleware.ts` (código crítico de auth) — decisão
      registrada em `PERMISSIONS.md` §2.1 de não fazer isso "de passagem".
- [x] Build, typecheck e lint passando; regressões relevantes do CRM
      verificadas (61→62 rotas, nenhuma existente alterada).
- [x] Atualizar `PROGRESS.md` com checkpoint completo ao final da fase.

## Fases 2–6

Não iniciar automaticamente. Detalhar cada uma em `TASKS.md` só quando a
fase anterior estiver com critério de aceite cumprido e Gabriel autorizar a
próxima entrega concreta (ver `../COMECE-AQUI-CLAUDE-CODE.md`, "Prompt de
continuidade").
