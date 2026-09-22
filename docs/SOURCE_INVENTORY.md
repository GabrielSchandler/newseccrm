# NewSec — inventário factual dos três sistemas de origem

Fatos lidos do código real (não de READMEs), com caminho de arquivo. Objetivo:
nenhuma decisão de arquitetura da Fase 1 em diante deve se basear em suposição
quando o fato real já foi levantado aqui.

Status: **CRM, Chat e Focus completos** (22/09/2026).

---

## 1. CRM (base `newseccrm`, clone do GRSCRM)

### 1.1 Modelo de identidade/permissão

`src/types/user.ts` define três dimensões ortogonais, não uma única enumeração:

```ts
export type CompanyUserRole = "admin" | "manager" | "seller";
export type CompanyBusinessArea = "commercial" | "legal";
export type LegalUserRole = "admin" | "consultant";
```

- `role`: escopo geral (admin/manager/seller).
- `business_area`: qual área/menu o usuário abre (comercial ou jurídico).
- `legal_role`: granularidade dentro do jurídico.
- Não existe papel "financeiro" dedicado — financeiro é módulo, não role.

`src/lib/auth/current-user.ts` (`loadCurrentUserContext`, envolto em `cache()`):

- Busca `auth.users` (Supabase) → `user_profiles` por `auth_user_id`. Falha
  explicitamente (`UserProfileContextError`) se não houver perfil ou
  `company_id`.
- **Cada `user_profiles` tem exatamente 1 `company_id` — é 1 usuário : 1
  empresa.** Não existe tabela `user_companies`/`company_memberships`/
  `team_members` no código (confirmado por busca nesses termos em
  `src/types` e `src/lib`).
- **Única exceção**: `is_platform_owner === true` permite trocar a empresa
  "ativa" via cookie (`ACTIVE_COMPANY_COOKIE_NAME`, linhas 83–102) — é
  impersonation administrativa do dono da plataforma, não multi-tenancy real
  de usuário comum.
- `canEditLegalWorkflow = role === "admin" || can_edit_legal_workflow` — flag
  extra por usuário.
- `is_active === false` → redireciona para `/conta-inativa`.

**RLS é real, não só decoração de UI.** `docs/sql/security-multi-tenant-rls.sql`
define funções `security definer` (`current_user_profile_id()`,
`current_user_company_id()`, `current_user_is_active()`, `current_user_role()`,
`current_user_is_admin()`, `current_user_is_admin_or_manager()`) usadas em
políticas de várias tabelas. `docs/sql/plataforma-multiempresas.sql` (linhas
66–94) tem um bloco `do $$ ... $$` que **varre dinamicamente todas as tabelas
com coluna `company_id`** e aplica RLS + policy de `platform_owner` a cada
uma — isolamento multiempresa é sistemático no Postgres, base sólida para o
NewSec herdar.

**Implicação para o NewSec:** a especificação (seção 5) pede vínculos
muitos-para-muitos usuário↔empresa e supervisor↔equipe. O CRM atual **não
tem isso** — é 1:1 com um único mecanismo de override. Introduzir
multi-empresa/multi-equipe por usuário é uma decisão de arquitetura real da
Fase 1, não um ajuste cosmético; precisa de migração e de mapear o
`is_platform_owner` atual para o papel Master do modelo alvo sem quebrar o
fallback existente.

### 1.2 Módulos e configuração de empresa

`src/lib/company/platform-settings.ts` define 11 módulos via
`CompanyModuleKey`: `commercial`, `legal`, `finance`, `academy`,
`lead_distribution`, `client_portal`, `backups`, `outlook_email`,
`simulations`, `documents`, `custom_templates`. Cada um mapeia a uma coluna
booleana `enable_*` em `company_platform_settings`, que também tem `status`
(`active/trial/suspended/cancelled`) e `storage_limit_mb`.

**Imposição em dois lugares, não só client:**

- Servidor: `isModuleEnabled(settings, module)` é chamado em Server
  Components/páginas (`academy/page.tsx:157`, `academy/gestao/page.tsx`,
  `academy/cursos/[courseSlug]/page.tsx`, `areas/page.tsx`) — bloqueio antes
  de renderizar. `app-sidebar.tsx` usa a mesma função só para esconder item
  de menu (UX).
- Banco: `docs/sql/company-platform-settings.sql` — `select` liberado a
  usuário ativo da própria empresa ou platform owner; `insert/update/delete`
  restritos a `current_user_is_platform_owner()` (linhas 52–72). Mesmo
  contornando a UI, a policy barra escrita direta via PostgREST.

**Risco a documentar**: se a tabela `company_platform_settings` estiver
ausente para uma empresa, o código cai em `defaultCompanyPlatformSettings`
com **todos os módulos habilitados por padrão** (linhas 168–190) — fallback
permissivo. Decidir explicitamente se o NewSec mantém esse default ou inverte
para "nada habilitado até configurar".

### 1.3 Schema de cliente — Obrigatório / Jurídico / Opcional

`src/lib/clients/schema.ts` (Zod) por si só **não distingue** jurídico de
obrigatório — essa distinção é só de UI, em `src/components/clients/client-form.tsx`
(array `fields`, linhas 37–54, e blocos condicionais a partir da linha 292).

- **Obrigatório** (Zod + `required: true` na UI): `full_name`, `cpf` (11
  dígitos), `rg`, `birth_date`, `marital_status`, `email` (formato válido),
  `zip_code`, `street`, `number`, `district`, `city`, `state`.
- **Jurídico** (`requirement: "legal"` na UI, mas **opcional no Zod**):
  `nationality`, `legal_responsible_user_id`, `legal_consultant_user_id`. O
  aviso na UI (linhas 218–221): "usados em documentos da esteira jurídica,
  como procurações e declarações" — é categoria de **uso**, não de
  obrigatoriedade.
