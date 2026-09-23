# NewSec — prompt de correção e continuidade para Claude Code

Data: 23/09/2026.
Repositório: https://github.com/GabrielSchandler/newseccrm
Versão revisada: `9065dc954f7bfb08a434ab59c55281b00022fbfb`.

> **Retificação (23/09/2026, mesmo dia, ver `docs/PERMISSIONS.md` §2.0 —
> documento mantido íntegro abaixo, sem editar o corpo):** a seção 7
> inteira ("Completar fundação multiempresa e multiequipe") pede criar
> vínculo N:N usuário↔empresa (`company_memberships`, backfill, RLS nova).
> O Gabriel confirmou depois que esse vínculo não existe pra
> gerente/supervisor/consultor — eles ficam 1:1 com a empresa, de
> propósito. Só a parte "supervisor em várias equipes" da seção 7 continua
> válida, e já foi entregue. A Entrega B (seção 14) foi concluída com esse
> escopo menor: testar ponta a ponta o fluxo de master que já existe, não
> construir o vínculo N:N. Onde o texto abaixo falar de "gerente
> multiempresa" ou vínculo N:N usuário↔empresa, vale o `PERMISSIONS.md`
> §2.0, não este texto.

## Como usar

Coloque este arquivo na raiz do checkout `newseccrm` e peça ao Claude Code:

> Leia integralmente NEWSEC-CORRECOES-E-CONTINUACAO-CLAUDE.md e execute a sequência autorizada nele. Confira primeiro o estado atual do repositório, preserve minhas alterações e continue até concluir as entregas locais e de homologação disponíveis, registrando os bloqueios externos reais. Não se limite a criar um plano ou corrigir apenas a documentação.

O conteúdo a partir da próxima seção é o prompt completo. Os achados são de revisão estática; devem ser reproduzidos e testados. Se o código já tiver mudado, adapte o trabalho ao estado atual, sem desfazer correções existentes.

---

## 1. Missão e escopo autorizado

Você está continuando o desenvolvimento do NewSec, que reúne GRSCRM, newsecchat e newsecfocus. Corrija as falhas identificadas, complete a fundação de autenticação/permissões e avance para uma integração funcional do atendimento com o CRM.

Esta instrução amplia o ciclo inicial, antes limitado às Fases 0 e 1: agora execute correções, fundação multiempresa/multiequipe, chat humano e ações essenciais do CRM no atendimento, em entregas sequenciais verificáveis. Prepare a migração Totalk e os demais módulos conforme a ordem adiante. Não peça nova autorização apenas porque a documentação antiga dizia para não iniciar Fases 2–6 automaticamente; este pedido autoriza a continuação local descrita aqui.

Continuam fora desta autorização: alterar o banco de produção, publicar em produção, substituir/conectar os dois números ativos, enviar mensagens reais, fazer disparos, cancelar Totalk ou contratar serviços. Essas operações externas precisam de autorização concreta. Pode escrever e testar código com adapters locais e fixtures. Pode trabalhar no banco de homologação já autorizado se identificar inequivocamente o projeto e se as credenciais disponíveis permitirem; se a identificação for incerta, prepare os passos e continue o trabalho local independente.

Não faça reset do banco de homologação nem apague registros existentes para simplificar testes. Use dados sintéticos isolados, com limpeza restrita aos IDs criados pela suíte.

Objetivo imediato: converter o protótipo visual em atendimento funcional, com isolamento entre empresas, persistência e ações de domínio corretas. Preserve as capacidades existentes do CRM. Não reescreva o produto do zero nem copie integralmente os três backends.

## 2. Leitura inicial e situação conhecida

Antes de editar:

1. Leia `AGENTS.md`, `CLAUDE.md` e instruções de subdiretórios aplicáveis.
2. Leia `NEWSEC-ESPECIFICACAO-E-PROMPT-CLAUDE.md`, `docs/PROGRESS.md`, `docs/TASKS.md`, `docs/PERMISSIONS.md`, `docs/ARCHITECTURE.md` e o mapa de paridade.
3. Confira `git status`, branch, HEAD e diferenças locais. Não sobrescreva trabalho de Gabriel ou de outro agente.
4. Compare HEAD com a referência auditada. Não use o SHA antigo como autorização para fazer checkout destrutivo.
5. Rode o baseline possível: tipos, lint, testes e build, separando falhas preexistentes das novas.
6. Verifique quais ambientes estão realmente disponíveis sem imprimir credenciais, connection strings ou dados pessoais.

