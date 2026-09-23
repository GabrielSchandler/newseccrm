# NewSec — especificação técnica e prompt mestre para Claude Code

Versão: 1.0 · 22/09/2026 · Produto e nome de trabalho sujeitos à aprovação de Gabriel.

Este documento é uma instrução de implementação para o agente de desenvolvimento. As imagens entregues junto dele são referências conceituais de interface. As regras escritas e o comportamento existente no CRM têm precedência sobre textos, números, campos ou detalhes eventualmente imprecisos das imagens.

> **Retificação (23/09/2026, ver `docs/PERMISSIONS.md` §2.0 — documento
> mantido íntegro abaixo, sem editar o corpo):** a seção 5 pede "vínculos
> muitos-para-muitos para usuário/empresa e supervisor/equipe" e fala de
> "gerente multiempresa". O Gabriel confirmou que isso não é o modelo real:
> só o master (`is_platform_owner`) acessa várias empresas — já existe,
> sem tabela nova. Gerente/supervisor/consultor ficam 1:1 com a própria
> empresa, de propósito. Só a parte "supervisor em várias equipes" era
> trabalho real de schema, e já foi entregue
> (`supabase/migrations/0001_equipes.sql`/`0002_equipes_integridade_empresa.sql`).
> Onde a seção 5 abaixo falar de vínculo N:N usuário↔empresa ou troca de
> empresa por um não-master, vale o `PERMISSIONS.md` §2.0, não este texto.

## 1. Missão e resultado esperado

Você é o agente responsável por implementar a unificação dos sistemas abaixo em um produto multiempresa, preservando o CRM e colocando o atendimento no centro da experiência:

- Base: https://github.com/GabrielSchandler/GRSCRM
- Atendimento: https://github.com/GabrielSchandler/newsecchat
- Produtividade: https://github.com/GabrielSchandler/newsecfocus
- API do atendimento atualmente contratado: https://flwchat.readme.io/

O novo produto deve manter todas as capacidades do CRM, incorporar as capacidades do Chat e do Focus e acrescentar as melhorias descritas neste documento. A implementação será incremental. Não reescreva os três sistemas do zero, não substitua regras existentes por aproximações e não considere uma tela visualmente pronta como integração concluída.

Objetivo operacional prioritário: substituir o Totalk com segurança, preservando os históricos acessíveis, os arquivos necessários e os fluxos de trabalho usados pela equipe. A referência de prazo é 07/10; confirmar ano e horário de corte no plano operacional antes de agendar mudanças externas. Não prometa terminar o escopo completo até essa data. Diferencie lançamento do atendimento, integração completa e evolução do produto.

Contexto confirmado:

- CRM tem dados importantes e deve conservar seu banco de produção e identificadores.
- Chat e Focus foram apenas testados; não há dados importantes desses dois bancos a migrar.
- Operação inicial: cinco consultores e dois números de WhatsApp com conexão não oficial.
- Os canais atendem comercial e jurídico. Não deduza que cada número pertence exclusivamente a um setor.
- As classificações de campos Obrigatório, Jurídico e Opcional já existem no CRM e devem ser preservadas.
- Um cliente pode ter vários telefones e vários ciclos comerciais, vendas e atendimentos simultâneos ou sucessivos.
- A experiência deve funcionar com atendimento por WhatsApp e com contatos por ligação/registro manual.
- Gabriel usa Claude Code e Codex com orçamento limitado. Trabalhe por entregas pequenas, reutilize o código e mantenha memória de projeto nos arquivos.

## 2. Limites desta execução e autorização

Este material autoriza, quando entregue ao Claude para iniciar, trabalho de desenvolvimento em ambiente isolado: inspeção dos repositórios, preparação de cópia local derivada do CRM, documentação, código, testes locais e migrações ainda não aplicadas em produção.

Não interprete o material como autorização para alterar o CRM em produção, aplicar SQL em produção, substituir canais ativos, disparar mensagens reais, consumir serviços pagos sem configuração autorizada, publicar deploy de produção, criar cobranças ou cancelar Totalk. Prepare esses passos de forma executável e verificável; execute-os quando Gabriel autorizar a operação concreta.

Não solicite confirmação para escolhas técnicas reversíveis que você consegue resolver por inspeção. Se faltar nome do novo repositório, use localmente `newsec-unified` como nome provisório. Se faltar acesso externo, continue os passos locais independentes e registre o impedimento exato. Não invente credenciais, projetos Supabase, domínio, endpoints ou resultados de teste.

**Primeiro ciclo autorizado pelo prompt inicial:** concluir a Fase 0 e implementar a Fase 1 descritas adiante. As demais fases são o destino arquitetural e o backlog ordenado; não precisam ser construídas na primeira execução.

## 3. Evidências do código e pontos obrigatórios de reinspeção

A análise anterior foi estática. Não equivale a teste de produção. Ao começar, registre o SHA atual dos três repositórios e confira os pontos abaixo contra o código real. READMEs podem estar desatualizados.

| Área | Evidência encontrada | Consequência |
| --- | --- | --- |
| CRM | Next 15, React 19, Tailwind 4, TypeScript, Supabase, React Hook Form e Zod | Usar a base do CRM e adaptar componentes importados |
| Chat | Next 15, React 18, Tailwind 3, BullMQ, Redis e worker persistente | Não copiar package.json nem instalar duas versões de React |
| Focus | Dashboard Next, agente Windows .NET 8, Edge Functions, RLS e agregação PostgreSQL | Incorporar painel e backend sem esquecer agente e ingestão |
| CRM | `src/lib/company/platform-settings.ts` já possui módulos e configuração de empresa | Evoluir configuração existente; verificar imposição no servidor |
| CRM | `src/lib/auth/current-user.ts` e `src/types/user.ts` têm modelo próprio de perfil/papel/empresa | Não adicionar um segundo login ou identidade paralela |
| CRM | `src/lib/clients/schema.ts` concentra validações do cadastro | Reutilizar regras e verificar também formulário e restrições do banco |
| CRM | Análise pode existir sem cliente; pré-venda exige cliente | Manter diferença e não criar cadastro incompleto para contornar validação |
| CRM | Integração Totalk lê anotações e envia PDF | Trocar também esses usos, além da interface de conversa |
| Chat | Transcrição recebida existe; caminho de áudio enviado pelo consultor marcava transcrição como não aplicável | Acrescentar transcrição de áudio de saída, assíncrona |
| Chat | Há tratamento de mídia e conversão de áudio com ffmpeg | Conversão de formato não é transcrição |
| Chat | Chave OpenAI resolvida globalmente nos caminhos inspecionados | Criar resolução de credencial por empresa para todas as tarefas de IA |
| Chat | Resumo/memórias/campos já são atualizados pela IA | Preservar trabalho manual e atribuir origem/versionamento |
| Focus | Agregação por pessoa/minuto e intervalos de 15 minutos consta em migrações recentes | Não regressar para soma bruta que duplica tempo entre dispositivos |
| Focus | Modelo original restringe líder a uma equipe | Evoluir vínculo para supervisor com múltiplas equipes |
| CRM | Academia já tem cursos e progresso | Preservar conteúdo e progresso antes de ampliar a distribuição |

Pontos de partida para leitura, confirmando sua existência na versão atual:

- CRM: `src/lib/company/platform-settings.ts`, `src/lib/auth/current-user.ts`, `src/types/user.ts`, `src/lib/clients/schema.ts`, `src/lib/calculations/schema.ts`, `src/lib/totalk/api.ts`, `src/lib/academy/course.ts`, `docs/sql/plataforma-multiempresas.sql`; procurar também ações Totalk de cálculos, schema de pré-venda e agrupamentos dos formulários.
- Chat: `lib/operacao/atendimento.ts`, `app/(painel)/atendimento/acoes.ts`, `app/(painel)/atendimento/tempo-real.tsx`, `lib/ia/contexto.ts`, `lib/ia/conversar.ts`, `lib/provedores/ia/indice.ts`, `lib/servicos/envio.ts`, `trabalhador/processadores/evento-webhook.ts`, `trabalhador/processadores/midia.ts`, `trabalhador/processadores/analise-ia.ts`.
- Focus: `dashboard/lib/sessao.ts`, diretórios `supabase/migrations`, `supabase/functions`, `agente`, `documentos`; localizar migrações `0036_metricas_coerentes.sql` e seguintes, se mantidas com esses nomes.

