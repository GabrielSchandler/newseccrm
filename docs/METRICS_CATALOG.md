# NewSec — catálogo de métricas

Catálogo formal pedido pela especificação (seção 12). Nenhuma métrica
listada aqui está implementada de verdade ainda — as telas de `/dashboards`,
`/produtividade` e `/atendimento/supervisao` da Fase 1 usam dados sintéticos
(`src/lib/demo/`). Este documento define o que cada indicador **deve**
significar quando for implementado de verdade, pra nenhum indicador
desaparecer por "não caber na primeira tela" e pra dashboard, card e
exportação sempre calcularem a mesma coisa a partir da mesma fonte.

## Regras gerais (valem pra toda métrica abaixo, não repetidas linha a linha)

- **Timezone**: horário da empresa (a definir onde fica configurado — hoje
  não há campo de timezone por empresa no CRM; decisão pendente, ver
  `PERMISSIONS.md`). Até lá, UTC-3 fixo.
- **Nulos/sem dados**: divisão por zero ou ausência de dado retorna
  "sem dados", nunca `0` nem `Infinity` — especialmente em percentuais e
  conversões (especificação seção 12).
- **Escopo**: toda métrica é implicitamente filtrada por `company_id` da
  empresa ativa (RLS) e, quando aplicável, pelos filtros globais de
  período/equipe/canal/consultor da tela.
- **Comparação de período**: "vs. período anterior" compara períodos de
  mesmo tamanho e mesma posição no calendário (não confundir semana
  corrente parcial com semana anterior completa).
- **Coorte**: quando um indicador depende de "pessoas únicas" (ex.:
  conversão), a definição de coorte usada está explícita na linha da
  métrica — nunca ambígua entre "eventos" e "pessoas".

## 1. Atendimento

| ID | Nome | Definição | Fonte (quando implementado) | Unidade |
| --- | --- | --- | --- | --- |
| `atd.entradas` | Novos contatos | Conversas/contatos novos no período | Chat: `conversas.created_at` | contagem |
| `atd.ativas` | Conversas ativas | Conversas em estado `HUMANO`/`AGUARDANDO_HUMANO`/`AGUARDANDO_CLIENTE`/`IA` (não `ENCERRADA`) | Chat: `conversas.estado` | contagem |
| `atd.sem_responsavel` | Sem responsável | Conversas ativas com `responsavel_id is null` | Chat: `conversas` | contagem |
| `atd.novos_nao_atendidos` | Novos não atendidos | Conversas criadas no período que nunca tiveram uma mensagem de humano | Chat: `conversas` + `mensagens` | contagem |
| `atd.aguardando_humano` | Aguardando humano | Conversas em `AGUARDANDO_HUMANO` agora | Chat: `conversas.estado` | contagem |
| `atd.aguardando_cliente` | Aguardando cliente | Conversas em `AGUARDANDO_CLIENTE` agora | Chat: `conversas.estado` | contagem |
| `atd.nao_lidas` | Não lidas | Conversas com mensagem de cliente após a última leitura do responsável | Chat (regra de leitura a documentar ao implementar) | contagem |
| `atd.retornos_vencidos` | Retornos vencidos | Retornos agendados (`retornos.data_retorno`) no passado e ainda não concluídos | Chat: `retornos` | contagem |
| `atd.primeira_resposta_humana` | Primeira resposta humana | Tempo entre 1ª mensagem do cliente e 1ª mensagem de humano (não conta resposta de IA) | Chat: `mensagens` (`autor='HUMANO'`) | mediana + p90 |
| `atd.resposta_ia` | Resposta da IA | Tempo entre mensagem do cliente e resposta da IA, medido separado da resposta humana | Chat: `mensagens` (`autor='IA'`) | mediana + p90 |
| `atd.tempo_resolucao` | Tempo de resolução | Tempo entre abertura e `ENCERRADA`, descontando tempo fora do expediente | Chat: `conversas` | mediana + p90 |
| `atd.backlog_por_idade` | Backlog por idade | Conversas ativas agrupadas por faixa de espera (0-15min, 15-60min, 1h+, 4h+) | Chat: `conversas` | contagem por faixa |
| `atd.transferencias` | Transferências | Quantidade de transferências no período, com motivo quando informado | Chat: RPC `transferir_conversa`/log | contagem |

## 2. Equipe

| ID | Nome | Definição | Fonte | Unidade |
| --- | --- | --- | --- | --- |
| `equipe.carga_atual` | Carga atual | Conversas ativas por consultor, agora | Chat: `conversas.responsavel_id` | contagem por pessoa |
| `equipe.disponibilidade` | Disponibilidade | Status manual do consultor (disponível/ocupado) — a definir onde fica gravado | a implementar | booleano |
| `equipe.sla_expediente` | SLA dentro do expediente | % de primeiras respostas humanas dentro da meta, só contando tempo de expediente | Chat + escala (Focus) | percentual |
| `equipe.distribuicao` | Distribuição | Conversas atendidas por pessoa / total da equipe no período | Chat | percentual por pessoa |
| `equipe.atendidas_por_pessoa` | Conversas efetivamente atendidas | Conversas onde a pessoa enviou ao menos 1 mensagem humana (não só foi responsável nominal) | Chat: `mensagens` | contagem por pessoa |

## 3. Comercial

