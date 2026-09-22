# NewSec — mapa de paridade de funcionalidades

Toda função hoje existente nos três sistemas precisa de origem e destino
propostos antes que uma rota antiga possa sumir (especificação seção 8.2 e
critério de aceite da Fase 0). Base factual: `SOURCE_INVENTORY.md`. Status
usados: **Base** (já existe no CRM clonado, ponto de partida do newseccrm),
**Portar** (existe em Chat/Focus, precisa ser trazido), **Redesenhar** (existe,
mas com um problema real identificado que não pode ser copiado como está),
**Novo** (não existe em nenhum dos três, é acréscimo da especificação).

## Comercial / CRM

| Função | Origem | Status | Observação |
| --- | --- | --- | --- |
| Cadastro de cliente (Obrigatório/Jurídico/Opcional) | CRM `src/lib/clients/schema.ts` | Base | Obrigatoriedade só em Zod, sem constraint no banco — decisão pendente (ver `SOURCE_INVENTORY.md` 1.3, `PERMISSIONS.md`). |
| Análise/simulação sem cliente | CRM `src/lib/calculations/schema.ts` | Base | Preservar `client_id` opcional. |
| Pré-venda com cliente obrigatório | CRM `src/lib/pre-sales/schema.ts` | Base | Preservar validação dupla (Zod + `assertClientBelongsToCompany`). |
| Contratos, leads, dashboard comercial | CRM `contratos/`, `leads/`, `dashboard/` | Base | Não inventariado em detalhe de campo nesta rodada — aprofundar ao tocar a área. |
| Contato provisório (conversa antes de cadastro completo) | Chat `contatos/` | Redesenhar | Chat trata contato como entidade própria simplificada; especificação (seção 7) exige que ele se vincule depois ao cliente do CRM sem duplicar cadastro — hoje são dois cadastros de pessoa paralelos (CRM `clients` vs. Chat `contatos`). |

## Jurídico / Financeiro / Documentos

| Função | Origem | Status | Observação |
| --- | --- | --- | --- |
| Esteira jurídica, aprovações (portal do cliente) | CRM `juridico/`, `aprovacoes/` | Base | Não detalhado nesta rodada. |
| Emails (Outlook jurídico) | CRM `emails/` | Base | — |
| Financeiro | CRM `financeiro/` | Base | — |
| Geração de documento (Word/PDF) | CRM (`docxtemplater`, `@react-pdf/renderer`) | Base | — |
| Envio de PDF de análise ao cliente | CRM `totalk-actions.ts` → Totalk | **Redesenhar** | Único uso real de envio de arquivo do CRM hoje depende do Totalk (`SOURCE_INVENTORY.md` 1.5) — precisa de substituto via canal do Chat integrado antes do corte. |
| Importação de dados de simulação a partir de anotação do atendimento | CRM `totalk-actions.ts` → Totalk | **Redesenhar** | Mesma dependência acima — hoje só existe via Totalk; substituto é o contexto estruturado do Chat (`ProposedFact`, especificação Anexo A.4). |

## Atendimento (a portar do Chat)

| Função | Origem | Status | Observação |
| --- | --- | --- | --- |
| Máquina de estados da conversa (IA/AGUARDANDO_HUMANO/HUMANO/AGUARDANDO_CLIENTE/ENCERRADA) | Chat SQL (`esquema-completo.sql` + migrações) | Portar | Lógica de banco (locks, RPCs) já madura — portar quase como está; corrigir a inconsistência comentário×código em `iaPodeResponder()` (`SOURCE_INVENTORY.md` 2.1). |
| Fila operacional (Meus/Equipe/IA/Supervisão) | Chat `assistente-ia/`, `equipes/`, `supervisao/` (mesmo componente, prop `modo`) | Portar | Padrão parametrizado reaproveitável para a Tela 04. |
| Transferência com controle de concorrência | Chat RPCs + lock de linha + coluna `versao` | Portar | Já resolve o requisito da especificação seção 10/Anexo C.2 — não reinventar. |
| Envio confiável (idempotência, reconciliação de timeout ambíguo) | Chat `lib/servicos/envio.ts`, `lib/nucleo/idempotencia.ts` | Portar | Já implementa outbox/idempotência da especificação seção 10 — portar a lógica de banco. |
| Webhook idempotente/tolerante a ordem invertida | Chat `trabalhador/processadores/evento-webhook.ts` | Portar | — |
| Transcrição de áudio recebido | Chat `midia.ts` + `lib/provedores/transcricao/` | Portar | — |
| Transcrição de áudio enviado pelo consultor | — | **Novo** | Confirmado ausente no Chat (`status_transcricao:'NAO_APLICAVEL'` fixo) — implementar do zero, especificação seção 11.3. |
| Contexto por IA (resumo, campos, memórias) | Chat `lib/ia/contexto.ts`, `lib/ia/conversar.ts` | **Redesenhar** | Sobrescrita silenciosa confirmada, sem proteção de campo confirmado manualmente (`SOURCE_INVENTORY.md` 2.3) — implementar `ProposedFact`/revisão explícita do zero. |
| Credencial de IA por empresa | Chat `lib/provedores/ia/indice.ts` | **Redesenhar** | Hoje é singleton global por processo/env var — reescrever a fábrica (especificação seção 6). |
| Revalidação de handoff antes de enviar resposta de IA | Chat `lib/ia/conversar.ts` + RPC `registrar_mensagem_ia` | Portar | Já resolve o risco "job atrasado responde depois do humano assumir" — portar a garantia via lock de linha. |
| Versionamento de prompt do agente de IA | Chat `ia/versoes/`, tabela `versoes_agente_ia` | Portar | Já implementa "propostas revisáveis e versionadas" (especificação seção 11.5). |
| Análise de atendimento → sugestão de melhoria | Chat `ia/analise/`, `sugestoes_ia` | Portar | Mesma observação acima. |
| Campanhas (disparo em massa) | Chat `campanhas/` | Portar | — |
| Respostas rápidas | Chat `respostas-rapidas/` | Portar | — |
| Retornos/follow-up agendado | Chat `retornos/` | Portar | — |
| Regras de horário/reabertura | Chat `configuracoes/atendimento/` | Portar | — |
| Campos personalizados de contato | Chat `configuracoes/campos/` | Portar | Reconciliar com campos do cliente do CRM — evitar dois catálogos de campo paralelos. |
| Conexão de canal WhatsApp (Evolution) | Chat `configuracoes/canais/` | Portar | — |
| Base de conhecimento / FAQ | — | Não existe | Confirmado ausente no Chat apesar de aparecer como conceito na especificação (área "Base de conhecimento" nos mockups de Supervisão) — não presumir que já está pronto em algum lugar. |
| Integração Google Sheets | Chat `integracoes/google-sheets` | Portar | Única integração real hoje além do Totalk/WhatsApp — mapear se ainda é necessária no NewSec ou se pertence só ao Chat legado. |