Na versão auditada:

- CRM foi reaproveitado e possui suas páginas reais.
- `(newsec)` adiciona outro shell visual e telas alimentadas por `src/lib/demo/`.
- `ConversationView` não envia mensagens; apenas exibe aviso e limpa texto.
- Os botões de contexto não executam as operações reais de cadastro/análise.
- O drawer de pré-venda tem campos `readOnly` e sempre produz um erro simulado ao salvar.
- Dashboards e produtividade usam números sintéticos.
- Não existem no novo repositório os pipelines de worker/webhook/ingestão dos sistemas de origem.
- Existe `supabase/migrations/0001_equipes.sql`, mas o checkpoint dizia que não havia sido aplicada.
- `current-user.ts` ainda resolve um perfil com uma empresa; gerente multiempresa não está implementado.
- Documentos possuem trechos históricos superados. Por exemplo, catálogo de métricas existe embora um checkpoint ainda o cite como pendente.

Repositórios de origem para reutilização:

- https://github.com/GabrielSchandler/GRSCRM
- https://github.com/GabrielSchandler/newsecchat
- https://github.com/GabrielSchandler/newsecfocus

Use código e testes atuais como evidência. Declarações em README/PROGRESS não substituem execução. Não infira que nenhum fluxo regrediu apenas porque a quantidade ou o tamanho das rotas no build permaneceu igual.

## 3. Correção prioritária: integridade entre equipe, usuário e empresa

### Evidência

Em `supabase/migrations/0001_equipes.sql`, `team_memberships.user_profile_id` referencia qualquer perfil existente. As policies de INSERT/UPDATE verificam a empresa da equipe e o papel do ator, mas não verificam um vínculo válido do usuário-alvo com aquela empresa.

Isso permite criar associação inconsistente se alguém fornecer o ID de um perfil de outra empresa. Não afirmar que já há vazamento em produção: o SQL é a origem da falha e sua aplicação real deve ser verificada.

### Comportamento exigido

- Só vincular alguém a uma equipe quando ele tiver vínculo válido com a empresa dessa equipe.
- O ator precisa ter permissão de administrar aquela equipe/empresa.
- Verificar INSERT e UPDATE, inclusive troca de equipe, troca de usuário e mudança de papel.
- Impedir que mudança posterior de empresa da equipe invalide silenciosamente associações existentes.
- Não tratar conhecer um UUID como prova de autorização.
- Evitar que a integridade dependa apenas do formulário ou da RLS: scripts administrativos e service role também precisam respeitar constraints/rotinas de integridade.

### Implementação

1. Verifique a aplicação da migração em cada ambiente conhecido.
2. Se já foi aplicada em algum ambiente compartilhado, crie migração corretiva incremental. Não altere somente o arquivo antigo e suponha que o banco ficará corrigido.
3. Se nunca foi aplicada, ajuste a migração inicial e documente o caminho de instalação. Mantenha estratégia de upgrade caso o estado do ambiente não seja uniforme.
4. Consulte inconsistências existentes antes de impor novas constraints; não apague nem reassocie usuários automaticamente.
5. Escolha uma representação compatível com os vínculos multiempresa da seção 7. A restrição final deve consultar a associação à empresa, não apenas o `company_id` legado do perfil.

Desenho relacional de referência, a adaptar aos nomes existentes:

- `company_memberships`: vínculo único entre perfil e empresa, com papel e situação.
- `teams`: empresa obrigatória e chave única adicional adequada a uma FK composta, se escolhida.
- `team_memberships`: empresa, equipe e vínculo de empresa compatíveis, protegidos por FKs compostas quando viável.

Também é possível usar trigger de integridade bem definido quando necessário; justificar escolha e concorrência. Não criar trigger com consultas vulneráveis a corrida sem considerar locks/constraints. Não inventar um sistema de identidade duplicado.

FK garante existência e consistência estrutural; vínculo ativo e autorização atual continuam sendo verificados no acesso. Desativar um vínculo pode preservar histórico, mas deve retirar acesso operacional.

Policies devem explicitar papéis destinatários quando apropriado e usar helpers com `search_path` seguro. Não usar `security definer` como atalho para contornar todas as policies. Revisar grants e acesso por `anon`, `authenticated` e serviço.

### Aceite obrigatório no PostgreSQL de teste

