# Como começar o projeto no Claude Code

## Preparação

1. Crie uma pasta de trabalho vazia para o novo produto ou abra uma cópia local derivada de GRSCRM. Não abra o ambiente de produção para esse primeiro ciclo.
2. Coloque o arquivo `NEWSEC-ESPECIFICACAO-E-PROMPT-CLAUDE.md` nessa pasta.
3. Baixe as dez imagens desta conversa e coloque-as em `docs/reference-images/`. Use os nomes da tabela abaixo. Se for mais simples, anexe as imagens na interface que você utiliza, garantindo que o Claude consiga vê-las.
4. Abra Claude Code nessa pasta e cole o prompt inicial abaixo. Não é necessário colar novamente toda a especificação na conversa: peça que ele leia o arquivo.

As imagens são referências conceituais. O texto da especificação define regras, fases e critérios. Pequenas diferenças entre mockups não são novas funcionalidades ou alterações do cadastro.

| Ordem | Nome sugerido | Conteúdo |
| --- | --- | --- |
| 01 | `01-atendimento-claro.png` | Tela principal do consultor |
| 02 | `02-atendimento-escuro.png` | Referência da paleta escura |
| 03 | `03-pre-venda-no-chat.png` | Drawer de pré-venda e preenchimento progressivo |
| 04 | `04-supervisao.png` | Fila e carga da equipe |
| 05 | `05-gestao.png` | Dashboard da empresa |
| 06 | `06-produtividade.png` | Focus dentro do sistema |
| 07 | `07-cliente-completo.png` | Cadastro e histórico integrado |
| 08 | `08-plataforma-master.png` | Empresas, módulos e limites |
| 09 | `09-editor-dashboards.png` | Personalização de indicadores |
| 10 | `10-academia.png` | Cursos e distribuição |

> **Nota real do projeto (22/09/2026):** das 11 imagens efetivamente recebidas, nenhuma cobre a Tela 07 (cliente completo) nem a Tela 08 (plataforma/master) — não existe referência visual para essas duas. Três marcas fictícias diferentes apareceram nos mockups (NewSec, "AtendoAI" e "WorkHub") e dois padrões de navegação (menu lateral vs. menu horizontal). O conjunto mais consistente — Atendimento escuro, Gestão, Produtividade, Editor de dashboards e Academia todos com o mesmo menu lateral NewSec em tema escuro — foi adotado como referência canônica; o restante (AtendoAI, WorkHub, variante clara com nav horizontal "GRS Consultoria") foi tratado como fora de marca e ignorado na padronização, conforme Anexo D. Ver `docs/reference-images/` e `docs/SOURCE_INVENTORY.md`.

## Prompt inicial — copiar a partir daqui

