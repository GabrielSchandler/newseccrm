import type { AcademyChapter, AcademyCourse, AcademyQuestion } from "@/types/academy";

function question(
  id: string,
  prompt: string,
  correctLabel: string,
  wrongLabels: string[],
  explanation: string,
): AcademyQuestion {
  return {
    id,
    prompt,
    explanation,
    options: [
      { id: `${id}-a`, label: wrongLabels[0], isCorrect: false },
      { id: `${id}-b`, label: correctLabel, isCorrect: true },
      { id: `${id}-c`, label: wrongLabels[1], isCorrect: false },
    ],
  };
}

const chapters: AcademyChapter[] = [
  {
    id: "operacao-grs",
    title: "Mapa da operacao: do lead ao acompanhamento",
    objective:
      "Entender a jornada completa do cliente no CRM, o papel de cada area e o padrao minimo de registro.",
    estimatedMinutes: 50,
    sections: [
      {
        title: "A jornada real do cliente",
        body: [
          "O atendimento comeca no lead, passa por diagnostico comercial, simulacao, pre-venda, pagamento, contrato, documentos, juridico e acompanhamento. Cada etapa precisa deixar rastro no CRM.",
          "O cliente nao compra apenas um documento. Ele compra seguranca para lidar com uma divida que pesa no orcamento. Por isso, clareza e continuidade importam tanto quanto fechamento.",
          "O CRM tira a operacao da memoria individual. Qualquer pessoa autorizada deve conseguir entender o caso sem depender de conversas soltas.",
        ],
      },
      {
        title: "Responsabilidades por area",
        body: [
          "Comercial qualifica, explica, simula, registra, vende e garante que pagamento e contrato estejam corretos.",
          "Juridico conduz esteira, documentos, comunicacoes, cobrancas de etapa e atualizacoes publicas quando necessario.",
          "Gestao acompanha qualidade, produtividade, metas, usuarios, templates, seguranca e indicadores. Financeiro confere vendas, metas liquidas, entradas, saidas e comissoes.",
        ],
      },
      {
        title: "Padrao minimo de atendimento",
        body: [
          "Todo atendimento precisa ter origem do lead, produto, dor principal, dados de contato, consultor responsavel, status atualizado, proximo passo e resumo de combinados.",
          "Pre-venda aprovada precisa ter descricao do acordo de pagamento, forma de pagamento, valores, documentos gerados e passagem de bastao para o juridico quando aplicavel.",
          "No acompanhamento publico do cliente, publique apenas informacoes objetivas e seguras. Dados sensiveis, documentos e estrategia interna ficam restritos ao CRM.",
        ],
      },
    ],
    checkpoint: question(
      "operacao-check",
      "Qual e o principal papel do CRM na operacao GRS?",
      "Centralizar historico, status, documentos e proximos passos do cliente.",
      ["Guardar apenas nome e telefone.", "Substituir todo atendimento humano."],
      "O CRM e a memoria operacional da empresa. Sem registro, o processo fica fragil e dependente de pessoas.",
    ),
    exam: [
      question(
        "operacao-exam-1",
        "Quando uma pre-venda e aprovada, o que precisa ficar claro?",
        "Pagamento, contrato, responsaveis, documentos e proximo passo.",
        ["Somente o valor da venda.", "Somente o nome do consultor."],
        "A aprovacao inicia uma esteira operacional; sem dados completos, o juridico recebe um caso fraco.",
      ),
      question(
        "operacao-exam-2",
        "Qual informacao deve ir para o acompanhamento publico?",
        "Atualizacoes objetivas e liberadas para consulta externa.",
        ["Dados sensiveis do cliente.", "Discussao interna da estrategia juridica."],
        "O portal do cliente deve informar sem expor dados desnecessarios.",
      ),
    ],
  },
  {
    id: "fundamentos-revisional-regulatorio",
    title: "Fundamentos do revisional: BCB, CDC, STJ e limites",
    objective:
      "Dar base tecnica e regulatoria para explicar revisional de forma segura, sem parecer juridico improvisado.",
    estimatedMinutes: 70,
    sections: [
      {
        title: "O que e analise revisional",
        body: [
          "Revisional e a analise de um contrato para verificar se juros, encargos, CET, tarifas, seguros, saldo devedor e cobrancas estao coerentes com o que foi contratado e com parametros de mercado.",
          "Nao e cancelamento magico de divida. Tambem nao e autorizacao para parar de pagar sem avaliacao. E uma estrategia tecnica que depende de documentos, calculo, produto, historico e risco do caso.",
          "O consultor deve falar em indicios, viabilidade e analise. Nunca deve falar em resultado garantido antes de validacao.",
        ],
      },
      {
        title: "Banco Central como parametro",
        body: [
          "As taxas medias divulgadas pelo Banco Central ajudam a comparar a operacao do cliente com praticas de mercado na epoca da contratacao e na modalidade correta.",
          "CET, taxa mensal, taxa anual, prazo, garantias, risco da operacao e relacionamento bancario influenciam a leitura. Comparar produto errado gera diagnostico errado.",
          "Fala segura: vamos comparar seus dados com parametros publicos e avaliar se ha indicios tecnicos para discutir.",
        ],
      },
      {
        title: "CDC e STJ em linguagem comercial",
        body: [
          "O Codigo de Defesa do Consumidor reforca informacao adequada, transparencia e cuidado contra praticas abusivas.",
          "O entendimento do STJ exige cautela: juros altos nao significam, por si so, abusividade automatica. O caso concreto precisa ser demonstrado.",
          "Frase proibida: seu contrato e abusivo com certeza. Frase correta: pelos dados iniciais, existem pontos que merecem analise tecnica.",
        ],
      },
    ],
    checkpoint: question(
      "fundamentos-regulatorio-check",
      "Qual e a forma mais segura de falar sobre taxa media do Banco Central?",
      "Ela e um parametro de comparacao que ajuda na analise, mas nao garante resultado.",
      ["Ela prova automaticamente abuso.", "Ela substitui contrato e documentos."],
      "Parametro publico ajuda, mas revisional depende de caso concreto, contrato e validacao tecnica.",
    ),
    exam: [
      question(
        "fundamentos-regulatorio-exam-1",
        "Antes da analise completa, o consultor pode afirmar que:",
        "Existem indicios que precisam ser avaliados com documentos e calculo.",
        ["A reducao e certa.", "O banco sera obrigado a quitar o contrato."],
        "A fala profissional protege a relacao com o cliente e evita promessa indevida.",
      ),
      question(
        "fundamentos-regulatorio-exam-2",
        "Qual cuidado vem do entendimento do STJ sobre juros?",
        "Juros altos nao bastam sozinhos; o caso concreto precisa demonstrar abuso.",
        ["Todo juros acima de 12% ao ano e ilegal.", "Nao existe revisao judicial de juros."],
        "O curso deve formar consultores prudentes, nao vendedores de promessa.",
      ),
    ],
  },
  {
    id: "produtos-documentos",
    title: "Produtos, documentos e qualificacao do caso",
    objective:
      "Diferenciar veiculo, imovel e emprestimo, reconhecer documentos essenciais e saber quando a oportunidade esta pronta para analise.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "Produtos atendidos",
        body: [
          "Veiculo costuma envolver contrato, parcela, saldo devedor, documento do bem, risco de busca e apreensao e negociacao com financeira.",
          "Imovel tende a ter prazo maior, saldo relevante, sistema de amortizacao, evolucao do saldo e impacto alto no orcamento familiar.",
          "Emprestimo e renegociacao exigem cuidado com CET, refinanciamentos sucessivos, seguros, tarifas e se a divida virou ciclo de dependencia.",
        ],
      },
      {
        title: "Documentos por prioridade",
        body: [
          "Prioridade 1: contrato, identificacao do cliente, valor da parcela, quantidade de parcelas, parcelas pagas e banco ou financeira.",
          "Prioridade 2: boleto, extrato de evolucao, demonstrativo de saldo, comprovantes de pagamento, notificacoes recebidas e documentos do bem quando houver.",
          "Prioridade 3: prints de cobranca, protocolos, mensagens do banco e outros elementos que ajudem a comprovar contexto.",
        ],
      },
      {
        title: "Qualidade do dado",
        body: [
          "Telefone, CPF, nome e produto precisam ser conferidos antes de cadastrar. Erro pequeno vira documento errado, simulacao errada e retrabalho juridico.",
          "Se um campo nao existe na planilha, nao invente. Se o cliente nao informou, registre pendencia ou deixe como nao informado conforme regra do formulario.",
          "Dados financeiros devem ser digitados com atencao a virgula, ponto, centavos e formato brasileiro.",
        ],
      },
    ],
    checkpoint: question(
      "produtos-documentos-check",
      "Qual e a melhor conduta quando falta documento importante?",
      "Registrar pendencia, explicar impacto e orientar o cliente sobre o envio.",
      ["Inventar dados para nao perder tempo.", "Ignorar a ausencia e prometer resultado."],
      "A falta de documento muda a seguranca da analise e precisa ficar registrada.",
    ),
    exam: [
      question(
        "produtos-documentos-exam-1",
        "Em financiamento de veiculo, um risco comum a mapear e:",
        "Busca e apreensao ou cobranca relacionada ao bem.",
        ["Apenas vencimento do cartao.", "Declaracao de imposto de renda."],
        "O risco do bem muda urgencia, linguagem e estrategia.",
      ),
      question(
        "produtos-documentos-exam-2",
        "Qual dado nao deve ser inventado pelo consultor?",
        "CPF, telefone, valor, parcela ou qualquer informacao do cliente.",
        ["Apenas observacao interna.", "Apenas origem do lead."],
        "Dados falsos contaminam documentos, calculos e historico.",
      ),
    ],
  },
  {
    id: "diagnostico-consultivo-avancado",
    title: "Diagnostico consultivo: perguntas, escuta e prioridade",
    objective:
      "Ensinar uma abordagem consultiva com perguntas bem organizadas, evitando interrogatorio frio e proposta generica.",
    estimatedMinutes: 65,
    sections: [
      {
        title: "Atendimento consultivo na pratica",
        body: [
          "Atender de forma consultiva e entender primeiro, orientar depois e vender apenas quando a solucao fizer sentido para a dor apresentada.",
          "O cliente deve sentir que foi ouvido. Perguntas em excesso, sem contexto, parecem interrogatorio e reduzem confianca.",
          "Antes de apresentar valor, entenda produto, urgencia, parcela, atraso, objetivo do cliente e capacidade de cumprir o combinado.",
        ],
      },
      {
        title: "Roteiro SPIN adaptado a GRS",
        body: [
          "Situacao: qual banco, produto, valor da parcela, prazo e quantas parcelas ja foram pagas?",
          "Problema: o que pesa hoje, parcela, saldo, atraso, ameaca de busca, negativacao ou falta de clareza?",
          "Implicacao: se nada mudar, o que acontece com seu orcamento, seu bem ou sua tranquilidade nos proximos meses?",
          "Necessidade de solucao: se conseguirmos identificar um caminho para reduzir impacto, renegociar ou revisar cobrancas, isso resolveria qual parte do problema?",
        ],
      },
      {
        title: "Classificacao de prioridade",
        body: [
          "Alta prioridade: atraso, risco de perda do bem, parcela sufocante, banco pressionando, cliente com documentos prontos e decisao proxima.",
          "Media prioridade: cliente interessado, dados parciais, sem risco imediato, precisa de explicacao e follow-up.",
          "Baixa prioridade: curiosidade sem dor clara, sem documentos, sem autorizacao para contato ou fora do perfil atendido.",
        ],
      },
    ],
    checkpoint: question(
      "diagnostico-avancado-check",
      "Qual pergunta melhor representa implicacao?",
      "Se essa parcela continuar assim, como isso afeta seu orcamento nos proximos meses?",
      ["Qual e o banco?", "Voce prefere Pix ou boleto?"],
      "Pergunta de implicacao ajuda o cliente a visualizar consequencia real sem criar medo artificial.",
    ),
    exam: [
      question(
        "diagnostico-avancado-exam-1",
        "Venda consultiva significa:",
        "Entender necessidade, orientar com clareza e propor quando fizer sentido.",
        ["Enviar preco antes de ouvir.", "Fazer perguntas sem explicar motivo."],
        "Consulta bem feita aumenta conversao e reduz cancelamento.",
      ),
      question(
        "diagnostico-avancado-exam-2",
        "O resumo de diagnostico deve conter:",
        "Dor, produto, banco, dados, pendencias e proximo passo.",
        ["Opiniao pessoal sem fatos.", "Somente o nome do cliente."],
        "Resumo bom reduz retrabalho e melhora passagem de bastao.",
      ),
    ],
  },
  {
    id: "simulacao-proposta",
    title: "Simulacao, proposta e leitura de indicadores",
    objective:
      "Padronizar a preparacao da simulacao, leitura do PDF e apresentacao da proposta com seguranca e impacto comercial.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "Antes de gerar a simulacao",
        body: [
          "Confira produto, banco, valor financiado, valor da parcela, quantidade de parcelas, parcelas pagas e entrada quando aplicavel.",
          "Valores devem ser digitados em formato brasileiro com cuidado. Um erro de centavos ou separador pode multiplicar a parcela e destruir a confianca.",
          "Se o produto for imovel ou emprestimo, nao force campos de veiculo. Use apenas o que realmente se aplica ao caso.",
        ],
      },
      {
        title: "Como explicar o PDF",
        body: [
          "Comece pelo resumo da operacao atual: o cliente precisa enxergar o tamanho do problema antes de entender a oportunidade.",
          "Depois explique economia total, economia mensal, parcela corrigida e saldo devedor pos-correcao como estimativas baseadas nos dados informados.",
          "Use frases simples: hoje seu contrato projeta este custo; com a estrategia revisional, a estimativa inicial aponta possibilidade de reduzir impacto.",
        ],
      },
      {
        title: "Reducao da parcela",
        body: [
          "A reducao padrao e ponto de partida operacional, nao verdade absoluta. Se o juros do cliente for baixo, uma reducao alta pode gerar projecao irreal.",
          "O consultor deve escolher percentual com criterio, observando produto, parcela, perfil do contrato e plausibilidade do resultado.",
          "Se nao tiver seguranca, registre a simulacao como estimativa conservadora e peca validacao antes de apresentar como argumento principal.",
        ],
      },
    ],
    checkpoint: question(
      "simulacao-proposta-check",
      "Qual e a melhor forma de apresentar economia no PDF?",
      "Como estimativa inicial baseada nos dados informados e sujeita a validacao.",
      ["Como reducao garantida pelo banco.", "Como valor que dispensa contrato."],
      "Simulacao profissional orienta decisao, mas nao substitui analise completa.",
    ),
    exam: [
      question(
        "simulacao-proposta-exam-1",
        "Antes de gerar PDF, o consultor deve:",
        "Conferir produto, valores, parcelas e dados do contrato.",
        ["Gerar rapido sem revisar.", "Usar os mesmos dados para todos."],
        "Simulacao errada gera venda fraca e retrabalho.",
      ),
      question(
        "simulacao-proposta-exam-2",
        "Quando a reducao padrao parecer agressiva demais:",
        "Ajuste o percentual com criterio e registre estimativa conservadora.",
        ["Ignore e mantenha sempre igual.", "Prometa que o juridico resolve depois."],
        "Curso bom ensina julgamento operacional, nao clique automatico.",
      ),
    ],
  },
  {
    id: "comunicacao-scripts",
    title: "Comunicacao profissional: ligacao, WhatsApp e scripts",
    objective:
      "Criar padrao de linguagem para abordagem, retorno, follow-up, audio, mensagem e registro de combinados.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "Tom de voz GRS",
        body: [
          "A voz da operacao deve ser humana, objetiva, confiante e responsavel. Nem fria como atendimento robotico, nem agressiva como venda de urgencia falsa.",
          "Evite exageros, letras maiusculas, excesso de emoji, termos juridicos soltos e mensagens longas sem proximo passo.",
          "Toda mensagem importante deve terminar com uma acao clara: enviar documento, confirmar dados, autorizar simulacao, escolher pagamento ou agendar retorno.",
        ],
      },
      {
        title: "Script de primeira abordagem",
        body: [
          "Abertura: vi que voce pediu orientacao sobre seu contrato. Vou levantar alguns dados para entender se faz sentido uma analise revisional.",
          "Diagnostico: qual e o banco, produto, valor da parcela, total de parcelas e quantas voce ja pagou?",
          "Transicao: com essas informacoes eu consigo preparar uma leitura inicial e te explicar o caminho mais seguro, sem promessa antecipada.",
        ],
      },
      {
        title: "Audio com resumo escrito",
        body: [
          "Audio pode gerar conexao, mas nao pode ser a unica prova do combinado. Depois de audio importante, envie resumo escrito e registre no CRM.",
          "Resumo ideal: conforme conversamos, vamos analisar seu contrato de veiculo com parcela aproximada de X, banco Y, e o proximo passo e enviar o contrato/documento.",
        ],
      },
    ],
    checkpoint: question(
      "comunicacao-scripts-check",
      "Qual pratica melhora seguranca depois de um audio importante?",
      "Enviar resumo escrito e registrar o combinado no CRM.",
      ["Confiar apenas no audio.", "Apagar a conversa para limpar historico."],
      "Resumo escrito reduz conflito e melhora continuidade operacional.",
    ),
    exam: [
      question(
        "comunicacao-scripts-exam-1",
        "Uma boa mensagem comercial deve terminar com:",
        "Um proximo passo claro.",
        ["Uma promessa absoluta.", "Um texto longo sem pedido objetivo."],
        "Proximo passo transforma conversa em avanco.",
      ),
      question(
        "comunicacao-scripts-exam-2",
        "Qual frase e mais alinhada ao padrao GRS?",
        "Vamos analisar seus dados e verificar se ha fundamento para revisao.",
        ["Seu contrato reduz com certeza.", "Se nao fechar agora voce perde tudo."],
        "O padrao e firme, mas responsavel.",
      ),
    ],
  },
  {
    id: "objecoes-negociacao",
    title: "Objecoes, negociacao e tomada de decisao",
    objective:
      "Ensinar a identificar a objecao real, responder com criterio e conduzir decisao sem confronto.",
    estimatedMinutes: 65,
    sections: [
      {
        title: "Objecao nao e rejeicao",
        body: [
          "Objecao e informacao. Pode ser falta de dinheiro, falta de confianca, medo de golpe, comparacao com concorrente, duvida juridica ou necessidade de falar com familiar.",
          "Antes de responder, classifique a objecao. Quem responde preco quando o cliente tem medo de golpe nao resolve nada.",
          "A estrutura e: acolher, investigar, esclarecer, conectar ao valor e confirmar proximo passo.",
        ],
      },
      {
        title: "Preco, confianca e prazo",
        body: [
          "Quando o cliente diz que esta caro, pergunte comparado a que, qual seria uma condicao viavel e qual impacto a parcela atual ja causa no orcamento.",
          "Clientes de ticket alto precisam de prova de seriedade: contrato, recibo, CNPJ, canais oficiais, documentos, acompanhamento e clareza de etapas.",
          "Prazos variam por banco, produto, resposta extrajudicial, necessidade de laudo, documentacao e eventual judicializacao.",
        ],
      },
      {
        title: "Limite do que a empresa controla",
        body: [
          "A empresa controla analise, organizacao, comunicacao, documentos, notificacoes, registro e acompanhamento.",
          "A empresa nao controla decisao do banco, tempo do Judiciario, aceite automatico de acordo ou resultado de liminar.",
          "Alinhar controle e limite reduz frustracao futura.",
        ],
      },
    ],
    checkpoint: question(
      "objecoes-negociacao-check",
      "Qual e a primeira atitude diante de uma objecao?",
      "Entender o motivo real antes de responder.",
      ["Rebater rapidamente.", "Dar desconto imediato."],
      "A objecao certa precisa da resposta certa; sem diagnostico, a negociacao fica aleatoria.",
    ),
    exam: [
      question(
        "objecoes-negociacao-exam-1",
        "Cliente com medo de golpe precisa principalmente de:",
        "Processo claro, contrato, canais oficiais e seguranca.",
        ["Mais pressao.", "Promessa de resultado imediato."],
        "Confianca se constroi com transparencia e provas de processo.",
      ),
      question(
        "objecoes-negociacao-exam-2",
        "O que a GRS controla no prazo do cliente?",
        "Organizacao, analise, documentos, comunicacao e acompanhamento.",
        ["Decisao obrigatoria do banco.", "Tempo exato do Judiciario."],
        "Alinhar controle e limite reduz frustracao futura.",
      ),
    ],
  },
  {
    id: "fechamento-pagamentos-contratos",
    title: "Fechamento, pagamentos, contrato e recibo",
    objective:
      "Padronizar fechamento, pagamentos previstos, descricao de contrato, geracao de documentos e passagem segura para a proxima etapa.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "Fechamento consultivo",
        body: [
          "Fechar e confirmar decisao consciente. O cliente precisa saber o que esta contratando, quanto paga, como paga, quais documentos recebera e qual o proximo passo.",
          "A pressao pode ate gerar venda, mas tambem gera distrato, contestacao, reclamacao e cliente ansioso no pos-venda.",
          "Use perguntas de decisao: faz sentido iniciarmos hoje com Pix ou prefere boleto para amanha?",
        ],
      },
      {
        title: "Pagamentos previstos e meta",
        body: [
          "Forma de pagamento deve ser registrada corretamente: Pix, boleto ou cartao. Status previsto precisa ter data futura. Pagamento pago precisa bater com comprovante.",
          "Meta comercial usa valor liquido de meta, considerando descontos de plataforma/maquininha quando houver. Por isso cartao pode ter meta diferente do valor bruto.",
          "Erro em pagamento bagunca painel comercial, comissao, financeiro e cobranca.",
        ],
      },
      {
        title: "Contrato e recibo",
        body: [
          "Contrato formaliza prestacao de servico. Recibo comprova pagamento. Ambos devem usar dados corretos e templates da empresa certa.",
          "Antes de enviar, confira nome, CPF/CNPJ, produto, valor, pagamento, descricao, empresa, CNPJ, endereco e especialista/apelido quando aplicavel.",
          "Documento errado transmite desorganizacao e pode gerar risco juridico.",
        ],
      },
    ],
    checkpoint: question(
      "fechamento-pagamentos-check",
      "Por que a descricao de contrato precisa ser bem escrita?",
      "Porque formaliza o acordo de pagamento e alimenta documentos.",
      ["Porque substitui o recibo.", "Porque nao fica registrada."],
      "Descricao clara reduz discussao futura e melhora qualidade documental.",
    ),
    exam: [
      question(
        "fechamento-pagamentos-exam-1",
        "Status previsto de pagamento deve ter:",
        "Data futura e forma de pagamento definida.",
        ["Data passada.", "Campo de forma vazio."],
        "Pagamento previsto e lembrete operacional, nao registro retroativo sem criterio.",
      ),
      question(
        "fechamento-pagamentos-exam-2",
        "Antes de enviar contrato, o consultor confere:",
        "Dados do cliente, empresa, valor, pagamento e template correto.",
        ["Apenas se o PDF abriu.", "Somente o nome do arquivo."],
        "Documento e parte da experiencia premium da empresa.",
      ),
    ],
  },
  {
    id: "crm-na-pratica",
    title: "CRM na pratica: cliente, pre-venda, documentos e historico",
    objective:
      "Ensinar a usar o CRM como ferramenta de produtividade, auditoria e experiencia do cliente.",
    estimatedMinutes: 70,
    sections: [
      {
        title: "Cadastro e pre-venda",
        body: [
          "Cliente deve ser cadastrado com nome, contato, documentos, endereco, consultor responsavel e observacoes relevantes quando existirem.",
          "Pre-venda representa a oportunidade comercial. Um cliente pode ter mais de uma pre-venda, entao cada uma precisa ter produto, servico, status, valores, pagamentos e protocolo.",
          "O protocolo GRS e a referencia do contrato/atendimento. Ele ajuda acompanhamento interno e consulta publica do cliente.",
        ],
      },
      {
        title: "Linha do tempo e anotacoes",
        body: [
          "Toda alteracao relevante deve gerar historico. Ao editar cliente, pre-venda ou status juridico, registre o que foi feito e por que.",
          "Anotacao boa tem contexto, decisao, pendencia e responsavel. Anotacao ruim e vaga: cliente falou comigo.",
          "Logs protegem a empresa e ajudam a resolver conflito sem depender de memoria.",
        ],
      },
      {
        title: "Documentos do cliente",
        body: [
          "Arquivos devem ser vinculados ao cliente correto, com tipo certo e titulo claro. Upload em massa exige atencao ao nome do arquivo.",
          "Antes de substituir ou excluir arquivo, confirme se nao e documento usado no juridico, contrato ou prova de pagamento.",
          "Documento sensivel deve ficar no bucket privado e nunca circular por canal pessoal.",
        ],
      },
    ],
    checkpoint: question(
      "crm-pratica-check",
      "Por que um cliente pode ter mais de uma pre-venda?",
      "Porque cada contrato/oportunidade pode ter produto, protocolo e status proprios.",
      ["Porque o CRM duplica dados sem motivo.", "Porque uma pre-venda substitui o cadastro."],
      "Separar cliente de pre-venda evita confundir oportunidades diferentes da mesma pessoa.",
    ),
    exam: [
      question(
        "crm-pratica-exam-1",
        "Uma boa anotacao de historico deve conter:",
        "Contexto, decisao, pendencia e responsavel.",
        ["Apenas emojis.", "Informacao vaga sem proximo passo."],
        "Historico bom permite continuidade e auditoria.",
      ),
      question(
        "crm-pratica-exam-2",
        "Arquivos do cliente devem ser enviados:",
        "No cliente correto, com tipo adequado e titulo identificavel.",
        ["Em qualquer cliente parecido.", "No WhatsApp pessoal do funcionario."],
        "Organizacao documental e parte da seguranca do processo.",
      ),
    ],
  },
  {
    id: "juridico-pos-venda",
    title: "Esteira juridica, pos-venda e acompanhamento",
    objective:
      "Mostrar como a equipe reduz ansiedade do cliente e organiza a entrega apos a venda.",
    estimatedMinutes: 65,
    sections: [
      {
        title: "Entrada no juridico",
        body: [
          "Cliente aprovado no comercial entra na esteira juridica conforme primeira coluna configurada pela empresa.",
          "A equipe juridica deve conferir documentos, pagamento, contrato, responsaveis e etapa atual antes de executar qualquer acao.",
          "Mover cliente de etapa sem anotacao clara compromete rastreabilidade.",
        ],
      },
      {
        title: "Esteira e documentos",
        body: [
          "Cada coluna representa uma fase operacional. Templates vinculados ajudam a gerar documentos corretos no momento certo.",
          "Se uma coluna for alterada pela gestao, os clientes precisam continuar legiveis: titulo claro, descricao objetiva e ordem logica.",
          "Clientes inativos ou distratos devem sair da esteira ativa para nao contaminar indicadores.",
        ],
      },
      {
        title: "Acompanhamento publico",
        body: [
          "O cliente pode consultar andamento com CPF e protocolo quando a empresa liberar atualizacoes. Isso reduz cobrancas repetidas e melhora percepcao de profissionalismo.",
          "Atualizacao publica deve ter titulo simples e descricao segura: documento solicitado, notificacao enviada, aguardando retorno, laudo em andamento.",
          "Nao publique dados sensiveis, estrategia juridica interna ou comentarios que possam expor a empresa.",
        ],
      },
    ],
    checkpoint: question(
      "juridico-pos-venda-check",
      "Qual e a melhor atualizacao publica para o cliente?",
      "Objetiva, segura e sem dados sensiveis.",
      ["Cheia de detalhes internos.", "Com estrategia juridica completa."],
      "O portal informa o cliente, mas nao expoe dados nem estrategia interna.",
    ),
    exam: [
      question(
        "juridico-pos-venda-exam-1",
        "Mover cliente na esteira juridica exige:",
        "Status correto e anotacao clara do motivo.",
        ["Mover sem registro.", "Apagar historico anterior."],
        "A esteira precisa ser rastreavel.",
      ),
      question(
        "juridico-pos-venda-exam-2",
        "Acompanhamento publico ajuda porque:",
        "Reduz ansiedade e cobrancas repetidas com informacao segura.",
        ["Substitui todo atendimento.", "Mostra documentos pessoais ao cliente."],
        "Visibilidade controlada melhora experiencia sem expor informacao.",
      ),
    ],
  },
  {
    id: "lgpd-seguranca-conduta",
    title: "LGPD, seguranca da informacao e conduta",
    objective:
      "Fixar regras de tratamento de dados, canais autorizados, equipamentos da empresa e responsabilidade individual.",
    estimatedMinutes: 75,
    sections: [
      {
        title: "O que e dado pessoal na operacao",
        body: [
          "Nome, CPF, RG, telefone, endereco, email, contrato, comprovante, documentos, placa, dados financeiros e historico de atendimento sao dados pessoais ou informacoes relacionadas ao cliente.",
          "Tratar dados significa coletar, acessar, usar, armazenar, compartilhar, alterar ou excluir informacao. O simples ato de abrir um documento ja exige responsabilidade.",
          "O consultor deve usar dados apenas para finalidade autorizada pela empresa.",
        ],
      },
      {
        title: "Medidas praticas de seguranca",
        body: [
          "Use login individual, senha segura, computador bloqueado ao se afastar e canais oficiais da empresa.",
          "Nao compartilhe senha, nao envie documentos para WhatsApp pessoal, nao salve arquivo de cliente em pasta pessoal e nao use email proprio para tratar caso.",
          "Se receber dado por canal inadequado, oriente o cliente a enviar pelo canal correto e registre a ocorrencia quando necessario.",
        ],
      },
      {
        title: "Condutas proibidas",
        body: [
          "E proibido receber pagamento em conta pessoal, cobrar servico nao autorizado, usar cartao ou dados do cliente, prometer servico fora da empresa ou continuar contato pelo numero pessoal.",
          "Tambem e proibido apagar conversas corporativas, levar chip/equipamento sem autorizacao, exportar base de clientes ou remover documentos do CRM.",
          "Essas condutas podem gerar responsabilizacao trabalhista, civil, criminal e disciplinar, alem de dano reputacional.",
        ],
      },
    ],
    checkpoint: question(
      "lgpd-seguranca-check",
      "Qual conduta esta alinhada a LGPD e seguranca?",
      "Usar canais oficiais, login individual e registrar informacoes no CRM.",
      ["Salvar documentos no celular pessoal.", "Receber pagamento em conta propria."],
      "Seguranca depende de pessoas, processo e tecnologia trabalhando juntos.",
    ),
    exam: [
      question(
        "lgpd-seguranca-exam-1",
        "Se o funcionario perde celular corporativo com acesso ao CRM, deve:",
        "Comunicar imediatamente o responsavel interno.",
        ["Esperar para ver se aparece.", "Apagar o assunto da memoria."],
        "Incidente comunicado cedo reduz risco e demonstra diligencia.",
      ),
      question(
        "lgpd-seguranca-exam-2",
        "Receber pagamento por fora da empresa:",
        "E conduta proibida e pode gerar responsabilizacao.",
        ["E permitido se o cliente aceitar.", "E apenas um detalhe financeiro."],
        "Pagamento precisa ocorrer pelos meios autorizados e registrados.",
      ),
    ],
  },
  {
    id: "qualidade-performance",
    title: "Qualidade, performance e certificacao",
    objective:
      "Conectar treinamento a indicadores, auditoria, melhoria continua e padrao de atendimento premium.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "Padrao de qualidade",
        body: [
          "Qualidade nao e apenas vender. E vender certo: cliente bem informado, dados corretos, contrato correto, pagamento correto e historico completo.",
          "Um atendimento premium deixa o cliente seguro mesmo quando o processo e complexo ou demorado.",
          "A meta e formar consultores que gerem receita com baixa reclamacao, baixa retratacao e boa passagem de bastao.",
        ],
      },
      {
        title: "Checklist diario",
        body: [
          "Abrir painel comercial, revisar leads novos, priorizar retornos, conferir pagamentos previstos, atualizar status, responder pendencias e registrar anotacoes relevantes.",
          "No fim do dia, revisar oportunidades quentes, clientes sem proximo passo e pagamentos que precisam de cobranca.",
          "Gestao deve usar indicadores para treinar: quem converte bem, quem registra mal, quem perde follow-up e quem tem muitos documentos corrigidos.",
        ],
      },
      {
        title: "Certificacao e reciclagem",
        body: [
          "Aprovacao no Academy deve demonstrar dominio do processo, linguagem segura, uso correto do CRM e conduta com dados.",
          "Reciclagens devem acontecer quando mudam templates, produto, regra de pagamento, script, politica de dados ou fluxo juridico.",
          "A formacao e continua. O mercado, as regras e a operacao mudam; o padrao da equipe precisa acompanhar.",
        ],
      },
    ],
    checkpoint: question(
      "qualidade-performance-check",
      "Qual e a melhor definicao de venda de qualidade?",
      "Venda com cliente informado, dados corretos, documentos certos e historico completo.",
      ["Venda feita a qualquer custo.", "Venda sem registro para ser mais rapida."],
      "Performance sustentavel combina conversao, seguranca e qualidade operacional.",
    ),
    exam: [
      question(
        "qualidade-performance-exam-1",
        "Qual indicador ajuda a encontrar gargalo de atendimento?",
        "Tempo parado por etapa e pagamentos pendentes.",
        ["Cor favorita do cliente.", "Quantidade de mensagens apagadas."],
        "Indicadores operacionais mostram onde treinar e corrigir processo.",
      ),
      question(
        "qualidade-performance-exam-2",
        "Consultor maduro e aquele que:",
        "Vende com previsibilidade, registro e baixo risco operacional.",
        ["Vende prometendo qualquer resultado.", "Evita o CRM para ganhar tempo."],
        "O melhor vendedor protege a receita e a reputacao da empresa.",
      ),
    ],
  },
];

