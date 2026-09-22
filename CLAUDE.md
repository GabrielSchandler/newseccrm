# NewSec — instruções para Claude Code neste repositório

Este é o repositório do produto **NewSec**: unificação do CRM em produção
(GRSCRM), do atendimento (newsecchat) e da produtividade (newsecfocus) num
único sistema, com o atendimento como espaço principal do consultor e o CRM
em segundo plano. Nasceu como clone completo do GRSCRM (histórico Git
preservado) em 22/09/2026.

**Leia antes de qualquer tarefa, nessa ordem:**

1. `NEWSEC-ESPECIFICACAO-E-PROMPT-CLAUDE.md` — especificação completa: arquitetura,
   regras de negócio, permissões, migração do Totalk, fases e critérios de
   aceite. É a fonte de verdade para decisões de produto e arquitetura.
2. `docs/PROGRESS.md` — checkpoint do estado real: o que foi feito, comandos
   executados, pendências, próximo passo. Sempre atualizar ao final de um ciclo.
3. `docs/TASKS.md` — lista de tarefas por fase.
4. `docs/SOURCE_INVENTORY.md`, `docs/PERMISSIONS.md`, `docs/FEATURE_PARITY.md`,
   `docs/METRICS_CATALOG.md` — inventário factual dos três sistemas de origem
   (conforme forem sendo preenchidos).

## Regras que não são negociáveis

- **Sempre em português (pt-BR)**: resposta, código, comentário, nome de
  arquivo/variável, mensagem de commit, documentação.
- **Banco de produção é o do CRM atual.** Nunca migrar os dados dele para um
  banco vazio. Chat e Focus só têm dados de teste — não há nada a migrar
  desses dois.
- **Não aplicar migração em produção, não fazer deploy de produção, não
  conectar/substituir os números de WhatsApp ativos, não enviar mensagem
  real, não cancelar o Totalk** sem autorização explícita do Gabriel para
  aquela operação concreta. Preparar essas etapas de forma executável não
  significa executá-las.
- **Não perder capacidade existente do CRM.** Toda função atual precisa de
  destino documentado no mapa de paridade antes de a rota antiga sumir.
  Obrigatório/Jurídico/Opcional do cadastro de cliente vêm do CRM atual, não
  se enfraquece essa validação.
- **Isolamento multiempresa/multiequipe é requisito de servidor e banco
  (RLS), nunca só de menu escondido.**
- **Dados sintéticos/demo precisam estar claramente identificados como tal.**
  Nunca declarar integração real concluída com base em mock/adapter de teste.
- A referência de prazo do corte do Totalk é 07/10 — confirmar ano/horário
  exato no runbook antes de agendar qualquer mudança externa. Prazo não é
  motivo para marcar item não testado como pronto (ver checklist de gate na
  especificação, seção 18).

## Como trabalhar aqui

- Ler o checkpoint (`docs/PROGRESS.md`) e o diff local antes de editar.
- Entregas pequenas e verticais, com critério de aceite, não uma reescrita
  ampla de uma vez.
- Perguntar ao Gabriel só quando uma decisão de negócio ou acesso realmente
  bloquear o trabalho e não puder ser resolvida por inspeção do código
  existente; caso contrário, escolher um default razoável, registrar e
  seguir.
- Atualizar `docs/PROGRESS.md` ao final de cada ciclo de trabalho, com o
  formato de checkpoint descrito na especificação (seção 20).
- Repositório remoto: `https://github.com/GabrielSchandler/newseccrm` (origin).
  O GRSCRM original continua acessível como remote `grscrm-upstream` só para
  referência — não há necessidade de sincronizar automaticamente com ele.