- **Opcional**: `phone_secondary`, `profession`, `notes`,
  `commercial_consultant_user_id`, `phone_mobile` (validado só se
  preenchido — pequena inconsistência: o tipo `Client` em `src/types/client.ts`
  declara `phone_mobile: string` não-nulável, mas o schema trata como
  opcional).

**Lacuna real a registrar**: não há `CREATE TABLE public.clients` versionado
em `docs/sql/` — só `ALTER TABLE ... ADD COLUMN` incrementais (ex.:
`clientes-nacionalidade-juridico.sql`, `clientes-responsavel-juridico.sql`,
`clientes-consultor-comercial.sql`), todas nullable, sem `NOT NULL`/`CHECK`.
**A obrigatoriedade de campos do cliente hoje só é reforçada no
Zod/formulário, não há constraint correspondente no banco.** Isso é dívida
técnica preexistente do CRM, não algo a "consertar sozinho" na integração —
mas precisa constar no `PERMISSIONS.md`/decisão de arquitetura porque a
especificação pede reforço também no banco para o produto novo.

### 1.4 Análise (simulação) sem cliente vs. pré-venda com cliente obrigatório

Confirmado — são políticas deliberadamente diferentes:

- **`src/lib/calculations/schema.ts`** (linha 76): `client_id: optionalUuid`,
  `pre_sale_id: optionalUuid` — ambos nullable/opcionais, assim como
  `client_name`/`client_cpf`/`client_phone` (linhas 79–81). Uma simulação
  (`financing_calculations`) pode existir sem nenhum vínculo. Em
  `src/app/(authenticated)/calculos/totalk-actions.ts` (linhas 221–249), o
  código só grava timeline/revalida página do cliente **se** `calculation.client_id`
  existir — tratado como opcional em runtime também.
- **`src/lib/pre-sales/schema.ts`** (linha 134): `client_id: z.string().uuid("Selecione um cliente.")`
  — sem union com null, portanto obrigatório, com mensagem de erro dedicada.
  Reforçado no servidor por `assertClientBelongsToCompany` e
  `assertClientExistsInCompany` (`src/app/(authenticated)/pre-vendas/actions.ts`,
  linhas 102 e 142) — dupla camada (Zod + checagem de posse no server action).

### 1.5 Integração Totalk — superfície real a substituir

Exatamente **duas chamadas de rede reais** em `src/lib/totalk/api.ts`:

1. `findTotalkContactByPhone(integration, phone)` (linha 166) —
   `GET {baseUrl}/core/v1/contact/phonenumber/{phone}`, extrai
   `annotation`/`contactName` (heurística recursiva `extractNestedText`).
2. `sendTotalkDocument({...})` (linha 205) —
   `POST {baseUrl}/chat/v1/send/document`, envia PDF/documento por WhatsApp.

**Todos os call sites concentrados em** `src/app/(authenticated)/calculos/totalk-actions.ts`:

- `importTotalkCalculationDataAction(phone)` (linha 69) → busca contato,
  parseia anotação (`src/lib/totalk/parser.ts`, puro, sem rede) e
  **pré-preenche o formulário de simulação** a partir de anotações feitas no
  atendimento Totalk. Consumido por
  `src/components/calculations/totalk-calculation-import-panel.tsx` e
  `src/components/calculations/calculation-form.tsx` (linhas 19, 367–409).
- `sendCalculationAnalysisViaTotalkAction(calculationId)` (linha 140) →
  **envia o PDF da análise por WhatsApp** via signed URL do Storage
  (`calculation-reports` bucket); grava evento `calculation_pdf_sent_totalk`
  em `client_timeline` e audit log `totalk.calculation_pdf_sent`. Consumido
  por `src/components/calculations/calculation-pdf-actions.tsx` (linhas
  20–22, 113).

Periféricos (não chamam a API, só gerenciam config/exibem histórico):
`src/app/(authenticated)/integracoes/actions.ts` +
`src/lib/totalk/integrations.ts` (credenciais: token/baseUrl/telefone, tabela
`totalk_integrations`), `src/app/(authenticated)/integracoes/page.tsx` (tela
de conexão), `src/components/clients/client-timeline-section.tsx` (linhas
86–89, só rótulo/ícone dos eventos), `src/lib/backups/*` (só referencia
`totalk_integrations` na lista de tabelas do backup).

**O que precisa de substituto ao desligar Totalk**: (a) importação de dados
de simulação a partir de anotação do atendimento — hoje só via Totalk; (b)
envio de PDF de análise por WhatsApp ao cliente. Superfície pequena e bem
isolada — é o ponto de partida certo para o Chat integrado assumir.

### 1.6 Academia

`src/lib/academy/course.ts`: cursos e capítulos são **hardcoded em
TypeScript**, não vêm do banco. `academyCourses` (linha 879) define 2 cursos:
`formacao-grs-revisional-venda-consultiva` (7 capítulos comerciais) e
`operacao-crm-grs` (7 capítulos de operação do CRM) — 14 capítulos ao todo,
com `sections`, `checkpoint` (1 pergunta de gate) e `exam` por capítulo,
`passingScore` de 85 por curso.

**Persistido no banco** (`docs/sql/academy-crm.sql`), com RLS real:

- `academy_chapter_progress` — progresso por `(company_id, user_profile_id,
  course_slug, chapter_id)`: `status`, `progress_percent`, `best_score`,
  `completed_at`, `last_activity_at`. Usuário vê/edita o próprio; admin/manager
  vê e edita de todos da empresa.
- `academy_exam_attempts` — tentativas de prova, `score`, `passed`, `answers`
  (jsonb), `submitted_at`. RLS equivalente.

**Não existe atribuição de curso por usuário/equipe** — todo usuário ativo da
empresa vê os mesmos 2 cursos. `academy/gestao/page.tsx` só agrega relatórios
(`AcademyReportRow`) para acompanhamento do gestor, não atribui.