```text
Quero que você comece a implementação do NewSec, unificando meu CRM, Chat e Focus.

Leia integralmente NEWSEC-ESPECIFICACAO-E-PROMPT-CLAUDE.md nesta pasta. Esse arquivo é a especificação principal de arquitetura, produto, regras de negócio, permissões, migração e execução. Examine também as imagens em docs/reference-images/ ou anexadas. Se não conseguir ler alguma imagem, diga exatamente qual; não afirme ter visto o que não conseguiu abrir.

Repositórios de origem:
- https://github.com/GabrielSchandler/GRSCRM
- https://github.com/GabrielSchandler/newsecchat
- https://github.com/GabrielSchandler/newsecfocus

O CRM é a base. Seu banco de produção tem dados importantes e será preservado. Chat e Focus têm apenas dados de teste, sem necessidade de migração. A operação inicial tem cinco consultores e dois números WhatsApp não oficiais, atendendo comercial e jurídico. Não presuma que um canal é exclusivo de um setor.

Vamos desenvolver em uma nova cópia/repositório derivado do CRM, preservando seu histórico, com ambiente de desenvolvimento/homologação separado. O nome local provisório pode ser newsec-unified. Não conecte testes ou previews ao banco de produção. Não crie um novo backend concorrente para clientes, empresas e login.

Nesta execução, conclua a Fase 0 e implemente a Fase 1 da especificação. Quero trabalho concreto, não apenas uma proposta:
1. Inspecione as instruções do workspace, git status, os três repositórios e seus SHAs; preserve minhas alterações existentes.
2. Registre baseline real, inventário de funções/rotas/dados, compatibilidade da stack, mapa de permissões, arquitetura e paridade. Use código como evidência, não apenas README.
3. Prepare a base local derivada do CRM quando ainda não existir. Preserve regras, rotas e identificadores. Não copie cegamente package.json ou migrações do Chat/Focus.
4. Crie a documentação central indicada na especificação e instruções curtas em CLAUDE.md e AGENTS.md, preservando instruções existentes.
5. Implemente shell, navegação, tokens claro/escuro, layout de atendimento e drawers com modo de demonstração explícito, preservando as páginas existentes do CRM.
6. Defina/prepare a fundação de empresas, vínculos, permissões e migrações aditivas proporcional ao que esta fase requer. Sem banco de homologação configurado, produza o que pode ser validado localmente e registre a execução pendente.
7. Valide build, tipos e regressões relevantes com os comandos reais disponíveis. Inspecione as telas no navegador se houver ferramenta para isso.
8. Atualize docs/PROGRESS.md e docs/TASKS.md com estado, evidências e próxima tarefa executável.

Prioridade visual: use a Tela 01 para hierarquia do atendimento; Tela 02 para paleta escura, mantendo a mesma estrutura; Tela 03 para interação dos drawers. Padronize pequenas diferenças de logotipo, menu e espaçamento entre imagens. Não implemente campos obrigatórios, chamadas de voz/vídeo ou canais adicionais apenas porque um mockup os mostrou. As exigências reais são as do CRM e da especificação.

Regras inegociáveis:
- Não perder nenhuma capacidade existente; manter mapa de paridade e registrar o que ainda não foi portado.
- Não enfraquecer validações: Obrigatório, Jurídico e Opcional vêm do CRM atual.
- Análise sem cliente continua possível onde já existe; pré-venda respeita os requisitos reais.
- Contato de chat não precisa virar cliente incompleto para poder conversar.
- Isolamento por empresa/equipe deve existir no servidor e no banco, não só no menu.
- Atualização de contexto pela IA não pode sobrescrever silenciosamente informação manual confirmada.
- Focus inclui todos os indicadores, ingestão e agente, não somente alguns cards.
- Dados sintéticos e adapters simulados devem ser identificados; não declarar integração real como concluída com base em mocks.

Você pode executar ações locais reversíveis necessárias a essas duas fases sem pedir confirmação a cada arquivo. Não aplique migrações em produção, não publique produção, não conecte/substitua os números ativos, não envie mensagens reais e não cancele Totalk nesta execução. Prepare as etapas futuras, mas não execute fases 2–6 automaticamente agora.

Se faltar acesso ou configuração, prossiga nas tarefas independentes e registre o bloqueio exato. Pergunte apenas quando uma decisão de negócio ou acesso impedir trabalho necessário e não puder ser resolvida pela inspeção. Não invente testes executados, dados, credenciais ou endpoints.

Ao terminar, entregue: comportamento implementado, arquivos principais, como abrir a demonstração, comandos/testes e resultados, limitações reais, migrações criadas/aplicadas e próxima tarefa recomendada. O checkpoint deve permitir retomar com outra sessão ou com Codex sem depender desta conversa.
```

## Prompt de continuidade — depois do primeiro ciclo

Use este texto somente quando quiser autorizar a próxima entrega. Substitua a indicação entre colchetes por uma fase/tarefa concreta do checkpoint.

```text
Continue o projeto NewSec a partir do estado real do repositório.

Leia as instruções existentes, docs/PROGRESS.md, docs/TASKS.md, a especificação principal e o diff atual antes de editar. Não recomece o projeto nem refaça decisões concluídas sem evidência de problema.

A entrega deste ciclo é: [fase e tarefa concreta].

Execute essa entrega ponta a ponta, reutilizando o código atual e preservando permissões, validações e compatibilidade com o CRM. Faça os testes adequados ao risco e atualize o checkpoint com comandos e resultados reais. Se a janela de uso terminar, o próximo passo deve ficar explícito no arquivo, sem depender da memória desta conversa.

As restrições de produção continuam válidas até eu autorizar uma operação concreta. Se faltar uma dependência externa, conclua o trabalho local independente e identifique exatamente o que falta.
```

## Prompt para usar o outro assistente como revisor

```text
Revise o diff desta entrega do NewSec contra a especificação e o checkpoint. Neste ciclo, faça revisão; não edite os mesmos arquivos em paralelo ao executor.

Concentre-se em: regressões do CRM; isolamento multiempresa e multiequipe; perda ou duplicação de mensagens; uso da credencial correta de IA; preservação de edição manual; compatibilidade de migrações; paridade dos indicadores; e afirmações de testes sem evidência.

Reporte problemas concretos com arquivo, trecho/localização, cenário de falha, impacto e correção sugerida. Diferencie bloqueadores, melhorias posteriores e dúvidas. Não proponha reescrita ampla por preferência de estilo. Não conclua que transporte WhatsApp foi validado se só existem mocks.
```

## Ordem recomendada de trabalho

Primeiro, base e telas navegáveis. Depois, chat humano integrado. Em seguida, ações do CRM e IA essencial no atendimento. Então, importação, piloto e corte do Totalk. Focus completo e dashboards avançam conforme o backlog, com editor de dashboards e Academia ampliada nas etapas posteriores.

Essa ordem preserva o objetivo completo e concentra o início na operação que precisa substituir a mensalidade atual. O prazo depende principalmente do estado real da integração, acesso à API, conexão dos números e resultado do piloto.
