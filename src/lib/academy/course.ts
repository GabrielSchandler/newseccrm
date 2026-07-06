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

function createCourse(course: Omit<AcademyCourse, "estimatedMinutes">): AcademyCourse {
  return {
    ...course,
    estimatedMinutes: course.chapters.reduce(
      (total, chapter) => total + chapter.estimatedMinutes,
      0,
    ),
  };
}

const commercialChapters: AcademyChapter[] = [
  {
    id: "mentalidade-comercial-grs",
    title: "Mentalidade comercial GRS",
    objective:
      "Entender o papel do comercial: vender com clareza, responsabilidade e seguranca para um cliente de ticket alto.",
    estimatedMinutes: 45,
    sections: [
      {
        title: "O que o cliente compra",
        body: [
          "O cliente nao compra apenas um contrato ou uma simulacao. Ele compra alivio, direcao e seguranca para lidar com uma divida que pesa no orcamento.",
          "A venda profissional nao depende de promessa forte. Ela depende de diagnostico bem feito, proposta coerente e conducao tranquila ate a decisao.",
          "O padrao GRS e consultivo: entender primeiro, orientar depois e fechar apenas quando a solucao fizer sentido para o caso.",
        ],
      },
      {
        title: "Limite entre venda e promessa",
        body: [
          "O comercial pode falar em analise, estrategia, indicios, estimativa e possibilidade. Nao deve garantir reducao, quitacao, liminar ou resposta do banco antes da validacao.",
          "Promessa indevida gera cliente ansioso, distrato, reclamacao e risco juridico para a empresa.",
          "A frase segura e: com base nos dados informados, conseguimos fazer uma leitura inicial e verificar se existe fundamento para uma estrategia revisional.",
        ],
      },
      {
        title: "O padrao de atendimento premium",
        body: [
          "Atendimento premium e objetivo, educado e organizado. O cliente precisa perceber processo, nao improviso.",
          "Cada contato deve ter proximo passo claro: enviar documentos, validar dados, aprovar simulacao, escolher forma de pagamento ou agendar retorno.",
          "Quando o consultor registra bem, qualquer pessoa da equipe consegue continuar o atendimento sem perda de contexto.",
        ],
      },
    ],
    checkpoint: question(
      "mentalidade-comercial-check",
      "Qual e a postura comercial mais segura para a GRS?",
      "Diagnosticar, orientar e propor sem prometer resultado antes da validacao.",
      ["Garantir reducao para aumentar conversao.", "Evitar perguntas e ir direto ao preco."],
      "A venda precisa proteger a receita e a reputacao da empresa.",
    ),
    exam: [
      question(
        "mentalidade-comercial-exam-1",
        "O cliente de alto ticket tende a valorizar:",
        "Seguranca, clareza, processo e prova de profissionalismo.",
        ["Pressa e promessa absoluta.", "Atendimento sem registro."],
        "Confianca nasce da combinacao entre linguagem clara e processo visivel.",
      ),
      question(
        "mentalidade-comercial-exam-2",
        "Qual frase e mais adequada?",
        "Vamos analisar seus dados e verificar se ha fundamento para revisao.",
        ["Seu contrato reduz com certeza.", "Se nao fechar agora voce perde tudo."],
        "A linguagem correta evita promessa indevida e melhora a qualidade da venda.",
      ),
    ],
  },
  {
    id: "fundamentos-revisional-comercial",
    title: "Fundamentos do revisional para venda consultiva",
    objective:
      "Explicar revisional com base tecnica simples, usando Banco Central, CDC e entendimento prudente sobre juros.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "O que e uma analise revisional",
        body: [
          "Revisional e a avaliacao de contrato, juros, CET, tarifas, encargos, seguros, saldo devedor e cobrancas para verificar se existe fundamento para discutir o custo da divida.",
          "Nao e cancelamento automatico de debito. Tambem nao e autorizacao para o cliente parar de pagar sem avaliacao.",
          "A abordagem correta e apresentar uma estimativa inicial e deixar claro que documentos e calculos melhoram a seguranca da analise.",
        ],
      },
      {
        title: "Banco Central como comparativo",
        body: [
          "As taxas medias do Banco Central servem como referencia para comparar modalidade, periodo e instituicao financeira.",
          "Comparacao errada gera argumento fraco. Produto, prazo, garantia, data da contratacao e perfil do contrato precisam ser considerados.",
          "O consultor deve falar em parametro de mercado, nao em prova automatica de abuso.",
        ],
      },
      {
        title: "CDC e cautela juridica",
        body: [
          "O Codigo de Defesa do Consumidor reforca transparencia, informacao adequada e combate a praticas abusivas.",
          "Ao mesmo tempo, juros altos por si so nao significam abusividade automatica. O caso concreto precisa ser demonstrado.",
          "Venda forte nao e venda exagerada. E venda com argumento que continua de pe depois que o cliente le o contrato.",
        ],
      },
    ],
    checkpoint: question(
      "fundamentos-comercial-check",
      "Como o consultor deve usar a taxa media do Banco Central?",
      "Como referencia de comparacao, sem prometer resultado automatico.",
      ["Como garantia de reducao.", "Como substituta do contrato."],
      "Parametro publico ajuda no diagnostico, mas nao substitui a analise do caso.",
    ),
    exam: [
      question(
        "fundamentos-comercial-exam-1",
        "Antes de ter documentos completos, o consultor deve falar em:",
        "Indicios e estimativa inicial.",
        ["Resultado garantido.", "Sentenca judicial certa."],
        "A fala comercial precisa ser tecnicamente defensavel.",
      ),
      question(
        "fundamentos-comercial-exam-2",
        "Qual cuidado e essencial na explicacao de juros?",
        "Nao tratar juros altos como abusividade automatica.",
        ["Afirmar que todo contrato e ilegal.", "Dizer que documento nao importa."],
        "O entendimento responsavel reduz risco e aumenta credibilidade.",
      ),
    ],
  },
  {
    id: "qualificacao-produtos-documentos",
    title: "Qualificacao: produto, documentos e prioridade",
    objective:
      "Saber diferenciar veiculo, imovel e emprestimo, pedir documentos certos e classificar prioridade comercial.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "Produtos atendidos",
        body: [
          "Veiculo costuma envolver parcela, saldo, contrato, documento do bem, risco de busca e apreensao e negociacao com financeira.",
          "Imovel tem prazos maiores, saldo relevante, sistema de amortizacao e impacto grande no orcamento familiar.",
          "Emprestimo exige cuidado com refinanciamentos, CET, seguros, tarifas e ciclos de renegociacao.",
        ],
      },
      {
        title: "Documentos essenciais",
        body: [
          "Prioridade inicial: contrato, banco, produto, valor da parcela, quantidade de parcelas, parcelas pagas e comprovantes quando houver.",
          "Quando aplicavel, solicite documentos do bem, boleto, extrato de evolucao, demonstrativo de saldo, notificacoes e protocolos.",
          "Se o cliente nao tiver tudo, registre pendencia e explique como isso afeta a analise.",
        ],
      },
      {
        title: "Prioridade comercial",
        body: [
          "Alta prioridade: cliente com dor clara, documentos proximos, risco de atraso ou perda do bem e decisao possivel.",
          "Media prioridade: interessado, mas ainda sem documentos ou sem urgencia.",
          "Baixa prioridade: curiosidade, sem dor clara ou fora do perfil atendido.",
        ],
      },
    ],
    checkpoint: question(
      "qualificacao-check",
      "Qual e a melhor atitude quando falta documento essencial?",
      "Registrar pendencia, orientar envio e explicar o impacto na analise.",
      ["Inventar dado aproximado.", "Prometer que documento nao sera necessario."],
      "Documento ausente muda a qualidade da analise e precisa ficar claro.",
    ),
    exam: [
      question(
        "qualificacao-exam-1",
        "Em financiamento de veiculo, um risco comum e:",
        "Busca e apreensao ou pressao ligada ao bem.",
        ["Declaracao de imposto de renda.", "Somente limite de cartao."],
        "O risco do bem altera urgencia e abordagem.",
      ),
      question(
        "qualificacao-exam-2",
        "Cliente de alta prioridade normalmente tem:",
        "Dor clara, dados relevantes e proximo passo possivel.",
        ["Apenas curiosidade.", "Nenhum dado e nenhuma urgencia."],
        "Priorizar bem aumenta produtividade comercial.",
      ),
    ],
  },
  {
    id: "diagnostico-spinning-grs",
    title: "Diagnostico consultivo e roteiro de perguntas",
    objective:
      "Conduzir a conversa com perguntas inteligentes, escuta ativa e transicao natural para a proposta.",
    estimatedMinutes: 65,
    sections: [
      {
        title: "Diagnostico antes de proposta",
        body: [
          "Preco antes de diagnostico enfraquece a venda. Primeiro entenda produto, banco, parcela, prazo, parcelas pagas, atraso, objetivo e preocupacao principal.",
          "O cliente deve sentir que a proposta foi construida para o caso dele, nao disparada como texto pronto.",
          "Perguntas boas reduzem objecoes futuras, porque o proprio cliente enxerga o tamanho do problema.",
        ],
      },
      {
        title: "Roteiro consultivo",
        body: [
          "Situacao: qual e o banco, produto, parcela, prazo total e quantas parcelas ja foram pagas?",
          "Problema: o que mais pesa hoje, parcela, saldo, atraso, notificacao, risco do bem ou falta de clareza?",
          "Implicacao: se nada mudar, como isso afeta seu orcamento nos proximos meses?",
          "Necessidade: se houver um caminho para reduzir impacto ou revisar cobrancas, isso resolveria qual parte do problema?",
        ],
      },
      {
        title: "Resumo de atendimento",
        body: [
          "Depois da conversa, registre a dor, dados principais, documentos pendentes, objecao relevante e proximo passo.",
          "Resumo ruim: cliente interessado. Resumo bom: cliente quer reduzir parcela do veiculo, banco X, parcela Y, pagou 14 de 48, vai enviar contrato ate 18h.",
          "O resumo ajuda o proprio consultor no follow-up e ajuda a gestao a auditar qualidade.",
        ],
      },
    ],
    checkpoint: question(
      "diagnostico-check",
      "Qual pergunta melhor identifica implicacao?",
      "Se essa parcela continuar assim, como isso afeta seu orcamento?",
      ["Qual e o banco?", "Voce prefere Pix ou boleto?"],
      "Implicacao faz o cliente entender consequencia sem criar medo artificial.",
    ),
    exam: [
      question(
        "diagnostico-exam-1",
        "Um bom resumo comercial contem:",
        "Dor, dados, pendencias, objecoes e proximo passo.",
        ["Apenas nome do cliente.", "Somente a opiniao do vendedor."],
        "Resumo bom reduz retrabalho e aumenta continuidade.",
      ),
      question(
        "diagnostico-exam-2",
        "Venda consultiva significa:",
        "Entender antes de propor.",
        ["Enviar preco antes de ouvir.", "Fazer pressao sem explicar."],
        "A proposta ganha forca quando nasce do diagnostico.",
      ),
    ],
  },
  {
    id: "simulacao-apresentacao-comercial",
    title: "Simulacao e apresentacao da proposta",
    objective:
      "Preparar simulacao com dados corretos e apresentar indicadores sem exagero, com foco em decisao.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "Dados antes do PDF",
        body: [
          "Confira produto, banco, valor financiado, valor da parcela, prazo, parcelas pagas e entrada quando aplicavel.",
          "Valores precisam respeitar formato brasileiro. Erro em virgula ou ponto pode transformar R$ 1.140,44 em R$ 114.044,00.",
          "Se o produto nao for veiculo, nao force dados de veiculo. O PDF deve mostrar apenas o que faz sentido para o caso.",
        ],
      },
      {
        title: "Como explicar os indicadores",
        body: [
          "Comece pela situacao atual: total da divida atual, saldo devedor e parcela atual.",
          "Depois apresente oportunidade: economia total, economia mensal, parcela corrigida e saldo pos-correcao.",
          "Use sempre linguagem de estimativa: com base nos dados informados, a analise inicial indica este potencial.",
        ],
      },
      {
        title: "Reducao da parcela",
        body: [
          "A reducao padrao e ponto de partida, mas o consultor pode ajustar quando o caso exigir uma estimativa mais conservadora.",
          "Quando juros forem baixos, uma reducao agressiva pode gerar simulacao irreal.",
          "A melhor proposta e aquela que o cliente entende e que a empresa consegue defender com serenidade.",
        ],
      },
    ],
    checkpoint: question(
      "simulacao-check",
      "Como apresentar a economia estimada?",
      "Como estimativa inicial baseada nos dados informados.",
      ["Como resultado garantido.", "Como valor que dispensa contrato."],
      "Simulacao orienta a decisao, mas nao substitui validacao documental.",
    ),
    exam: [
      question(
        "simulacao-exam-1",
        "Antes de gerar PDF, o consultor deve:",
        "Conferir produto, valores, parcelas e dados do contrato.",
        ["Gerar rapidamente sem revisar.", "Usar os mesmos dados de outro cliente."],
        "Simulacao errada reduz confianca e gera retrabalho.",
      ),
      question(
        "simulacao-exam-2",
        "Se a reducao padrao parecer irreal:",
        "Ajuste o percentual com criterio e registre estimativa conservadora.",
        ["Mantenha sempre igual.", "Prometa que o juridico corrige depois."],
        "O consultor deve ter julgamento, nao apenas apertar botao.",
      ),
    ],
  },
  {
    id: "comunicacao-comercial-whatsapp",
    title: "Comunicacao comercial: ligacao, WhatsApp e follow-up",
    objective:
      "Padronizar linguagem, mensagens, audios e retornos para aumentar conversao sem perder profissionalismo.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "Tom de voz",
        body: [
          "A comunicacao deve ser humana, direta, educada e segura. Nem fria como robo, nem agressiva como venda desesperada.",
          "Evite excesso de emoji, letras maiusculas, textos enormes e termos juridicos jogados sem explicacao.",
          "Toda mensagem importante deve ter contexto e proximo passo claro.",
        ],
      },
      {
        title: "Script base",
        body: [
          "Abertura: vi que voce pediu orientacao sobre seu contrato. Vou levantar alguns dados para entender se faz sentido uma analise revisional.",
          "Diagnostico: qual e o banco, produto, valor da parcela, total de parcelas e quantas voce ja pagou?",
          "Transicao: com isso consigo preparar uma leitura inicial e te explicar o caminho mais seguro, sem promessa antecipada.",
        ],
      },
      {
        title: "Follow-up e registro",
        body: [
          "Follow-up deve lembrar o valor da conversa e facilitar a resposta do cliente.",
          "Depois de audio importante, envie resumo escrito e registre no CRM.",
          "Mensagem sem registro e atendimento invisivel. Se der problema, a empresa nao consegue reconstruir a historia.",
        ],
      },
    ],
    checkpoint: question(
      "comunicacao-check",
      "Qual pratica aumenta seguranca depois de um audio importante?",
      "Enviar resumo escrito e registrar no CRM.",
      ["Confiar apenas no audio.", "Apagar a conversa para limpar historico."],
      "Resumo escrito reduz conflitos e facilita continuidade.",
    ),
    exam: [
      question(
        "comunicacao-exam-1",
        "Uma boa mensagem comercial termina com:",
        "Proximo passo claro.",
        ["Promessa absoluta.", "Texto longo sem pedido objetivo."],
        "Proximo passo transforma conversa em avanco.",
      ),
      question(
        "comunicacao-exam-2",
        "Qual canal deve concentrar tratativas de cliente?",
        "Canais oficiais da empresa.",
        ["WhatsApp pessoal do funcionario.", "Email pessoal."],
        "Canais oficiais protegem cliente, funcionario e empresa.",
      ),
    ],
  },
  {
    id: "objecoes-fechamento-comercial",
    title: "Objecoes, negociacao e fechamento",
    objective:
      "Responder objecoes com criterio, conduzir decisao e fechar com acordo claro de pagamento e documentos.",
    estimatedMinutes: 65,
    sections: [
      {
        title: "Objecao nao e rejeicao",
        body: [
          "Objecao e informacao. Pode ser preco, medo de golpe, falta de confianca, necessidade de falar com familiar ou duvida sobre prazo.",
          "Antes de responder, descubra a objecao real. Quem responde preco para cliente com medo de golpe nao resolve nada.",
          "A estrutura e: acolher, investigar, esclarecer, conectar ao valor e confirmar proximo passo.",
        ],
      },
      {
        title: "Fechamento responsavel",
        body: [
          "Fechar e confirmar uma decisao consciente. O cliente precisa saber o que esta contratando, quanto paga, como paga e qual sera a proxima etapa.",
          "A pressao pode gerar venda, mas tambem gera distrato e reclamacao. O fechamento bom reduz ansiedade no pos-venda.",
          "Use perguntas claras: faz sentido iniciarmos hoje com Pix ou prefere boleto para amanha?",
        ],
      },
      {
        title: "Contrato, recibo e pagamento",
        body: [
          "Contrato formaliza a prestacao do servico. Recibo comprova pagamento. Ambos precisam usar dados corretos e template da empresa certa.",
          "Forma de pagamento deve ser registrada como Pix, boleto ou cartao. Status previsto deve ter data futura.",
          "Meta comercial usa valor liquido de meta, considerando taxas quando houver.",
        ],
      },
    ],
    checkpoint: question(
      "objecoes-fechamento-check",
      "Qual e a primeira atitude diante de uma objecao?",
      "Entender a objecao real antes de responder.",
      ["Dar desconto imediato.", "Rebater rapidamente."],
      "A resposta certa depende da objecao certa.",
    ),
    exam: [
      question(
        "objecoes-fechamento-exam-1",
        "Cliente com medo de golpe precisa principalmente de:",
        "Processo claro, contrato, canais oficiais e seguranca.",
        ["Mais pressao.", "Promessa de resultado imediato."],
        "Confianca se constroi com transparencia.",
      ),
      question(
        "objecoes-fechamento-exam-2",
        "Um fechamento de qualidade deixa claro:",
        "Servico, valor, forma de pagamento, documentos e proximo passo.",
        ["Apenas o valor.", "Apenas o nome do vendedor."],
        "Clareza no fechamento reduz pos-venda problematico.",
      ),
    ],
  },
  {
    id: "lgpd-conduta-comercial",
    title: "LGPD, conduta e seguranca no comercial",
    objective:
      "Fixar regras para uso de dados, canais oficiais, equipamentos da empresa e pagamentos autorizados.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "Dados pessoais no comercial",
        body: [
          "Nome, CPF, telefone, email, endereco, contrato, parcela, documentos e historico de atendimento sao dados pessoais ou informacoes relacionadas ao cliente.",
          "O consultor acessa dados apenas para a finalidade autorizada pela empresa.",
          "Dados nao devem circular por celular pessoal, email pessoal, pasta pessoal ou conversa sem controle.",
        ],
      },
      {
        title: "Condutas proibidas",
        body: [
          "E proibido receber pagamento em conta pessoal, cobrar servico nao autorizado, usar dados de cartao do cliente ou manter atendimento por numero pessoal.",
          "Tambem e proibido apagar conversas corporativas, exportar base de leads ou reter chip/equipamento da empresa.",
          "Essas condutas podem gerar responsabilizacao trabalhista, civil, criminal e disciplinar.",
        ],
      },
      {
        title: "Rotina segura",
        body: [
          "Use login individual, senha segura, canais oficiais e computador bloqueado ao se afastar.",
          "Se um cliente enviar documento por canal inadequado, oriente o canal correto e registre o contexto quando necessario.",
          "Seguranca e parte da venda: cliente premium precisa confiar no processo.",
        ],
      },
    ],
    checkpoint: question(
      "lgpd-comercial-check",
      "Qual conduta esta alinhada a seguranca?",
      "Usar canais oficiais, login individual e registrar informacoes no CRM.",
      ["Receber Pix pessoal.", "Salvar contrato no celular pessoal."],
      "Seguranca protege cliente, funcionario e empresa.",
    ),
    exam: [
      question(
        "lgpd-comercial-exam-1",
        "Pagamento por fora da empresa:",
        "E proibido e pode gerar responsabilizacao.",
        ["E permitido se o cliente aceitar.", "E apenas um detalhe financeiro."],
        "Pagamento precisa ocorrer pelos meios autorizados e registrados.",
      ),
      question(
        "lgpd-comercial-exam-2",
        "Se um dado do cliente for enviado em canal pessoal:",
        "Oriente o canal correto e registre a ocorrencia quando necessario.",
        ["Continue por ali para ser mais rapido.", "Apague e finja que nao recebeu."],
        "A resposta correta reduz risco e organiza o atendimento.",
      ),
    ],
  },
];

