# Importador de histórico do Totalk

Entrega E da `NEWSEC-CORRECOES-E-CONTINUACAO-CLAUDE.md` (seção 12): migra o
histórico do Totalk pro NewSec. **Já grava de verdade em homologação**
(desde 24/09/2026) — ver "Como funciona". Produção continua sendo decisão
separada do Gabriel (ver "Pendências externas reais").

## O que este importador NÃO é

Não é a integração já existente em `src/lib/totalk/api.ts` (essa é outra
coisa: busca contato por telefone pra pré-preencher simulação + envia PDF de
análise por WhatsApp — usada em produção, continua funcionando, não mexe
aqui). Este importador é um script **separado e independente**, cujo
único papel é trazer o **histórico de conversas** do Totalk pra dentro do
NewSec.

## Fonte de leitura x destino de escrita — dois eixos independentes

- **Fonte** (`--real` ou não): de onde os dados do Totalk são lidos —
  fixtures locais (padrão, sem token) ou a API real (exige
  `TOTALK_IMPORT_TOKEN`/`TOTALK_IMPORT_BASE_URL` no `.env.local` — **nunca
  colar o token no chat**; é o Gabriel quem adiciona a variável e confirma
  "feito"). Token real ainda não configurado — todo o histórico deste README
  usa fixtures.
- **Destino** (`--destino=homologacao` ou não): pra onde os dados
  normalizados vão — arquivo local em `saida/` (padrão, nunca toca no banco)
  ou as tabelas reais de homologação (`contacts`, `contact_phone_numbers`,
  `conversations`, `messages`). **Produção não é um destino suportado aqui**
  — decisão operacional separada, nunca automática.

## Como funciona

```
node scripts/totalk-importer/importar.mjs                                  # fixture -> arquivo local, continua checkpoint
npm run totalk:importar                                                    # mesma coisa
node scripts/totalk-importer/importar.mjs --reiniciar                      # ignora checkpoint, começa do zero
node scripts/totalk-importer/importar.mjs --real                           # lê da API real, ainda escreve só em arquivo local
node scripts/totalk-importer/importar.mjs --destino=homologacao --empresa-id=<uuid> --canal-id=<uuid> --dry-run   # preview contra o banco real, nada gravado
node scripts/totalk-importer/importar.mjs --destino=homologacao --empresa-id=<uuid> --canal-id=<uuid>             # grava de verdade em homologação
node scripts/totalk-importer/importar.mjs --falhar-apos-sessao=<id>        # flag de teste — ver "Como foi testado"
```

`--empresa-id`/`--canal-id` nunca são escolhidos automaticamente — o script
recusa rodar com `--destino=homologacao` sem os dois, e imprime o nome da
empresa/canal resolvidos antes de gravar qualquer coisa, pra nunca ser
ambíguo onde os dados estão indo.

Ordem de importação: departamentos → agentes → contatos → sessões → (por
sessão) mensagens → notas internas. Tudo lido com paginação real da API
(`PageNumber`/`PageSize`, para quando `hasMorePages` for `false` — ver
`cliente-totalk.mjs`), respeitando os limites documentados em
<https://flwchat.readme.io/reference/rate-limiting> (1000 req/5min contínuo,
rajada de 200 req/5s) com backoff exponencial em `429`/5xx.

Saída em `scripts/totalk-importer/saida/` (gerado, fora do git) — escrita
sempre, mesmo com `--destino=homologacao` (fica como rastro de auditoria da
rodada; com destino real, é a gravação no banco que é a fonte de verdade,
não este arquivo):

- `contatos-normalizados.json`, `conversas-normalizadas.json`,
  `mensagens-normalizadas.json` — formato canônico (ver "Formato canônico"
  abaixo), só com os itens **novos** desta rodada (o que já tinha sido
  importado antes não é reescrito).
- `relatorio-reconciliacao.json` / `.md` — contagem esperada (fonte) vs.
  importada vs. já vista por recurso, agentes sem mapeamento, mídia
  indisponível, responsáveis mapeados que não existem no destino e erros.
  Nunca fica silenciosamente incompleto.

Estado de execução (não é segredo, mas também não precisa ir pro histórico
do repo) em `scripts/totalk-importer/.checkpoint/estado.json` — guarda os
IDs externos já vistos por tipo de entidade e quais sessões já foram
totalmente processadas. **Com `--destino=homologacao`, o checkpoint local é
só uma otimização, não a fonte de verdade de dedupe** — ver "Idempotência
com --destino" abaixo.

## Garantias e como foram testadas

