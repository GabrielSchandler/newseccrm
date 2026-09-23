# NewSec — mapa de permissões

Base factual em `SOURCE_INVENTORY.md`. Este documento propõe a equivalência
entre o que existe hoje nos três sistemas e o modelo alvo da especificação
(seção 5: Master/Gerente/Supervisor/Consultor, vínculos muitos-para-muitos
usuário↔empresa e supervisor↔equipe). É proposta de arquitetura para a
Fase 1, não implementação ainda.

## 1. O que existe hoje (fato, não proposta)

| Sistema | Modelo de papel | Vínculo usuário↔empresa | Vínculo usuário↔equipe |
| --- | --- | --- | --- |
| CRM | `role` (admin/manager/seller) × `business_area` (commercial/legal) × `legal_role` (admin/consultant), três dimensões ortogonais | **1:1** — cada `user_profiles` tem 1 `company_id`. Override só para `is_platform_owner` (troca via cookie, sem vínculo real) | Não existe conceito de equipe no CRM |
| Chat | Não documentado como enum central; ao menos um gate por `SUPERVISOR` encontrado em `/relatorios`. Departamentos existem como conceito de roteamento (`departamentos/`), não de hierarquia de pessoas | 1:1 implícito (organização única por sessão, `organizacao_id`) | Não claramente modelado — atendentes são "membros" (`membro_id`), sem tabela de equipe distinta de departamento |
| Focus | `OWNER`, `MANAGER`, `TEAM_LEAD`, `VIEWER` (enum `papel_usuario`) | 1:1 — `profiles.org_id` | **1:1 escalar** — `profiles.team_id`/`employees.team_id` são FK simples, não junção N:N. Regra de negócio explícita no schema: "uma pessoa pertence a UMA equipe; uma equipe pertence a UMA empresa" |

**Conclusão que atravessa os três**: nenhum dos três sistemas de origem
suporta hoje usuário em múltiplas empresas nem supervisor em múltiplas
equipes. A especificação pede exatamente isso (seção 5) — é trabalho real de
schema/RLS da Fase 1, em pelo menos 6 tabelas do Focus (`teams`, `employees`,
`activity_logs`, `devices`, `resumo_horario`, `resumo_diario`,
`resumo_app_diario`) mais o que for equivalente no CRM e no Chat. Não tratar
como um ajuste de enum.

## 2. Proposta de equivalência para o modelo alvo

| Alvo (especificação seção 5) | Equivalente mais próximo hoje | Observação |
| --- | --- | --- |
| **Master** (plataforma) | CRM `is_platform_owner`; conceito próximo de painel `/plataforma` do Focus (admin de plataforma, RLS já nega acesso a telemetria por padrão) | O CRM já resolve "master não vê dado privado por padrão" para módulos; o Focus já resolve isso para telemetria. Herdar os dois princípios, não reinventar. |
| **Gerente** (empresas vinculadas) | CRM `role=admin`/`manager`; Focus `MANAGER` (enxerga a empresa inteira, `equipeEscopo=null`) | Hoje 1:1 com a empresa — vínculo N:N é o que falta. |
| **Supervisor** (equipes autorizadas) | Chat papel `SUPERVISOR` (gate em `/relatorios`); Focus `TEAM_LEAD` (restrito a 1 equipe hoje) | Ponto de maior esforço de migração: Focus tem a restrição de 1 equipe **imposta em RLS**, não só em UI. |
| **Consultor** | CRM `role=seller`; Chat atendente/membro padrão; Focus implícito (colaborador comum, sem papel de gestão) | Dimensão `business_area` (comercial/jurídico) do CRM é ortogonal a este papel e deve ser preservada como está — a especificação (seção 5) já avisa para não colapsar isso numa única enumeração. |

## 2.1 Implementado (22-23/09/2026)

`supabase/migrations/0001_equipes.sql` cria `public.teams` e
`public.team_memberships` (N:N usuário↔equipe, com `membership_role`
`supervisor`/`member`) dentro do próprio CRM — resolve a metade
"supervisor em várias equipes" da lacuna descrita acima, de forma aditiva
(nenhuma tabela existente alterada, nenhum código hoje lê estas tabelas,
RLS reaproveitando as funções `current_user_*` já existentes no CRM). Ainda
não aplicado em nenhum ambiente — SQL pronto para colar no SQL Editor do
Supabase de homologação. Nenhuma tela ainda usa isso (fundação de dado, não
de produto).

**Não incluído nesta migração, de propósito**: usuário em várias empresas.
Isso exige mudar `src/lib/auth/current-user.ts` e
`src/lib/supabase/middleware.ts` — código de autenticação crítico, usado
por todas as rotas autenticadas — e generalizar o mecanismo que hoje só
existe para `is_platform_owner` (troca de empresa ativa via cookie
`ACTIVE_COMPANY_COOKIE_NAME`) para qualquer usuário com mais de um
`user_profiles`. É mudança de maior risco, que merece sessão dedicada com
teste de dois usuários em duas empresas antes de aplicar — não entra numa
migração "de passagem" junto com outra coisa.

## 3. Decisões que a Fase 1 precisa tomar (não resolvidas aqui)

- Formato do vínculo N:N usuário↔empresa: nova tabela de
  membership/vínculo, papel por vínculo (não por usuário global), e como o
  `is_platform_owner` do CRM e o painel `/plataforma` do Focus convergem
  para o papel Master único.
- Formato do vínculo N:N supervisor↔equipe: substituir `team_id` escalar do
  Focus por tabela de junção, com migração de dados (cada `team_id` atual
  vira uma linha na nova tabela) e atualização de todas as policies RLS que
  hoje usam `auth_escopo_equipe()`.
- Onde a dimensão `business_area` (comercial/jurídico) do CRM se encaixa no
  modelo de módulos/entitlements (especificação seção 6) — é módulo,
  atributo do vínculo, ou os dois.
- Se o gate `SUPERVISOR` do Chat em `/relatorios` deve virar checagem de
  módulo+papel unificada ou continuar um caso especial.

## 4. Reforços a preservar (já funcionam bem hoje — não reinventar)

- RLS multiempresa do CRM: varredura dinâmica de toda tabela com
  `company_id`, aplicada sistematicamente (`docs/sql/plataforma-multiempresas.sql`
  no CRM clonado).
- Lock de linha (`select ... for update`) + coluna `versao` para
  concorrência de atribuição de conversa no Chat — portar a lógica de banco
  quase como está.
- RLS por `team_id` do Focus já é real e testada em produção (mesmo que
  restrita a 1 equipe) — migrar a estrutura (escalar → N:N), não a
  disciplina de enforcement.

Ver `SOURCE_INVENTORY.md` seções 1.9, 2.10 e 3.10 para o detalhe factual por
trás de cada linha acima.