const crmChapters: AcademyChapter[] = [
  {
    id: "mapa-crm-areas",
    title: "Mapa do CRM: areas, menus e responsabilidades",
    objective:
      "Entender onde cada area trabalha, quais menus usar e como o CRM organiza a operacao multiempresa.",
    estimatedMinutes: 45,
    sections: [
      {
        title: "Tela inicial e areas",
        body: [
          "Usuarios com acesso superior podem escolher entre Gestao, Comercial, Juridico e Financeiro conforme permissao da empresa.",
          "O menu lateral muda de acordo com a area atual. Isso evita confusao entre rotinas de comercial, juridico e gestao.",
          "Cada empresa possui dados, clientes, templates, usuarios e configuracoes isolados por empresa.",
        ],
      },
      {
        title: "Quando usar cada area",
        body: [
          "Comercial concentra clientes, pre-vendas, simulacoes, painel comercial, documentos e Academy.",
          "Juridico concentra clientes, documentos, esteira, emails, anexos e acompanhamento de processos.",
          "Gestao concentra usuarios, empresas, templates, backups, configuracoes, relatorios e acompanhamento do Academy.",
        ],
      },
      {
        title: "Regra de ouro do CRM",
        body: [
          "O CRM deve responder tres perguntas: quem e o cliente, em que etapa ele esta e qual e o proximo passo.",
          "Se uma informacao importante so existe no WhatsApp, ela ainda nao existe para a operacao.",
          "Registrar bem e parte da entrega, nao uma burocracia separada.",
        ],
      },
    ],
    checkpoint: question(
      "mapa-crm-check",
      "Qual e a regra de ouro do CRM?",
      "Mostrar quem e o cliente, em que etapa esta e qual o proximo passo.",
      ["Guardar apenas vendas fechadas.", "Substituir toda conversa com o cliente."],
      "O CRM e a memoria operacional da empresa.",
    ),
    exam: [
      question(
        "mapa-crm-exam-1",
        "O menu lateral deve refletir:",
        "A area atual do usuario.",
        ["Apenas o cargo do usuario.", "Sempre todos os menus do sistema."],
        "Menus por area reduzem ruido e melhoram usabilidade.",
      ),
      question(
        "mapa-crm-exam-2",
        "Informacao relevante combinada por WhatsApp deve:",
        "Ser registrada no CRM.",
        ["Ficar apenas na conversa.", "Ser lembrada de memoria."],
        "Registro garante continuidade e auditoria.",
      ),
    ],
  },
  {
    id: "clientes-crm",
    title: "Clientes: cadastro, edicao e documentos",
    objective:
      "Usar corretamente a tela de clientes, campos obrigatorios/opcionais, botoes de copia e documentos anexados.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "Cadastro de cliente",
        body: [
          "Cadastre dados reais e conferidos: nome, CPF quando existir, telefone, email, endereco, estado civil, profissao e responsaveis.",
          "Quando o gestor cria cliente para outro consultor, deve selecionar o consultor comercial responsavel.",
          "Campos juridicos aparecem para informacoes usadas em documentos do juridico, como banco, CNPJ e sede quando aplicavel.",
        ],
      },
      {
        title: "Documentos do cliente",
        body: [
          "A tela do cliente mostra arquivos enviados, documentos gerados, pre-vendas e simulacoes vinculadas.",
          "Upload em massa aceita varios arquivos, mas cada documento deve ser classificado pelo tipo correto.",
          "Nomes claros ajudam na busca: RG, contrato, comprovante, notificacao, laudo e recibo devem ficar identificaveis.",
        ],
      },
      {
        title: "Atalhos e seguranca",
        body: [
          "Botoes de copiar reduzem erro ao transferir CPF, telefone, endereco e demais dados para documentos ou mensagens.",
          "Use WhatsApp e email oficiais sempre que possivel. Evite copiar dado sensivel para ambientes sem controle.",
          "Ao editar dados, registre no historico o que foi alterado e por que.",
        ],
      },
    ],
    checkpoint: question(
      "clientes-crm-check",
      "Ao editar dado relevante do cliente, o usuario deve:",
      "Salvar e registrar no historico o motivo da alteracao.",
      ["Alterar sem anotacao.", "Criar outro cliente duplicado."],
      "Historico permite auditoria e continuidade.",
    ),
    exam: [
      question(
        "clientes-crm-exam-1",
        "Arquivos anexados devem ter:",
        "Tipo correto e nome identificavel.",
        ["Nome aleatorio.", "Cliente parecido."],
        "Organizacao documental reduz retrabalho.",
      ),
      question(
        "clientes-crm-exam-2",
        "Consultor comercial responsavel serve para:",
        "Designar quem acompanha aquele cliente no comercial.",
        ["Excluir responsaveis juridicos.", "Substituir o CPF."],
        "Responsabilidade clara melhora indicadores e atendimento.",
      ),
    ],
  },
  {
    id: "pre-vendas-crm",
    title: "Pre-vendas: pipeline, status e pagamentos",
    objective:
      "Criar e atualizar pre-vendas com produto, status, pagamento previsto, meta e documentos corretos.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "Pipeline comercial",
        body: [
          "Pre-venda representa uma oportunidade ou contrato em andamento. Um cliente pode ter mais de uma pre-venda.",
          "O pipeline mostra status como lead, pre-venda, em contato, em negociacao, aprovado e perdido.",
          "Ao arrastar ou alterar status, registre contexto quando a mudanca for relevante.",
        ],
      },
      {
        title: "Pagamentos previstos",
        body: [
          "Forma de pagamento deve ser Pix, boleto ou cartao. Se status for previsto, a data precisa ser futura.",
          "Em Pix e boleto, a meta deve puxar o mesmo valor do pagamento. Em cartao, o usuario pode informar meta liquida por causa de taxas.",
          "Pagamentos pagos entram no painel comercial do mes do pagamento, mesmo que a pre-venda tenha sido criada em mes anterior.",
        ],
      },
      {
        title: "Contrato, recibo e descricao",
        body: [
          "A descricao de contrato alimenta documentos e precisa explicar a forma acordada de pagamento.",
          "Numero do processo e numero do financiamento podem ser preenchidos quando fizerem sentido.",
          "Pre-venda aprovada deve ficar pronta para gerar documentos e seguir para o juridico quando aplicavel.",
        ],
      },
    ],
    checkpoint: question(
      "pre-vendas-crm-check",
      "Quando Pix ou boleto sao selecionados, o campo meta deve:",
      "Usar o mesmo valor do pagamento.",
      ["Ficar sempre vazio.", "Receber CPF do cliente."],
      "A meta alimenta painel comercial e comissao.",
    ),
    exam: [
      question(
        "pre-vendas-crm-exam-1",
        "Pagamento previsto deve ter:",
        "Data futura e forma definida.",
        ["Data vencida sem motivo.", "Forma em branco."],
        "Previsao correta melhora cobranca e alerta.",
      ),
      question(
        "pre-vendas-crm-exam-2",
        "Uma venda paga neste mes conta no painel:",
        "No mes do pagamento.",
        ["Somente no mes da criacao da pre-venda.", "Apenas quando gerar contrato."],
        "O painel considera pagamentos pagos no periodo.",
      ),
    ],
  },
  {
    id: "simulacoes-crm",
    title: "Simulacoes no CRM",
    objective:
      "Criar simulacoes de veiculo, imovel e emprestimo, gerar PDF e evitar erros de preenchimento.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "Produtos da simulacao",
        body: [
          "Veiculo pode usar campos de bem, marca/modelo e entrada quando aplicavel.",
          "Imovel e emprestimo ocultam campos que nao fazem sentido, como informacoes de veiculo e entrada.",
          "A reducao de parcela vem sugerida por padrao, mas pode ser ajustada pelo consultor antes de gerar a simulacao.",
        ],
      },
      {
        title: "Campos calculados",
        body: [
          "Valor financiado, parcelas restantes e outros campos automaticos aparecem com visual diferente para evitar confusao com input manual.",
          "Se faltar dado, o PDF deve omitir blocos nao preenchidos em vez de poluir o documento com informacoes vazias.",
          "A situacao da simulacao vai como aprovada por padrao, especialista vem do usuario logado e data vem do dia atual.",
        ],
      },
      {
        title: "PDF da simulacao",
        body: [
          "O PDF deve usar logo, endereco, CNPJ, telefone e site da empresa selecionada.",
          "Cada simulacao gera protocolo e arquivo padronizado.",
          "Antes de enviar ao cliente, confira se valores, produto, indicadores e rodape estao coerentes.",
        ],
      },
    ],
    checkpoint: question(
      "simulacoes-crm-check",
      "O que deve acontecer com campos nao preenchidos no PDF?",
      "Devem ser omitidos quando nao fizerem sentido.",
      ["Devem aparecer como texto vazio.", "Devem ser preenchidos com dados inventados."],
      "PDF limpo aumenta profissionalismo e evita duvida.",
    ),
    exam: [
      question(
        "simulacoes-crm-exam-1",
        "A reducao da parcela no cadastro serve para:",
        "Ajustar a estimativa antes de gerar o PDF.",
        ["Aparecer sempre no PDF.", "Bloquear qualquer simulacao."],
        "O campo da porcentagem e ferramenta interna de calculo.",
      ),
      question(
        "simulacoes-crm-exam-2",
        "Campos automaticos devem parecer:",
        "Calculados e nao editaveis.",
        ["Inputs comuns.", "Botoes de acao."],
        "Visual correto reduz erro de uso.",
      ),
    ],
  },
  {
    id: "documentos-templates-crm",
    title: "Documentos, templates e variaveis",
    objective:
      "Entender como gerar documentos, usar templates oficiais e manter tags coerentes por empresa e area.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "Templates por empresa",
        body: [
          "Cada empresa deve usar seus proprios templates, logo, dados, clausulas e documentos.",
          "Templates do juridico podem ficar vinculados a etapas da esteira. Templates comerciais geram contrato, recibo e pre-venda.",
          "Quando uma empresa tiver clausula diferente na simulacao, deve existir configuracao ou template especifico para ela.",
        ],
      },
      {
        title: "Tags e dados",
        body: [
          "Tags puxam dados do cliente, pre-venda, empresa, financeiro e responsaveis.",
          "Se uma informacao usada no documento nao existir no cadastro, crie campo apropriado ou marque como juridico/obrigatorio conforme uso.",
          "Documento gerado com tag vazia transmite falta de cuidado.",
        ],
      },
      {
        title: "Geracao e visualizacao",
        body: [
          "Ao gerar documento, o CRM deve salvar registro, arquivo, status e relacao com cliente/pre-venda.",
          "Visualizar documento nao deve abrir abas duplicadas ou telas vazias.",
          "Se houver erro de permissao, verifique empresa, area do template e politica de acesso.",
        ],
      },
    ],
    checkpoint: question(
      "documentos-crm-check",
      "Por que templates devem ser separados por empresa?",
      "Porque dados, clausulas, logo e documentos podem mudar por empresa.",
      ["Porque o CRM nao aceita tags.", "Porque todos usam o mesmo CNPJ."],
      "Multiempresa exige isolamento tambem nos documentos.",
    ),
    exam: [
      question(
        "documentos-crm-exam-1",
        "Uma tag sem dado correspondente gera risco de:",
        "Documento incompleto ou pouco profissional.",
        ["PDF mais bonito.", "Backup automatico."],
        "Tags precisam refletir dados reais.",
      ),
      question(
        "documentos-crm-exam-2",
        "Templates juridicos podem ser vinculados a:",
        "Etapas da esteira juridica.",
        ["Apenas ao painel comercial.", "Somente ao backup."],
        "Vinculo por etapa facilita geracao do documento correto.",
      ),
    ],
  },
  {
    id: "juridico-acompanhamento-crm",
    title: "Juridico, esteira e acompanhamento do cliente",
    objective:
      "Usar esteira juridica, documentos, emails, movimentacoes e portal de acompanhamento com seguranca.",
    estimatedMinutes: 65,
    sections: [
      {
        title: "Esteira juridica",
        body: [
          "A esteira mostra em que fase cada cliente esta, ha quanto tempo e quais documentos da etapa existem.",
          "Usuarios autorizados podem editar colunas, titulo, descricao, ordem e mover clientes em massa, respeitando regras de seguranca.",
          "Coluna so deve ser removida quando nao houver cliente nela. Templates vinculados ficam no sistema, mas sem vinculo com etapa removida.",
        ],
      },
      {
        title: "Movimentacoes e anotacoes",
        body: [
          "Ao mover cliente de etapa, registre uma anotacao clara sobre o motivo.",
          "Movimentacao publica deve ser objetiva e segura, sem dados sensiveis, valores ou estrategia interna.",
          "Logs internos registram criacao, edicao e remocao de movimentacoes do acompanhamento.",
        ],
      },
      {
        title: "Email e documentos",
        body: [
          "Administradores juridicos podem enviar emails com templates ou texto livre, anexando documentos do cliente.",
          "Emails enviados devem deixar rastro no historico do cliente.",
          "Arquivos importados ou gerados devem ficar vinculados ao cliente correto e no bucket privado.",
        ],
      },
    ],
    checkpoint: question(
      "juridico-acompanhamento-check",
      "Qual atualizacao deve aparecer para o cliente no portal?",
      "Uma informacao objetiva, segura e liberada pela equipe.",
      ["Estrategia interna completa.", "Dados sensiveis do processo."],
      "O portal reduz ansiedade sem expor informacao indevida.",
    ),
    exam: [
      question(
        "juridico-acompanhamento-exam-1",
        "Mover cliente na esteira exige:",
        "Status correto e anotacao clara.",
        ["Apagar historico.", "Mover sem motivo registrado."],
        "A esteira precisa ser rastreavel.",
      ),
      question(
        "juridico-acompanhamento-exam-2",
        "Email enviado pelo juridico deve:",
        "Ficar registrado no historico do cliente.",
        ["Ser enviado por conta pessoal.", "Nao deixar rastro."],
        "Registro protege a empresa e facilita acompanhamento.",
      ),
    ],
  },
  {
    id: "paineis-backup-seguranca-crm",
    title: "Paineis, backup e seguranca operacional",
    objective:
      "Conhecer paineis, financeiro, backups, restauracao e boas praticas de uso seguro do CRM.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "Paineis e consultas",
        body: [
          "Painel comercial mostra vendas do mes, meta, pagamentos pendentes, comissao estimada, origem do lead e segmentacoes.",
          "Gestao ve indicadores da equipe e pode filtrar por consultor. Consultor comum ve apenas seus proprios dados.",
          "Financeiro separa lancamentos de consultas, usa meta liquida para vendas e mantem logs de alteracoes.",
        ],
      },
      {
        title: "Backups e restauracao",
        body: [
          "Backups padronizados incluem dados, documentos, historicos, acompanhamentos, logs, templates e arquivos vinculados.",
          "Backup automatico fica fora da producao via GitHub Actions. Backup manual pode ser gerado para situacoes especiais.",
          "Restauracao pode ser por cliente ou completa, usando formato padronizado para reduzir risco.",
        ],
      },
      {
        title: "Seguranca multiempresa",
        body: [
          "Cada empresa deve ver apenas seus dados. Clientes, templates, documentos, backups e configuracoes precisam respeitar company_id.",
          "Usuarios master e plataforma podem ter acesso superior, mas acoes sensiveis devem ser registradas.",
          "Se aparecer dado de outra empresa, pare o uso e comunique imediatamente.",
        ],
      },
    ],
    checkpoint: question(
      "paineis-backup-check",
      "Qual e o objetivo do backup padronizado?",
      "Permitir restauracao confiavel de dados e arquivos importantes.",
      ["Substituir o uso do CRM.", "Guardar apenas prints."],
      "Backup bom precisa ser restauravel, nao apenas baixavel.",
    ),
    exam: [
      question(
        "paineis-backup-exam-1",
        "Consultor comercial comum deve ver no painel:",
        "Apenas seus proprios resultados.",
        ["Vendas de todos sem permissao.", "Backups de todas as empresas."],
        "Permissao por usuario protege dados e evita conflito.",
      ),
      question(
        "paineis-backup-exam-2",
        "Se dados da GRS aparecerem em empresa Kairos:",
        "Interrompa, reporte e corrija isolamento multiempresa.",
        ["Ignore se for pouco dado.", "Copie para outra tela."],
        "Vazamento multiempresa e risco critico.",
      ),
    ],
  },
];