Testado manualmente contra as fixtures (`fixtures/`, 3 sessões — Mariana
Costa/comercial concluída, Rafael Almeida/comercial em andamento, Clara
Nunes/comercial pendente sem agente — os mesmos nomes já usados nas telas de
demonstração de `/atendimento`, de propósito, pra manter a história
consistente):

- **Importar duas vezes não duplica**: rodar `npm run totalk:importar` duas
  vezes seguidas — na segunda rodada, `relatorio-reconciliacao.md` mostra
  `novos: 0` e `jaVistos` igual ao total em todos os recursos.
- **Retomar lote não reprocessa tudo**: rodar com
  `--falhar-apos-sessao=sessao-mariana-0001` interrompe o script de
  propósito logo depois de terminar a sessão da Mariana (checkpoint salvo
  antes de lançar o erro). Rodar de novo sem a flag completa só as sessões
  do Rafael e da Clara — a Mariana não é reprocessada (relatório mostra as
  mensagens/notas dela em `jaVistos`, não em `novos`).
- **Mídia indisponível fica explícita**: a fixture da Mariana tem uma
  mensagem de áudio com `fileId: "arquivo-audio-0001"` mas sem `details.file`
  correspondente, de propósito (simula a API devolvendo a mensagem sem
  conseguir embutir o arquivo) — aparece em `relatorio-reconciliacao.md`,
  seção "Mídia indisponível", nunca é ignorada.
- **Agente sem mapeamento não vira usuário novo**: `mapeamento-agentes.json`
  deixa `agente-bruno-0002` sem `userIdNewSec` de propósito — a sessão do
  Rafael (responsável Bruno) é importada mesmo assim, só com
  `responsavelUserId: null`, e o agente aparece em
  "Agentes sem mapeamento" no relatório. Nenhum código deste importador cria
  linha em `user_profiles`.
- **Não aciona nada real**: `cliente-totalk.mjs` só implementa os endpoints
  de leitura (`GET`/`POST .../filter`) documentados em
  <https://flwchat.readme.io/> — nenhuma função de envio de mensagem,
  campanha, chatbot ou OTP existe neste diretório.
- **Retry com backoff em 429/5xx**: o modo fixture nunca passa pelo caminho
  de rede (`chamarComRetentativa`/`requisitarReal`), então isso não é
  exercido pelos testes acima. Verificado à parte em
  `npm run totalk:testar-retry` (ou
  `node scripts/totalk-importer/testar-retry.mjs`): simula 2 respostas `429`
  seguidas de sucesso (confirma 3 chamadas e ~1.5s de espera acumulada,
  backoff exponencial 500ms→1000ms) e confirma que um erro permanente
  (`401`) falha já na primeira tentativa, sem retentativa nenhuma.

## Verificado contra homologação de verdade (24/09/2026)

Empresa real criada em homologação especificamente pra isso — `GRS
Soluções` (`6e44e5ca-011a-421c-aaea-95b4935e691a`), canal `Totalk (histórico
importado)` (`364988a1-0e62-4c96-9c92-0580a684bd0e`, `provider=totalk`,
`status=inactive` — é só destino de histórico, não canal ao vivo). Rodada
completa (fixtures → `--destino=homologacao`) resultou em, verificado por
consulta direta ao banco (não só pelo relatório do próprio script):

- **3 contatos, 3 conversas, 13 mensagens** (12 mensagens + 1 nota) — bate
  exatamente com o total das fixtures.
- **Status mapeado corretamente**: sessão `COMPLETED` → `encerrada`,
  `IN_PROGRESS` → `humano`, `PENDING` → `aguardando_humano`; mensagem de
  saída `READ`/`DELIVERED` → `lida`/`entregue`; toda mensagem de entrada →
  `recebida`; nota → `criada`, `is_internal_note=true`.
  Anexo (`msg-mariana-0003`) resolvido com o `PublicFileDTO` completo, sem
  nenhuma chamada de rede extra.
- **`outbound_jobs`: 0 linhas** — confirmado por query direta. Histórico
  importado não passa por `enviar_mensagem_com_job()`, é um INSERT direto em
  `messages`.
- **Idempotência real, duas formas diferentes**: rodar de novo com o mesmo
  checkpoint → `novos: 0` em tudo. **Apagando o checkpoint local por
  completo** (`rm -rf .checkpoint`) e rodando de novo → contagens locais de
  departamento/agente/sessão resetam (esperado, são só bookkeeping local),
  mas `contatos`/`mensagens`/`notas` continuam `novos: 0` — a dedupe real
  vem do banco (telefone, `conversations.external_id`, `messages.external_id`),
  não do checkpoint. Contagem final no banco depois de 4 rodadas (2 que
  quebraram no meio de propósito pra testar recuperação, 1 completa, 1 com
  checkpoint apagado): continua exatamente 3/3/13, sem duplicata nenhuma.