- Gerente A pode vincular membro A à equipe A.
- Gerente A não pode vincular membro sem vínculo em A à equipe A.
- Gerente A não pode administrar equipe B.
- Consultor não pode promover a si mesmo para supervisor/gerente.
- UPDATE não contorna as restrições.
- Usuário com vínculos autorizados em A e B pode ter equipes legítimas nas duas, sem compartilhamento dos dados operacionais.
- Revogação do vínculo retira acesso posterior.
- Restrição estrutural também rejeita associação inconsistente feita por uma conexão com bypass de RLS.

Mock de Supabase não prova isolamento. Se PostgreSQL não estiver disponível, escreva a suíte e marque explicitamente "não executada", sem declarar a correção validada no banco.

## 4. Correção: rascunhos desaparecem ao trocar conversa

### Evidência

`src/components/newsec/atendimento-workspace.tsx` renderiza `ConversationView` com `key={conversa.id}`. Dentro de `conversation-view.tsx`, o rascunho vive apenas em `useState`. Trocar a conversa desmonta o componente e descarta o texto.

### Solução exigida

- Guardar rascunhos fora do ciclo de vida do componente de uma conversa: store ou estado elevado ao workspace.
- Chave lógica composta por usuário + empresa + conversa + modo do compositor, diferenciando mensagem de nota interna.
- Não resolver apenas removendo `key`: isso pode fazer o texto de um cliente aparecer no outro.
- `ConversationView` recebe rascunho controlado e callbacks; não possui a única cópia do texto.
- A→B→A preserva textos independentes e não mistura anexos, seleções ou nota interna.
- Logout, troca de usuário e empresa encerram subscriptions e removem do contexto visível o conteúdo anterior.
- Persistência entre recargas é uma decisão explícita: se usar armazenamento local, definir namespace, expiração, limpeza e comportamento em computador compartilhado. Não adicionar persistência indefinida de mensagens sensíveis sem necessidade.

Ao enviar de verdade:

1. Capturar snapshot imutável do texto e anexos da operação.
2. Criar uma intenção durável de envio no servidor com ID de operação.
3. Após aceite durável, limpar somente a versão do rascunho que foi enviada.
4. Se o usuário digitar outro texto enquanto o envio está em andamento, não apagar o novo texto quando a resposta antiga chegar.
5. Se a persistência falhar, preservar rascunho e informar erro.
6. Se o provedor falhar após persistir, manter mensagem com estado recuperável; não criar duplicata ao reenviar.

Testes: troca A/B, troca de empresa com IDs coincidentes, falha de persistência, digitação durante envio, nota interna separada e reabertura de conversa.

## 5. Correção: script de homologação pode anunciar sucesso com falhas

### Evidência

Em `scripts/homologacao/copiar-schema-producao.ps1`:

- O resultado de `pg_dump` é inferido pela existência/tamanho do arquivo, sem checar imediatamente o exit code.
- Um arquivo parcial ou remanescente pode ser tratado como dump válido.
- `psql` roda sem `ON_ERROR_STOP`; erros SQL podem não produzir a falha esperada pelo script.
- O script trata cópia de `public` sem privilégios como se fosse reprodução completa do ambiente.

### Correção exigida

- Capturar `$LASTEXITCODE` imediatamente após cada programa nativo. `$ErrorActionPreference = 'Stop'` não substitui isso no Windows PowerShell 5.1.
- Criar saída temporária exclusiva por execução; usar o dump somente após sucesso confirmado. Não reutilizar arquivo anterior por acidente.
- Executar `psql` com interrupção por erro e sem configuração pessoal que altere o comportamento; avaliar `-X` e `-v ON_ERROR_STOP=1`.
- Usar transação única quando compatível com o SQL produzido; documentar exceções reais e estratégia de recuperação quando não for possível.
- Nunca continuar para restore quando dump falhar.
- Propagar exit code não zero e nunca mostrar "Pronto" após erro.
- Validar origem/destino como projetos distintos, incluindo os diferentes formatos de conexão direta/pooler. Não comparar apenas hostname quando ele puder ser compartilhado por vários projetos.
- Exigir identificação explícita do destino como homologação. Bloquear destino ambíguo; não executar restore em produção.
- Não registrar senha, URL completa com credenciais ou argumentos sensíveis nos logs; usar a forma mais segura compatível com as ferramentas disponíveis.
- Não usar `--clean`, apagar schema ou recriar banco para contornar conflitos sem autorização específica.
- Verificar versão compatível de `pg_dump` com o servidor e orientar com erro legível.