export const academyCourses: AcademyCourse[] = [
  createCourse({
    slug: "formacao-grs-revisional-venda-consultiva",
    title: "Formacao Comercial GRS",
    subtitle: "Venda consultiva revisional",
    description:
      "Curso para formar consultores comerciais capazes de qualificar oportunidades, explicar revisional com responsabilidade, apresentar simulacoes, lidar com objecoes, fechar contratos e proteger dados do cliente.",
    passingScore: 85,
    audience:
      "Consultores comerciais, supervisores comerciais e gestores que acompanham vendas.",
    chapters: commercialChapters,
  }),
  createCourse({
    slug: "operacao-crm-grs",
    title: "Operacao do CRM GRS",
    subtitle: "Uso profissional da plataforma",
    description:
      "Curso pratico para ensinar usuarios a operar o CRM com qualidade: clientes, pre-vendas, simulacoes, documentos, juridico, paineis, backups, multiempresa e seguranca operacional.",
    passingScore: 85,
    audience:
      "Usuarios comerciais, juridicos, financeiros, gestores e administradores em onboarding.",
    chapters: crmChapters,
  }),
];

export const academyCourse = academyCourses[0];

export function getAcademyCourse(courseSlug: string) {
  return academyCourses.find((course) => course.slug === courseSlug) ?? null;
}

export function getAcademyChapter(courseSlug: string, chapterId?: string) {
  const course = chapterId ? getAcademyCourse(courseSlug) : academyCourse;
  const targetChapterId = chapterId ?? courseSlug;

  return course?.chapters.find((chapter) => chapter.id === targetChapterId) ?? null;
}

export function getNextAcademyChapter(courseSlug: string, chapterId?: string) {
  const course = chapterId ? getAcademyCourse(courseSlug) : academyCourse;
  const targetChapterId = chapterId ?? courseSlug;
  const currentIndex =
    course?.chapters.findIndex((chapter) => chapter.id === targetChapterId) ?? -1;

  return currentIndex >= 0 ? course?.chapters[currentIndex + 1] ?? null : null;
}

export function getAcademyQuestionAnswer(question: AcademyQuestion, optionId: string) {
  return question.options.find((option) => option.id === optionId) ?? null;
}