| ID | Nome | Definição | Fonte | Unidade |
| --- | --- | --- | --- | --- |
| `com.analises` | Análises | Simulações (`financing_calculations`) criadas no período, com/sem cliente vinculado | CRM: `financing_calculations` | contagem |
| `com.pre_vendas` | Pré-vendas | `pre_sales` criadas no período | CRM: `pre_sales` | contagem |
| `com.vendas` | Vendas | Pré-vendas com status de venda fechada | CRM: `pre_sales.status` | contagem |
| `com.cancelamentos` | Cancelamentos | Pré-vendas com status `distrato`/cancelado | CRM: `pre_sales.status` | contagem |
| `com.ticket_medio` | Ticket médio | Soma de `contract_value` das vendas ÷ quantidade de vendas | CRM: `pre_sales.contract_value` | R$ |
| `com.conversao_contatos` | Conversão — contatos com venda | Contatos com ao menos 1 venda ÷ contatos da coorte do período. **Não** é vendas ÷ contatos (uma pessoa com 2 vendas não pode gerar >100%, ver especificação seção 12) | Chat contatos + CRM vendas | percentual |
| `com.conversao_por_venda` | Vendas por contato | Vendas ÷ contatos da coorte — pode passar de 100%, rótulo deixa isso explícito | CRM + Chat | percentual (pode >100%) |

## 4. Financeiro

| ID | Nome | Definição | Fonte | Unidade |
| --- | --- | --- | --- | --- |
| `fin.vendido` | Vendido | Soma de `contract_value` das vendas no período (contratado, não necessariamente recebido) | CRM: `pre_sales` | R$ |
| `fin.recebido` | Recebido | Soma de pagamentos com status confirmado | CRM: módulo financeiro (a mapear em detalhe — `FEATURE_PARITY.md` marca "Base", não inventariado a fundo) | R$ |
| `fin.a_receber` | A receber | Pagamentos previstos ainda não confirmados, com data futura | CRM: `payments`/financeiro | R$ |
| `fin.vencido` | Vencido | Pagamentos previstos com data passada e sem confirmação | CRM: financeiro | R$ |

## 5. IA

| ID | Nome | Definição | Fonte | Unidade |
| --- | --- | --- | --- | --- |
| `ia.volume_assistido` | Volume assistido | Mensagens/ações onde a IA sugeriu e humano confirmou | a implementar (Fase 3) | contagem |
| `ia.volume_automatico` | Volume automático | Mensagens respondidas pela IA sem intervenção humana | Chat: `mensagens.autor='IA'` | contagem |
| `ia.handoffs` | Handoffs | Transferências de IA para humano, com motivo (limite de mensagens, confiança baixa, pedido do cliente) | Chat: `conversar.ts` | contagem por motivo |
| `ia.erros` | Erros | Falhas de chamada ao provedor de IA (timeout, cota, credencial ausente) | Chat: logs do provedor | contagem |
| `ia.latencia` | Latência | Tempo de resposta do provedor de IA | Chat: logs do provedor | mediana + p90 |
| `ia.consumo` | Consumo | Tokens/minutos de IA usados, por empresa e finalidade | A implementar — especificação seção 6 pede tabela de uso versionada | tokens/min |
| `ia.custo_estimado` | Custo estimado | Consumo × tabela de preços versionada (nunca hardcoded) | A implementar | R$ |

## 6. Produtividade (Focus) — catálogo já existente, preservar integralmente

Levantado em `SOURCE_INVENTORY.md` §3.7 a partir do código real do Focus.
Nenhum destes pode ser cortado ao portar (especificação seção 6/12).

| ID | Nome | Definição | Fonte real (Focus) | Unidade |
| --- | --- | --- | --- | --- |
| `prod.jornada_prevista` | Jornada prevista | Horas de expediente conforme escala configurada | Focus: escalas | horas |
| `prod.tempo_ativo` | Tempo ativo | Minutos com atividade detectada (produtivo + neutro + improdutivo + sem classificação), deduplicado entre dispositivos | Focus: `painel_produtividade_diaria()` | horas |
| `prod.tempo_produtivo` | Tempo produtivo | Minutos classificados como `PRODUCTIVE` | Focus: `app_mappings`/`productivity_categories` | horas |
| `prod.cobertura` | Cobertura | Minutos registrados ÷ minutos de expediente previsto | Focus | percentual |
| `prod.fora_expediente` | Atividade fora do expediente | Minutos ativos fora da escala — vira hora extra (`painel_horas_extras`), nunca entra no índice de produtividade | Focus | horas |
| `prod.distribuicao_jornada` | Distribuição da jornada | % produtivo/neutro/improdutivo/ocioso/bloqueado/sem dados | Focus | percentual (7 fatias) |
| `prod.aplicativos` | Aplicativos e sites | Tempo por app/site, classificado ou pendente | Focus: `resumo_app_diario` + `app_mappings` | horas por app |
| `prod.dispositivos` | Dispositivos | Estações registradas, com/sem envio recente, versão do agente | Focus: `devices` | contagem |
| `prod.minutos_sobrepostos` | Minutos sobrepostos | Minutos onde 2+ dispositivos da mesma pessoa reportaram ao mesmo tempo — exibido como aviso, nunca somado como tempo extra | Focus: `resumo_pessoa_15min` | horas |

## Construtor de fórmulas avançado (Fase 6, não Fase 1)

Especificação seção 12 pede um parser de AST validado contra este catálogo
(nunca `eval`/SQL livre) pra fórmulas derivadas. Não implementado — listado
aqui só pra registrar que este catálogo é a lista de blocos permitidos
quando esse construtor existir.