Rotas: `academy/page.tsx` (hub), `academy/cursos/[courseSlug]/page.tsx`,
`academy/cursos/[courseSlug]/capitulos/[chapterId]/page.tsx`,
`academy/capitulos/[chapterId]/page.tsx` (legada, sem `courseSlug` no path),
`academy/gestao/page.tsx`, `academy/actions.ts`
(`completeAcademyChapterAction`, `submitAcademyExamAction`).

**Preservar, não recriar**: 14 capítulos de conteúdo pedagógico específico da
operação GRS já escrito em pt-BR, com progresso/prova já funcionando com RLS.

### 1.7 Mapa de rotas de primeiro nível — `src/app/(authenticated)/`

`academy`, `alterar-senha`, `aprovacoes`, `areas`, `backups`, `calculos`,
`clientes`, `comercial`, `contratos`, `dashboard`, `documentos`, `emails`,
`empresa`, `empresas`, `financeiro`, `integracoes`, `juridico`, `leads`,
`logs`, `pre-vendas`, `usuarios`.

Agrupamento provável por área de produto (a aprofundar por diretório na Fase
1, isto é leitura de superfície por nome + módulos do item 1.2):

- **Comercial**: `comercial`, `clientes`, `pre-vendas`, `calculos`,
  `contratos`, `leads`, `dashboard`.
- **Jurídico**: `juridico`, `emails` (Outlook jurídico), `aprovacoes`
  (portal do cliente).
- **Financeiro**: `financeiro`.
- **Gestão/plataforma**: `empresa`, `empresas` (plural — sugere painel do
  platform owner), `usuarios`, `backups`, `logs`, `integracoes`
  (Totalk/Outlook), `documentos` (templates/documentos gerados), `areas`
  (seletor comercial/jurídico/gestão).
- **Conta**: `alterar-senha`.
- **Academia**: `academy` (item 1.6).

### 1.8 Stack real (`package.json`)

Next `^15.5.24` (App Router) · React `^19.1.0`/`react-dom ^19.1.0` ·
Tailwind CSS `^4.3.3` (`@tailwindcss/postcss`) · Supabase
`@supabase/supabase-js ^2.112.4` + `@supabase/ssr ^0.6.1` · React Hook Form
`^7.55.0` (+ `@hookform/resolvers ^5.0.1`) · Zod `^3.24.3` · TypeScript
`^5.8.3`. Outras libs relevantes: `@react-pdf/renderer` (PDFs),
`docxtemplater`/`pizzip`/`mammoth` (Word), `pdf-lib`, `sharp`, `xlsx`,
`sanitize-html`.

Scripts (`package.json`): `dev`, `build`, `start`, `lint` (ESLint flat
config), `typecheck` (`tsc --noEmit`), `test` (`vitest run`, Vitest
`^4.1.11`), mais `backup:stored`, `backup:register-external`,
`import:legacy-rd`, `import:rd-crm-activities`.

### 1.9 Observações para `PERMISSIONS.md` / decisões de arquitetura

- **Não há multi-empresa nem multi-equipe por usuário hoje** — é 1:1, com
  override só para `is_platform_owner`. A especificação (seção 5) exige
  vínculos muitos-para-muitos; isso é trabalho real de schema/migração da
  Fase 1, não um detalhe.
- Obrigatório/Jurídico/Opcional do cliente é convenção de UI + Zod, sem
  constraint no banco — a tabela `clients` base nunca teve `CREATE TABLE`
  versionado em `docs/sql`. Formalizar isso é uma decisão a tomar (reforçar
  no banco vs. manter só aplicação), não algo a inventar sozinho.
- Enforcement de módulos e RLS multiempresa já é real e sistemático — base
  sólida para herdar sem reescrever.
- Totalk tem superfície pequena (2 chamadas, 1 arquivo central de actions) —
  bom sinal para o cronograma até 07/10.
- Academia é "code as content" para cursos (nada no banco), mas
  progresso/prova são dados reais com RLS — preservar as duas tabelas ao
  portar.

---

## 2. newsecchat (atendimento)

### 2.1 Máquina de estados do atendimento

Fonte de verdade real é **SQL**, não TypeScript: `supabase/esquema-completo.sql`
+ `supabase/migrations/0018_pausa_e_despacho.sql` (e seguintes). O TS em
`lib/nucleo/estados.ts` é só uma cópia declarativa "para a interface decidir
o que oferecer ao operador".

Estados (`enum estado_conversa`, `esquema-completo.sql:609-611`): `IA`,
`AGUARDANDO_HUMANO`, `HUMANO`, `AGUARDANDO_CLIENTE`, `ENCERRADA`. Regra
central: quando um humano assume, a IA cala — só volta por devolução
explícita. **Achado real (não suposição)**: `iaPodeResponder()`
(`lib/nucleo/estados.ts:112-114`) só retorna `true` para `estado === 'IA'`,
mas o comentário logo acima (linhas 102-111) afirma que a IA também responde
em `AGUARDANDO_HUMANO` — a implementação não faz isso. Inconsistência entre
comentário e código a resolver na Fase 3 (não copiar o comentário errado).

Transições via RPC Postgres (`assumir_conversa`, `transferir_com_nota`/
`transferir_conversa`, `devolver_conversa_para_ia`,
`encerrar_conversa_com_versao`, `reabrir_conversa`), chamadas por
`app/(painel)/atendimento/acoes.ts`.

**Concorrência — duas camadas reais de defesa**:
1. `select ... for update` na linha da conversa dentro da mesma transação de
   toda função de transição (`esquema-completo.sql:816-868`,
   `0018_pausa_e_despacho.sql:82-96`). `assumir_conversa` recusa
   (`return false`) se `estado='HUMANO'` e o responsável já é outra pessoa —
   "quem chegou antes fica com ela". `acoes.ts:62-67` traduz isso em "Outro
   atendente assumiu esta conversa antes."