Se um caminho tiver mudado, use `rg` para localizar sua responsabilidade. Registre o equivalente atual, não crie um arquivo duplicado apenas para satisfazer esta lista.

## 4. Organização de repositório, banco e deploy

### 4.1 Novo repositório derivado do CRM

Criar uma base local derivada de GRSCRM preservando o histórico Git. Manter o CRM original disponível. Tratar Chat e Focus como fontes de módulos, contratos, testes e regras. Não fazer merge cego de três árvores ou copiar três aplicações completas para uma interface com iframes.

Recomenda-se um repositório com uma aplicação web e processos adicionais claramente separados. Não mover o CRM inteiro para um monorepo complexo antes de haver necessidade. Estrutura inicial sugerida, adaptável ao inventário:

```text
src/                       # aplicação e domínios existentes do CRM
  app/                     # rotas preservadas + novas rotas
  components/              # shell, UI e componentes dos domínios
  lib/                     # serviços/regras reutilizados e adaptados
workers/                   # filas, envio, IA, importação e mídia
agent/                     # agente Windows derivado do Focus
supabase/                  # migrações novas, funções e testes de isolamento
scripts/                   # importação, reconciliação e verificações
docs/
  PROJECT_SPEC.md
  SOURCE_INVENTORY.md
  FEATURE_PARITY.md
  ARCHITECTURE.md
  DATA_MODEL.md
  PERMISSIONS.md
  METRICS_CATALOG.md
  UI_SPEC.md
  MIGRATION_TOTALK.md
  RUNBOOK.md
  TASKS.md
  PROGRESS.md
  decisions/
  reference-images/
```

Não duplique regras de negócio entre `src` e `workers`. Extraia um módulo compartilhado quando houver consumidor real; use workspace package apenas se simplificar importação, build e deploy. Separe dependências browser, Node e Deno.

### 4.2 Banco

Banco de produção alvo: o banco atual do CRM. Não migrar seus dados para um banco vazio só para facilitar a união.

Durante desenvolvimento, usar banco local ou homologação separado, com schema equivalente e dados sintéticos/anonimizados quando autorizado. Nunca conectar previews ou testes de migração ao banco de produção por conveniência.

Evoluir com migrações aditivas e compatíveis:

1. Inventariar tabelas, constraints, triggers, funções, policies, storage, extensões e scripts existentes.
2. Fazer o mapeamento semântico dos três schemas.
3. Definir entidades canônicas, reusando as do CRM.
4. Criar novas estruturas e backfills idempotentes em homologação.
5. Preservar leitura/escrita esperadas pelo CRM antigo durante convivência.
6. Documentar mudança incompatível e sua janela; postergar remoções até depois da estabilização.

Nunca executar em bloco as migrações de Chat ou Focus sobre o CRM sem revisar colisões de tabelas, funções, policies, enums, triggers e ownership. Não assumir que o banco real corresponde a todos os SQLs presentes no Git. Comparação com produção deve usar acesso autorizado e nunca expor dados ou segredos em logs.

### 4.3 Deploy

- Uma aplicação web e domínio principal para o usuário.
- Web Next na infraestrutura atual compatível, inicialmente Vercel se mantida.
- Worker persistente para BullMQ, Redis, envio, mídia, IA e migração; não executar processamento demorado dentro da requisição HTTP.
- Provedor/conector WhatsApp e sua infraestrutura conforme o adapter existente, a validar com os dois números reais.
- Supabase para Auth, PostgreSQL, Storage e Realtime; Edge Functions do Focus conforme necessidade.
- Agente Windows distribuído e atualizado separadamente, mesmo com código no mesmo repositório.

Um repositório não significa um único processo nem um único deploy técnico. Não criar microsserviços independentes para cada entidade neste porte inicial.

## 5. Identidade, empresas, equipes e permissões

Uma pessoa faz login uma vez. Sua sessão pode ter vínculos em uma ou mais empresas. A empresa ativa é contexto validado pelo servidor, não uma garantia de permissão recebida do navegador.

Modelo lógico sugerido: usuário Auth → vínculos em empresas → papéis/permissões → vínculos em equipes. Adapte nomes e tipos ao CRM real.

| Papel | Escopo | Capacidades principais |
| --- | --- | --- |
| Master | Plataforma | Criar/editar/suspender empresas, planos, módulos, limites e configuração comercial |
| Gerente | Empresas às quais está vinculado | Equipes, usuários, visão financeira autorizada, operação e dashboards das empresas |
| Supervisor | Uma ou mais equipes autorizadas | Filas, transferências, atendimento, resultados e treinamento dessas equipes |
| Consultor | Próprios registros e filas compartilhadas explicitamente autorizadas | Atendimento, análise, cliente, pré-venda, atividades e desempenho próprio |

Papel comercial/jurídico, equipe, cargo e condição de master são dimensões distintas. Não faça uma única enumeração que impossibilite um gerente também atender. Preservar acessos existentes ao migrar papéis; documentar tabela de equivalência entre `admin`, `manager`, `seller` e o modelo alvo.

Regras:

- Vínculos muitos-para-muitos para usuário/empresa e supervisor/equipe.
- Uma empresa tem várias equipes; canais podem encaminhar para mais de um setor/equipe.
- Validar empresa + ação + escopo + módulo em toda operação sensível.
- RLS precisa refletir a mesma regra, incluindo arquivos, relatórios, buscas e Realtime.
- Service role nunca vai ao navegador. Uso no worker exige escopo explícito e validação própria.
- Company ID de payload/webhook não é confiável: resolver a empresa a partir do canal autenticado/credencial registrada.
- Chaves estrangeiras e consultas devem impedir vínculo entre entidades de empresas diferentes.
- Troca de empresa limpa cache, subscriptions, contexto aberto, formulários e rascunhos exibidos; persistência de rascunhos deve ser segregada por usuário/empresa/conversa.
- Revogação de acesso deve invalidar ações posteriores e subscriptions conforme capacidades da infraestrutura.
- Por padrão, o master administra a plataforma sem abrir conteúdo privado de clientes ou telemetria bruta de empresas. Acesso de suporte, se necessário, precisa ser uma capacidade explícita, temporária e auditada; conferir a política atual e decidir a migração sem deixar um bypass acidental.

Criar testes com usuário em duas empresas, supervisor em duas equipes, usuário sem vínculo e identificadores de outra empresa. Menu escondido não é controle de acesso.

## 6. Módulos, planos, limites e credenciais de IA

Separar `entitlement` da empresa de permissão do usuário. Um usuário autorizado não ganha módulo não contratado; um módulo contratado não libera acesso a todos.

Reutilizar o catálogo do CRM e estender para chat, atendimento por IA, análise assistida, produtividade/Focus, treinamento, dashboards e Academia conforme granularidade necessária. Não desabilitar análise manual porque atendimento automático de IA foi removido do plano.

Matriz mínima:

- CRM comercial, jurídico, financeiro, documentos, simulações, portal, leads, Academia e integrações já existentes.
- Chat humano.
- IA de atendimento, resumo/contexto, transcrição e análise/treinamento como capacidades separáveis quando necessário.
- Produtividade: painel, ingestão e limites de dispositivos.
- Dashboards padrão e personalização avançada.
- Limites: usuários, canais, dispositivos, armazenamento, retenção e consumo de IA, quando suportados.

Aplicar limites também nos endpoints, jobs e rotinas agendadas. Suspensão deve ter comportamento explícito para operações em andamento, leitura histórica e exportação; não apagar dados para representar módulo desativado. Comparar com regras atuais antes de mudar o comportamento.

Master pode configurar oferta e desconto como metadados comerciais, sem necessidade de implementar um sistema completo de cobrança neste ciclo. Não inferir que painel de plano significa cobrança automática funcionando.

Credenciais OpenAI:

- Resolver credencial no servidor por empresa e finalidade.
- Uma credencial pode ser concedida explicitamente a várias empresas, inclusive de donos diferentes, sem compartilhar acesso aos dados delas.
- Manter cadastro de credencial separado das concessões de uso por empresa; armazenar segredo criptografado ou em gerenciador de segredos, com chave mestra fora do banco.
- Nunca retornar segredo após cadastro; exibir identificador mascarado, responsável, empresas autorizadas e opção de substituir/revogar.
- Aplicar a resolução a atendimento, contexto, transcrição, imagens e treinamento; não deixar um caminho usando variável global silenciosamente.
- Registrar empresa, tarefa, modelo, tokens/minutos, latência, status e custo estimado com tabela de preços versionada. Valores devem ser configuráveis; não fixar preços de memória.
- Limites e alertas por empresa; orçamento esgotado mantém atendimento humano e informa indisponibilidade da IA.
- Definir modelos por tarefa; começar com o menor custo que passe a validação. Selecionar versões disponíveis pela documentação atual ao implementar.

