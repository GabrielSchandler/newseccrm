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
      "Entender o papel do comercial: vender com clareza, responsabilidade e segurança para um cliente de ticket alto.",
    estimatedMinutes: 45,
    sections: [
      {
        title: "O que o cliente compra",
        body: [
          "O cliente não compra apenas um contrato ou uma simulação. Ele compra alívio, direção e segurança para lidar com uma dívida que pesa no orçamento.",
          "A venda profissional não depende de promessa forte. Ela depende de diagnóstico bem feito, proposta coerente e conducao tranquila até a decisão.",
          "O padrão GRS e consultivo: entender primeiro, orientar depois e fechar apenas quando a solucao fizer sentido para o caso.",
        ],
      },
      {
        title: "Limite entre venda e promessa",
        body: [
          "O comercial pode falar em análise, estratégia, indícios, estimativa e possibilidade. Não deve garantir redução, quitação, liminar ou resposta do banco antes da validação.",
          "Promessa indevida gera cliente ansioso, distrato, reclamação e risco jurídico para a empresa.",
          "A frase segura é: com base nos dados informados, conseguimos fazer uma leitura inicial e verificar se existe fundamento para uma estratégia revisional.",
        ],
      },
      {
        title: "O padrão de atendimento premium",
        body: [
          "Atendimento premium e objetivo, educado e organizado. O cliente precisa perceber processo, não improviso.",
          "Cada contato deve ter próximo passo claro: enviar documentos, validar dados, aprovar simulação, escolher forma de pagamento ou agendar retorno.",
          "Quando o consultor registra bem, qualquer pessoa da equipe consegue continuar o atendimento sem perda de contexto.",
        ],
      },
    ],
    checkpoint: question(
      "mentalidade-comercial-check",
      "Qual é a postura comercial mais segura para a GRS?",
      "Diagnosticar, orientar e propor sem prometer resultado antes da validação.",
      ["Garantir redução para aumentar conversão.", "Evitar perguntas e ir direto ao preço."],
      "A venda precisa proteger a receita e a reputação da empresa.",
    ),
    exam: [
      question(
        "mentalidade-comercial-exam-1",
        "O cliente de alto ticket tende a valorizar:",
        "Segurança, clareza, processo e prova de profissionalismo.",
        ["Pressa e promessa absoluta.", "Atendimento sem registro."],
        "Confiança nasce da combinacao entre linguagem clara e processo visivel.",
      ),
      question(
        "mentalidade-comercial-exam-2",
        "Qual frase e mais adequada?",
        "Vamos analisar seus dados e verificar se há fundamento para revisão.",
        ["Seu contrato reduz com certeza.", "Se não fechar agora você perde tudo."],
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
        title: "O que é uma análise revisional",
        body: [
          "Revisional e a avaliação de contrato, juros, CET, tarifas, encargos, seguros, saldo devedor e cobranças para verificar se existe fundamento para discutir o custo da dívida.",
          "Não é cancelamento automático de debito. Tambem não é autorização para o cliente parar de pagar sem avaliação.",
          "A abordagem correta e apresentar uma estimativa inicial e deixar claro que documentos e cálculos melhoram a segurança da análise.",
        ],
      },
      {
        title: "Banco Central como comparativo",
        body: [
          "As taxas médias do Banco Central servem como referência para comparar modalidade, período e instituição financeira.",
          "Comparação errada gera argumento fraco. Produto, prazo, garantia, data da contratação e perfil do contrato precisam ser considerados.",
          "O consultor deve falar em parametro de mercado, não em prova automática de abuso.",
        ],
      },
      {
        title: "CDC e cautela jurídica",
        body: [
          "O Código de Defesa do Consumidor reforca transparência, informação adequada e combate a práticas abusivas.",
          "Ao mesmo tempo, juros altos por si só não significam abusividade automática. O caso concreto precisa ser demonstrado.",
          "Venda forte não é venda exagerada. E venda com argumento que continua de pe depois que o cliente le o contrato.",
        ],
      },
    ],
    checkpoint: question(
      "fundamentos-comercial-check",
      "Como o consultor deve usar a taxa media do Banco Central?",
      "Como referência de comparação, sem prometer resultado automático.",
      ["Como garantia de redução.", "Como substituta do contrato."],
      "Parametro público ajuda no diagnóstico, mas não substitui a análise do caso.",
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
        "Qual cuidado e essencial na explicação de juros?",
        "Não tratar juros altos como abusividade automática.",
        ["Afirmar que todo contrato e ilegal.", "Dizer que documento não importa."],
        "O entendimento responsável reduz risco e aumenta credibilidade.",
      ),
    ],
  },
  {
    id: "qualificacao-produtos-documentos",
    title: "Qualificação: produto, documentos e prioridade",
    objective:
      "Saber diferenciar veículo, imóvel e empréstimo, pedir documentos certos e classificar prioridade comercial.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "Produtos atendidos",
        body: [
          "Veículo costuma envolver parcela, saldo, contrato, documento do bem, risco de busca e apreensao e negociacao com financeira.",
          "Imóvel tem prazos maiores, saldo relevante, sistema de amortizacao e impacto grande no orçamento familiar.",
          "Empréstimo exige cuidado com refinanciamentos, CET, seguros, tarifas e ciclos de renegociacao.",
        ],
      },
      {
        title: "Documentos essenciais",
        body: [
          "Prioridade inicial: contrato, banco, produto, valor da parcela, quantidade de parcelas, parcelas pagas e comprovantes quando houver.",
          "Quando aplicável, solicite documentos do bem, boleto, extrato de evolução, demonstrativo de saldo, notificações e protocolos.",
          "Se o cliente não tiver tudo, registre pendência e explique como isso afeta a análise.",
        ],
      },
      {
        title: "Prioridade comercial",
        body: [
          "Alta prioridade: cliente com dor clara, documentos próximos, risco de atraso ou perda do bem e decisão possível.",
          "Media prioridade: interessado, mas ainda sem documentos ou sem urgência.",
          "Baixa prioridade: curiosidade, sem dor clara ou fora do perfil atendido.",
        ],
      },
    ],
    checkpoint: question(
      "qualificacao-check",
      "Qual é a melhor atitude quando falta documento essencial?",
      "Registrar pendência, orientar envio e explicar o impacto na análise.",
      ["Inventar dado aproximado.", "Prometer que documento não sera necessário."],
      "Documento ausente muda a qualidade da análise e precisa ficar claro.",
    ),
    exam: [
      question(
        "qualificacao-exam-1",
        "Em financiamento de veículo, um risco comum e:",
        "Busca e apreensao ou pressao ligada ao bem.",
        ["Declaracao de imposto de renda.", "Somente limite de cartao."],
        "O risco do bem altera urgência e abordagem.",
      ),
      question(
        "qualificacao-exam-2",
        "Cliente de alta prioridade normalmente tem:",
        "Dor clara, dados relevantes e próximo passo possível.",
        ["Apenas curiosidade.", "Nenhum dado e nenhuma urgência."],
        "Priorizar bem aumenta produtividade comercial.",
      ),
    ],
  },
  {
    id: "diagnostico-spinning-grs",
    title: "Diagnóstico consultivo e roteiro de perguntas",
    objective:
      "Conduzir a conversa com perguntas inteligentes, escuta ativa e transicao natural para a proposta.",
    estimatedMinutes: 65,
    sections: [
      {
        title: "Diagnóstico antes de proposta",
        body: [
          "Preço antes de diagnóstico enfraquece a venda. Primeiro entenda produto, banco, parcela, prazo, parcelas pagas, atraso, objetivo e preocupacao principal.",
          "O cliente deve sentir que a proposta foi construida para o caso dele, não disparada como texto pronto.",
          "Perguntas boas reduzem objeções futuras, porque o próprio cliente enxerga o tamanho do problema.",
        ],
      },
      {
        title: "Roteiro consultivo",
        body: [
          "Situação: qual é o banco, produto, parcela, prazo total e quantas parcelas já foram pagas?",
          "Problema: o que mais pesa hoje, parcela, saldo, atraso, notificacao, risco do bem ou falta de clareza?",
          "Implicacao: se nada mudar, como isso afeta seu orçamento nos próximos meses?",
          "Necessidade: se houver um caminho para reduzir impacto ou revisar cobranças, isso resolveria qual parte do problema?",
        ],
      },
      {
        title: "Resumo de atendimento",
        body: [
          "Depois da conversa, registre a dor, dados principais, documentos pendentes, objeção relevante e próximo passo.",
          "Resumo ruim: cliente interessado. Resumo bom: cliente quer reduzir parcela do veículo, banco X, parcela Y, pagou 14 de 48, vai enviar contrato até 18h.",
          "O resumo ajuda o próprio consultor no follow-up e ajuda a gestão a auditar qualidade.",
        ],
      },
    ],
    checkpoint: question(
      "diagnostico-check",
      "Qual pergunta melhor identifica implicacao?",
      "Se essa parcela continuar assim, como isso afeta seu orçamento?",
      ["Qual é o banco?", "Você prefere Pix ou boleto?"],
      "Implicacao faz o cliente entender consequencia sem criar medo artificial.",
    ),
    exam: [
      question(
        "diagnostico-exam-1",
        "Um bom resumo comercial contem:",
        "Dor, dados, pendencias, objeções e próximo passo.",
        ["Apenas nome do cliente.", "Somente a opiniao do vendedor."],
        "Resumo bom reduz retrabalho e aumenta continuidade.",
      ),
      question(
        "diagnostico-exam-2",
        "Venda consultiva significa:",
        "Entender antes de propor.",
        ["Enviar preço antes de ouvir.", "Fazer pressao sem explicar."],
        "A proposta ganha forca quando nasce do diagnóstico.",
      ),
    ],
  },
  {
    id: "simulacao-apresentacao-comercial",
    title: "Simulação e apresentacao da proposta",
    objective:
      "Preparar simulação com dados corretos e apresentar indicadores sem exagero, com foco em decisão.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "Dados antes do PDF",
        body: [
          "Confira produto, banco, valor financiado, valor da parcela, prazo, parcelas pagas e entrada quando aplicável.",
          "Valores precisam respeitar formato brasileiro. Erro em virgula ou ponto pode transformar R$ 1.140,44 em R$ 114.044,00.",
          "Se o produto não for veículo, não force dados de veículo. O PDF deve mostrar apenas o que faz sentido para o caso.",
        ],
      },
      {
        title: "Como explicar os indicadores",
        body: [
          "Comece pela situação atual: total da dívida atual, saldo devedor e parcela atual.",
          "Depois apresente oportunidade: economia total, economia mensal, parcela corrigida e saldo pós-correcao.",
          "Use sempre linguagem de estimativa: com base nos dados informados, a análise inicial indica este potencial.",
        ],
      },
      {
        title: "Redução da parcela",
        body: [
          "A redução padrão e ponto de partida, mas o consultor pode ajustar quando o caso exigir uma estimativa mais conservadora.",
          "Quando juros forem baixos, uma redução agressiva pode gerar simulação irreal.",
          "A melhor proposta e aquela que o cliente entende e que a empresa consegue defender com serenidade.",
        ],
      },
    ],
    checkpoint: question(
      "simulacao-check",
      "Como apresentar a economia estimada?",
      "Como estimativa inicial baseada nos dados informados.",
      ["Como resultado garantido.", "Como valor que dispensa contrato."],
      "Simulação orienta a decisão, mas não substitui validação documental.",
    ),
    exam: [
      question(
        "simulacao-exam-1",
        "Antes de gerar PDF, o consultor deve:",
        "Conferir produto, valores, parcelas e dados do contrato.",
        ["Gerar rapidamente sem revisar.", "Usar os mesmos dados de outro cliente."],
        "Simulação errada reduz confiança e gera retrabalho.",
      ),
      question(
        "simulacao-exam-2",
        "Se a redução padrão parecer irreal:",
        "Ajuste o percentual com criterio e registre estimativa conservadora.",
        ["Mantenha sempre igual.", "Prometa que o jurídico corrige depois."],
        "O consultor deve ter julgamento, não apenas apertar botao.",
      ),
    ],
  },
  {
    id: "comunicacao-comercial-whatsapp",
    title: "Comunicacao comercial: ligacao, WhatsApp e follow-up",
    objective:
      "Padronizar linguagem, mensagens, audios e retornos para aumentar conversão sem perder profissionalismo.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "Tom de voz",
        body: [
          "A comunicacao deve ser humana, direta, educada e segura. Nem fria como robo, nem agressiva como venda desesperada.",
          "Evite excesso de emoji, letras maiúsculas, textos enormes e termos jurídicos jogados sem explicação.",
          "Toda mensagem importante deve ter contexto e próximo passo claro.",
        ],
      },
      {
        title: "Script base",
        body: [
          "Abertura: vi que você pediu orientação sobre seu contrato. Vou levantar alguns dados para entender se faz sentido uma análise revisional.",
          "Diagnóstico: qual é o banco, produto, valor da parcela, total de parcelas e quantas você já pagou?",
          "Transicao: com isso consigo preparar uma leitura inicial e te explicar o caminho mais seguro, sem promessa antecipada.",
        ],
      },
      {
        title: "Follow-up e registro",
        body: [
          "Follow-up deve lembrar o valor da conversa e facilitar a resposta do cliente.",
          "Depois de áudio importante, envie resumo escrito e registre no CRM.",
          "Mensagem sem registro e atendimento invisivel. Se der problema, a empresa não consegue reconstruir a historia.",
        ],
      },
    ],
    checkpoint: question(
      "comunicacao-check",
      "Qual prática aumenta segurança depois de um áudio importante?",
      "Enviar resumo escrito e registrar no CRM.",
      ["Confiar apenas no áudio.", "Apagar a conversa para limpar histórico."],
      "Resumo escrito reduz conflitos e facilita continuidade.",
    ),
    exam: [
      question(
        "comunicacao-exam-1",
        "Uma boa mensagem comercial termina com:",
        "Próximo passo claro.",
        ["Promessa absoluta.", "Texto longo sem pedido objetivo."],
        "Próximo passo transforma conversa em avanco.",
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
    title: "Objeções, negociacao e fechamento",
    objective:
      "Responder objeções com criterio, conduzir decisão e fechar com acordo claro de pagamento e documentos.",
    estimatedMinutes: 65,
    sections: [
      {
        title: "Objeção não é rejeicao",
        body: [
          "Objeção e informação. Pode ser preço, medo de golpe, falta de confiança, necessidade de falar com familiar ou duvida sobre prazo.",
          "Antes de responder, descubra a objeção real. Quem responde preço para cliente com medo de golpe não resolve nada.",
          "A estrutura e: acolher, investigar, esclarecer, conectar ao valor e confirmar próximo passo.",
        ],
      },
      {
        title: "Fechamento responsável",
        body: [
          "Fechar e confirmar uma decisão consciente. O cliente precisa saber o que está contratando, quanto paga, como paga e qual será a próxima etapa.",
          "A pressao pode gerar venda, mas tambem gera distrato e reclamação. O fechamento bom reduz ansiedade no pós-venda.",
          "Use perguntas claras: faz sentido iniciarmos hoje com Pix ou prefere boleto para amanha?",
        ],
      },
      {
        title: "Contrato, recibo e pagamento",
        body: [
          "Contrato formaliza a prestação do serviço. Recibo comprova pagamento. Ambos precisam usar dados corretos e template da empresa certa.",
          "Forma de pagamento deve ser registrada como Pix, boleto ou cartao. Status previsto deve ter data futura.",
          "Meta comercial usa valor liquido de meta, considerando taxas quando houver.",
        ],
      },
    ],
    checkpoint: question(
      "objecoes-fechamento-check",
      "Qual é a primeira atitude diante de uma objeção?",
      "Entender a objeção real antes de responder.",
      ["Dar desconto imediato.", "Rebater rapidamente."],
      "A resposta certa depende da objeção certa.",
    ),
    exam: [
      question(
        "objecoes-fechamento-exam-1",
        "Cliente com medo de golpe precisa principalmente de:",
        "Processo claro, contrato, canais oficiais e segurança.",
        ["Mais pressao.", "Promessa de resultado imediato."],
        "Confiança se constroi com transparência.",
      ),
      question(
        "objecoes-fechamento-exam-2",
        "Um fechamento de qualidade deixa claro:",
        "Serviço, valor, forma de pagamento, documentos e próximo passo.",
        ["Apenas o valor.", "Apenas o nome do vendedor."],
        "Clareza no fechamento reduz pós-venda problematico.",
      ),
    ],
  },
  {
    id: "lgpd-conduta-comercial",
    title: "LGPD, conduta e segurança no comercial",
    objective:
      "Fixar regras para uso de dados, canais oficiais, equipamentos da empresa e pagamentos autorizados.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "Dados pessoais no comercial",
        body: [
          "Nome, CPF, telefone, email, endereço, contrato, parcela, documentos e histórico de atendimento são dados pessoais ou informações relacionadas ao cliente.",
          "O consultor acessa dados apenas para a finalidade autorizada pela empresa.",
          "Dados não devem circular por celular pessoal, email pessoal, pasta pessoal ou conversa sem controle.",
        ],
      },
      {
        title: "Condutas proibidas",
        body: [
          "E proibido receber pagamento em conta pessoal, cobrar serviço não autorizado, usar dados de cartao do cliente ou manter atendimento por número pessoal.",
          "Tambem e proibido apagar conversas corporativas, exportar base de leads ou reter chip/equipamento da empresa.",
          "Essas condutas podem gerar responsabilizacao trabalhista, civil, criminal e disciplinar.",
        ],
      },
      {
        title: "Rotina segura",
        body: [
          "Use login individual, senha segura, canais oficiais e computador bloqueado ao se afastar.",
          "Se um cliente enviar documento por canal inadequado, oriente o canal correto e registre o contexto quando necessário.",
          "Segurança e parte da venda: cliente premium precisa confiar no processo.",
        ],
      },
    ],
    checkpoint: question(
      "lgpd-comercial-check",
      "Qual conduta está alinhada a segurança?",
      "Usar canais oficiais, login individual e registrar informações no CRM.",
      ["Receber Pix pessoal.", "Salvar contrato no celular pessoal."],
      "Segurança protege cliente, funcionario e empresa.",
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
        "Oriente o canal correto e registre a ocorrencia quando necessário.",
        ["Continue por ali para ser mais rapido.", "Apague e finja que não recebeu."],
        "A resposta correta reduz risco e organiza o atendimento.",
      ),
    ],
  },
];