## Produtividade (a portar do Focus)

| Função | Origem | Status | Observação |
| --- | --- | --- | --- |
| Agregação por pessoa/minuto/15min, deduplicação entre dispositivos | Focus `0036_metricas_coerentes.sql` | Portar | Solução madura, 2+ ciclos de correção de bug já documentados — portar a lógica de agregação quase como está. |
| Classificação de atividade (produtivo/neutro/improdutivo) | Focus `productivity_categories`, `app_mappings` | Portar | — |
| Agente Windows (.NET 8) | Focus `agente/` | Portar | Não reimplementar em JS; distribuir/atualizar separadamente do deploy web (especificação seção 13). |
| Ingestão autenticada por token de dispositivo | Focus Edge Functions | Portar | Padrão já correto (empresa/equipe nunca vêm do payload do agente) — reaproveitar o desenho. |
| Liderança restrita a 1 equipe | Focus `profiles.team_id`/`employees.team_id` escalar | **Redesenhar** | Migração real de schema/RLS para N:N (especificação seção 13) — ver `PERMISSIONS.md`. |
| Suspensão administrativa de coleta | Focus `organizations.status` + `collection_enabled` | **Redesenhar** | Confirmado decorativo hoje (campo existe, nada o lê no agente, servidor não rejeita ingestão) — implementar de verdade no NewSec, não herdar o gap. |
| Janela de coleta configurável | Focus `OpcoesAgente.JanelaColetaInicio/Fim` | Portar | Já funciona corretamente. |
| Catálogo completo de indicadores/telas (Visão geral, Pessoas, Equipes, Aplicativos, Jornada, Dispositivos, Registros, Relatórios) | Focus `dashboard/app/painel/*` | Portar | Ver `SOURCE_INVENTORY.md` 3.7 — nenhum pode ser cortado. |
| Exportação XLSX/CSV | Focus `dashboard/lib/exportacao.ts` | Portar | — |
| Retenção configurável (detalhe expira, agregado é permanente) | Focus `organizations.retencao_dias` + `pg_cron` | Portar | — |
| Limites de coleta (sem teclado/tela/conteúdo de conversa) | Focus `agente/src/Telemetria.Coletor` | Portar (política) | Confirmar que o NewSec preserva os mesmos limites — não é negociável, especificação seção 13. |

## Academia

| Função | Origem | Status | Observação |
| --- | --- | --- | --- |
| Cursos e capítulos (14 capítulos, conteúdo pt-BR da operação GRS) | CRM `src/lib/academy/course.ts` (hardcoded) | Base | Preservar conteúdo — não recriar. |
| Progresso e prova por capítulo, com RLS | CRM `academy_chapter_progress`, `academy_exam_attempts` | Base | — |
| Atribuição de curso por empresa/equipe/pessoa | — | **Novo** | Confirmado ausente hoje (todo usuário ativo vê os 2 cursos fixos) — especificação seção 8.2/Tela 10 pede distribuição granular; é trabalho novo, não portar de lugar nenhum. |

## Plataforma / Master

| Função | Origem | Status | Observação |
| --- | --- | --- | --- |
| Isolamento multiempresa sistemático (RLS por `company_id`) | CRM `docs/sql/plataforma-multiempresas.sql` | Base | Varredura dinâmica já cobre toda tabela nova com `company_id` — herdar o padrão para tabelas novas do Chat/Focus. |
| Módulos/entitlements por empresa, com fallback permissivo se ausente | CRM `platform-settings.ts` | **Redesenhar** | Decidir se mantém fallback "tudo habilitado" ou inverte (`SOURCE_INVENTORY.md` 1.2). |
| Painel do revendedor/plataforma (sem acesso a telemetria por padrão) | Focus `/plataforma` | Portar | Bom padrão de privacidade a herdar para o Master do NewSec (especificação seção 5, "master administra sem abrir conteúdo privado"). |
| Gestão de empresas/planos/limites (Tela 08) | — | **Novo** | Não existe hoje em nenhum dos três como tela dedicada — Fase 6. |
| Editor de dashboards (Tela 09) | — | **Novo** | Não existe hoje — Fase 6, backlog explícito da especificação. |

---

Este mapa é vivo: atualizar o status de cada linha ao portar, e adicionar
linhas conforme cada área for aprofundada além do que a inventariação de
superfície da Fase 0 cobriu (em especial Comercial/Jurídico/Financeiro do
CRM, listados aqui só por diretório, sem detalhe de campo).
