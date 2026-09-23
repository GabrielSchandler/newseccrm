# Decisão: manter `/atendimento` (e demais rotas do shell novo) no lugar, não mover para `/demo/...`

Data: 2026-09-23.

## Contexto

A revisão de 23/09/2026 apontou, com razão, um risco real: rota operacional
sem separação clara entre demonstração e dado real pode acabar recebendo
consulta de banco de verdade "por engano", com fallback silencioso pra
fixture quando a consulta falha. Uma correção possível seria mover todo o
shell novo pra um namespace isolado tipo `/demo/atendimento`.

## Decisão

Não renomear. `/atendimento`, `/atendimento/supervisao`, `/dashboards` e
`/produtividade` continuam nesses caminhos.

## Por quê

1. `NEWSEC-ESPECIFICACAO-E-PROMPT-CLAUDE.md` (Anexo A.5) já define
   `/atendimento` como a rota **real e definitiva** do produto — o plano
   sempre foi essa mesma URL evoluir de demonstração pra dado real ao longo
   das fases (Fase 1 demo → Fase 2 chat real → Fase 3 CRM real), não duas
   rotas paralelas (`/demo/atendimento` e depois `/atendimento` de verdade)
   que precisariam ser reconciliadas/uma delas apagada depois.
2. Verificado nesta revisão: nenhum componente em `src/components/newsec/`
   ou rota em `src/app/(newsec)/` importa `@/lib/supabase/*` hoje. Não existe
   nenhum código que "tenta buscar dado real e cai pra fixture se falhar" —
   é binário: ou o componente usa só `src/lib/demo/*` (situação atual, sem
   exceção) ou vai ser reescrito na Fase 2/3 pra usar dado real (sem
   fixture nenhuma no caminho). O risco descrito (fallback silencioso)
   **não existe hoje porque não há path condicional nenhum** — só existe a
   partir do momento em que alguém escrever esse código, e nesse momento
   ele precisa nascer com guard de sessão/permissão real, não fallback.

## O que isso exige daqui pra frente (registrado pra não esquecer)

- Ao portar cada tela de `src/lib/demo/*` pra dado real (Fase 2 em diante),
  a troca é completa: remove o import de `src/lib/demo/*` daquele
  componente, não convive com ele atrás de uma flag "se falhar usa demo".
  Ver seção 6 do documento de correções — rota real exige sessão,
  vínculo/empresa e módulo verificados no servidor, sempre.
- Se algum dia for necessário um modo demo explícito rodando **ao lado** do
  produto real (ex.: pra treinar equipe nova, ou pra vídeo de vendas), aí
  sim cria-se `/demo/...` como uma coisa nova e deliberada — não é o caso
  hoje, onde só existe demo porque a integração real ainda não foi feita.