## 7. Entidades e invariantes de domínio

Os nomes seguintes representam responsabilidades, não uma obrigação de criar todas essas tabelas. Reutilize as entidades existentes e justifique cada nova tabela.

| Responsabilidade | Invariante |
| --- | --- |
| Empresa, usuário e vínculo | Uma identidade Auth; acesso por vínculo ativo |
| Equipe e membros | Múltiplas equipes por supervisor; história de atribuições quando necessária |
| Canal | Pertence a uma empresa; identifica conta/número/provedor e roteamento |
| Contato operacional | Pode conversar antes de cadastro completo no CRM |
| Cliente CRM | Obedece integralmente às validações atuais |
| Telefones do contato/cliente | Relação de vários números; normalização e origem preservadas |
| Identidade externa | IDs do provedor e importação não são IDs internos |
| Conversa/sessão | Pertence a canal/empresa e tem responsáveis e estado auditáveis |
| Mensagem | Direção, autor real, tipo, timestamps, ID externo, estado de entrega |
| Nota interna | Jamais é enviada ao cliente como mensagem |
| Análise/simulação | Pode existir sem cliente se a regra atual permitir |
| Pré-venda | Exige cliente e campos definidos pelo CRM |
| Venda | Valor, item/serviço, responsável, status e vínculo existentes do CRM |
| Pós-venda/chamado | Pode vincular uma venda específica; histórico independente de nova pré-venda |
| Contexto e revisão | Valor, origem, fontes, autor, versão e timestamps |
| Métrica e dashboard | Definição versionada e autorização dos dados de origem |
| Importação | Origem, entidade externa, checkpoint, erro e resultado reconciliável |

Não criar dois cadastros mestres de pessoa dentro da mesma empresa. Contato provisório pode se vincular depois ao cliente existente, sem copiar suas conversas. Manter compatibilidade dos campos atuais `phone_mobile` e `phone_secondary` enquanto páginas antigas os utilizarem; definir explicitamente quem é a fonte de verdade e como evitar divergência.

Normalização telefônica não pode apagar evidência do original. Tratar DDI, variações históricas, contatos com números compartilhados e mudança de titular. Telefone sozinho não autoriza fusão irreversível. Quando houver conflito de identidade, exibir revisão/associação manual e registrar decisão. Nunca deduplicar pessoas de empresas diferentes em uma entidade global acessível a ambas.

IDs externos devem ter unicidade no escopo adequado, por exemplo empresa + provedor + canal/conta + ID externo, conforme contrato do provedor. Conferir alcance real dos IDs antes de definir constraints.

Valores monetários em decimal exato ou centavos com moeda definida; nunca float para cálculo financeiro. Datas operacionais em UTC, exibição e agregação conforme timezone da empresa. Filtros por dia devem considerar mudança de timezone e horário comercial.

## 8. Experiência e navegação

### 8.1 Princípios

- Atendimento abre como principal espaço do consultor.
- Ações frequentes ocorrem por painel lateral ou drawer, preservando conversa, scroll e rascunho.
- Páginas completas continuam disponíveis por link direto, inclusive para rotinas administrativas e uso sem conversa.
- Obrigatórios primeiro, Jurídico e Opcional em grupos expansíveis; preservar regras atuais.
- IA sugere; cadastro, venda, transferência e alterações relevantes mostram claramente seu resultado e autoria.
- Não esconder informação de validação apenas em toast. Erro aparece no campo e em resumo acessível.
- Distinguir vazio, carregando, sem acesso, módulo indisponível, erro e ausência de dados.
- Interface inteiramente em português; datas, moeda e números em formato local.

### 8.2 Navegação proposta

Itens exibidos de acordo com papéis e módulos:

| Área | Conteúdo |
| --- | --- |
| Atendimento | Meus, equipe, IA, filas, retornos, conversas e campanhas autorizadas |
| Clientes | Busca, cadastro completo, telefones, histórico e relacionamentos |
| Comercial | Análises, pré-vendas, vendas, leads e rotinas atuais |
| Jurídico | Fluxos e responsabilidades existentes |
| Financeiro | Recebimentos, valores e relatórios existentes |
| Dashboards | Meu desempenho, atendimento, vendas, financeiro, equipe e empresa |
| Produtividade | Visão geral, equipes, pessoas, jornada, aplicativos/sites e relatórios |
| Academia | Cursos disponíveis, progresso e atribuições |
| Configurações | Empresa, equipe, canais, IA, integrações, dispositivos e permissões |
| Plataforma | Apenas master: empresas, módulos, limites, saúde e configuração comercial |

Não remover uma rota antiga até que sua capacidade esteja preservada, os links tenham destino adequado e a paridade esteja documentada.

### 8.3 Sistema visual

Referência inicial: aplicação sóbria, legível e compacta; tipografia sem serifa, ícones de linha, borda leve, espaçamento consistente, poucos níveis de sombra. Nome NewSec provisório.

Tokens sugeridos, a ajustar à identidade aprovada:

| Token | Claro | Escuro |
| --- | --- | --- |
| Background | #F6F8FB | #0B1220 |
| Surface | #FFFFFF | #111B2D |
| Text primary | #15243B | #E7EEF8 |
| Text secondary | #64748B | #9CACBF |
| Border | #E2E8F0 | #26344B |
| Primary | #2563EB | #6094FF |

Tokens semânticos em CSS, não cores espalhadas em componentes. Tema claro, escuro e preferência do sistema; persistência por usuário com fallback local, sem flash de tema. Verificar contraste de combinações reais. Não usar somente cor para status. Foco visível, teclado, labels, aria e acessibilidade dos dialogs. Respeitar redução de movimento.

Alvo principal desktop 1440×900 e 1920×1080. Em 1280px, reduzir menu e tornar painel do cliente recolhível. Em tablet/celular, usar lista → conversa → contexto com navegação consistente. Evitar quatro colunas espremidas e scroll horizontal da página.

## 9. Telas de referência e especificação funcional

As dez imagens são direções visuais, não layouts já implementados. Salvar as imagens anexadas em `docs/reference-images/` se disponíveis; se o agente não conseguir acessá-las, usar esta especificação e registrar a ausência, sem fingir ter visto os arquivos.

### Tela 01 — Atendimento claro

Quatro regiões: menu global; lista de conversas; conversa; contexto do cliente. Larguras adaptáveis: menu 176–208px, lista 272–320px, contexto 320–380px e conversa ocupando o restante. Preferir mínimo de 420px para a conversa antes de recolher painel.

Lista: busca, abas Meus/Equipe/IA, filtros combináveis de canal, equipe, responsável, estado e espera; paginação por cursor e ordenação estável. Mostrar nome, trecho, última atividade, responsável, canal, contagem de não lidas e indicador de espera.

Conversa: identidade, canal, responsável, estado humano/IA, transferir, concluir/reabrir; mensagens, anexos, áudios e notas internas diferenciadas; compositor fixo com rascunho, upload, áudio e envio. Persistir envio pendente antes de depender do provedor; mostrar estados e erro recuperável. Não confundir API aceitar o envio com entrega ao destinatário.

Contexto: cadastro ou contato provisório, telefones vinculados, resumo de pré-venda, pós-venda, vendas, informações coletadas/faltantes, última atualização e fontes. Ações Gerar análise, Cadastrar cliente, Criar pré-venda e Atualizar contexto. Ações bloqueadas explicam o requisito real; uma ação pode abrir um drawer para completar dados.

### Tela 02 — Atendimento escuro

Mesmo comportamento e hierarquia da Tela 01. Cobrir mensagens, formulários, menus, calendário, gráficos, editor, upload e todos os estados. Não aceitar tema parcial que apenas troca o fundo.

### Tela 03 — Ações no chat e pré-venda

Drawer com rascunho preservado, campos sugeridos pela IA identificados e campos obrigatórios conforme schema atual. O mockup simplifica os campos; a implementação deve listar os campos reais e as seções atuais do CRM.