2. Concorrência otimista via coluna `versao` (incrementada a cada transição),
   usada em `encerrarConversa` (`acoes.ts:183-199`, exige `versao` do
   cliente). Trigger de banco adicional `validar_envio_humano`
   (`0021_fila_e_reabertura.sql:55-63`) re-checa no INSERT da mensagem se
   `estado='HUMANO'` e `responsavel_id` batem — segunda camada independente
   da checagem em TS.

**Relógio de "aguardando resposta" — resposta tripla**, na view
`fila_operacional` (`0028_foto_do_contato.sql:20-53`):
- **Nota interna** (`adicionarNota`, `acoes.ts:508-531`): grava só em
  `notas_internas`, nunca referenciada pela view. Não afeta o relógio.
- **Evento de sistema** (`tipo='SISTEMA'`): excluído explicitamente da
  subquery de "última mensagem pública"
  (`left join lateral(... where tipo<>'SISTEMA' ...)`,
  `0028_foto_do_contato.sql:41`). Não reseta o relógio.
- **Mensagem de campanha**: ao contrário das duas acima, **afeta o relógio
  integralmente** — `trabalhador/processadores/campanha.ts:260-268` grava
  com `autor:'SISTEMA'` mas `tipo:'TEXTO'` (não `'SISTEMA'`) e atualiza
  `estado`/`ultima_mensagem_em` da conversa diretamente, contando como
  "última mensagem pública" e disparando o relógio normalmente.

### 2.2 Tempo real

`app/(painel)/atendimento/tempo-real.tsx`: **um canal Realtime por empresa**
(`central:${organizacaoId}`), três assinaturas `postgres_changes` filtradas
por `organizacao_id` (`conversas`, `mensagens` INSERT/UPDATE, `retornos`) —
não é por conversa nem global.

Mitigação de recarga excessiva já existente: INSERT de mensagem da conversa
aberta é injetado direto na tela (sem ida ao servidor); qualquer outro
evento aciona `recarregarComAtraso()` com debounce de 600ms e mínimo de
3000ms entre `router.refresh()` (variável de módulo compartilhada entre
assinaturas da aba). `router.refresh()` refaz a página inteira no servidor —
o próprio código chama isso de "caro", daí o agrupamento. Relógio de
segurança: 90s conectado / 15s desconectado, mais recarga ao voltar de aba
parada >20s.

### 2.3 Contexto por IA

`lib/ia/contexto.ts`: **não há delta/checkpoint incremental** —
`montarContexto()` faz varredura completa a cada turno (8 consultas
paralelas: contato, campos personalizados, valores de campo, `memorias_contato`
limit 40, últimas 20 mensagens, departamentos, etiquetas, contagem total). O
que evita mandar a conversa inteira ao modelo é o limite de 20 mensagens +
resumo comprimido (`contato.resumo`) + memórias nomeadas — não um mecanismo
de delta.

Versionamento: só timestamp (`memorias_contato.atualizado_em`,
`contato.resumo_atualizado_em`), sem histórico de versões — é sobrescrita,
não append.

**Achado crítico para a Fase 3 (`ContextProposal`/preservação de edição
manual, especificação seção 11.1 e Anexo A.4)**: não há proteção contra
sobrescrita. `aplicarAprendizado` (`lib/ia/conversar.ts:358-397`) grava
`valores_campos_contato` via `upsert(..., {onConflict:'contato_id,campo_id'})`
— sobrescrita silenciosa, sem checar se o valor existente é de origem
`'HUMANO'` vs `'IA'`. A coluna `origem` existe na tabela (gravada como
`'IA'`, linha 380), mas o `upsert` não a usa como guarda — qualquer origem é
sobrescrita igualmente. Campo com chave desconhecida é descartado
(comportamento correto), mas campo conhecido já confirmado manualmente
**não tem proteção hoje**. Memórias usam o mesmo padrão
(`upsert(...,{onConflict:'contato_id,chave'})`, mesma chave = sobrescrita).
Isso precisa virar o mecanismo `ProposedFact`/revisão explícita da
especificação, não pode ser portado como está.

### 2.4 Conversação IA e atendimento automático

`lib/ia/conversar.ts` (`executarTurnoIa`). Handoff: transferência para
humano via `encaminharParaHumano()` → RPC `transferir_conversa`; devolução
para IA é sempre ação humana explícita (`devolverParaIa`, `acoes.ts:82-125`),
nunca automática.

**Revalidação antes de responder — já existe, em duas camadas** (cobre
exatamente o risco "job atrasado responde depois de humano assumir" citado
na especificação):
1. Início do turno relê `conversa.estado` do banco antes de montar contexto
   ou chamar o provedor (linhas 54-69).
2. Gravação passa pela RPC `registrar_mensagem_ia`
   (`esquema-completo.sql:913-965`), que faz `select ... for update` e
   confere `estado <> 'IA'` **na mesma transação** do INSERT da mensagem —
   se um humano assumiu durante o processamento, a RPC devolve `null` e
   `conversar.ts:255-258` trata como `IGNORADO`, sem enfileirar envio. A
   garantia final é o lock de linha no SQL, não o `if` em TS.

Limite de mensagens seguidas sem resposta do cliente
(`agente.max_mensagens_seguidas`) força transferência para humano; confiança
abaixo de `CONFIANCA_MINIMA = 0.45` também transfere.

### 2.5 Credencial de IA

`lib/provedores/ia/indice.ts` + `lib/ambiente.ts:61-62` +
`lib/provedores/transcricao/indice.ts`. **Confirmado: resolução é global, não
por empresa.** Uma única `OPENAI_API_KEY` de variável de ambiente alimenta
conversa, JSON estruturado e transcrição. Pior: o provedor é **singleton em
memória do processo**:

