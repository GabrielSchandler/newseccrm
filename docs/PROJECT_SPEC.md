# NewSec — resumo do escopo

Este arquivo é um resumo de navegação. A especificação completa e vinculante
está em `../NEWSEC-ESPECIFICACAO-E-PROMPT-CLAUDE.md` — leia ela por inteiro
antes de decisões de arquitetura; este resumo não a substitui.

## O que é

Unificação de três sistemas em um produto multiempresa só, com o atendimento
(WhatsApp) como espaço principal do consultor e o CRM em segundo plano:

- **Base**: GRSCRM (`https://github.com/GabrielSchandler/GRSCRM`) — CRM em
  produção da GRS Soluções (revisional de juros/direito financeiro). Banco de
  produção e identificadores são preservados. Next 15 / React 19 / Tailwind 4
  / Supabase.
- **Atendimento**: newsecchat (`https://github.com/GabrielSchandler/newsecchat`)
  — WhatsApp via Evolution API (conector não oficial), worker BullMQ/Redis,
  IA de contexto/transcrição. Só dados de teste, sem migração de dados.
- **Produtividade**: newsecfocus (`https://github.com/GabrielSchandler/newsecfocus`)
  — agente Windows .NET 8 + dashboard Next + Supabase. Só dados de teste, sem
  migração de dados.

## Por que agora

O Totalk (atendimento atual) cobra de novo em 07/10 — confirmar ano exato no
runbook antes de qualquer decisão de data. O objetivo operacional prioritário
é substituí-lo com segurança antes dessa cobrança, sem perder histórico,
arquivos nem fluxo de trabalho da equipe (5 consultores, 2 números WhatsApp
atendendo comercial e jurídico).

## Ordem de implementação

Fase 0 (inventário) → Fase 1 (shell/tema/navegação + fundação de permissões)
→ Fase 2 (chat humano integrado) → Fase 3 (CRM dentro do atendimento + IA
essencial) → Fase 4 (migração/piloto/corte Totalk) → Fase 5 (Focus completo +
dashboards) → Fase 6 (produto SaaS ampliado). Detalhe de cada fase e critério
de aceite: seção 17 da especificação completa. O checklist de go/no-go para
desligar o Totalk está na seção 18 — nenhum item marcado como pronto sem
teste real.

## Onde estão as coisas

- Especificação completa: `../NEWSEC-ESPECIFICACAO-E-PROMPT-CLAUDE.md`
- Roteiro de como iniciar/continuar com Claude Code e Codex:
  `../COMECE-AQUI-CLAUDE-CODE.md`
- Checkpoint de progresso real: `PROGRESS.md`
- Lista de tarefas por fase: `TASKS.md`
- Inventário factual dos três sistemas de origem: `SOURCE_INVENTORY.md`
- Mapa de permissões/papéis: `PERMISSIONS.md`
- Mapa de paridade de funcionalidades: `FEATURE_PARITY.md`
- Catálogo de métricas/indicadores: `METRICS_CATALOG.md`
- Referências visuais (mockups do ChatGPT, com limitações documentadas):
  `reference-images/`