Inventariar o que não é copiado pelo comando atual: grants necessários, políticas/configuração do Storage, buckets, funções/extensões em outros schemas, triggers no schema Auth, jobs agendados, usuários Auth e integrações externas. Não copiar dados pessoais para preencher essas lacunas. Preparar seed sintético e scripts de setup explícitos.

Teste de erro obrigatório em ambiente descartável: dump falha → restore não executa; SQL inválido → saída de erro e sem mensagem de sucesso; destino igual à origem → operação bloqueada; schema válido → verificações de objetos/grants esperados passam. Não usar o banco real para provocar falhas.

## 6. Correção: separar demonstração de aplicação autenticada

### Evidência

`src/app/(newsec)/layout.tsx` não exige sessão e as páginas de atendimento/produtividade não resolvem usuário/empresa. Isso hoje expõe somente dados sintéticos. Não conectar consultas reais a essas páginas antes de introduzir a proteção.

Há outra inconsistência: o middleware legado usa `startsWith('/dashboard')`, que também corresponde a `/dashboards`. A classificação de workspace repete o padrão. Isso pode aplicar regras antigas de gestão ao novo dashboard e impedir a visão de desempenho do consultor.

### Implementação exigida

- Rotas operacionais validam sessão, perfil/vínculo ativo, empresa, módulo e ação no servidor.
- Server Actions, APIs, downloads, buscas e subscriptions possuem proteção própria; middleware é uma primeira camada, não a autorização completa.
- Definir modo demo explicitamente. Preferir namespace isolado como `/demo/...` quando simplificar a separação, com flag server-side e dados sintéticos garantidos.
- Falta de configuração, banco indisponível ou falta de permissão não podem acionar fallback silencioso para fixtures.
- Importações de `src/lib/demo` não devem alimentar rotas operacionais. Separar adaptadores de demonstração e reais.
- Indicadores de erro/vazio/loading ficam claros, sem números fictícios para "preencher a tela".
- Revisar comparações de prefixo para respeitar fronteira de segmento: rota igual ao prefixo ou começando por `prefixo + '/'`, conforme a intenção. Testar explicitamente `/dashboard` e `/dashboards`.
- Revisar matcher raiz, `getHomeForRole`, `classifyWorkspacePath`, login/logout e mudança de senha para evitar redirecionamentos em loop.
- Consultor com módulo e permissão passa a ter atendimento como entrada principal quando a rota estiver funcional. Consultor sem chat conserva uma entrada válida do CRM.
- Supervisor/gerente podem atender e acessar visões agregadas autorizadas; papel de gestão não elimina produtividade individual.
- Master conserva entrada de plataforma e não ganha acesso irrestrito a conteúdo privado por consequência de uma refatoração.

Menu deve receber capacidades resolvidas e mostrar somente itens pertinentes, sem confundir ocultação visual com segurança. Trocar links para o novo shell progressivamente, preservando acesso às rotas antigas até a paridade estar comprovada.

Testes: sem sessão; sessão vencida; perfil ausente/inativo; vínculo revogado; empresa inválida; consultor em dashboard próprio; supervisor de equipe alheia; empresa sem módulo; troca de empresa; acesso por URL direta; fixtures desligadas fora do demo.

## 7. Completar fundação multiempresa e multiequipe

Hoje `src/lib/auth/current-user.ts` utiliza `user_profiles.auth_user_id` com `.maybeSingle()` e o `company_id` do perfil. Não transforme simplesmente essa consulta em uma lista para depois escolher o primeiro resultado. Uma identidade Auth deve continuar representando uma pessoa; os vínculos são entidades próprias.

### Modelo e transição

1. Inventariar constraints, policies e helpers existentes antes de editar.
2. Criar vínculos usuário↔empresa com papel/estado e unicidade apropriada.
3. Fazer backfill idempotente do vínculo atual a partir do perfil legado.
4. Preservar os campos e contratos ainda utilizados pelo CRM antigo durante a transição.
5. Vínculos de equipe referenciam a empresa autorizada, conforme seção 3.
6. Não converter supervisor em admin global para facilitar acesso; permissão por equipe precisa ser real.
7. Definir equivalência entre `admin`, `manager`, `seller`, papéis jurídico/comercial e modelo master/gerente/supervisor/consultor.
8. Documentar convivência e estratégia de migração dos helpers/policies legados.

### Contexto e RLS