export const academyCourse: AcademyCourse = {
  slug: "formacao-grs-revisional-venda-consultiva",
  title: "Formacao Profissional GRS em Revisional e Operacao CRM",
  subtitle: "Trilha completa para comercial, juridico e gestores",
  description:
    "Curso reformulado para formar usuarios capazes de diagnosticar oportunidades, explicar revisional com responsabilidade, operar o CRM com qualidade, conduzir pos-venda, proteger dados pessoais e manter padrao premium de atendimento.",
  passingScore: 85,
  estimatedMinutes: chapters.reduce((total, chapter) => total + chapter.estimatedMinutes, 0),
  audience:
    "Consultores comerciais, consultores juridicos, assistentes administrativos, supervisores, gestores e usuarios em onboarding.",
  chapters,
};

export function getAcademyChapter(chapterId: string) {
  return academyCourse.chapters.find((chapter) => chapter.id === chapterId) ?? null;
}

export function getNextAcademyChapter(chapterId: string) {
  const currentIndex = academyCourse.chapters.findIndex(
    (chapter) => chapter.id === chapterId,
  );

  return currentIndex >= 0 ? academyCourse.chapters[currentIndex + 1] ?? null : null;
}

export function getAcademyQuestionAnswer(question: AcademyQuestion, optionId: string) {
  return question.options.find((option) => option.id === optionId) ?? null;
}