```ts
let instancia: ProvedorIa | null = null;
export function obterProvedorIa(): ProvedorIa {
  if (instancia) return instancia;
  if (!integracaoConfigurada('IA')) { instancia = provedorIaSimulado; return instancia; }
  switch (ambienteServidor.provedorIa) {
    case 'OPENAI': default: instancia = new ProvedorOpenAI({ chave: ambienteServidor.openaiChave }); return instancia;
  }
}
```

Sem parâmetro de organização/finalidade — a mesma instância/chave atende
todas as empresas do processo. Sem chave, cai em `ProvedorIaSimulado`
(fallback gracioso, atendimento humano continua). **A fábrica precisa ser
reescrita do zero** para aceitar `organizacaoId`/finalidade e resolver
credencial por linha de banco (especificação seção 6) — não é um ajuste
incremental do código atual.

### 2.6 Envio de mensagens

`lib/servicos/envio.ts`. Contrato em duas etapas deliberado: (1) grava
mensagem `PENDENTE` com `chave_idempotencia`; (2) enfileira despacho
(BullMQ). Estados de `status_mensagem`:
`PENDENTE → ENFILEIRADA → ENVIADA → ENTREGUE → LIDA` (ou `FALHOU`) — mapa de
ordem numérica no handler de webhook (`evento-webhook.ts:242-278`) impede
retrocesso (confirmação atrasada não rebaixa mensagem já `LIDA`).

Idempotência via `lib/nucleo/idempotencia.ts`: chaves determinísticas
SHA-256 (nunca aleatórias) — `chaveEnvioManual` usa membro+conteúdo+janela
de 5s (clique duplo cai na mesma chave), `chaveRespostaIa(conversaId,
mensagemGatilhoId)`, `chaveEnvioCampanha(campanhaId, contatoId)`. Constraint
única `(organizacao_id, chave_idempotencia)` no banco; violação (`23505`) é
tratada buscando a linha existente em vez de falhar. Antes de despachar,
`reservar_despacho_mensagem` (UPDATE condicional, reserva de 120s) impede
dois workers enviando a mesma mensagem.

**Timeout ambíguo — reconciliação, não retry cego**: flag `iniciouChamada`
distingue erro antes de chamar o provedor (retry seguro) de erro
depois/durante (estado incerto → `despacho_incerto=true`, **reenvio
automático bloqueado**, exige confirmação humana via `conferirEntrega()`,
`acoes.ts:641-645`, RPC `resolver_despacho`). View `fila_operacional` expõe
isso (`envio_incerto`), inclusive `ENFILEIRADA` há mais de 2min como sinal
de trava.

### 2.7 Processadores do worker

`trabalhador/processadores/evento-webhook.ts`, `midia.ts`, `analise-ia.ts`.

**Webhook idempotente/tolerante a ordem invertida**: sim, várias camadas —
evento já `PROCESSADO`/`IGNORADO` é pulado; mensagem duplicada detectada por
unicidade `(organizacao_id, identificador_externo)`; status fora de ordem
bloqueado pelo mapa monotônico (seção 2.6); conversa aberta duplicada via
índice único parcial `conversas_aberta_unica_idx` (`estado <> 'ENCERRADA'`),
com `resolverConversaAberta` relendo a conversa "vencedora" em corrida.

**ffmpeg é conversão de formato, não transcrição**:
`transcodificarParaNotaDeVoz` (`envio.ts:319-355`) converte áudio gravado
pelo atendente (webm/opus do navegador) para ogg/opus mono — único formato
que WhatsApp/Evolution renderiza como nota de voz. Só instalado na imagem
Docker do worker (`Dockerfile.worker`), nunca na Vercel/site.

**Transcrição enviada vs. recebida — confirmado, gap persiste**: só áudio
**recebido** do cliente é transcrito (`evento-webhook.ts:162`,
`status_transcricao='PENDENTE'` só se `midia.tipo==='AUDIO'` recebido;
`midia.ts:124-126` dispara Whisper via `lib/provedores/transcricao/indice.ts`).
Áudio **enviado** pelo atendente (`enviarAudioManual`, `acoes.ts:374-501`)
é gravado com `status_transcricao:'NAO_APLICAVEL'` (linha 439) — nunca entra
na fila. A especificação (seção 11.3) pede transcrição de saída também;
confirma que ainda falta implementar, não é suposição desatualizada.

### 2.8 Mapa de rotas/features — `app/(painel)/`

- `atendimento/` — central de conversas.
- `assistente-ia/`, `equipes/`, `supervisao/` — **mesmo componente**
  `GestaoOperacional` com prop `modo` diferente (`"ia"`/`"equipes"`/
  `"supervisao"`) — não são telas independentes, é a mesma fila operacional
  com lentes diferentes. Relevante para a Fase 2/4 do NewSec: pode virar
  uma única implementação parametrizada em vez de três.
- `campanhas/` (+ `[id]/`, `nova/`) — disparo em massa, janela de envio,
  limite diário, variações A/B.
- `configuracoes/` — hub: `atendimento/` (regras de horário/reabertura,
  tabela `regras_atendimento`), `auditoria/`, `campos/` (campos
  personalizados de contato), `canais/` (conexão Evolution/WhatsApp),
  `departamentos/`, `usuarios/`.
- `contatos/` (+ `[id]/`) — CRM básico do contato (equivalente simplificado
  ao que o CRM real já tem — não portar como está, mapear para paridade).
- `ia/` (+ `analise/`, `versoes/`) — configuração do agente, versionamento
  de prompt (`versoes_agente_ia`, fluxo de publicação), análise vira
  `sugestoes_ia` com status `PENDENTE` exigindo aprovação humana antes de
  nova versão (`analise-ia.ts:1-12`) — já implementa o "propostas revisáveis
  e versionadas" que a especificação pede (seção 11.5).