- Empresa ativa de cookie/rota é entrada não confiável; validar contra vínculos do usuário autenticado.
- Permissões são resolvidas pelo vínculo na empresa ativa, não pelo maior papel que a pessoa tem em qualquer empresa.
- RLS de tabelas multiempresa autoriza vínculo e escopo reais. Apenas trocar cookie no Next não muda automaticamente o contexto do PostgreSQL.
- Não considerar `current_user_company_id()` legado suficiente para o novo modelo N:N. Projetar a transição das policies explicitamente.
- Se usar claims para apoiar contexto, apenas dados assinados e controlados pelo servidor; não confiar em `user_metadata` editável pelo usuário. Considerar revogação e claims obsoletos.
- Preferir checagem de vínculo da empresa da própria linha para isolamento. Operações que selecionam uma empresa ativa devem filtrar explicitamente e ser verificadas também no servidor.
- Company IDs, team IDs, client IDs e conversation IDs recebidos do cliente sempre são validados em conjunto.
- Impedir vínculo de análise/pré-venda/conversa/anexo a entidade de outra empresa.
- Cache deve conter empresa, usuário e escopo relevante; invalidar em revogação e troca de empresa.

Criar documentação e testes com duas empresas e ao menos: gerente multiempresa com papéis diferentes, supervisor em duas equipes, consultor restrito e usuário sem vínculo. Verificar arquivos e dados agregados, não só a listagem principal.

## 8. Melhorias de UX necessárias antes de integrar dados reais

### Responsividade

O layout atual combina menu de 200px, lista de 300px, conversa com mínimo de 420px e contexto de 340px, dentro de um container com overflow oculto. Em telas estreitas pode cortar partes essenciais.

- Desktop largo: quatro regiões.
- Desktop menor: menu compacto e painel de contexto recolhível/overlay.
- Mobile/tablet: navegação lista → conversa → contexto, preservando seleção e rascunho.
- Compositor e ação de envio sempre acessíveis, inclusive com teclado virtual quando verificável.
- Drawer com foco inicial, Escape, contenção/retorno de foco e labels acessíveis.
- Verificar no mínimo 1920, 1366, 1280, 768 e 390px, sem scroll horizontal da página para o fluxo principal.

### Estados reais

- Botão sem implementação precisa explicar sua indisponibilidade; não aparentar sucesso.
- Não simular um erro de backend sempre que salvar: quando a operação for implementada, usar sucesso/erro reais.
- Remover referências a caminhos de arquivos, Fase 1/Fase 3 e detalhes de implementação da interface operacional. Essas informações pertencem à documentação/demo técnica, não ao fluxo do consultor.
- Formularios reais devem ser editáveis e usar validação existente. Não copiar regras Zod para arrays paralelos que possam divergir.
- Tema claro/escuro deve cobrir a área funcional nova; páginas legadas podem ser migradas por entrega, com pendências registradas.

## 9. Integrar chat humano: primeira entrega funcional completa

Use `newsecchat` como fonte de implementação, conferindo seu SHA atual. Reaproveite adapter do provedor, normalização de eventos, estado de entrega, concorrência, mídia e testes úteis. Adapte React/Tailwind e entidades para a base do CRM; não copie package.json por inteiro.

### Entidades e contratos

- Empresa e usuário canônicos do CRM.
- Canal pertence a uma empresa; roteamento para comercial/jurídico é configuração, não inferência pelo número.
- Contato operacional pode existir sem cadastro completo.
- Cliente CRM continua obedecendo aos requisitos existentes.
- Conversa vincula contato, canal, equipe e responsável autorizados.
- Mensagem guarda direção, autoria humana/IA/sistema, tipo, timestamps, status e IDs externos.
- Nota interna não pode ser enviada ao provedor.
- Telefones e identidades externas permitem associação a cliente sem criar duplicatas automaticamente por nome/telefone.

Não criar um segundo mestre de clientes, uma organização paralela ou outro login para o Chat.

### Envio, persistência e recuperação

1. Validar sessão, vínculo, módulo, canal, conversa e anexos.
2. Aceitar ID idempotente de operação e restringi-lo ao escopo adequado.
3. Persistir mensagem/intenção de envio em transação.
4. Publicar job de modo recuperável: usar outbox ou reconciliação explícita entre commit e enqueue.
5. Worker persistente processa envio; ambiente serverless web não fica responsável por um loop duradouro.
6. Distinguir criado/pendente, aceito pelo provedor, enviado, entregue, lido e falha segundo capacidades reais do adapter.
7. Timeout ambíguo exige reconciliação; retry cego pode duplicar mensagem real.
8. Webhooks duplicados/fora de ordem fazem upsert/transição idempotente, sem retroceder estado por evento atrasado.
9. UI reconcilia bolha otimista pelo ID de operação/mensagem e não adiciona uma segunda cópia.