Ao gerar análise sem cliente, reutilizar o fluxo já suportado. Ao cadastrar cliente, mostrar somente faltantes obrigatórios primeiro, permitir revisar preenchidos e reutilizar validação no servidor. Ao criar pré-venda, vincular cliente/análise corretos; falhar com orientação clara se faltar requisito. Salvar e voltar à mesma conversa sem reload completo.

Disponibilizar equivalente manual acessível em Comercial/Clientes e ação Registrar ligação. Um registro de ligação contém autoria, momento, observações e vínculo quando existir; não exige mensagem WhatsApp fictícia.

### Tela 04 — Supervisão

Fila operacional com estado, tempo de espera, canal, setor, responsável e ação. Visão da carga dos cinco consultores com conversas ativas, pendências, maior espera, disponibilidade e capacidade configurável. Não usar só quantidade bruta como recomendação de transferência.

Transferência individual e distribuição com escopo autorizado, validação de destino, motivo opcional e auditoria. Atribuições concorrentes precisam ser atômicas para evitar dois consultores assumindo simultaneamente. Não mover silenciosamente atendimento durante edição/envio sem feedback.

Abas para humanos, IA, automações e disparos; campanhas com progresso, pausa e falhas reais. Treinar equipe abre avaliação com período, cobertura da amostra, fontes e recomendações, nunca um ranking sem evidência.

### Tela 05 — Gestão e dashboards padrão

Visões para gerente e versões de escopo para consultor/supervisor. Filtros globais período/empresa/equipe/canal/consultor, aplicados consistentemente. Cards clicáveis abrem registros que explicam o número quando autorizado. Distinguir contratado, vendido, recebido, pendente e cancelado.

Dashboards iniciais: meu desempenho, fila/atendimento, funil comercial, vendas/financeiro, equipe/empresa e produtividade. Comparação de períodos equivalentes, data de atualização, definição do indicador e tratamento de amostra pequena.

### Tela 06 — Produtividade

Focus completo como área do produto. Preservar todos os indicadores e filtros existentes por inventário, não limitar aos poucos cards do mockup.

Cobrir previsto, ativo, produtivo, neutro, improdutivo, ocioso, cobertura, sem dados, fora da jornada, aplicativos/sites, ritmo, dispersão e detalhes por pessoa/equipe quando existentes. Manter coerência entre cards, gráficos e tabelas usando a mesma base de cálculo. Dispositivos, matrícula e horários em Configurações, sem remover funcionalidades necessárias.

Não equiparar atividade no computador a resultado comercial; exibir indicadores em dimensões distintas. Mostrar atraso de ingestão e ausência de dados sem classificá-los automaticamente como ociosidade.

### Tela 07 — Cliente completo

Página com identificação, telefones, responsáveis, status e ações. Abas Visão geral, Atendimentos, Análises, Pré-vendas, Vendas, Pós-venda, Documentos e Histórico, adaptadas às capacidades reais.

Linha do tempo unifica referências a eventos sem duplicar entidades. Cada venda pode abrir seus próprios chamados de pós-venda. Campos/resumos editáveis com histórico de autoria. Exibir registros manualmente criados por telefone e importados do Totalk com origem visível.

### Tela 08 — Plataforma/master

Listagem de empresas com situação, usuários, canais, módulos e consumo. Drawer de edição: plano/oferta, desconto informativo, capacidades contratadas e limites. Permitir várias empresas sob o mesmo dono por vínculos, sem deduzir isolamento pelo dono.

Ativar/desativar empresa com consequência claramente descrita. Mostrar saúde técnica e consumo agregado, sem exibir conteúdo privado de atendimentos por padrão. Gerenciamento de credenciais compartilhadas revela concessões, não o segredo.

### Tela 09 — Editor de dashboards

Catálogo de indicadores autorizados à esquerda, grade de cards ao centro, configuração à direita. Arrastar/redimensionar com alternativa por teclado; título, período, filtro, formato, tamanho e permissões de compartilhamento.

Salvar rascunho, visualizar, publicar configuração e restaurar padrão. Mudanças não devem alterar dashboard de toda a empresa sem escopo explícito. Fórmulas por catálogo validado, não SQL ou JavaScript livre. A implementação completa pertence à evolução após o lançamento operacional.

### Tela 10 — Academia

Catálogo e Meu aprendizado. Filtros obrigatórios/disponíveis/concluídos, progresso e retomada. Cursos padrão da plataforma e cursos com distribuição por empresa, equipe/setor e pessoa. Tela administrativa para atribuições, datas e acompanhamento conforme permissão. Reutilizar conteúdo, provas e progresso existentes antes de evoluir autoria de cursos.

## 10. Atendimento: estados, eventos e concorrência

Separar dimensões que hoje podem estar misturadas:

- Estado da conversa: aberta, em atendimento, resolvida etc., conforme mapeamento existente.
- Modo de atendimento: humano, IA, automação.
- Responsável e equipe.
- Última mensagem significativa e quem precisa responder.
- Leitura/não lida por regra documentada.
- Retorno agendado e sua data.

Definir formalmente aguardando consultor, aguardando cliente, novo não atendido, não lido, sem responsável e retorno vencido. Uma nota interna, evento de sistema, importação ou mensagem de campanha não deve resetar todos os relógios indevidamente. Não contar resposta automática como primeira resposta humana; exibir métricas distintas.

Criar uma tabela de transições com evento de entrada, estado anterior, permissão, efeito, prazo e evento de saída. Reutilizar a máquina de estados atual quando correta. Preservar semânticas dos filtros existentes ou documentar mudança/migração.

Confiabilidade de mensagens:

1. Gerar ID/idempotency key de operação no cliente ou servidor conforme desenho.
2. Validar usuário, empresa, canal, módulo, conversa e anexos.
3. Registrar mensagem/estado pendente e intenção durável de processamento.
4. Enfileirar de forma recuperável; adotar outbox ou reconciliação para falha entre commit e enqueue.
5. Worker realiza envio pelo adapter; retry depende da certeza sobre o resultado, evitando reenvio cego após timeout ambíguo.
6. Webhooks atualizam estado de forma idempotente e tolerante a repetição/ordem invertida.
7. Cliente reconcilia mensagem otimista pelo ID estável, sem duplicar bolhas.

Não prometer exatamente uma entrega quando o provedor não oferece garantia; prevenir duplicatas controláveis e expor falhas ambíguas para reconciliação.

Anexos privados com autorização de leitura, limites de tipo/tamanho, upload direto quando adequado e URLs temporárias; não guardar links públicos do Totalk como única cópia do acervo que precisa sobreviver ao cancelamento.

## 11. IA, contexto, análise e treinamento

### 11.1 Contexto estruturado

Modelo conceitual de campo: chave, valor, status de confirmação, origem manual/IA/importação, IDs de mensagens fonte, confiança quando útil, quem alterou, versão e data.

Gerar proposta estruturada validada por schema. Não usar JSON arbitrário da IA diretamente como atualização de registro. Campo ausente permanece ausente; não inventar CPF, renda, data, valor ou documento.

Atualizar contexto considera resumo anterior e delta desde o último checkpoint. Varredura integral fica como opção explícita/reprocessamento e deve lidar com histórico longo por lotes. Salvar watermark de mensagens e versão do resumo. Debounce/coalescer mensagens próximas, cancelar job obsoleto quando possível, impedir duas execuções de gravarem em ordem errada.

Preservar campos manuais confirmados. Se a IA detectar divergência, oferecer proposta com fonte; não sobrescrever silenciosamente. Exibir atualização em andamento, sucesso, erro e última cobertura. Contexto pode continuar útil sem chamadas de IA quando não houver credencial.

Separar resumo geral, pré-venda por oportunidade quando necessário, pós-venda por venda/chamado e fatos cadastrais. Um cliente pode comprar novamente enquanto recebe suporte de venda anterior. Não classificar todo o histórico após a primeira venda como pós-venda.

### 11.2 Análise

Gerar análise prepara dados e aciona o motor determinístico existente para cálculos. IA pode extrair e explicar; não substitui fórmula financeira validada. Mostrar faltantes, unidade, fonte e revisão antes de gravar. Permitir iniciar análise manual sem cliente/conversa conforme CRM.

### 11.3 Áudio e arquivos

Transcrever áudio recebido e áudio enviado pelo consultor. Envio ao cliente não aguarda transcrição. Job separado por mensagem/arquivo/modelo/versão, com estado pendente/processando/concluído/falha/não aplicável.