- **Recuperação de queda no meio de uma sessão, contra o banco de
  verdade**: as duas primeiras rodadas quebraram de propósito (ver bugs
  abaixo) no meio do processamento da sessão da Mariana. A rodada seguinte
  (sem `--reiniciar`) não recriou o que já existia (conversa + 6 mensagens
  já gravadas) e completou só o que faltava (a nota) — prova real de queda
  no meio do processo, não só o cenário sintético de
  `--falhar-apos-sessao`.
- **2 bugs reais encontrados rodando de verdade** (não em teoria):
  1. `assigned_user_profile_id` mapeado em `mapeamento-agentes.json` pra um
     `user_profiles.id` que não existe no ambiente de destino (o exemplo do
     arquivo é fictício, de propósito) quebrava a criação da conversa
     inteira (violação de FK). Corrigido: `resolverOuCriarConversa()`
     tenta de novo sem responsável se a primeira tentativa falhar por FK —
     a conversa é importada mesmo assim, e o caso fica registrado em
     "Responsáveis mapeados que não existem no ambiente de destino" no
     relatório, nunca mascarado.
  2. Nota interna gravava `author_type: "consultor"`, mas
     `messages_author_type_check` (0004) só aceita
     `cliente | humano | ia | sistema` — nenhum valor "consultor" existe no
     schema real. Corrigido pra `"humano"` (mesma convenção do sistema ao
     vivo, ver `criarNotaInternaAction`).

## Formato canônico da saída

Alinhado com as "Entidades e contratos" da seção 9 do documento de correção
(conversa vincula contato/canal/equipe/responsável; mensagem guarda
direção/autoria/tipo/timestamps/status/ID externo; nota interna nunca é
enviada ao provedor):

```jsonc
// contatos-normalizados.json
{ "idExterno": "...", "nome": "...", "telefone": "...", "email": "...", "status": "...", "origemImportacao": "totalk" }

// conversas-normalizadas.json
{
  "idExterno": "...", "contatoIdExterno": "...", "canalIdExterno": "...", "canalTipo": "CLOUDAPI_WHATSAPP",
  "departamentoIdExterno": "...", "agenteIdExterno": "...", "responsavelUserId": "uuid do NewSec ou null",
  "status": "...", "criadoEm": "...", "encerradoEm": "...", "origemImportacao": "totalk"
}

// mensagens-normalizadas.json (mensagem e nota interna compartilham o formato; ehNotaInterna distingue)
{
  "idExterno": "...", "conversaIdExterno": "...", "ehNotaInterna": false,
  "direcao": "entrada | saida", "autoria": "cliente | humano | ia | sistema",
  "agenteIdExterno": "...", "tipo": "TEXT | DOCUMENT | AUDIO | ...", "texto": "...", "timestamp": "...",
  "arquivoIdExterno": "...", "arquivoResolvido": { "...": "metadados do arquivo, se resolvido" },
  "arquivoIndisponivel": false, "origemImportacao": "totalk"
}
```

## Suposições a validar no piloto real

- **`direction: FROM_HUB`/`TO_HUB`** — revisitei a documentação
  (`GET /v1/session/{id}/message`, 24/09/2026): o enum confirmado tem
  exatamente esses dois valores (nenhum terceiro), mas o significado
  semântico continua sem descrição explícita na doc, e o endpoint de envio
  (`POST /v1/session/{id}/message`) não devolve `direction` na resposta pra
  confirmar por dedução (é sempre saída, então o campo nem aparece). Este
  importador continua assumindo, pelo nome do campo, que `FROM_HUB` =
  originado no hub (agente/sistema → contato, mapeado pra `"saida"`) e
  `TO_HUB` = contato → hub (mapeado pra `"entrada"`/`autoria: "cliente"`).
  **Ainda precisa de revalidação contra uma chamada real** — se estiver
  invertido, é uma linha só pra trocar em `normalizarMensagem()`
  (`cliente-totalk.mjs` → `importar.mjs`).