Jobs contêm IDs e contexto mínimo; segredos são resolvidos no servidor. Autenticar webhook conforme suporte real do provedor e resolver empresa pelo canal autenticado, não pelo `company_id` do payload.

### Operação humana

- Assumir, transferir, concluir/reabrir com mudanças atômicas e auditoria.
- Duas pessoas tentando assumir a mesma conversa recebem resultado consistente.
- Aguardar humano/cliente, não lidas, novos, sem responsável e retorno vencido são dimensões formalizadas.
- Nota interna, importação e mensagem de sistema não devem adulterar relógio de primeira resposta.
- Busca e histórico paginados; Realtime autorizado por escopo, com reconexão e recuperação do intervalo perdido.
- Acesso aos anexos é privado e autorizado. Não expor service role nem aceitar URL arbitrária para fetch de arquivo.
- Reutilizar campanhas e follow-ups existentes conforme paridade; não fazer disparo real nesta execução.

### Aceite local/homologação

Uma sessão sintética atravessa endpoint de webhook de teste → persistência → fila/lista → conversa → resposta humana persistida → job → adapter de teste → evento de confirmação. Validar também reinício do worker, retry e duplicação de evento.

Adapter de teste precisa ser explicitamente selecionado por configuração e não operar como fallback silencioso. Isso valida o pipeline interno, não a conexão real dos números. Canal real somente após autorização; registrar essa etapa como pendente quando ainda não executada.

## 10. Integrar ações do CRM ao atendimento

Após o chat persistente:

- Gerar análise usa o motor determinístico existente e aceita ausência de cliente nos casos já suportados.
- Cadastrar cliente identifica faltantes reais, preenche sugestões revisáveis e chama a regra de domínio atual.
- Criar pré-venda exige cliente e todas as validações atuais, preservando seções Obrigatório/Jurídico/Opcional conforme o CRM real.
- Formulários em drawer compartilham schema e serviços com páginas completas; não implementar uma segunda versão simplificada da regra.
- Salvar retorna IDs reais, atualiza contexto visível e preserva a conversa/rascunho.
- Duplo clique/retry não cria dois clientes ou duas pré-vendas. Definir estratégia de idempotência e constraints adequada a cada entidade.
- Registrar ligação funciona sem mensagem WhatsApp fictícia e sem exigir conversa quando o caso de uso não requer.
- Vincular vários telefones conserva histórico, resolve conflitos com revisão e não une empresas diferentes.
- Vendas e pós-venda são entidades estruturadas do CRM ou extensões coerentes; resumo textual da IA não é fonte de verdade financeira.
- Cliente pode ter nova pré-venda enquanto existe pós-venda de uma venda anterior.
- Substituir envio de PDFs e leitura de anotações que ainda dependem do Totalk por serviços do novo atendimento, mantendo compatibilidade durante transição.

Aceite: contato sem cadastro → conversa → análise → completar obrigatórios → cliente → pré-venda → documento, preservando IDs e histórico, com autorizações e erros de validação reais.

## 11. IA essencial após a integração humana

Não deixe IA bloquear o chat humano. Primeiro os fluxos persistentes e auditáveis; depois integrar os processadores de IA reaproveitados do Chat.

- Resolver credencial no servidor por empresa e finalidade.
- Credencial compartilhada exige concessão explícita, sem compartilhar dados entre as empresas.
- Armazenar segredo protegido e jamais devolvê-lo ao navegador.
- Contexto estruturado tem versão, origem, fontes e confirmação manual.
- Atualização usa delta/watermark e controla concorrência; job antigo não sobrescreve revisão nova.
- Informações confirmadas manualmente ficam preservadas; divergência vira proposta revisável.
- Pré-venda/pós-venda são vinculados ao ciclo correto e não só à primeira venda do cliente.
- Áudio recebido e enviado pelo consultor são transcritos de forma assíncrona, se capacidade/credencial permitirem.
- Transcrição de áudio de saída não dispara uma resposta automática como se fosse entrada do cliente.
- Revalidar modo humano/IA imediatamente antes de enviar uma resposta automática. Handoff invalida envios atrasados indevidos.
- Respostas estruturadas passam por validação; dados ausentes continuam ausentes.
- Mensagens/documentos são dados não confiáveis; não podem alterar permissões nem instruir ferramentas a acessar outra empresa.
- Cotas, cache, dedupe, retry limitado e rastreamento de consumo por empresa/tarefa.