Manter autoria e direção: transcrição de saída não é nova mensagem recebida e não deve disparar resposta da IA para si mesma. Exibir transcrição retrátil e possibilidade de corrigir texto usado no contexto, preservando original. Repetição de webhook ou retry não pode multiplicar cobranças desnecessárias.

Não confundir imagem descrita, arquivo PDF recebido e texto realmente extraído. Se extração de PDF for implementada, ter limites, parser seguro, OCR apenas quando necessário e indicação de páginas/fonte. Não afirmar que um documento foi lido quando só existe seu nome.

### 11.4 Atendimento automático

Reaproveitar configuração e handoff do Chat. Aquisição de atendimento por humano deve impedir jobs atrasados de enviarem uma resposta da IA. Revalidar modo e permissão imediatamente antes de enviar. Cliente pode pedir humano; encaminhamento precisa ser visível na fila.

Mensagens e documentos do cliente são dados não confiáveis, não instruções de sistema. Ferramentas da IA têm permissões limitadas e schemas; nenhuma mensagem autoriza exportar dados de outra empresa, revelar segredos ou executar SQL. Gravações de venda/cadastro usam funções de domínio e suas validações.

### 11.5 Treinar IA e treinar consultores

Manter sugestões de melhoria da IA como propostas revisáveis e versionadas. Não reescrever automaticamente o prompt de atendimento ao analisar conversas.

Treinamento de equipe: período padrão últimos sete dias, baseado em atividade no período e não apenas na data de abertura da conversa. Incluir amostragem representativa, partes relevantes do fim da conversa e autoria real após transferências. Evitar avaliar só as primeiras mensagens ou atribuir toda conversa ao último responsável.

Resultado: resumo da equipe, cobertura/amostra, pontos fortes, oportunidades por consultor, exemplos vinculados, ações sugeridas e comparação com critério explícito. Temas: resposta, clareza, argumentação, coleta de informações, próximos passos, passagem entre equipes e resolução. Separar tempos fora do expediente e espera pelo cliente. Permitir revisão e contestação; não apresentar inferências como fatos ou notas determinísticas.

Execução assíncrona, cache por período/escopo/versão/dados, orçamento e progresso. Consultor só acessa avaliação própria quando autorizado; supervisor só das equipes permitidas.

## 12. Indicadores e dashboards

Antes de construir cards, criar catálogo de métricas com ID, nome, definição, fonte, escopo, unidade, granularidade, timezone, campo de data, filtros, denominador, exclusões, política de nulos e versão.

Inventariar 100% dos indicadores existentes no Focus e CRM. Para cada um marcar origem, fórmula, destino, teste e status. Nenhum indicador pode desaparecer por não caber na primeira tela.

Conjunto inicial adicional:

- Atendimento: entradas, conversas ativas, sem responsável, novos não atendidos, aguardando humano, aguardando cliente, não lidas, retornos vencidos, primeira resposta humana, resposta da IA, tempo de resolução, backlog por idade e transferências.
- Equipe: carga atual, disponibilidade, SLA dentro do expediente, distribuição e conversas efetivamente atendidas por pessoa.
- Comercial: análises, pré-vendas, vendas, cancelamentos, ticket médio e conversões com definição de coorte.
- Financeiro: vendido, recebido, a receber e vencido usando a fonte financeira do CRM.
- IA: volume assistido/automático, handoffs, erros, latência, consumo e custo estimado.
- Focus: catálogo integral preservado, incluindo dados ausentes, múltiplos dispositivos e jornada.

Mediana e p90 são úteis para tempos, além da média; não calcular percentis a partir da média de grupos. Resultados atribuídos ao consultor devem ter regra para coautoria/transferência e não duplicar o total da empresa.

Conversão: `vendas / contatos` só representa porcentagem de pessoas convertidas se numerador e denominador forem coortes compatíveis e pessoas únicas. Várias vendas por pessoa podem gerar uma razão maior que 100%; rotular como vendas por contato ou usar contatos com ao menos uma venda. Mostrar a definição escolhida. Divisão por zero retorna sem dados, não infinito.

Construtor de fórmulas avançado:

- Catálogo permitido de métricas, operações e funções simples.
- Parser para AST validada; nunca eval, JavaScript ou SQL livre.
- Tipos/unidades e granularidades compatíveis.
- Limites de complexidade, custo, período e quantidade de séries.
- Autorização aplicada a cada métrica, inclusive fórmulas derivadas e exportação.
- Configuração versionada, layout responsivo, filtro global e overrides visíveis.
- Defaults profissionais por papel; personalização não é requisito para trocar o Totalk.

## 13. Focus: integração completa

Preservar agente Windows, fila local, matrícula, ingestão, agregados, classificação de aplicativos, jornada, retenção, filtros, exportações e detalhes existentes. Portar a interface sem perder o pipeline.

Mapear colaborador do Focus ao usuário operacional quando houver correspondência; permitir colaborador sem login se já suportado. Empresa/equipe canônicas precisam chegar à ingestão sem depender de um parâmetro não autenticado do dispositivo.

Validar intervalos sobrepostos e múltiplos dispositivos: um minuto da mesma pessoa não vira dois minutos de jornada. Fora de jornada, ausência de dados e ociosidade são categorias distintas. Consultas de dashboard usam agregados adequados, não varredura de toda telemetria bruta.

Preservar limites de coleta existentes: não acrescentar conteúdo digitado, capturas de tela ou conteúdo de conversas ao Focus. Rever suspensão tanto no servidor quanto na configuração propagada ao agente. Buffer offline não pode continuar coletando indefinidamente se a política exige suspensão; documentar comportamento e teste específico.

Não reimplementar o agente em JavaScript nem colocá-lo dentro do deploy web. Se o ambiente não puder compilar/testar Windows, reportar essa lacuna e preparar validação na máquina apropriada.

## 14. Migração Totalk

Documentação oficial: https://flwchat.readme.io/. Revalidar endpoints, paginação, autorização, rate limit e resposta real no momento de implementar. A análise da documentação indica caminho possível; completude de históricos e anexos precisa de amostra autorizada.

Pontos encontrados na documentação, sujeitos a revalidação:

| Entidade | Endpoint documentado |
| --- | --- |
| Contatos | `GET https://api.wts.chat/core/v1/contact` |
| Sessões | `GET https://api.wts.chat/chat/v2/session` |
| Mensagens da sessão | `GET https://api.wts.chat/chat/v1/session/{id}/message` |
| Notas da sessão | `GET https://api.wts.chat/chat/v1/session/{id}/note` |

Também inventariar usuários, departamentos, canais, tags, campos personalizados, carteiras, agendamentos, automações e outros objetos efetivamente utilizados. Não afirmar suporte a exportação de um objeto só porque seu nome aparece no menu.

Contatos têm estados ativo/arquivado/bloqueado; consultar apenas o padrão pode omitir registros. Sessões incluem estados encerrados/ocultos, responsáveis, departamentos e timestamps. Mensagens distinguem direção, autor, tipo, status, origem e arquivos. Notas devem permanecer internas. Alguns detalhes de mídia incluem URLs de arquivo/download e transcrição; validar disponibilidade real.

A documentação consultada indicava paginação até 100 itens e limites de 1.000 requisições/5 minutos por conta, com limite adicional de rajada. Revalidar antes de usar, respeitar Retry-After quando presente e 429 com backoff/jitter. Planejar margem para a operação que ainda estará rodando no Totalk; não consumir todo o limite na importação.

Etapas:

1. Inventário read-only autorizado e amostra: dois canais, contato com vários atendimentos, conversa antiga, áudio, arquivo, nota interna, transferência, contato arquivado e mensagem deletada quando existente.
2. Definir mapeamento, fusão de contatos, vínculo ao CRM, exclusões e política de histórico.
3. Implementar dry-run: contagens, estimativa de mídia, conflitos e custo/tempo aproximado, sem escrever nas tabelas operacionais.
4. Importação inicial em homologação, com IDs externos, checkpoints, checksum de arquivos e timestamps originais.
5. Reconciliar contagens por canal/período/entidade; explicar diferenças documentadas. Conferir amostra visual de início/meio/fim e acesso aos arquivos copiados.
6. Importação inicial autorizada no destino de produção com feature flag e sem efeitos de atendimento.
7. Capturar delta por UpdatedAt/janela sobreposta e IDs; não confiar só no horário de criação. Avaliar registros alterados/deletados conforme API permite.
8. Cutover: definir instante, responsáveis, mecanismo de conexão, drenagem de fila, último delta e reconciliação de eventos durante a troca.
9. Validar os dois números e os cinco consultores no novo fluxo, com envio/recebimento autorizado e verificação de mídia.
10. Arquivar evidências e executar encerramento do Totalk somente após aceite operacional de Gabriel.

