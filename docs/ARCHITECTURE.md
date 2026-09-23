# NewSec — arquitetura (rascunho vivo)

Consolidação dos riscos e decisões já levantados em `SOURCE_INVENTORY.md`,
`PERMISSIONS.md` e `FEATURE_PARITY.md`. Este documento reúne a visão geral;
o detalhe factual por trás de cada ponto fica nos outros três.

## Visão geral

```text
                         ┌─────────────────────────┐
                         │   Vercel (Next.js)      │
                         │  newseccrm (este repo)  │
                         └───────────┬─────────────┘
                                     │ HTTPS (supabase-js)
                                     ▼
                         ┌─────────────────────────┐
                         │   Supabase (Postgres)    │
                         │  Auth · DB · Storage ·   │
                         │  Realtime · Edge Funcs   │
                         └───────────┬─────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
             Worker (a criar)   Agente Windows    Conector WhatsApp
             BullMQ/Redis       (Focus, .NET 8)   (Evolution API)
             envio/IA/mídia     produtividade      atendimento
```

Hoje (Fase 1), só o quadro "Vercel + Supabase" existe de fato. Worker,
agente e conector WhatsApp são trabalho das Fases 2, 3 e 5.

## Ambientes

| Ambiente | Banco | Propósito |
| --- | --- | --- |
| Produção do CRM (GRSCRM) | Supabase original, com dados reais | Continua rodando sozinho, não tocado por este projeto até o corte planejado |
| Homologação (newseccrm) | Supabase novo, schema copiado via `scripts/homologacao/`, sem dados de cliente | Onde este projeto roda e é testado, incluindo o deploy na Vercel |
| Local | Homologação (mesmo banco) ou nenhum | `npm run dev`/`build`/`start` com `.env.local` apontando pro banco de homologação |

## Riscos identificados e decisão de arquitetura

1. **Sem multi-equipe hoje** (`PERMISSIONS.md` §1-3, retificado em §2.0) —
   Focus trava líder numa equipe só via RLS. Migração real de schema já
   entregue (`0001_equipes.sql`/`0002_equipes_integridade_empresa.sql`,
   pendente só de aplicação em homologação). Multi-**empresa** por usuário
   comum não é mais escopo — só o master acessa várias empresas, e isso já
   existe sem schema novo (`is_platform_owner`).
2. **Sobrescrita silenciosa de contexto por IA** (`SOURCE_INVENTORY.md`
   §2.3) — Chat sobrescreve campo confirmado manualmente sem checar
   origem. Vira o mecanismo `ProposedFact`/revisão explícita da
   especificação (Anexo A.4) na Fase 3, não portar como está.
3. **Credencial de IA global por processo** (`SOURCE_INVENTORY.md` §2.5) —
   fábrica de provedor de IA do Chat precisa ser reescrita para resolver
   por empresa/finalidade (especificação seção 6) antes de qualquer
   segunda empresa usar IA.
4. **Suspensão de coleta do Focus é decorativa** (`SOURCE_INVENTORY.md`
   §3.6) — campo existe de ponta a ponta, nada o aplica. Resolver de
   verdade no NewSec, não herdar o gap.
5. **Obrigatoriedade de cliente só em Zod, sem constraint no banco**
   (`SOURCE_INVENTORY.md` §1.3) — decisão pendente: reforçar no banco
   (`NOT NULL`/`CHECK`) ou manter só na aplicação.
6. **Integração Totalk tem superfície pequena** (`SOURCE_INVENTORY.md`
   §1.5) — 2 chamadas de API, 1 arquivo central de actions. Bom sinal para
   o prazo de 07/10 (confirmar ano/horário exato antes de agendar o corte).

## Próximos documentos

- `METRICS_CATALOG.md` — catálogo formal de indicadores (base já
  levantada em `SOURCE_INVENTORY.md` §3.7 pro Focus; falta atendimento,
  comercial, financeiro e IA).
- `DATA_MODEL.md` — schema canônico proposto para as entidades da seção 7
  da especificação, quando a fundação de empresa/vínculo/permissão for
  desenhada.
- `RUNBOOK.md` — procedimento de corte do Totalk (especificação seção 14),
  a escrever perto da Fase 4.
