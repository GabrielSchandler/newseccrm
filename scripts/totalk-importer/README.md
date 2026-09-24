# Importador de histórico do Totalk (dry-run)

Entrega E da `NEWSEC-CORRECOES-E-CONTINUACAO-CLAUDE.md` (seção 12): prepara
a migração de histórico do Totalk sem executar o corte. Hoje roda só contra
**fixtures locais** (sem token real) — status atual: **nenhuma chamada real
foi feita**, só validação da lógica do importador.

## O que este importador NÃO é

Não é a integração já existente em `src/lib/totalk/api.ts` (essa é outra
coisa: busca contato por telefone pra pré-preencher simulação + envia PDF de
análise por WhatsApp — usada em produção, continua funcionando, não mexe
aqui). Este importador é um script **separado e independente**, cujo
único papel é trazer o **histórico de conversas** do Totalk pra dentro do
NewSec quando o Chat humano real (Entrega C) existir.

## Por que roda só com fixtures por enquanto

Duas dependências externas reais, nenhuma delas resolvida ainda:

1. **Token de API do Totalk** — não configurado. Quando existir, adicionar
   `TOTALK_IMPORT_TOKEN` e `TOTALK_IMPORT_BASE_URL` no `.env.local` (local)
   ou nas variáveis de ambiente do ambiente que rodar a importação real —
   **nunca colar o token no chat**; é o Gabriel quem adiciona a variável e
   confirma "feito".
2. **Schema real de conversa/mensagem do NewSec** — ainda não existe (depende
   da Entrega C, chat humano real, que por sua vez depende do Gabriel decidir
   onde roda o worker/Redis). Por isso a saída deste importador fica em
   arquivos JSON locais (`saida/`), não em tabela do Supabase — quando o
   schema real existir, o único ponto a mudar é a etapa final de escrita.

## Como funciona

```
node scripts/totalk-importer/importar.mjs                                  # fixture, continua do checkpoint
npm run totalk:importar                                                    # mesma coisa
node scripts/totalk-importer/importar.mjs --reiniciar                      # ignora checkpoint, começa do zero
node scripts/totalk-importer/importar.mjs --real                           # usa TOTALK_IMPORT_TOKEN/BASE_URL reais (exige as duas env vars)
node scripts/totalk-importer/importar.mjs --falhar-apos-sessao=<id>        # flag de teste — ver "Como foi testado"
```

Ordem de importação: departamentos → agentes → contatos → sessões → (por
sessão) mensagens → notas internas. Tudo lido com paginação real da API
(`PageNumber`/`PageSize`, para quando `hasMorePages` for `false` — ver
`cliente-totalk.mjs`), respeitando os limites documentados em
<https://flwchat.readme.io/reference/rate-limiting> (1000 req/5min contínuo,
rajada de 200 req/5s) com backoff exponencial em `429`/5xx.

Saída em `scripts/totalk-importer/saida/` (gerado, fora do git):

- `contatos-normalizados.json`, `conversas-normalizadas.json`,
  `mensagens-normalizadas.json` — formato canônico (ver "Formato canônico"
  abaixo), só com os itens **novos** desta rodada (o que já tinha sido
  importado antes não é reescrito).
- `relatorio-reconciliacao.json` / `.md` — contagem esperada (API) vs.
  importada vs. já vista por recurso, agentes sem mapeamento, mídia
  indisponível e erros. Nunca fica silenciosamente incompleto.

Estado de execução (não é segredo, mas também não precisa ir pro histórico
do repo) em `scripts/totalk-importer/.checkpoint/estado.json` — guarda os
IDs externos já vistos por tipo de entidade e quais sessões já foram
totalmente processadas.

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
  mensagem de áudio (`arquivo-audio-0001`) que não existe em
  `fixtures/arquivos.json` de propósito — aparece em
  `relatorio-reconciliacao.md`, seção "Mídia indisponível", nunca é
  ignorada.
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
  "direcao": "entrada | saida", "autoria": "cliente | humano | ia | sistema | consultor",
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
- **Resolução de arquivo/mídia — suposição CORRIGIDA (24/09/2026), não mais
  "a confirmar":** `GET /v2/file/{id}` **não existe** (confirmei via 404
  direto na doc). Mas também não é o caso de "listagem com filtro por ID"
  como este README supunha antes — **`GET /v2/file` e `POST /v2/file` não
  são de listagem/consulta, são o fluxo de UPLOAD** (`GET /v2/file` pede uma
  URL temporária de upload dado `Type`/`Name`/`MimeType`; `POST /v2/file`
  confirma o upload dado um `tempFileId` e devolve o `PublicFileV2DTO`
  definitivo). Não existe nenhum endpoint de "obter arquivo já existente
  por ID" na API pública do Totalk.
  **A boa notícia:** não precisa de um — o schema de
  `GET /v1/session/{id}/message` já traz o arquivo embutido em
  `items[].details.file` (mensagem com 1 anexo) ou `details.files[]`
  (múltiplos), cada um como `PublicFileDTO` completo: `id`, `name`,
  `extension`, `mimeType`, `size`, e crucialmente `publicUrl` /
  `publicUrlDownload` — URL direta pra baixar o arquivo, sem chamada
  adicional nenhuma.
  **Isso invalida o desenho atual do código, não só a suposição**:
  `resolverArquivo(fileId)` em `cliente-totalk.mjs` chama
  `GET /v2/file/{fileId}` em modo real — essa chamada sempre falharia
  (404) contra a API de verdade, fazendo TODO anexo aparecer como "mídia
  indisponível" mesmo quando o arquivo está disponível. E as fixtures
  (`fixtures/mensagens/*.json`, `fixtures/arquivos.json`) usam um formato
  achatado (`fileId`/`filesIds` soltos na mensagem, `resolverArquivo`
  buscando por id numa lista separada) que não corresponde ao formato real
  da API (arquivo aninhado dentro de `details.file`/`details.files` da
  própria mensagem). **Pendente pra próxima etapa de implementação:**
  reescrever `normalizarMensagem()` pra ler `mensagem.details?.file` /
  `details?.files`, apagar `resolverArquivo()` e a chamada a
  `GET /v2/file/{id}` (dead code depois da correção), e atualizar as
  fixtures pro formato aninhado real — com os testes manuais documentados
  abaixo re-rodados pra confirmar que nada quebrou.

## Quando a Entrega C (chat humano real) existir

Trocar só a etapa final de `importar.mjs` (hoje `writeFile` pra
`saida/*.json`) por inserts idempotentes nas tabelas reais de
contato/conversa/mensagem, usando `idExterno` como chave de conflito
(`ON CONFLICT DO NOTHING`/upsert) — o resto do pipeline (paginação, dedupe,
checkpoint, retry, relatório) já fica pronto e não muda.

## Pendências externas reais

- Token de API do Totalk — decisão/acesso do Gabriel.
- Confirmar as duas suposições acima contra uma chamada real, assim que o
  token existir.
- Definir `mapeamento-agentes.json` de verdade (hoje só tem um exemplo com
  UUID fictício) antes de qualquer importação real.
- Cancelamento do Totalk continua bloqueado até os dois canais WhatsApp,
  equipe, histórico e fluxos dependentes serem validados — este importador
  não altera esse bloqueio, só prepara o lado de dados.