- **Resolução de arquivo/mídia — CORRIGIDO (24/09/2026), não é mais
  suposição:** `GET /v2/file/{id}` **não existe** (confirmei via 404 direto
  na doc). E não é o caso de "listagem com filtro por ID" como este README
  supunha antes — **`GET /v2/file` e `POST /v2/file` são o fluxo de UPLOAD**
  (`GET /v2/file` pede uma URL temporária de upload dado
  `Type`/`Name`/`MimeType`; `POST /v2/file` confirma o upload dado um
  `tempFileId` e devolve o `PublicFileV2DTO` definitivo), não consulta de
  arquivo existente. Não existe nenhum endpoint de "obter arquivo já
  existente por ID" na API pública do Totalk — **e não precisa de um**: o
  schema de `GET /v1/session/{id}/message` já traz o arquivo embutido em
  `items[].details.file` (mensagem com 1 anexo) ou `details.files[]`
  (múltiplos), cada um como `PublicFileDTO` completo: `id`, `name`,
  `extension`, `mimeType`, `size`, `publicUrl`/`publicUrlDownload` — sem
  chamada adicional nenhuma.
  **Código corrigido:** `resolverArquivo()` (que chamava
  `GET /v2/file/{fileId}`, uma chamada que sempre falharia com 404 em modo
  real) foi removida de `cliente-totalk.mjs`. `normalizarMensagem()`
  (`importar.mjs`) agora lê `mensagem.details?.file ??
  mensagem.details?.files?.[0]` direto do objeto que `listarMensagens()` já
  trouxe — zero chamadas extras de rede pra resolver mídia. As fixtures
  (`fixtures/mensagens/sessao-mariana-0001.json`) foram atualizadas pro
  formato real (arquivo aninhado em `details.file`); `fixtures/arquivos.json`
  foi removido (não é mais referenciado por nada).
  **Reverificado depois da mudança** (os mesmos 5 cenários desta seção,
  rodados de novo): mensagem `msg-mariana-0003` (contrato) resolve com o
  `PublicFileDTO` completo (`mimeType`, `size`, `publicUrl`,
  `publicUrlDownload`) direto de `details.file`, sem nenhuma chamada extra;
  `msg-mariana-0005` (áudio, sem `details.file` de propósito) continua
  caindo em "mídia indisponível" (1 item no relatório, como antes);
  importar duas vezes seguidas ainda dá `novos: 0` na segunda; interromper
  com `--falhar-apos-sessao=sessao-mariana-0001` e retomar ainda processa só
  Rafael+Clara (6 mensagens) sem reprocessar a Mariana; `testar-retry.mjs`
  passa igual (não usa resolução de arquivo).

## Idempotência com --destino (checkpoint local perdido não duplica nada)

Sem `--destino`, o checkpoint local (`vistos.*`/`sessoesConcluidas`) é a
única fonte de verdade de dedupe — funciona porque é a única execução que
importa. Com `--destino=homologacao`, o checkpoint vira só uma otimização
(evita relistar dados desnecessariamente); a dedupe de verdade é sempre
verificada contra o próprio banco antes de qualquer INSERT:

- Contato: por `contact_phone_numbers.phone_e164` (único por empresa) —
  `resolverOuCriarContato()`.
- Conversa: por `conversations.external_id`, único por canal desde a
  migração 0008 — `resolverOuCriarConversa()`.
- Mensagem/nota: por `messages.external_id`, único por conversa desde 0004
  — checado por sessão antes de processar as mensagens dela
  (`externalIdsExistentes`).

Cada INSERT também trata `23505` (unique_violation) como corrida
recuperável (relê e segue), não como erro fatal. `checkpoint.sessoesConcluidas`
só é marcado — e persistido em disco — **depois** que os dados da sessão
já estão duravelmente gravados (nunca antes), pra uma queda no meio do
processo nunca mascarar perda de dado como "já concluído". Prova real disso
tudo (não só teórica) em "Verificado contra homologação de verdade" acima.

## Promoção pra produção

**Não é o escopo deste script.** Aplicar as migrações em produção, importar
o histórico de verdade lá, conectar o número real do WhatsApp e cancelar o
Totalk são quatro decisões operacionais distintas do Gabriel — nenhuma
inferida daqui, nenhuma executada automaticamente. Este importador só prova
que o pipeline funciona corretamente contra homologação.

## Pendências externas reais

- Token de API do Totalk — decisão/acesso do Gabriel.
- Confirmar a suposição de `direction: FROM_HUB`/`TO_HUB` contra uma chamada
  real, assim que o token existir (a suposição de resolução de arquivo já
  foi corrigida contra a documentação oficial, não depende mais do token).
- Definir `mapeamento-agentes.json` de verdade (hoje só tem um exemplo com
  UUID fictício — por isso toda conversa importada até agora foi sem
  responsável) antes de qualquer importação real.
- Empresa/canal de destino em homologação já existem (ver "Verificado contra
  homologação de verdade") — nada pendente aqui pro piloto em homologação.
  Produção é outra decisão (ver "Promoção pra produção").
- Cancelamento do Totalk continua bloqueado até os dois canais WhatsApp,
  equipe, histórico e fluxos dependentes serem validados — este importador
  não altera esse bloqueio, só prepara o lado de dados.
