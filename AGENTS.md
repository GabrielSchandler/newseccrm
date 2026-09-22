# NewSec — instruções para agentes (Codex e outros)

Mesmo projeto e mesmas regras descritas em `CLAUDE.md`. Este arquivo existe
porque ferramentas diferentes (Claude Code, Codex) leem nomes diferentes;
não duplique regras aqui — leia `CLAUDE.md` e a especificação completa em
`NEWSEC-ESPECIFICACAO-E-PROMPT-CLAUDE.md` antes de começar.

## Coordenação entre agentes

Quando Claude Code e Codex trabalharem no mesmo período: um executa por vez
em um conjunto de arquivos/branch, o outro revisa o diff (segurança do
isolamento multiempresa, regressões do CRM, uso de credencial de IA correta,
preservação de edição manual, paridade de indicadores). Não editar os
mesmos arquivos em paralelo sem coordenação explícita registrada em
`docs/PROGRESS.md`.

Antes de retomar qualquer trabalho: leia `docs/PROGRESS.md` (checkpoint real,
não depende de memória de conversa anterior), `docs/TASKS.md` e o diff local
(`git status` / `git diff`).