Toda importação deve ser idempotente, retomável e auditável. Erros ficam em relatório/retry controlado, sem ignorar silenciosamente uma página. Um import replay não pode enviar mensagem, disparar IA, abrir campanha, gerar cobrança de transcrição ou alterar SLA atual como se fosse entrada nova. Registrar `origin=import` ou equivalente e aplicar isso nos processadores.

Copiar histórico não migra a sessão WhatsApp. Validar se credenciais/sessão atual são transferíveis; não presumir. Pode ser necessário novo pareamento. Evitar dois processos concorrentes respondendo ao mesmo número. Documentar comportamento de mensagens durante a janela de troca e alternativa de rollback; rollback do banco e rollback da conexão são operações diferentes.

Substituir também as chamadas Totalk do CRM para ler anotações e enviar PDFs. Não cancelar o serviço enquanto uma rotina importante ainda depende dele.

## 15. Desempenho, custo e observabilidade

Metas iniciais propostas, a medir em homologação com configuração e amostra registradas, não promessas contratuais:

- Feedback visual local ao enviar mensagem: até aproximadamente 100ms.
- Persistência/aceite interno p95 abaixo de 800ms em condições normais; latência de provedor medida separadamente.
- Alternar conversa já carregada sem full reload e com resposta perceptível abaixo de 300ms quando cache válido.
- Primeira tela útil do atendimento p95 até 2s na rede de teste definida.
- Dashboard agregado comum p95 até 2s para o volume inicial representativo.

Medir antes de otimizar e ajustar metas pela infraestrutura real. Não usar `sent` como sinônimo de entregue.

Práticas:

- Paginação por cursor para histórico e filas; índices guiados por consultas reais e EXPLAIN em homologação.
- Ordenação determinística por timestamp + ID, seleção apenas das colunas necessárias e ausência de N+1.
- Realtime por escopo pertinente; não recarregar a aplicação inteira em toda mensagem da empresa.
- Cache separado por empresa/usuário/permissão/filtro; invalidação explícita e descarte ao trocar empresa.
- Agregados e jobs incrementais para dashboards e Focus; limitar cardinalidade de filtros caros.
- Virtualização quando volume justificar, sem prejudicar navegação acessível.
- Jobs de contexto por delta, dedupe, cache de transcrições e controle de concorrência por empresa.
- Filas com retry limitado, backoff, dead-letter/estado de falha e reconciliação.
- Logs estruturados por correlation ID, empresa e operação, sem segredos ou corpo de conversa por padrão.
- Painel operacional com fila pendente, mensagem mais antiga, falhas, webhook atrasado, canal desconectado, latência e consumo.
- Arquivos com retenção definida, custos de storage/egress observados e limpeza de uploads órfãos.
- Adiar bibliotecas pesadas e não carregar editor de dashboard/relatórios no bundle inicial do chat.

Não usar polling agressivo como única estratégia permanente se Realtime já existe. Fallback de reconexão deve ser conservador e observável.

## 16. Segurança e integridade como requisitos de implementação

Foco nos riscos concretos deste produto: cruzamento entre empresas, perda/duplicação de mensagem, exposição de anexos, credenciais, regressão de regra financeira e dano a dados existentes.

- Aplicar autorização em servidor e RLS; testar acesso direto a IDs alheios.
- Webhook autenticado de acordo com o mecanismo efetivamente oferecido pelo provedor; se inexistente, documentar compensação e risco, não inventar assinatura.
- Validar entradas com schemas reutilizados e consultas parametrizadas.
- Autorização de download não depende apenas de conhecer a URL.
- Logs de mudança em responsáveis, contextos, cadastro, venda, plano, credencial e importação.
- Proteção contra lost updates usando versão/updated_at quando múltiplos editores atuam no mesmo registro.
- Backups e restauração ensaiada antes do corte; registrar RPO/RTO pretendidos e limitações reais.
- Exportações respeitam o mesmo escopo dos dashboards.
- Feature flags de lançamento separadas de entitlements comerciais.

## 17. Fases de implementação

### Fase 0 — Inventário e baseline

Entregas: SHAs, stack/lockfiles, execução do baseline possível, mapa de rotas/regras/dados, paridade de funções, matriz de permissões, catálogo inicial de métricas, arquitetura e riscos concretos.

Registrar comandos realmente executados, resultados e falhas preexistentes. Se faltar banco/env, diferenciar não executado de falhou. Não instalar versões latest indiscriminadamente. Ler AGENTS.md/CLAUDE.md existentes antes de editar e não substituí-los sem incorporar instruções válidas.

Critério: todos os domínios existentes têm origem e destino propostos; divergências relevantes estão registradas; plano não depende de migração destrutiva do CRM.

### Fase 1 — Base unificada e sistema visual

Implementar shell do CRM com navegação proposta, claro/escuro, componentes fundamentais, preservação de rotas e primeira tela de atendimento navegável com dados sintéticos em modo de demonstração explícito. Implementar drawer de ações e estados de loading/vazio/erro sem simular backend concluído.

Preparar modelo de identidade/empresa/permissão e migrações aditivas em homologação quando disponível; sem ambiente, produzir SQL e testes aplicáveis e registrar a execução pendente. Reutilizar auth CRM; não inventar troca de empresa funcional sem validar vínculos.

Critério: CRM continua compilando e seus fluxos críticos preservados; chat visual usável em desktop e tema escuro; dados fictícios não aparecem como produção; restrições de acesso planejadas e aplicadas às novas operações já funcionais.

### Fase 2 — Chat humano integrado

Portar pipeline do Chat para identidades canônicas. Receber/enviar, mídia, áudio, notas, filas, transferência, retomada/reabertura, histórico, draft, estado de entrega, busca e conexão dos canais. Integrar contatos e vínculos ao CRM. Preservar retorno/follow-up, campanhas e demais capacidades existentes por mapa de paridade; o que for necessário à operação atual entra antes do corte.

Critério: uma fatia ponta a ponta funciona com adapter de teste e depois canal real autorizado; retry/webhook duplicado não duplica mensagem; permissões e isolamento comprovados.

### Fase 3 — CRM dentro do atendimento + IA essencial

Análise, cadastro e pré-venda em drawers usando regras atuais; ligação/manual; contexto editável com fontes; atendimento IA/handoff conforme uso atual; transcrição recebida e enviada; envio de PDFs via novo canal; pré/pós-venda e vendas vinculadas.

Critério: consultor conclui o fluxo principal sem perder conversa; dados obrigatórios são respeitados; IA não sobrescreve confirmação manual nem responde após handoff; operação humana funciona sem IA.

### Fase 4 — Migração, piloto e corte Totalk

Dry-run, importação em homologação, delta, reconciliação, ensaio operacional, guia da equipe e runbook de corte/rollback. Implantação progressiva somente autorizada. Os dois canais e cinco consultores devem participar de verificação operacional compatível com a operação.

Critério: checklist de go/no-go abaixo aprovado; nenhum fluxo essencial ainda chama Totalk; arquivos e históricos requeridos disponíveis; plano de conexão e recuperação validado.

### Fase 5 — Focus completo e dashboards

Incorporar todos os indicadores, pipeline e agente do Focus, papéis multi-equipe, dashboards de consultor/supervisor/gerente e catálogo de métricas. Caso possível sem atrasar o caminho crítico, antecipar o inventário e fundação de agregação; não bloquear o corte por editor de layout.

Critério: paridade integral de indicadores documentada, equivalência dos cálculos, dados ausentes e multi-dispositivo corretos, pipeline testado além da tela.

### Fase 6 — Produto SaaS ampliado

Editor de dashboards/formulas, treinamento de equipe, distribuição avançada de cursos, refinamentos de plano/limites, relatórios e otimizações orientadas por uso. Capacidade completa continua no backlog até entregue, não desaparece ao concluir MVP.

Critério: testes e aceites específicos do domínio; publicar cada capacidade independente via feature flag quando fizer sentido.