const crmChapters: AcademyChapter[] = [
  {
    id: "mapa-crm-areas",
    title: "Mapa do CRM: áreas, menus e responsabilidades",
    objective:
      "Entender onde cada área trabalha, quais menus usar e como o CRM organiza a operação multiempresa.",
    estimatedMinutes: 45,
    sections: [
      {
        title: "Tela inicial e áreas",
        body: [
          "Usuários com acesso superior podem escolher entre Gestão, Comercial, Jurídico e Financeiro conforme permissão da empresa.",
          "O menu lateral muda de acordo com a área atual. Isso evita confusão entre rotinas de comercial, jurídico e gestão.",
          "Cada empresa possui dados, clientes, templates, usuários e configurações isolados por empresa.",
        ],
      },
      {
        title: "Quando usar cada área",
        body: [
          "Comercial concentra clientes, pré-vendas, simulações, painel comercial, documentos e Academy.",
          "Jurídico concentra clientes, documentos, esteira, emails, anexos e acompanhamento de processos.",
          "Gestão concentra usuários, empresas, templates, backups, configurações, relatórios e acompanhamento do Academy.",
        ],
      },
      {
        title: "Regra de ouro do CRM",
        body: [
          "O CRM deve responder tres perguntas: quem é o cliente, em que etapa ele está e qual é o próximo passo.",
          "Se uma informação importante só existe no WhatsApp, ela ainda não existe para a operação.",
          "Registrar bem e parte da entrega, não uma burocracia separada.",
        ],
      },
    ],
    checkpoint: question(
      "mapa-crm-check",
      "Qual é a regra de ouro do CRM?",
      "Mostrar quem é o cliente, em que etapa está e qual o próximo passo.",
      ["Guardar apenas vendas fechadas.", "Substituir toda conversa com o cliente."],
      "O CRM e a memoria operacional da empresa.",
    ),
    exam: [
      question(
        "mapa-crm-exam-1",
        "O menu lateral deve refletir:",
        "A área atual do usuário.",
        ["Apenas o cargo do usuário.", "Sempre todos os menus do sistema."],
        "Menus por área reduzem ruido e melhoram usabilidade.",
      ),
      question(
        "mapa-crm-exam-2",
        "Informação relevante combinada por WhatsApp deve:",
        "Ser registrada no CRM.",
        ["Ficar apenas na conversa.", "Ser lembrada de memoria."],
        "Registro garante continuidade e auditoria.",
      ),
    ],
  },
  {
    id: "clientes-crm",
    title: "Clientes: cadastro, edição e documentos",
    objective:
      "Usar corretamente a tela de clientes, campos obrigatórios/opcionais, botoes de cópia e documentos anexados.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "Cadastro de cliente",
        body: [
          "Cadastre dados reais e conferidos: nome, CPF quando existir, telefone, email, endereço, estado civil, profissao e responsáveis.",
          "Quando o gestor cria cliente para outro consultor, deve selecionar o consultor comercial responsável.",
          "Campos jurídicos aparecem para informações usadas em documentos do jurídico, como banco, CNPJ e sede quando aplicável.",
        ],
      },
      {
        title: "Documentos do cliente",
        body: [
          "A tela do cliente mostra arquivos enviados, documentos gerados, pré-vendas e simulações vinculadas.",
          "Upload em massa aceita varios arquivos, mas cada documento deve ser classificado pelo tipo correto.",
          "Nomes claros ajudam na busca: RG, contrato, comprovante, notificacao, laudo e recibo devem ficar identificaveis.",
        ],
      },
      {
        title: "Atalhos e segurança",
        body: [
          "Botoes de copiar reduzem erro ao transferir CPF, telefone, endereço e demais dados para documentos ou mensagens.",
          "Use WhatsApp e email oficiais sempre que possível. Evite copiar dado sensível para ambientes sem controle.",
          "Ao editar dados, registre no histórico o que foi alterado e por que.",
        ],
      },
    ],
    checkpoint: question(
      "clientes-crm-check",
      "Ao editar dado relevante do cliente, o usuário deve:",
      "Salvar e registrar no histórico o motivo da alteração.",
      ["Alterar sem anotacao.", "Criar outro cliente duplicado."],
      "Histórico permite auditoria e continuidade.",
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
        "Consultor comercial responsável serve para:",
        "Designar quem acompanha aquele cliente no comercial.",
        ["Excluir responsáveis jurídicos.", "Substituir o CPF."],
        "Responsabilidade clara melhora indicadores e atendimento.",
      ),
    ],
  },
  {
    id: "pre-vendas-crm",
    title: "Pré-vendas: pipeline, status e pagamentos",
    objective:
      "Criar e atualizar pré-vendas com produto, status, pagamento previsto, meta e documentos corretos.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "Pipeline comercial",
        body: [
          "Pré-venda representa uma oportunidade ou contrato em andamento. Um cliente pode ter mais de uma pré-venda.",
          "O pipeline mostra status como lead, pré-venda, em contato, em negociacao, aprovado e perdido.",
          "Ao arrastar ou alterar status, registre contexto quando a mudança for relevante.",
        ],
      },
      {
        title: "Pagamentos previstos",
        body: [
          "Forma de pagamento deve ser Pix, boleto ou cartao. Se status for previsto, a data precisa ser futura.",
          "Em Pix e boleto, a meta deve puxar o mesmo valor do pagamento. Em cartao, o usuário pode informar meta líquida por causa de taxas.",
          "Pagamentos pagos entram no painel comercial do mês do pagamento, mesmo que a pré-venda tenha sido criada em mês anterior.",
        ],
      },
      {
        title: "Contrato, recibo e descrição",
        body: [
          "A descrição de contrato alimenta documentos e precisa explicar a forma acordada de pagamento.",
          "Número do processo e número do financiamento podem ser preenchidos quando fizerem sentido.",
          "Pré-venda aprovada deve ficar pronta para gerar documentos e seguir para o jurídico quando aplicável.",
        ],
      },
    ],
    checkpoint: question(
      "pre-vendas-crm-check",
      "Quando Pix ou boleto são selecionados, o campo meta deve:",
      "Usar o mesmo valor do pagamento.",
      ["Ficar sempre vazio.", "Receber CPF do cliente."],
      "A meta alimenta painel comercial e comissão.",
    ),
    exam: [
      question(
        "pre-vendas-crm-exam-1",
        "Pagamento previsto deve ter:",
        "Data futura e forma definida.",
        ["Data vencida sem motivo.", "Forma em branco."],
        "Previsão correta melhora cobrança e alerta.",
      ),
      question(
        "pre-vendas-crm-exam-2",
        "Uma venda paga neste mês conta no painel:",
        "No mês do pagamento.",
        ["Somente no mês da criação da pré-venda.", "Apenas quando gerar contrato."],
        "O painel considera pagamentos pagos no período.",
      ),
    ],
  },
  {
    id: "simulacoes-crm",
    title: "Simulações no CRM",
    objective:
      "Criar simulações de veículo, imóvel e empréstimo, gerar PDF e evitar erros de preenchimento.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "Produtos da simulação",
        body: [
          "Veículo pode usar campos de bem, marca/modelo e entrada quando aplicável.",
          "Imóvel e empréstimo ocultam campos que não fazem sentido, como informações de veículo e entrada.",
          "A redução de parcela vem sugerida por padrão, mas pode ser ajustada pelo consultor antes de gerar a simulação.",
        ],
      },
      {
        title: "Campos calculados",
        body: [
          "Valor financiado, parcelas restantes e outros campos automaticos aparecem com visual diferente para evitar confusão com input manual.",
          "Se faltar dado, o PDF deve omitir blocos não preenchidos em vez de poluir o documento com informações vazias.",
          "A situação da simulação vai como aprovada por padrão, especialista vem do usuário logado e data vem do dia atual.",
        ],
      },
      {
        title: "PDF da simulação",
        body: [
          "O PDF deve usar logo, endereço, CNPJ, telefone e site da empresa selecionada.",
          "Cada simulação gera protocolo e arquivo padronizado.",
          "Antes de enviar ao cliente, confira se valores, produto, indicadores e rodape estao coerentes.",
        ],
      },
    ],
    checkpoint: question(
      "simulacoes-crm-check",
      "O que deve acontecer com campos não preenchidos no PDF?",
      "Devem ser omitidos quando não fizerem sentido.",
      ["Devem aparecer como texto vazio.", "Devem ser preenchidos com dados inventados."],
      "PDF limpo aumenta profissionalismo e evita duvida.",
    ),
    exam: [
      question(
        "simulacoes-crm-exam-1",
        "A redução da parcela no cadastro serve para:",
        "Ajustar a estimativa antes de gerar o PDF.",
        ["Aparecer sempre no PDF.", "Bloquear qualquer simulação."],
        "O campo da porcentagem e ferramenta interna de cálculo.",
      ),
      question(
        "simulacoes-crm-exam-2",
        "Campos automaticos devem parecer:",
        "Calculados e não editaveis.",
        ["Inputs comuns.", "Botoes de ação."],
        "Visual correto reduz erro de uso.",
      ),
    ],
  },
  {
    id: "documentos-templates-crm",
    title: "Documentos, templates e variáveis",
    objective:
      "Entender como gerar documentos, usar templates oficiais e manter tags coerentes por empresa e área.",
    estimatedMinutes: 55,
    sections: [
      {
        title: "Templates por empresa",
        body: [
          "Cada empresa deve usar seus próprios templates, logo, dados, cláusulas e documentos.",
          "Templates do jurídico podem ficar vinculados a etapas da esteira. Templates comerciais geram contrato, recibo e pré-venda.",
          "Quando uma empresa tiver cláusula diferente na simulação, deve existir configuração ou template específico para ela.",
        ],
      },
      {
        title: "Tags e dados",
        body: [
          "Tags puxam dados do cliente, pré-venda, empresa, financeiro e responsáveis.",
          "Se uma informação usada no documento não existir no cadastro, crie campo apropriado ou marque como jurídico/obrigatório conforme uso.",
          "Documento gerado com tag vazia transmite falta de cuidado.",
        ],
      },
      {
        title: "Geração e visualização",
        body: [
          "Ao gerar documento, o CRM deve salvar registro, arquivo, status e relação com cliente/pre-venda.",
          "Visualizar documento não deve abrir abas duplicadas ou telas vazias.",
          "Se houver erro de permissão, verifique empresa, área do template e política de acesso.",
        ],
      },
    ],
    checkpoint: question(
      "documentos-crm-check",
      "Por que templates devem ser separados por empresa?",
      "Porque dados, cláusulas, logo e documentos podem mudar por empresa.",
      ["Porque o CRM não aceita tags.", "Porque todos usam o mesmo CNPJ."],
      "Multiempresa exige isolamento tambem nos documentos.",
    ),
    exam: [
      question(
        "documentos-crm-exam-1",
        "Uma tag sem dado correspondente gera risco de:",
        "Documento incompleto ou pouco profissional.",
        ["PDF mais bonito.", "Backup automático."],
        "Tags precisam refletir dados reais.",
      ),
      question(
        "documentos-crm-exam-2",
        "Templates jurídicos podem ser vinculados a:",
        "Etapas da esteira jurídica.",
        ["Apenas ao painel comercial.", "Somente ao backup."],
        "Vínculo por etapa facilita geração do documento correto.",
      ),
    ],
  },
  {
    id: "juridico-acompanhamento-crm",
    title: "Jurídico, esteira e acompanhamento do cliente",
    objective:
      "Usar esteira jurídica, documentos, emails, movimentações e portal de acompanhamento com segurança.",
    estimatedMinutes: 65,
    sections: [
      {
        title: "Esteira jurídica",
        body: [
          "A esteira mostra em que fase cada cliente está, há quanto tempo e quais documentos da etapa existem.",
          "Usuários autorizados podem editar colunas, título, descrição, ordem e mover clientes em massa, respeitando regras de segurança.",
          "Coluna só deve ser removida quando não houver cliente nela. Templates vinculados ficam no sistema, mas sem vínculo com etapa removida.",
        ],
      },
      {
        title: "Movimentações e anotações",
        body: [
          "Ao mover cliente de etapa, registre uma anotacao clara sobre o motivo.",
          "Movimentação pública deve ser objetiva e segura, sem dados sensíveis, valores ou estratégia interna.",
          "Logs internos registram criação, edição e remoção de movimentações do acompanhamento.",
        ],
      },
      {
        title: "Email e documentos",
        body: [
          "Administradores jurídicos podem enviar emails com templates ou texto livre, anexando documentos do cliente.",
          "Emails enviados devem deixar rastro no histórico do cliente.",
          "Arquivos importados ou gerados devem ficar vinculados ao cliente correto e no bucket privado.",
        ],
      },
    ],
    checkpoint: question(
      "juridico-acompanhamento-check",
      "Qual atualizacao deve aparecer para o cliente no portal?",
      "Uma informação objetiva, segura e liberada pela equipe.",
      ["Estratégia interna completa.", "Dados sensíveis do processo."],
      "O portal reduz ansiedade sem expor informação indevida.",
    ),
    exam: [
      question(
        "juridico-acompanhamento-exam-1",
        "Mover cliente na esteira exige:",
        "Status correto e anotacao clara.",
        ["Apagar histórico.", "Mover sem motivo registrado."],
        "A esteira precisa ser rastreavel.",
      ),
      question(
        "juridico-acompanhamento-exam-2",
        "Email enviado pelo jurídico deve:",
        "Ficar registrado no histórico do cliente.",
        ["Ser enviado por conta pessoal.", "Não deixar rastro."],
        "Registro protege a empresa e facilita acompanhamento.",
      ),
    ],
  },
  {
    id: "paineis-backup-seguranca-crm",
    title: "Painéis, backup e segurança operacional",
    objective:
      "Conhecer painéis, financeiro, backups, restauração e boas práticas de uso seguro do CRM.",
    estimatedMinutes: 60,
    sections: [
      {
        title: "Painéis e consultas",
        body: [
          "Painel comercial mostra vendas do mês, meta, pagamentos pendentes, comissão estimada, origem do lead e segmentações.",
          "Gestão vê indicadores da equipe e pode filtrar por consultor. Consultor comum vê apenas seus próprios dados.",
          "Financeiro separa lançamentos de consultas, usa meta líquida para vendas e mantém logs de alterações.",
        ],
      },
      {
        title: "Backups e restauração",
        body: [
          "Backups padronizados incluem dados, documentos, históricos, acompanhamentos, logs, templates e arquivos vinculados.",
          "Backup automático fica fora da produção via GitHub Actions. Backup manual pode ser gerado para situações especiais.",
          "Restauração pode ser por cliente ou completa, usando formato padronizado para reduzir risco.",
        ],
      },
      {
        title: "Segurança multiempresa",
        body: [
          "Cada empresa deve ver apenas seus dados. Clientes, templates, documentos, backups e configuracoes precisam respeitar company_id.",
          "Usuários master e plataforma podem ter acesso superior, mas ações sensíveis devem ser registradas.",
          "Se aparecer dado de outra empresa, pare o uso e comunique imediatamente.",
        ],
      },
    ],
    checkpoint: question(
      "paineis-backup-check",
      "Qual é o objetivo do backup padronizado?",
      "Permitir restauração confiável de dados e arquivos importantes.",
      ["Substituir o uso do CRM.", "Guardar apenas prints."],
      "Backup bom precisa ser restaurável, não apenas baixável.",
    ),
    exam: [
      question(
        "paineis-backup-exam-1",
        "Consultor comercial comum deve ver no painel:",
        "Apenas seus próprios resultados.",
        ["Vendas de todos sem permissão.", "Backups de todas as empresas."],
        "Permissão por usuário protege dados e evita conflito.",
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
      "Curso para formar consultores comerciais capazes de qualificar oportunidades, explicar revisional com responsabilidade, apresentar simulações, lidar com objeções, fechar contratos e proteger dados do cliente.",
    passingScore: 85,
    audience:
      "Consultores comerciais, supervisores comerciais e gestores que acompanham vendas.",
    chapters: commercialChapters,
  }),
  createCourse({
    slug: "operacao-crm-grs",
    title: "Operação do CRM GRS",
    subtitle: "Uso profissional da plataforma",
    description:
      "Curso prático para ensinar usuários a operar o CRM com qualidade: clientes, pré-vendas, simulações, documentos, jurídico, painéis, backups, multiempresa e segurança operacional.",
    passingScore: 85,
    audience:
      "Usuários comerciais, jurídicos, financeiros, gestores e administradores em onboarding.",
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