- `integracoes/` — hoje só existe **uma** integração real
  (`integracoes/page.tsx` redireciona direto para `integracoes/google-sheets`;
  comentário explícito no código confirma).
- `painel/` — dashboard/home da área logada.
- `relatorios/` — métricas de atendimento, exige papel `SUPERVISOR`.
- `respostas-rapidas/` — templates de resposta, por atendente ou
  compartilhados.
- `retornos/` — agendamento de follow-up, vencidos/hoje/próximos, sugestão
  automática (`fila_operacional.sugestao_retorno`).

**Não existe** base de conhecimento/FAQ em nenhum nível (confirmado por
Grep) — se isso aparece em algum README do Chat, o código não implementa.

### 2.9 Stack real

Next `^15.5.25` · **React `18.3.1`/`react-dom 18.3.1` (React 18, não 19 —
confirma a advertência da especificação de não instalar duas versões de
React ao portar)** · Tailwind `^3.4.14` + `tailwindcss-animate` +
`class-variance-authority` + Radix UI (dialog/dropdown/select/tabs/tooltip)
como base de componentes · BullMQ `^5.28.1` + `ioredis ^5.4.1` (worker
próprio, `trabalhador/principal.ts` via `tsx`, `Dockerfile.worker` dedicado,
**sem build do Next no worker** — comentário explícito no Dockerfile) ·
`@supabase/supabase-js ^2.116.0` + `@supabase/ssr ^0.12.7` · `openai ^4.73.0`
(único SDK de IA — conversa, JSON estruturado, transcrição, descrição de
imagem, todos pela mesma lib/chave) · `googleapis ^144.0.0` (Google Sheets).
Mídia: sem dependência npm de áudio/vídeo — depende do binário `ffmpeg` do
SO, só na imagem Docker do worker, chamado via `execFile`. Testes: `vitest
^2.1.5`. TypeScript `^5.6.3`.

### 2.10 Observações para `PERMISSIONS.md` / `FEATURE_PARITY.md`

- Sobrescrita silenciosa de campo/memória confirmada por origem (2.3) é o
  achado mais crítico para a Fase 3 — implementar `ProposedFact`/revisão
  explícita da especificação a partir do zero, o Chat atual não tem essa
  proteção apesar de já guardar a coluna `origem`.
  Ver [[SOURCE_INVENTORY]] item 3 (Focus) para o mesmo padrão de risco em
  outra área.
- Credencial OpenAI global (2.5) é bloqueador de arquitetura para multi-
  empresa de IA (especificação seção 6) — reescrever a fábrica antes de
  ligar IA para qualquer segunda empresa.
- Concorrência de atribuição (2.1) e confiabilidade de envio (2.6) já estão
  bem resolvidas no Chat atual (locks de linha, idempotência por SHA-256,
  reconciliação de timeout ambíguo) — portar a lógica de banco quase como
  está, não reinventar.
- `assistente-ia`/`equipes`/`supervisao` como uma view parametrizada (2.8) é
  um padrão de implementação reaproveitável para a Tela 04 (Supervisão) da
  especificação.

## 3. newsecfocus (produtividade)

### 3.1 Sessão/autenticação do dashboard

`dashboard/lib/sessao.ts`. Auth via Supabase SSR cookie-based
(`dashboard/lib/supabase/server.ts`); `dashboard/middleware.ts` revalida a
sessão a cada request. `carregarContexto()` (linhas 19-70) resolve
`profiles` (role, team_id, org_id) via `auth.getUser()` — **empresa não vem
do cliente**, vem do perfil no banco.

Papéis: `OWNER`, `MANAGER`, `TEAM_LEAD`, `VIEWER`. Escopo de equipe
(`equipeEscopo`) só é restrito para `TEAM_LEAD` (linha 50) — OWNER/MANAGER/
VIEWER enxergam a empresa inteira. `podeAdministrar()` = OWNER ou MANAGER.

### 3.2 Modelo de agregação e deduplicação entre dispositivos

Migração `0036_metricas_coerentes.sql` confirmada (nome/número batem
exatamente com a especificação). Cadeia: `0001_schema.sql` (`activity_logs`,
`productivity_categories`, `app_mappings`) → `0005_agregados_retencao.sql`
(resumos horário/diário/app-diário, consolidação incremental, retenção) →
`0019_classificacao_sem_duplicidade.sql` (corrige dupla classificação
domínio+processo) → `0036_metricas_coerentes.sql` (reescrita completa,
corrige 3 bugs documentados no próprio cabeçalho da migração).

**Deduplicação entre estações — mecanismo real**: `minutos_pessoa()` (0036,
linhas 137-167) resolve **antes de somar**, via `select distinct on
(employee_id, minuto) ... order by (estado='ATIVO') desc, (estado='OCIOSO')
desc, ...` — se a pessoa está ativa numa máquina e ociosa/sem dado em outra
no mesmo minuto, vale a ativa ("o ocioso da outra não apaga o trabalho",
comentário da migração). Excedente vira `minutos_sobrepostos` (coluna
dedicada em `resumo_pessoa_15min`), exposto como aviso, não como tempo
extra. Tela `/painel/registros` explica isso ao usuário: "Com duas estações
da mesma pessoa, os dois minutos aparecem aqui; nos indicadores, o minuto
conta uma vez só." Fonte única de todos os cards/relatórios:
`painel_produtividade_diaria()` (0036, linhas 704-880). Blocos de 15min
alinhados em UTC via `date_bin` resolvem fronteiras de escala fora da hora
cheia.

### 3.3 Liderança restrita a uma equipe — confirmado