Testes com respostas sintéticas controladas antes de chamadas pagas. Testes pagos/credenciais externas somente se já autorizados; reportar o que foi realmente exercitado. Treinamento de equipe e editor de prompts avançado podem vir após a migração operacional.

## 12. Preparar migração Totalk sem executar o corte

Consultar a documentação atual em https://flwchat.readme.io/ e inspecionar os usos Totalk ainda presentes no CRM.

Entregar importador com dry-run, checkpoints, IDs externos, retry e relatório de reconciliação. Não considerar a integração atual de leitura de anotação/envio de PDF equivalente a um importador de histórico.

Cobrir contatos e estados, sessões, mensagens, notas internas, anexos, autoria, canal, responsáveis e timestamps conforme a API realmente disponibiliza. Mapear entidades legadas a usuários/equipes existentes; não criar acesso para usuário antigo automaticamente.

Requisitos:

- Importar duas vezes não duplica.
- Retomar lote não reprocessa tudo.
- Mídia é copiada para armazenamento autorizado quando necessária; não depender permanentemente de links do fornecedor.
- Histórico importado não aciona IA, envio, campanha, cobrança de transcrição ou contagem de nova entrada.
- Delta considera atualizações e usa janela sobreposta/IDs para reduzir perdas.
- Rate limits reais revalidados, com margem para o Totalk ainda em operação.
- Diferenças de contagem e arquivos indisponíveis ficam explícitas; não ignorar página com erro.
- Runbook separa migração de dados de pareamento/conexão WhatsApp.
- Não conectar os mesmos números a dois processos que respondam simultaneamente.
- Cancelamento do Totalk depende de validação dos dois canais, equipe, histórico e fluxos antes dependentes dele.

Sem token autorizado, testar o importador com fixtures representativas e manter integração real pendente. Não pedir que o usuário cole segredos em uma conversa; orientar configuração no ambiente adequado.

## 13. Focus, dashboards e Academia: preservar escopo e ordenar

Não gastar a maior parte deste ciclo criando mais telas demonstrativas enquanto o chat não funciona.

Depois de estabilizar o caminho operacional:

- Portar o pipeline do Focus: agente Windows, matrícula, ingestão, agregados, configuração de jornada, classificação e retenção.
- Mapear pessoas/equipes às identidades canônicas, conservando colaboradores sem login se o produto já suportar.
- Preservar todos os indicadores catalogados; tela reduzida não autoriza remoção.
- Proteger deduplicação de pessoa/minuto entre dispositivos e distinguir ausência de dados de ociosidade.
- Alimentar dashboards padrão com consultas reais, definições e filtros consistentes, com drilldown autorizado.
- Manter número vendido/recebido/cancelado e taxa de conversão com coorte/denominador corretos.
- Implementar personalização/fórmulas em etapa posterior com catálogo e parser validado, nunca SQL/JavaScript livre.
- Conservar Academia atual; acrescentar atribuição por empresa/equipe/pessoa sem perder progresso e cursos existentes.

Deixar tarefas concretas por domínio em `docs/TASKS.md`, com dependências e critérios. Não marcar como integrado um módulo que só possui mockup.

## 14. Ordem de execução e gates

### Entrega A — Corrigir problemas da base

Integridade equipe/empresa; script de homologação; rascunhos; separação demo/real; prefixos de rota e responsividade crítica. Testes de regressão e documentação atualizados.

### Entrega B — Fundação de acesso

Vínculos multiempresa/multiequipe, contexto autorizado, RLS, navegação por capacidade e transição compatível com CRM. Gate de isolamento com duas empresas e papéis diferentes.

### Entrega C — Chat humano real no ambiente de teste

Banco, worker, filas, adapter, webhook, envio, histórico, atribuição, mídia, Realtime e testes ponta a ponta internos. Só integrar dados reais depois de B.

### Entrega D — Ações do CRM e IA essencial

Cadastro, análise e pré-venda reais em drawer; contexto com proteção manual; áudio e handoff. Não alterar cálculos financeiros existentes por preferência do modelo.

### Entrega E — Importador e runbook

Dry-run, retomada, reconciliação, delta e ensaio com fixtures/homologação autorizado. Preparar operação externa e indicar os dados necessários para executar o piloto.

### Entrega F — Paridade de Focus e evolução

Integração completa do Focus, dashboards reais, treinamento e Academia ampliada, conforme backlog e sem atrasar correções do atendimento.

