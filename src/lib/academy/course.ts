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
    id: "introducao-revisional",
    title: "O que e revisional: judicial, extrajudicial e quando analisar",
    objective:
      "Dar uma visao clara sobre revisional bancario, caminhos possiveis e limites do que pode ser prometido ao cliente.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "O que e revisional bancario",
        body: [
          "Revisional bancario e a analise tecnica de um contrato para verificar se existem cobrancas questionaveis, desequilibrio contratual ou valores acima de parametros praticados no mercado.",
          "O cliente normalmente procura ajuda porque a parcela esta pesada, a divida virou uma bola de neve ou o valor total do contrato ficou muito maior do que esperava.",
          "Podem ser avaliados financiamento de veiculo, emprestimo, consignado, financiamento imobiliario, refinanciamento e renegociacoes.",
        ],
      },
      {
        title: "Judicial e extrajudicial",
        body: [
          "O caminho extrajudicial tenta negociar antes de entrar em processo: notificacao, ouvidoria, setor juridico da financeira e proposta tecnica.",
          "O caminho judicial leva a discussao para a Justica quando existe fundamento e a tentativa amigavel nao resolve, ou quando ha urgencia, cobranca agressiva ou risco ao bem.",
          "O consultor deve explicar possibilidades, nunca prometer liminar, desconto, quitacao ou devolucao como resultado garantido.",
        ],
      },
      {
        title: "Sinais que justificam analise",
        body: [
          "Parcela muito alta, juros acima do mercado, CET pouco claro, muitas parcelas pagas, tarifas ou seguros nao explicados e refinanciamento repetido sao sinais de atencao.",
          "Esses sinais nao garantem abuso. Eles indicam que vale analisar com documentos, calculo e criterio.",
        ],
      },
    ],
    checkpoint: question(
      "introducao-check",
      "Qual e a forma mais segura de explicar revisional ao cliente?",
      "E uma analise para verificar se existem pontos questionaveis no contrato.",
      [
        "E um processo que reduz qualquer contrato.",
        "E uma forma de parar de pagar sem risco.",
      ],
      "A explicacao correta abre possibilidade tecnica sem criar promessa indevida.",
    ),
    exam: [
      question(
        "introducao-exam-1",
        "O que indica que um contrato pode merecer analise?",
        "Parcela alta, juros elevados, CET pouco claro ou cobrancas questionaveis.",
        ["Somente atraso do cliente.", "Qualquer financiamento, sem excecao."],
        "Sinais de alerta justificam analise, mas nao garantem resultado.",
      ),
      question(
        "introducao-exam-2",
        "Quando o judicial costuma ser mais necessario?",
        "Quando ha recusa de negociacao, risco ao bem ou necessidade de discussao formal.",
        ["Quando o cliente quer resultado no mesmo dia.", "Sempre antes de qualquer tentativa extrajudicial."],
        "A estrategia depende do caso, dos documentos e do risco envolvido.",
      ),
    ],
  },
  {
    id: "mentalidade-grs",
    title: "Mentalidade GRS: consultoria, etica e responsabilidade",
    objective:
      "Ensinar que a venda revisional depende de confianca, diagnostico, clareza e responsabilidade.",
    estimatedMinutes: 40,
    sections: [
      {
        title: "O papel do consultor",
        body: [
          "O consultor e a primeira pessoa que traduz para o cliente um tema complexo: contrato bancario, juros, parcelas, riscos e possibilidades de revisao.",
          "A postura esperada e ouvir antes de argumentar, fazer perguntas antes de apresentar solucao, explicar sem exagero e registrar informacoes corretamente.",
          "Uma venda forte nao nasce de pressao. Nasce de diagnostico bem feito e de uma decisao consciente do cliente.",
        ],
      },
      {
        title: "O que nao pode acontecer",
        body: [
          "Nao garanta reducao antes da analise, nao afirme que todo contrato tem juros abusivos e nao oriente inadimplencia como estrategia.",
          "Evite medo artificial, fundamento juridico inventado, omissao de valores e tratamento descuidado de dados pessoais.",
        ],
      },
      {
        title: "Padrao de linguagem",
        body: [
          "Use linguagem simples, segura e humana: analisamos dados do contrato, comparamos parametros e orientamos o melhor caminho.",
          "Evite frases absolutas como reducao garantida, banco obrigado a aceitar ou todo contrato tem abuso.",
        ],
      },
    ],
    checkpoint: question(
      "mentalidade-check",
      "Qual e a melhor definicao do papel do consultor?",
      "Explicar o servico, diagnosticar a situacao e conduzir o cliente com clareza.",
      [
        "Convencer rapidamente antes que o cliente fale com concorrentes.",
        "Garantir reducao de parcela para gerar seguranca imediata.",
      ],
      "A GRS vende analise, metodo e acompanhamento. Promessa excessiva cria risco e frustracao.",
    ),
    exam: [
      question(
        "mentalidade-exam-1",
        "O que sustenta uma venda revisional segura?",
        "Diagnostico, clareza e responsabilidade.",
        ["Pressao e urgencia.", "Promessa de resultado."],
        "O cliente precisa decidir com informacao correta, nao por medo.",
      ),
      question(
        "mentalidade-exam-2",
        "Qual atitude aumenta risco para a empresa?",
        "Prometer resultado antes da analise.",
        ["Registrar informacoes no CRM.", "Explicar prazos com cuidado."],
        "Promessas absolutas prejudicam a experiencia do cliente e a seguranca operacional.",
      ),
    ],
  },
  {
    id: "fundamentos-revisional",
    title: "Fundamentos da revisao de juros e contratos bancarios",
    objective:
      "Dar base conceitual para explicar revisao de juros sem termos juridicos confusos, exageros ou informacoes inseguras.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "O que e revisao de juros",
        body: [
          "A revisao e uma analise tecnica e juridica do contrato para verificar se cobrancas estao coerentes com parametros legais, informacoes contratuais, taxa media de mercado e regras de consumo.",
          "Ela pode envolver taxa mensal e anual, CET, valor financiado, entrada, parcelas, seguros, tarifas, saldo devedor e valores pagos.",
          "Nao e fraude, nao e calote e tambem nao e solucao magica. Precisa de documento, calculo, criterio e avaliacao do caso.",
        ],
      },
      {
        title: "Contratos que podem ser analisados",
        body: [
          "Podem ser analisados financiamentos de veiculos, imoveis, emprestimos pessoais, consignados e renegociacoes bancarias.",
          "Nem todo contrato tem abuso. O consultor identifica indicios e encaminha para analise.",
        ],
      },
      {
        title: "Banco Central, CDC e STJ em linguagem segura",
        body: [
          "Taxas medias do Banco Central ajudam a comparar o contrato com o mercado da epoca.",
          "O Codigo de Defesa do Consumidor protege contra praticas abusivas e falta de transparencia.",
          "A avaliacao depende do contrato e do caso concreto. O consultor nao deve citar tese juridica de memoria quando nao tiver certeza.",
        ],
      },
    ],
    checkpoint: question(
      "fundamentos-check",
      "O que o consultor pode afirmar antes da analise completa?",
      "Que a equipe avaliara se existem indicios de cobranca questionavel.",
      [
        "Que o contrato certamente possui abuso.",
        "Que o banco sempre sera obrigado a reduzir a parcela.",
      ],
      "A fala correta abre possibilidade tecnica sem prometer resultado.",
    ),
    exam: [
      question(
        "fundamentos-exam-1",
        "Qual frase e mais segura?",
        "Vamos verificar se existem indicios de cobranca questionavel.",
        ["Seu contrato esta errado com certeza.", "O banco sempre perde esse tipo de caso."],
        "O consultor trabalha com indicios, documentos e validacao tecnica.",
      ),
      question(
        "fundamentos-exam-2",
        "A taxa media do Banco Central serve para:",
        "Comparar o contrato com referencias de mercado.",
        ["Garantir resultado automatico.", "Substituir a analise do contrato."],
        "Ela e parametro relevante, mas nao elimina a analise do caso concreto.",
      ),
    ],
  },
  {
    id: "diagnostico-consultivo",
    title: "Diagnostico consultivo: perguntas que revelam o problema",
    objective:
      "Ensinar o consultor a conduzir uma conversa de mapeamento antes de apresentar solucao.",
    estimatedMinutes: 45,
    sections: [
      {
        title: "Perguntar antes de responder",
        body: [
          "A qualidade da venda depende da qualidade das perguntas. Perguntar evita proposta generica e mostra interesse real pelo contexto do cliente.",
          "O consultor deve entender produto, banco, parcela, quantidade paga, motivo da busca, urgencia e expectativa.",
        ],
      },
      {
        title: "Quatro tipos de perguntas",
        body: [
          "Perguntas situacionais levantam dados. Perguntas de problema identificam dor. Perguntas de implicacao mostram consequencias. Perguntas de solucao conectam valor.",
          "Exemplo de implicacao: se essa parcela continuar nesse valor, como isso afeta seu orcamento nos proximos meses?",
        ],
      },
      {
        title: "Abertas e fechadas",
        body: [
          "Perguntas abertas ajudam o cliente a explicar. Perguntas fechadas ajudam a direcionar decisao e proximo passo.",
          "Use uma pergunta por vez, principalmente no WhatsApp.",
        ],
      },
    ],
    checkpoint: question(
      "diagnostico-check",
      "Qual pergunta pertence melhor ao grupo de implicacao?",
      "Como essa parcela impacta seu orcamento se continuar assim?",
      [
        "Qual e o banco do contrato?",
        "Voce prefere pagar por Pix ou boleto?",
      ],
      "Pergunta de implicacao mostra consequencias do problema sem inventar medo.",
    ),
    exam: [
      question(
        "diagnostico-exam-1",
        "Perguntas situacionais servem para:",
        "Levantar dados basicos do contrato e do cliente.",
        ["Criar pressao para fechamento.", "Prometer reducao imediata."],
        "Sem dados, nao existe diagnostico serio.",
      ),
      question(
        "diagnostico-exam-2",
        "Perguntas fechadas sao uteis para:",
        "Confirmar informacoes e conduzir o proximo passo.",
        ["Deixar o cliente sem alternativas.", "Evitar ouvir a dor do cliente."],
        "A pergunta fechada organiza decisao, mas nao substitui escuta.",
      ),
    ],
  },
  {
    id: "confianca-autoridade",
    title: "Confianca, autoridade e experiencia do cliente",
    objective:
      "Organizar comunicacao de autoridade sem arrogancia, com clareza e acolhimento.",
    estimatedMinutes: 40,
    sections: [
      {
        title: "Jornada de compra",
        body: [
          "O cliente passa por atencao, interesse, avaliacao, decisao e seguranca pos-venda.",
          "Na avaliacao, ele pergunta sobre prazo, garantia, legalidade, casos semelhantes e valores. Essas perguntas indicam interesse.",
        ],
      },
      {
        title: "Rapport sem artificialidade",
        body: [
          "Rapport nao e elogio forcado. E demonstrar atencao, usar linguagem clara e respeitar o ritmo do cliente.",
          "A postura profissional transmite seguranca: explicar etapas, pedir documentos certos e registrar tudo.",
        ],
      },
      {
        title: "Autoridade com humildade",
        body: [
          "Demonstrar autoridade e explicar o motivo das perguntas e os limites da analise.",
          "A fala deve ser firme, mas nunca superior ou agressiva.",
        ],
      },
    ],
    checkpoint: question(
      "confianca-check",
      "O que significa demonstrar autoridade na GRS?",
      "Explicar processo, limites e proximos passos com seguranca.",
      [
        "Falar dificil para impressionar o cliente.",
        "Evitar perguntas e partir para o fechamento.",
      ],
      "Autoridade vem de clareza e dominio do processo, nao de arrogancia.",
    ),
    exam: [
      question(
        "confianca-exam-1",
        "Perguntas sobre garantia e prazo geralmente indicam:",
        "Interesse e necessidade de seguranca.",
        ["Perda definitiva da venda.", "Que o cliente nao deve ser atendido."],
        "O consultor deve responder com calma e conduzir o cliente.",
      ),
      question(
        "confianca-exam-2",
        "Rapport profissional e:",
        "Criar conexao com respeito, escuta e linguagem clara.",
        ["Fazer elogios artificiais.", "Concordar com tudo que o cliente diz."],
        "Conexao verdadeira reduz ansiedade e melhora a experiencia.",
      ),
    ],
  },
  {
    id: "simulacao-apresentacao",
    title: "Apresentacao da analise e dos numeros",
    objective:
      "Ensinar como apresentar simulacao, economia estimada e limites da proposta com seguranca.",
    estimatedMinutes: 50,
    sections: [
      {
        title: "Preparacao antes de explicar",
        body: [
          "Antes de apresentar numeros, confirme dados: valor da parcela, parcelas pagas, saldo, tipo de produto, banco e documentos disponiveis.",
          "Se os dados estiverem incompletos, explique que a simulacao e estimativa inicial.",
        ],
      },
      {
        title: "Como apresentar numeros",
        body: [
          "A apresentacao deve separar parcela atual, parcela corrigida, economia mensal, economia total e saldo devedor corrigido.",
          "Evite inflar expectativa. Mostre que o relatorio e uma analise de oportunidade e nao promessa judicial.",
        ],
      },
      {
        title: "Garantia, prazo e valor",
        body: [
          "Quando o cliente pergunta prazo, explique as etapas. Quando pergunta garantia, explique a clausula contratual aplicavel. Quando pergunta valor, conecte custo ao potencial beneficio.",
        ],
      },
    ],
    checkpoint: question(
      "simulacao-check",
      "Qual e a forma mais correta de apresentar uma possivel reducao?",
      "Como estimativa baseada nos dados informados e sujeita a analise.",
      [
        "Como reducao garantida depois do pagamento.",
        "Como promessa de resultado judicial.",
      ],
      "A simulacao melhora conversao quando e clara, tecnica e honesta.",
    ),
    exam: [
      question(
        "simulacao-exam-1",
        "Se faltam dados do contrato, o consultor deve:",
        "Informar que a simulacao e estimativa inicial.",
        ["Inventar dados para concluir logo.", "Cancelar o atendimento automaticamente."],
        "Dados incompletos exigem transparencia.",
      ),
      question(
        "simulacao-exam-2",
        "Perguntas sobre valor e prazo podem indicar:",
        "Que o cliente esta avaliando decisao e precisa de clareza.",
        ["Que ele nao tem interesse.", "Que devemos pressionar pelo pagamento."],
        "Essas perguntas devem ser tratadas como oportunidade de orientar.",
      ),
    ],
  },
  {
    id: "fechamento-compromisso",
    title: "Compromisso, fechamento e proximos passos",
    objective:
      "Criar fechamento consultivo com compromisso real e sem pressao indevida.",
    estimatedMinutes: 40,
    sections: [
      {
        title: "Por que compromisso importa",
        body: [
          "Compromisso e o cliente entender o problema, concordar com o caminho e saber o que precisa fazer em seguida.",
          "Sem compromisso, o atendimento vira conversa longa sem decisao.",
        ],
      },
      {
        title: "Motivos de decisao",
        body: [
          "O cliente decide por dor financeira, desejo de seguranca e confianca no metodo.",
          "A venda deve conectar a solucao a esses motivos, sem exagerar risco.",
        ],
      },
      {
        title: "Fechamento com alternativas",
        body: [
          "Perguntas melhores: podemos seguir com Pix ou boleto? Voce prefere receber o contrato agora ou apos revisar a proposta?",
          "Perguntas fracas: vai fechar ou nao? Posso te ligar de novo qualquer dia?",
        ],
      },
    ],
    checkpoint: question(
      "fechamento-check",
      "Qual e o objetivo de criar compromisso?",
      "Garantir que o cliente entenda valor, caminho e proximo passo.",
      [
        "Pressionar o cliente a pagar imediatamente.",
        "Evitar explicar detalhes para nao gerar duvida.",
      ],
      "Compromisso nasce de entendimento e seguranca.",
    ),
    exam: [
      question(
        "fechamento-exam-1",
        "A pergunta 'de 0 a 10' mede:",
        "O nivel de seguranca do cliente para seguir.",
        ["A renda exata do cliente.", "A garantia de resultado do processo."],
        "Ela ajuda a entender objecoes restantes.",
      ),
      question(
        "fechamento-exam-2",
        "Melhor pergunta de fechamento:",
        "Faz mais sentido seguir por Pix ou boleto?",
        ["Vai fechar agora ou nao?", "Se nao fechar hoje, vai perder tudo."],
        "A pergunta oferece proximo passo claro sem agressividade.",
      ),
    ],
  },
  {
    id: "objecoes",
    title: "Tratamento de objecoes comuns",
    objective:
      "Responder duvidas sem confronto, sem promessa indevida e com registro correto.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "O que e uma objecao",
        body: [
          "Objecao nao e ataque. Muitas vezes e pedido de seguranca.",
          "O consultor deve acolher, perguntar, esclarecer e conduzir.",
        ],
      },
      {
        title: "Estrutura GRS",
        body: [
          "Primeiro reconheca a preocupacao. Depois pergunte o que exatamente o cliente quer dizer. Em seguida explique com base no processo e confirme se ficou claro.",
          "Exemplo: quando voce fala em garantia, voce quer dizer garantia de reducao, de acompanhamento ou de prestacao do servico?",
        ],
      },
      {
        title: "Frases que prejudicam",
        body: [
          "Evite respostas defensivas, promessas absolutas ou comparacoes agressivas com concorrentes.",
          "Nunca use duvida do cliente como motivo para pressionar pagamento.",
        ],
      },
    ],
    checkpoint: question(
      "objecoes-check",
      "Quando o cliente pergunta sobre garantia, o consultor deve:",
      "Entender a preocupacao especifica e explicar os limites do contrato.",
      [
        "Prometer reducao para encerrar a duvida.",
        "Ignorar a pergunta e pedir pagamento.",
      ],
      "Garantia precisa ser explicada com precisao para proteger cliente e empresa.",
    ),
    exam: [
      question(
        "objecoes-exam-1",
        "Uma objecao geralmente representa:",
        "Uma necessidade de seguranca ou esclarecimento.",
        ["Uma ofensa ao consultor.", "Uma ordem para encerrar atendimento."],
        "Responder bem a objecoes aumenta conversao e confianca.",
      ),
      question(
        "objecoes-exam-2",
        "A assinatura do contrato significa que:",
        "O cliente autorizou a prestacao, sem impedir analise de clausulas e cobrancas.",
        ["Nao existe mais nada a questionar.", "A revisao se torna automaticamente ganha."],
        "O contrato com a empresa formaliza servico; nao promete resultado bancario.",
      ),
    ],
  },
  {
    id: "whatsapp-script",
    title: "Script, WhatsApp e comunicacao escrita",
    objective:
      "Padronizar abordagem por mensagem com clareza, humanidade e foco em proximo passo.",
    estimatedMinutes: 45,
    sections: [
      {
        title: "AIDA aplicado ao revisional",
        body: [
          "Atencao: contextualize o contato. Interesse: faca perguntas. Desejo: conecte a dor a uma analise possivel. Acao: convide para o proximo passo.",
          "A etapa acao deve gerar uma decisao simples, como enviar documento, revisar proposta ou escolher forma de pagamento.",
        ],
      },
      {
        title: "Script base",
        body: [
          "Ola, aqui e da equipe GRS. Vi que voce buscou ajuda sobre revisao do financiamento. Posso te fazer algumas perguntas rapidas para entender seu caso e te orientar corretamente?",
          "Explique em partes, evite texto longo e confirme entendimento.",
        ],
      },
      {
        title: "Tom de voz",
        body: [
          "Uma pergunta por vez. Frases curtas. Nada de caixa alta agressiva. Evite audio longo sem contexto.",
          "Registre as informacoes importantes no CRM para garantir continuidade.",
        ],
      },
    ],
    checkpoint: question(
      "whatsapp-check",
      "O que a etapa acao do AIDA deve gerar?",
      "Um proximo passo claro e simples para o cliente.",
      [
        "Um texto longo sem pergunta.",
        "Uma promessa para acelerar a venda.",
      ],
      "A comunicacao escrita precisa facilitar a decisao, nao confundir.",
    ),
    exam: [
      question(
        "whatsapp-exam-1",
        "No primeiro contato, e melhor:",
        "Contextualizar e pedir permissao para fazer perguntas.",
        ["Enviar contrato imediatamente.", "Mandar varias mensagens sem pausa."],
        "Permissao e contexto aumentam resposta e reduzem resistencia.",
      ),
      question(
        "whatsapp-exam-2",
        "No WhatsApp, a boa pratica e:",
        "Fazer uma pergunta por vez.",
        ["Mandar blocos longos.", "Evitar registrar informacoes no CRM."],
        "Mensagens simples melhoram compreensao e registro.",
      ),
    ],
  },
  {
    id: "rotina-lgpd",
    title: "Rotina comercial, CRM e protecao de dados",
    objective:
      "Conectar performance, registro correto, passagem de bastao e LGPD no dia a dia.",
    estimatedMinutes: 65,
    sections: [
      {
        title: "Rotina diaria",
        body: [
          "Performance depende de rotina: organizar leads, priorizar retornos, registrar status, cobrar documentos e manter follow-up.",
          "O CRM e a memoria da empresa. Sem registro, o cliente fica dependente de conversas soltas.",
        ],
      },
      {
        title: "Etiquetas e status",
        body: [
          "Status correto evita perda de lead, cobranca duplicada e confusao entre comercial e juridico.",
          "Sempre registre combinados, pendencias, forma de pagamento e etapa atual.",
        ],
      },
      {
        title: "LGPD e dados do cliente",
        body: [
          "Dados de cliente nao devem circular por canais pessoais. Use ferramentas, chips e equipamentos autorizados pela empresa.",
          "Nao exponha CPF, documentos, contratos ou dados financeiros sem necessidade operacional.",
          "Passagem de bastao bem feita protege o cliente e reduz retrabalho.",
        ],
      },
    ],
    checkpoint: question(
      "rotina-check",
      "Por que registrar status e informacoes do lead?",
      "Para manter historico, continuidade e seguranca operacional.",
      [
        "Para substituir atendimento humano.",
        "Para evitar que gestor acompanhe o processo.",
      ],
      "Registro correto diminui retrabalho e protege a empresa.",
    ),
    exam: [
      question(
        "rotina-exam-1",
        "Dados do cliente devem circular:",
        "Somente em canais e equipamentos autorizados pela empresa.",
        ["No WhatsApp pessoal do funcionario.", "Em qualquer aplicativo que facilite a venda."],
        "LGPD e seguranca operacional exigem controle dos canais.",
      ),
      question(
        "rotina-exam-2",
        "Passagem de bastao para o juridico exige:",
        "Dados, documentos e historico registrados com clareza.",
        ["Apenas avisar verbalmente.", "Apagar conversas antigas para limpar atendimento."],
        "O juridico precisa de contexto para seguir sem retrabalho.",
      ),
    ],
  },
];

export const academyCourse: AcademyCourse = {
  slug: "formacao-grs-revisional-venda-consultiva",
  title: "Formacao GRS em Revisional Bancario e Venda Consultiva",
  subtitle: "Curso inicial para comercial e juridico",
  description:
    "Trilha baseada no Academy original para formar usuarios capazes de explicar revisional bancario, conduzir atendimento consultivo, registrar corretamente no CRM e proteger dados dos clientes.",
  passingScore: 80,
  estimatedMinutes: chapters.reduce((total, chapter) => total + chapter.estimatedMinutes, 0),
  audience: "Consultores comerciais, consultores juridicos, assistentes e gestores.",
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