`supabase/migrations/0004_saas_equipes_colaboradores.sql`: `profiles.team_id
uuid references teams(id)` é **coluna escalar**, não junção N:N (linha 147).
Comentário explícito: "Obrigatório para TEAM_LEAD: delimita a equipe que
esse gestor enxerga." Hierarquia declarada no cabeçalho: "Empresa → Equipe
(1 empresa) → Colaborador (1 equipe) → Atividade... uma pessoa pertence a
UMA equipe; uma equipe pertence a UMA empresa." `auth_escopo_equipe()`
(linhas 216-226) reforça isso em todas as RLS policies de
`teams/employees/activity_logs/devices/resumo_*`. `employees.team_id`
também é FK escalar. **Implicação para a especificação (seção 13, "evoluir
vínculo para supervisor com múltiplas equipes")**: é mudança real de schema
(coluna escalar → tabela de junção) que toca RLS em pelo menos 6 tabelas,
não um ajuste de UI.

### 3.4 Ingestão — empresa/equipe autenticadas, não soltas

Edge Functions `supabase/functions/registrar-dispositivo/index.ts` e
`ingestao-lote/index.ts`. **Matrícula do dispositivo é autenticada**:
`registrar-dispositivo` recebe `enrollment_key` (chave da empresa) +
`hardware_id` + `machine_name`, resolve empresa via RPC `empresa_por_chave`,
gera token aleatório, grava só o **hash** em `devices.token_hash`, devolve o
token em claro uma única vez. Upsert por `(org_id, hardware_id)` evita
duplicar em reinstalação.

**Ingestão subsequente é por token do dispositivo**: `ingestao-lote` lê
`Authorization: Bearer <token>`, calcula hash e busca `devices` por esse
hash — `org_id`, `equipe_padrao_id`, `nome_colaborador_padrao` vêm do
registro do dispositivo no servidor, **nunca do payload do agente**
("o agente nunca decide em qual empresa nem em quem grava", comentário do
código). Resolução de pessoa via RPC `resolver_colaborador` (cria/reaproveita
`employees` por `(org_id, os_user normalizado)`), distinguindo conta LOCAL
(só naquela máquina) de conta de DOMÍNIO/nuvem (mesma pessoa em qualquer
máquina).

### 3.5 Classificação de atividade

Estados de tempo (`ATIVO`/`OCIOSO`/`BLOQUEADO`) derivados de
`is_locked`/`is_idle` no servidor; "sem dados" é diferença
(`minutos_expediente - minutos_registrados`), não um estado gravado.
Categoria de produtividade: enum `PRODUCTIVE`/`NEUTRAL`/`UNPRODUCTIVE`;
"sem classificação" é `tipo IS NULL`.

Configuração é **tabela por empresa**, editável no dashboard, não arquivo:
`productivity_categories` (categorias) + `app_mappings` (regras
processo→categoria e domínio→categoria). RPC de classificação casa cada
minuto com a regra mais específica (domínio vence processo para navegador,
via `LEFT JOIN LATERAL ... LIMIT 1` — correção do bug de dupla contagem de
`0019`). Tela `/painel/aplicativos` (Administração › Classificação) lista
tudo que já apareceu e cruza com `app_mappings`, destacando pendentes. Seed
padrão por empresa nova (`aplicar_classificacao_padrao`): 3 categorias +
~80 regras (Office/IDEs/ERPs/portais gov.br como produtivo; Outlook/Teams/
WhatsApp/ChatGPT/Claude/Gemini como neutro/comunicação; YouTube/redes
sociais/streaming/e-commerce/apostas como improdutivo).

### 3.6 Limites de coleta — confirmado: sem teclado, sem tela, sem conteúdo de conversa

Agente em C#/.NET 8, `agente/src/Telemetria.Coletor/Monitoramento/`:

- **Teclado/mouse — só contagem**: `ContadoresEntrada.cs` usa hooks globais
  mas incrementa só contadores (`_teclas`, `_cliques`, `_rolagens`).
  Comentário explícito: "Nenhum código de tecla, caractere ou posição é lido
  ou guardado; o lParam dos eventos é ignorado por completo" — só o wParam
  (tipo de evento) importa.
- **Janela em foco — só executável e título, nunca captura de tela**:
  `InspetorJanela.cs` lê `process_name`/`window_title` via API do Windows.
  Busca por `screenshot|BitBlt|CopyFromScreen|keylog|GetAsyncKeyState` em
  todo `agente/src` e `supabase/functions` não encontrou nenhuma ocorrência
  em código próprio.
- **Minimização de dados antes de gravar** (`HigienizadorTexto.cs`, citando
  LGPD art. 6º III): remove e-mail do título, redige sequência de 6+ dígitos
  se configurado, normaliza URL para só o host.
- **Apps sigilosos — nem título é gravado**: lista configurável
  (`whatsapp.exe, telegram.exe, signal.exe, discord.exe, slack.exe,
  keepass.exe, keepassxc.exe, 1password.exe, bitwarden.exe`) grava título
  fixo `"(titulo nao coletado)"` e domínio nulo.
- **Campos efetivamente enviados** (um registro por minuto): `timestamp`,
  `process_name`, `window_title` (higienizado), `domain`, `is_idle`,
  `is_locked`, `keystrokes_count`, `mouse_clicks_count`, `scroll_count`,
  `active_seconds`, `foreground_seconds`, `os_user`. Nenhum campo de
  conteúdo digitado, imagem ou texto de conversa em nenhum ponto do
  contrato nem da tabela `activity_logs`.

**Suspensão — achado importante, parcialmente implementado, não esconder no
NewSec**: dois conceitos distintos.
1. Suspensão de energia (sleep/resume do Windows) — só log local de
   "estava dormindo", não é política de pausa.
2. **Suspensão administrativa (billing)** — `organizations.status`
   (`TRIAL/ATIVA/SUSPENSA/CANCELADA`). `ingestao-lote` calcula
   `collection_enabled = status not in ('SUSPENSA','CANCELADA')` e devolve
   isso na resposta, **mas não é aplicado**: o servidor grava o lote de
   `activity_logs` **antes** de checar o status da org (sem rejeição), e no
   agente o campo `ColetaHabilitada` existe no contrato mas **não há
   nenhuma leitura dele em código** — busca confirma só a declaração, nunca
   um uso. O próprio comentário do código admite: "ainda falta o serviço
   propagar a pausa ao coletor da sessão." **Hoje, suspender uma empresa não
   interrompe a coleta em lugar nenhum.** Isso é dívida técnica preexistente
   do Focus a resolver no NewSec, não um comportamento a copiar
   silenciosamente.
3. Janela de coleta configurável (HH:mm) — essa sim é respeitada: fora da
   janela, o agente simplesmente não grava, configuração aplicada via
   config remota assinada, recarregada a cada 2 minutos.

**Buffer offline pode continuar coletando indefinidamente — confirmado**:
`BufferTelemetria.cs` (SQLite/SQLCipher local) só purga por **idade**
(padrão 14 dias), nunca por suspensão — e como o coletor não consulta
`collection_enabled`, mesmo com a empresa `SUSPENSA` no servidor o agente
continua amostrando e empilhando no buffer local sem limite de quantidade.

### 3.7 Mapa de indicadores/rotas do dashboard (`dashboard/app/painel/`)

- **`/painel` (Visão Geral)**: cards "Tempo produtivo/expediente" (com
  variação vs. período anterior), "Tempo ativo", "Atividade fora do
  expediente", "Cobertura de dados"; barra empilhada de 7 fatias (produtivo,
  neutro, improdutivo, sem classificação, ocioso, bloqueado, sem dados);
  abas "Atividade ao longo do período", "Ritmo e alternância", "Últimos
  registros"; "Pontos de atenção" e comparativo entre equipes.