Execute a sequência sem solicitar aprovação entre pequenas mudanças locais já autorizadas. Se uma dependência externa bloquear um gate, não o marque como concluído: avance em trabalho independente seguro, deixe explícito o bloqueio e mantenha os trechos ainda não validados desativados no caminho operacional.

Não exigir que toda a Entrega F esteja pronta para preparar o piloto Totalk. Não interromper voluntariamente após a Entrega A se ainda há trabalho autorizado e executável nas próximas entregas. Se a sessão terminar por limite de uso/contexto, salvar checkpoint preciso.

## 15. Testes, evidências e condição de conclusão

Comandos iniciais existentes na referência: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Confirmar scripts atuais antes de executar. Introduzir testes adicionais proporcionais aos riscos, reaproveitando Vitest e infraestrutura disponível.

Tabela mínima de evidências:

| Risco | Evidência exigida |
| --- | --- |
| Associação entre empresas | Teste real de constraints e RLS no banco de teste |
| Acesso a conversa/anexo alheio | Requisição autenticada com usuário não autorizado falha |
| Rascunho perdido/misturado | Testes A→B→A e troca de usuário/empresa |
| Sucesso falso do script | Teste com falha de dump e SQL inválido |
| Demo entrando em produção | Rotas reais não usam fixtures nem fallback silencioso |
| Permissão errada em dashboard | Consultor vê próprio escopo; supervisor só equipes permitidas |
| Mensagem duplicada | Repetição de operação/webhook não duplica registros/envio controlável |
| Falha entre banco e fila | Reconciliação recupera intenção durável após reinício |
| Sobrescrita pela IA | Proposta concorrente não remove informação manual confirmada |
| Migração com efeitos colaterais | Import replay não aciona mensagens/IA/campanhas |
| Regressão CRM | Fluxos essenciais continuam válidos com seus requisitos reais |

Se configurar CI, usar banco de teste/serviços efêmeros ou ambiente dedicado; nunca credenciais de produção. Não transformar capturas de tela ou relato do agente em substituto de teste automatizado de isolamento.

Mensurar latência interna e latência de provedor separadamente. Em testes sem WhatsApp real, dizer exatamente isso. Transcrição mockada não comprova qualidade de áudio real. Build aprovado não comprova que migração foi aplicada.

## 16. Documentação e checkpoint obrigatório

Atualizar `docs/PROGRESS.md` com resumo atual no topo e manter histórico claramente marcado. Conciliar `TASKS.md`, `FEATURE_PARITY.md`, `PERMISSIONS.md` e `ARCHITECTURE.md`. Criar/atualizar `DATA_MODEL.md`, `RUNBOOK.md`, `MIGRATION_TOTALK.md` e decisões relevantes conforme conteúdo real for produzido.

Não substituir documentação por grandes textos genéricos. Cada registro deve conter:

```text
Entrega e tarefa:
Branch e HEAD:
Mudanças implementadas:
Migrações criadas:
Migrações aplicadas, em qual ambiente e com qual evidência:
Comandos/testes executados e resultados:
Integrações reais versus simuladas:
Pendências e bloqueios externos:
Compatibilidade com o CRM antigo:
Próximo passo executável:
```

Manter instruções curtas em `CLAUDE.md` e `AGENTS.md`, referenciando documentos maiores. Não reler todo o inventário dos três sistemas a cada pequena tarefa. Não colocar todas as imagens e a especificação inteira no contexto de cada ciclo; consultar os trechos relevantes.

Commits locais devem ser coerentes e separados por entrega, sem segredos. Não fazer push/deploy de forma a publicar mudanças externas sem a autorização aplicável. Não editar arquivos simultaneamente com outro executor sem coordenação explícita.

## 17. Resposta esperada ao final de cada entrega

Informe de forma objetiva:

1. O que foi corrigido e a causa.
2. O que agora funciona de ponta a ponta.
3. Arquivos e migrações relevantes.
4. Testes realmente executados e seus resultados.
5. O que continua demonstrativo ou não validado.
6. Bloqueios externos concretos, se existirem.
7. Próxima tarefa e instrução de como validar a entrega.

Não declare "sem erros", "100% seguro" ou "pronto para produção" sem qualificar o alcance da validação. O objetivo é reduzir riscos por implementação correta e evidência verificável. Preserve as regras reais do CRM, os dados de produção e o caminho de migração gradual.

Comece agora pelo baseline e pela Entrega A, seguindo para as próximas entregas autorizadas conforme os gates forem satisfeitos.