## 18. Gate para substituir Totalk

Não usar prazo como motivo para marcar item não testado como pronto.

- [ ] Receber/enviar texto nos dois números autorizados.
- [ ] Arquivos, PDFs, áudio recebido e enviado disponíveis; estados de falha recuperáveis.
- [ ] Consultores conseguem assumir, transferir, concluir e retomar conforme permissão.
- [ ] Não há dupla resposta entre humano, IA e sistema antigo.
- [ ] Clientes, análises, pré-vendas, vendas e rotinas jurídicas essenciais preservadas.
- [ ] Anotações e envio de documento antes dependentes do Totalk têm substituto validado.
- [ ] Histórico e mídias necessários reconciliados com diferenças explicadas.
- [ ] Importação repetida/delta não gera mensagens nem ações automáticas.
- [ ] Isolamento de empresas, equipes, arquivos e Realtime validado.
- [ ] Worker, filas, canais e alertas operacionais funcionando.
- [ ] Backup, rollback e responsáveis documentados e ensaiados no possível.
- [ ] Equipe consegue executar roteiros reais em piloto.
- [ ] Gabriel autoriza o corte e depois o cancelamento, avaliando o resultado operacional.

## 19. Testes e critérios de qualidade

Concentrar testes nos riscos; evitar testar detalhes que apenas espelham a implementação.

| Camada | Casos essenciais |
| --- | --- |
| Domínio CRM | Requisitos preservados, cálculo determinístico, pré-venda com cliente, análise sem cliente quando permitida |
| Permissões | Duas empresas, gerente multiempresa, supervisor multiequipe, IDs de terceiros, storage e exportação |
| Chat | Webhook duplicado/fora de ordem, timeout ambíguo, retry, concorrência de atribuição, handoff e anexos |
| IA | Schema inválido, dados ausentes, edição manual protegida, job obsoleto, credencial correta e falha/cota |
| Importação | Dry-run, repetição, retomada, delta, notas internas, mídia, timestamps e efeitos colaterais desligados |
| Métricas | Timezone, expediente, transferência, divisão por zero, coorte, cancelamento, duplicação de dispositivos |
| UI/E2E | Login, troca de empresa, enviar, cadastrar, analisar, pré-venda, transferência, temas e responsividade |

Usar os comandos do projeto, corrigindo scripts incompatíveis com a versão real quando necessário. Não assumir que um script `lint` herdado funciona só porque existe. Build sem testes de fluxo não prova integração; mock sem canal real não prova transporte WhatsApp.

Para cada fase registrar o que foi validado, em qual ambiente, com qual amostra e quais dependências externas ficaram pendentes. Não alegar testes executados com base em README de outro projeto.

## 20. Como trabalhar com Claude Code e Codex

Manter um executor por conjunto de arquivos/branch e usar o outro assistente para revisão de diffs, segurança do isolamento e decisões difíceis. Não deixar dois agentes editando simultaneamente os mesmos arquivos sem coordenação explícita. Não é obrigatório usar agentes paralelos.

Criar instruções curtas em `CLAUDE.md` e `AGENTS.md`, preservando conteúdo existente, com referências aos documentos centrais. Não duplicar esta especificação inteira nos dois arquivos. Manter `docs/PROGRESS.md` como checkpoint portátil.

Em cada ciclo:

1. Ler checkpoint, diff local, branch, instruções e tarefa atual.
2. Escolher uma entrega vertical pequena com critério de aceite.
3. Inspecionar apenas arquivos relevantes e reutilizar contratos existentes.
4. Implementar, validar riscos relevantes e revisar diff.
5. Registrar decisões e pendências concretas.
6. Criar commit local coerente quando autorizado pelo fluxo, sem segredos; não sobrescrever mudanças de Gabriel.
7. Informar resumo objetivo com arquivos, comportamento, testes e próxima tarefa.

Não depender de um futuro “continuar” recuperar contexto da conversa. Checkpoint deve conter:

```text
Fase e tarefa atual:
Branch e commit base:
Mudanças concluídas:
Arquivos relevantes:
Migrações criadas/aplicadas e ambiente:
Comandos executados e resultados:
Pendências externas reais:
Decisões tomadas e justificativa:
Próximo passo executável:
Cuidados de compatibilidade:
```

Não refatorar por estilo todo o CRM no mesmo ciclo da integração. Não introduzir dependências só para reproduzir aparência de um mockup. Perguntas ao dono devem se limitar a decisões de negócio realmente bloqueantes; proponha default e continue trabalho independente.

## 21. Primeira execução: sequência exata

1. Leia este documento integralmente e as imagens acessíveis.
2. Localize checkout atual e instruções do workspace; examine `git status` antes de qualquer edição.
3. Inspecione os três repositórios em modo de leitura e registre SHAs.
4. Se ainda não houver novo checkout, prepare cópia local derivada do CRM preservando Git; não publique novo remoto sem a configuração/autorização necessária.
5. Rode baseline possível sem tocar produção. Reporte falhas preexistentes separadamente.
6. Produza os documentos da Fase 0 com inventário real, decisões e ordem de implantação. Não se limite a repetir este texto.
7. Implemente Fase 1: tokens de tema, shell, navegação, componentes de layout, atendimento demonstrativo e drawer mantendo páginas do CRM.
8. Prepare fundação de acesso/dados proporcional às operações novas. Não crie infraestrutura vazia excessiva para todo o backlog.
9. Valide build/tipos e regressões relevantes; verifique telas em navegador se disponível.
10. Atualize checkpoint e entregue resultado revisável com instrução de como abrir a demonstração e o que permanece simulado.

Não execute as fases 2–6 automaticamente neste primeiro ciclo. Termine a entrega acordada com estado claro; a continuidade deve usar a próxima fase e o checkpoint. Isso delimita o lote de trabalho, não exige aprovação para cada alteração pequena dentro dele.

## 22. Regras para resolver conflitos e dúvidas

Ordem de autoridade: instrução atual de Gabriel → regras de negócio confirmadas no CRM → esta especificação → imagens conceituais → convenções preferidas do agente. Reportar conflito que possa alterar dados ou direitos, sem ocultar divergência.

Decisões a confirmar no momento em que bloquearem implementação externa: nome/visibilidade do novo repositório, domínio, ambiente de homologação, infraestrutura de worker/Redis/conector, uso real de campanhas/automação no Totalk, volume/retencão de mídia, configurações de expediente, quais usuários podem ver financeiro e janela de corte. Não é necessário perguntar tudo antes de iniciar Fases 0 e 1.

Resultado esperado do agente: código incremental reaproveitado, documentação consistente, testes honestos e uma interface coerente com as imagens, preservando dados e funções. Entregar o sistema funcionando por partes verificáveis, não apenas uma coleção de telas.

## Anexo A — Contratos técnicos de referência

Estes contratos descrevem responsabilidades. Adapte assinaturas aos serviços existentes antes de criar novas abstrações. Não substituir o schema do CRM por estes exemplos.

### A.1 Contexto autorizado

```ts
type AuthorizedContext = {
  authUserId: string;
  companyId: string;
  membershipId: string;
  permittedTeamIds: readonly string[];
  permissions: ReadonlySet<string>;
};

// Resolvido no servidor a partir da sessão e dos vínculos persistidos.
// Não aceitar um objeto equivalente enviado pelo navegador como prova de acesso.
async function requireContext(input: {
  companyId: string;
  permission: string;
  resource?: { kind: string; id: string };
}): Promise<AuthorizedContext>;
```

A empresa selecionada é uma entrada a validar. Acesso à empresa inteira deve ser capacidade explícita, não inferido de `permittedTeamIds` vazio. Diferenciar sem equipes de acesso irrestrito. Master não deve ser convertido implicitamente em gerente de todas as empresas.

### A.2 Provedor de mensagens

```ts
type SendRequest = {
  companyId: string;
  channelId: string;
  conversationId: string;
  messageId: string;
  operationId: string;
  recipientExternalId: string;
  kind: 'text' | 'audio' | 'image' | 'document';
  text?: string;
  attachmentId?: string;
};

type SendOutcome =
  | { status: 'accepted'; providerMessageId: string }
  | { status: 'rejected'; retryable: boolean; code: string }
  | { status: 'unknown'; reconciliationRequired: true };
```