- **`/painel/pessoas`** (+ `[id]`): cadastradas/com registro/pendentes;
  tabela por pessoa (produtivo %, tempo ativo, cobertura, último registro).
- **`/painel/equipes`** (+ `[id]`): total de equipes/pessoas, tempo
  produtivo/expediente, cobertura; desempenho + composição por equipe.
- **`/painel/aplicativos`** (+ `[alvo]`): identificados/classificados/
  pendentes; donut de categorias; mais usados; lista com filtro.
- **`/painel/jornada`**: previsto, cobertura, fora da escala, pessoas com
  expediente; comparativo dia a dia (escala vs. blocos de 15min).
- **`/painel/horas-extras`**: redirect puro para `/painel/jornada`
  ("horas extras virou parte de jornada: 'fora da escala'").
- **`/painel/dispositivos`**: estações (com limite do plano), com/sem envio
  recente, versões do agente; detalhe + diário de eventos por estação.
- **`/painel/registros`**: tabela minuto a minuto, paginada.
- **`/painel/relatorios`**: prévia + exportação de 4 tipos (Diário,
  Colaboradores, Equipes, Aplicativos).
- **`/painel/administracao`**: pessoas, equipes, escalas, empresa/código de
  instalação, classificação, usuários.
- **`/painel/conta`**, **`/plataforma`** (painel do revendedor — RLS nega
  acesso a telemetria/resumos ao admin de plataforma).

**Nenhum indicador pode ser cortado** ao portar — isto é o catálogo integral
citado pela especificação seção 6/12.

### 3.8 Retenção e exportação

`organizations.retencao_dias` (padrão 90, entre 7 e 3650) — só o detalhado
(`activity_logs`) expira, via `expurgar_atividade_antiga()` agendada por
`pg_cron` (diária, 04:10 UTC). **Os agregados (resumo_horario/diario/
app_diario) nunca são apagados por retenção** — ficam permanentes para
histórico gerencial. Buffer local do agente tem retenção própria (14 dias,
independente). Exportação (`dashboard/lib/exportacao.ts`): XLSX (via
`exceljs`) e CSV (BOM UTF-8, padrão pt-BR) para os 4 tipos de relatório,
usando as mesmas funções/fonte que as telas.

### 3.9 Stack real

**Dashboard** (`dashboard/package.json`, pacote `newsec-focus-painel`
v2.0.0): Next `^15.5.25`, **React 18.3.1/React DOM 18.3.1 (React 18, igual
ao Chat — nenhum dos dois está em React 19 como o CRM)**,
`@supabase/ssr ^0.5.2` + `@supabase/supabase-js ^2.45.4`, `exceljs ^4.4.0`,
`recharts ^2.13.3`, `tailwindcss ^3.4.14`, TypeScript `^5.6.3`.

**Agente** (3 projetos .NET, versão unificada `1.6.0` em
`agente/src/Directory.Build.props`), todos `net8.0-windows`:
`Telemetria.Coletor` (processo na sessão do usuário, WinExe, WPF só para UI
Automation gerenciada — nenhuma janela criada), `Telemetria.Servico`
(Windows Service), `Telemetria.Nucleo` (biblioteca: SQLite+SQLCipher para
buffer local criptografado, DPAPI para cifrar o token do dispositivo).

### 3.10 Observações metodológicas e para `FEATURE_PARITY.md`

- Análise 100% estática (leitura de código/migrações); agente .NET e
  dashboard não foram compilados/rodados nesta inventariação.
- **Achado a não suavizar**: suspensão administrativa de conta hoje é
  decorativa de ponta a ponta — campo existe no contrato mas nada o lê no
  agente, e o servidor grava telemetria antes de checar status da org. É
  item de trabalho pendente do produto original a resolver no NewSec, não
  comportamento a herdar em silêncio.
- Evoluir líder→múltiplas equipes é migração real de schema (RLS em ≥6
  tabelas), não cosmético — orçar isso explicitamente na Fase 5.
- Deduplicação entre dispositivos e classificação de atividade já são
  soluções maduras (2+ ciclos de correção de bug documentados nas próprias
  migrações) — portar a lógica de agregação quase como está.