Reutilizar o adapter existente e estender os tipos reais suportados. O worker recebe IDs de anexos, não URLs arbitrárias fornecidas pelo usuário para fetch irrestrito. Resolve arquivo e permissão na empresa correta. `accepted` não significa `delivered`. Quando não houver ID de retorno no contrato real, representar o estado honestamente, sem gerar ID externo falso.

### A.3 Jobs

Envelope recomendado: `jobId`, `kind`, `companyId`, `resourceId`, `requestedBy`, `correlationId`, `idempotencyKey`, `schemaVersion`, `createdAt` e `origin`. Segredos não vão na fila; o processador os resolve no servidor.

Kinds possíveis: enviar mensagem, baixar/processar mídia, transcrever, atualizar contexto, avaliar equipe e importar lote. Não exigir uma fila física por kind; separar prioridades quando necessário. Envio humano tem prioridade operacional sobre análise histórica.

Cada job revalida recurso/empresa, estado atual, direito de uso da capacidade e limites relevantes. A autorização no enqueue não garante que nada mudou até sua execução. Para alterações humanas relevantes, preservar `requestedBy` e registrar resultado.

### A.4 Revisão de contexto

```ts
type ProposedFact = {
  field: string;
  value: unknown;
  sourceMessageIds: string[];
  status: 'suggested';
};

type ContextProposal = {
  conversationId: string;
  baseRevision: number;
  throughMessageId: string;
  facts: ProposedFact[];
  presaleSummary?: string;
  aftersaleSummaries?: Array<{ saleId: string; summary: string }>;
};
```

Validar IDs fonte e vínculos de venda contra a mesma empresa. A IA não escolhe arbitrariamente qualquer `saleId`. Se a proposta estiver baseada em revisão antiga, reavaliar/mesclar com regras explícitas; não substituir a revisão mais nova.

### A.5 Rotas e componentes

Manter rotas existentes do CRM, adicionando equivalentes abaixo apenas onde não existirem. Não criar URLs duplicadas para o mesmo domínio sem estratégia de canonicalização.

| Destino lógico | Exemplo de rota nova | Componentes principais |
| --- | --- | --- |
| Central de atendimento | `/atendimento` | QueueFilters, ConversationList, ConversationView, MessageComposer, CustomerContextPanel |
| Conversa selecionada | `/atendimento/[conversationId]` ou seleção persistida equivalente | Carregamento autorizado, cursor, draft e painel |
| Supervisão | `/atendimento/supervisao` | QueueTable, TeamWorkload, TransferDialog |
| Cliente completo | Reutilizar rota atual de clientes | CustomerHeader, RelatedPhones, CustomerTimeline, DomainTabs |
| Dashboards | `/dashboards` | DashboardFilters, MetricCard, Drilldown |
| Produtividade | `/produtividade` | Views portadas do Focus com filtros canônicos |
| Plataforma | `/plataforma/empresas` | CompanyTable, EntitlementEditor, LimitEditor |

Subrotas de configurações devem preservar padrões do CRM. Não renderizar tudo em uma página gigante nem fazer cada drawer possuir sua própria cópia do schema.

## Anexo B — Ambiente, migrações e execução

### B.1 Configuração

Criar `.env.example` sem segredos, documentando nomes reais existentes antes de propor novos. Separar explicitamente:

- Públicas: URL do Supabase e chave publicável/anon apropriada ao cliente, URL pública do app quando necessária.
- Exclusivas do servidor: service role, conexão administrativa/migração, Redis, credenciais do adapter, segredo de webhook quando oferecido, chave de criptografia e tokens de importação.
- Configuração de produto: origem permitida, timezone padrão, limites, modelos por tarefa, modo demo e flags de rollout.

Não colocar chave OpenAI, service role ou token de canal em variável `NEXT_PUBLIC_*`. As chaves por empresa são cadastradas de forma autorizada no servidor; `.env` não substitui o modelo de concessões multiempresa.

Validar configuração na inicialização com mensagens sem expor valores. App web pode abrir áreas independentes se worker/IA não estiverem configurados, mas deve indicar indisponibilidade e não simular sucesso. Fixtures só podem ser usadas sob modo demo explícito e impedido em produção.

### B.2 Reprodutibilidade

- Manter lockfile canônico da aplicação base e registrar versão de Node compatível.
- Inventariar extensões/cron/Edge Functions necessárias; não depender de configuração invisível feita manualmente.
- Script de setup local documentado com serviços mínimos e dados sintéticos.
- CI executa verificações compatíveis com ambiente sem segredos de produção.
- Dependências exclusivas do agente Windows têm instruções separadas.
- Registrar licenças e origem dos componentes reaproveitados; não copiar credenciais presentes em histórico ou exemplos.

### B.3 Migração compatível

Para cada migração, documentar: objetivo, pré-condições, objetos afetados, locks esperados, backfill, modo de validação, impacto no CRM antigo e estratégia de recuperação. Índices grandes e alterações de constraints podem precisar de implantação em etapas; decidir pelo volume real.

Separar mudanças de schema de scripts de importação longa. Scripts retomáveis registram checkpoint e transação em unidade pequena. Não manter uma única transação de horas enquanto baixa arquivos externos. Erros de mídia não devem apagar contatos importados válidos; registrar pendências e bloquear o aceite de completude quando necessário.

Reversão nem sempre é `down migration`: depois de novos dados escritos, remover tabela/coluna pode perder informação. Preferir rollback de aplicação e desativação da feature quando compatível, conservando dados para reparo posterior.

## Anexo C — Roteiros de aceite para o piloto

### C.1 Consultor

Contato sem cadastro envia mensagem → aparece no canal correto → consultor assume → responde → recebe áudio/documento → atualiza contexto → revisa sugestões → gera análise → completa os obrigatórios reais → cadastra cliente → cria pré-venda vinculada → envia documento → agenda retorno → reabre a mesma conversa sem perder histórico.

Repetir parte do fluxo por ligação registrada manualmente, sem WhatsApp. Repetir com cliente existente usando um segundo número, verificando associação sem duplicar cadastro.

### C.2 Supervisor

Visualiza apenas suas equipes → identifica conversa sem responsável e maior espera → escolhe consultor disponível → transfere → destinatário recebe atualização → outro supervisor não autorizado não acessa a conversa nem pelo ID direto. Duas transferências simultâneas produzem resultado consistente e feedback de conflito quando necessário.

### C.3 IA

IA coleta fatos → humano corrige um valor → nova mensagem contradiz esse valor → atualização preserva o confirmado e mostra proposta → usuário assume atendimento → job antigo de IA tenta finalizar → nenhuma resposta automática indevida é enviada. Repetir com credencial indisponível, cota esgotada e áudio de saída do consultor.

### C.4 Dados e corte

Importar a mesma amostra duas vezes → contagens estáveis → nenhuma mensagem ou job de IA disparado → nota segue interna → autoria/timestamps preservados → anexo copiado abre sem depender da sessão Totalk → importar delta → mensagens durante corte reconciliadas → canal desconectado aparece como falha operacional e possui procedimento de recuperação.

### C.5 Métricas

Escolher registros rastreáveis e conferir o card até o detalhe → filtro de equipe mantém o mesmo escopo em gráfico/tabela → trocar empresa não mostra cache anterior → duas estações de uma pessoa não dobram jornada → ausência de ingestão não vira ociosidade → contato com duas vendas não infla taxa de pessoas convertidas.

## Anexo D — Interpretação e limites das referências visuais

As imagens foram produzidas como mockups de interface por geração de imagens. A Tela 01 define a estrutura principal; a Tela 02 define principalmente a paleta escura. As versões padronizadas de Supervisão, Gestão e Produtividade substituem as primeiras variantes, caso ambas apareçam na conversa.

Padronizar marca, menu, ícones, cabeçalho e espaçamento usando um único conjunto de componentes. Valores, datas, fotografias, nomes e gráficos são ilustrativos. Números de canais em imagens não alteram os dois canais iniciais confirmados. Ícones de telefone/vídeo não autorizam implementar chamadas nativas; o requisito confirmado é registrar manualmente uma ligação. Campos dos mockups não substituem validações do CRM. Telas reduzidas ilustram organização, não a lista completa de indicadores ou funções.

Para implementar, gerar dados sintéticos internamente coerentes e conectar cada indicador ao catálogo validado. Não copiar percentuais de uma imagem como fórmula de cálculo. Renderizar textos revisados em português e não reproduzir erro tipográfico do mockup.
