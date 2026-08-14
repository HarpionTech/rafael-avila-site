/* Conteúdo, links e assets editáveis da página. */
window.CONFIG = {
  marca: {
    nome: 'Rafael Ávila',
    // Assina o rodape e a linha de papel do bloco Sobre. Um lugar so: eram
    // dois campos com a mesma frase, e divergiriam na primeira revisao.
    titulo: 'Terapeuta, mentor, palestrante e autor do livro Bem-vindo ao Mundo Real',
    instagram: 'https://www.instagram.com/rafa.aviila/',
    arroba: '@rafa.aviila'
  },

  whatsapp: {
    numero: '5548991947402',
    mensagem: 'Olá vim pela pagina e gostaria de marcar uma consulta'
  },

  sobre: {
    eyebrow: 'Sobre Rafael',
    titulo: 'Um processo terapêutico breve, prático e objetivo.',
    bio: 'Rafael conduz um processo terapêutico individualizado, com uma abordagem prática, objetiva e voltada para a realidade de cada pessoa. O trabalho busca compreender o contexto, identificar padrões de pensamento, emoções e comportamentos e, a partir disso, desenvolver novas formas de lidar com os desafios da vida.',
    complemento: 'Criador de métodos e ferramentas voltados ao desenvolvimento pessoal e às relações humanas, Rafael transforma conhecimentos em reflexões práticas, favorecendo mais clareza, consciência e autonomia para que cada pessoa possa fazer escolhas mais alinhadas com a vida que deseja construir.',
    imagem: 'assets/perfil.png',
    imagemAlt: 'Retrato de Rafael Ávila',
    destaques: [
      { valor: '7', label: 'formações ligadas a comportamento e gestão' },
      { valor: '16,2 mil', label: 'pessoas acompanham seu conteúdo' },
      { valor: 'Autor', label: 'publicado pela Âncora Editora' }
    ]
  },

  metodo: {
    eyebrow: 'Terapia online',
    titulo: 'Todas as áreas da sua vida trabalhadas em um único processo.',
    intro: 'A terapia tem como objetivo ajudar você a construir uma vida mais equilibrada e satisfatória. Muitas vezes o sofrimento emocional não nasce de um problema específico, mas do desequilíbrio entre as cinco áreas que influenciam diretamente o seu bem-estar — e por isso trabalhamos todas elas juntas.',
    areas: [
      { nome: 'Vida familiar', desc: 'Relações, apoio e convivência.' },
      { nome: 'Vida amorosa', desc: 'Relacionamentos afetivos e conexão emocional.' },
      { nome: 'Vida profissional', desc: 'Trabalho, carreira e realização pessoal.' },
      { nome: 'Vida social', desc: 'Amizades, lazer e rede de apoio.' },
      { nome: 'Vida pessoal', desc: 'Autoconhecimento, autoestima e autocuidado.' }
    ],
    fecho: 'Durante as sessões buscamos compreender os padrões de pensamento, emoção e comportamento que podem estar por trás de ansiedade, insegurança, baixa autoestima, conflitos nos relacionamentos, desmotivação ou sensação de estagnação.',
    abordagem: 'A partir de abordagens comportamentais, o objetivo é desenvolver mais autoconhecimento, autoconfiança, inteligência emocional e habilidades práticas para lidar com os desafios da vida de forma mais saudável.',
    alem: 'A terapia não serve apenas para resolver problemas. Ela também fortalece aquilo que já funciona, promove crescimento pessoal e ajuda você a construir uma vida mais alinhada com seus valores, objetivos e propósito.',
    convite: 'Deseja iniciar esse processo e dar o primeiro passo em direção a uma vida mais equilibrada?',
    imagem: 'assets/terapia-online.jpg',
    imagemAlt: 'Rafael Ávila apresentando seu atendimento online',
    passos: [
      { n: '01', nome: 'Primeiro contato', desc: 'Você chama no WhatsApp e conta, em poucas linhas, o que está vivendo e o que deseja mudar.' },
      { n: '02', nome: 'Leitura do contexto', desc: 'A conversa inicial identifica prioridades, padrões recorrentes e o formato mais adequado para o acompanhamento.' },
      { n: '03', nome: 'Sessões individuais', desc: 'Os encontros são online, conduzidos com escuta ativa e intervenções orientadas para a sua realidade.' },
      { n: '04', nome: 'Aplicação no cotidiano', desc: 'O que foi compreendido se transforma em observação, tarefa e prática entre as sessões.' }
    ]
  },

  publicacoes: {
    eyebrow: 'Publicações',
    titulo: 'Livros publicados por Rafael Ávila.',
    intro: 'Arraste o livro para girá-lo',
    sck: 'lp|ebooks',
    /* Vantagem do formato digital, compartilhada pelos quatro e-books.
       Fica no nivel da secao porque e a mesma frase para todos: repetida
       item a item, divergiria na primeira revisao. */
    seloDigital: { icone: 'raio', titulo: 'Acesso imediato', desc: 'Link na hora da compra' },
    itens: [
      {
        id: 'mundo-real',
        numero: '01',
        titulo: 'Bem-vindo ao Mundo Real',
        descricao: 'Um convite para abandonar as ilusões, aceitar a realidade como ela é e assumir o controle daquilo que realmente depende de você. Viver no mundo real não significa desistir dos seus sonhos — significa aprender a construí-los com equilíbrio, maturidade e coragem.',
        detalhes: ['A Gangorra do Extremismo', 'As três fases da mudança: aceitação, adaptação e reestruturação', 'As cinco esferas da vida, do familiar ao pessoal'],
        preco: 'R$ 39,90',
        capa: 'assets/livros/3d-mundo-real.webp',
        textura: 'assets/frente do livro fisico.jpeg',
        contracapa: 'assets/capa do livro fisico.jpeg',
        // Lombada escrita, não fotografada: a arte impressa é texto sobre preto,
        // e desenhar sai nítido em qualquer tamanho. `selo` é o nome da editora
        // em texto — quando o logotipo da Âncora existir em arquivo, entra aqui.
        lombadaTexto: {
          fundo: '#0a0a0b',
          corAutor: '#c9a05c',      // dourado, como no impresso
          corTitulo: '#f4f1ea',
          autor: 'RAFAEL ÁVILA',
          titulo: 'BEM-VINDO AO MUNDO REAL',
          // Logotipo real da editora, recortado no próprio contorno.
          seloImagem: 'assets/icones/ancora-editora.webp'
        },
        razao: 1.40,
        espessura: 0.16,
        capaAlt: 'Capa do livro Bem-vindo ao Mundo Real',
        contracapaAlt: 'Contracapa do livro Bem-vindo ao Mundo Real',
        link: 'https://hotmart.com/pt-br/marketplace/produtos/bem-vindo-ao-mundo-real/W107095695P',
        // Único título com etiqueta: é o lançamento, e o único que existe em papel.
        etiqueta: 'Lançamento',
        /* Duas versões do mesmo livro. Com `formatos`, o card troca o botão único
           por um par — e um formato sem link sai desabilitado em vez de sumir,
           para a existência da versão já ser anunciada antes de estar à venda. */
        formatos: [
          // URLs CRUAS: o `sck` de origem é colado por hotmartLink(). O link do
          // digital chega do contato.md já com `?sck=lp|ebooks`; guardá-lo assim
          // duplicaria o parâmetro na saída.
          { rotulo: 'Físico', link: 'https://hotmart.com/pt-br/marketplace/produtos/bem-vindo-ao-mundo-real/W107095695P',
            /* Sem prazo em dias: o envio é da editora pela Hotmart, e um número
               aqui vira promessa que a página não controla. Quando o Rafael
               confirmar o prazo real, entra no lugar de `titulo`. */
            selo: { icone: 'caminhao', titulo: 'Enviado para todo o Brasil', desc: 'Livro impresso · Âncora Editora' } },
          { rotulo: 'Digital', link: 'https://hotmart.com/pt-br/marketplace/produtos/hagsxd-bem-vindo-ao-mundo-real-m2oxk/G107096153I',
            selo: { icone: 'raio', titulo: 'Acesso imediato', desc: 'Link na hora da compra' } }
        ],
        disponivel: true
      },
      {
        id: 'mentalidade',
        numero: '02',
        titulo: 'Mentalidade Blindada',
        descricao: 'Por que algumas pessoas mantêm o foco e seguem avançando diante das dificuldades, enquanto outras desistem nos primeiros obstáculos? A resposta não está na sorte, no talento ou na inteligência — está na forma como pensam e respondem aos desafios. Aqui Rafael apresenta o Método 3A da Autoperformance.',
        detalhes: ['Autorresponsabilidade: assumir o controle das escolhas', 'Automotivação: direcionar os motivos por trás do comportamento', 'Autoconfiança: construída em ação e aprendizado, não em frases positivas', 'Exercícios para aplicar o Método 3A imediatamente'],
        preco: 'R$ 19,90',
        capa: 'assets/livros/mock-mentalidade.webp',
        // Arte plana extraída do mockup por build/rectify_mockup.py. É a única
        // das três cujo mockup mostra a lombada escrita.
        textura: 'assets/livros/plana-mentalidade.webp',
        lombada: 'assets/livros/lombada-mentalidade.webp',
        razao: 1.46,
        espessura: 0.16,
        capaAlt: 'Capa do e-book Mentalidade Blindada',
        link: 'https://hotmart.com/pt-br/marketplace/produtos/hagsxd-mentalidade-blindada-ypw0d/U107028328D',
        disponivel: true
      },
      {
        id: 'relacionamentos',
        numero: '03',
        titulo: 'O Segredo dos Relacionamentos Saudáveis',
        descricao: 'Por que alguns relacionamentos duram a vida toda e outros acabam mesmo quando ainda existe amor? O Tripé dos Relacionamentos Saudáveis é a metodologia que Rafael desenvolveu para mostrar os pilares que sustentam um vínculo duradouro.',
        detalhes: ['Respeito, comunicação e transparência: os três pilares', 'Como identificar os sinais de que a relação enfraqueceu', 'Limites saudáveis e comunicação mais madura', 'Exemplos práticos e exercícios de reflexão'],
        preco: 'R$ 19,90',
        capa: 'assets/livros/mock-relacionamentos.webp',
        textura: 'assets/livros/plana-relacionamentos.webp',
        // O mockup deste esconde a lombada: ela é escrita em canvas, com as cores
        // amostradas da própria capa.
        lombadaTexto: {
          // A capa tem tarja verde no pé: puxando a borda dela, o verde dobra a
          // quina e continua na lombada, em vez de morrer na aresta.
          fundoCapa: 'assets/livros/plana-relacionamentos.webp',
          fundo: '#f2f0e8',
          corAutor: '#8a7a52',
          corTitulo: '#1d3226',
          autor: 'RAFAEL ÁVILA',
          titulo: 'O SEGREDO DOS RELACIONAMENTOS SAUDÁVEIS'
        },
        razao: 1.65,
        espessura: 0.16,
        capaAlt: 'Capa do e-book O Segredo dos Relacionamentos Saudáveis',
        link: 'https://hotmart.com/pt-br/marketplace/produtos/por-que-os-relacionamentos-acabam/B106799231R',
        disponivel: true
      },
      {
        id: 'autoterapia',
        numero: '04',
        titulo: 'Autoterapia',
        descricao: 'Uma abordagem para analisar sua vida pessoal, familiar, amorosa, profissional e social a partir da Teoria da Vida Plena.',
        detalhes: ['Baseado na Teoria da Vida Plena', 'Cinco áreas da vida', 'Autoanálise guiada'],
        preco: 'R$ 19,90',
        capa: 'assets/livros/mock-autoterapia.webp',
        textura: 'assets/livros/plana-autoterapia.webp',
        lombadaTexto: {
          fundoCapa: 'assets/livros/plana-autoterapia.webp',
          fundo: '#e9dbcd',
          corAutor: '#9a7b46',
          corTitulo: '#1e2a3a',
          autor: 'RAFAEL ÁVILA',
          titulo: 'AUTOTERAPIA'
        },
        razao: 1.52,
        espessura: 0.16,
        // Pose negativa: o mockup deste é espelhado — mostra o corte das folhas,
        // não a lombada. Repetir a pose dos outros deixaria de ser o mockup dele.
        pose: -0.454,
        capaAlt: 'Capa do e-book Autoterapia',
        link: 'https://hotmart.com/pt-br/marketplace/produtos/autoterapia-baseado-na-teoria-da-vida-plena/M107082316G',
        disponivel: true
      },
      {
        id: 'autoconfianca',
        numero: '05',
        titulo: 'Autoconfiança: Pare de se Diminuir',
        descricao: 'Você sente que poderia se posicionar melhor, mas se cala, busca aprovação ou evita conflitos por medo do julgamento? Rafael apresenta aqui a Imponência Pessoal: a ideia de que autoconfiança não é só um traço com que se nasce — ela se desenvolve por comportamento, experiência e treino.',
        detalhes: ['Imponência posicional × imponência pessoal', 'Postura, comunicação e contato visual', 'Dizer não sem culpa e lidar com críticas', 'Exercícios e desafios práticos'],
        preco: 'R$ 19,90',
        capa: 'assets/livros/plana-autoconfianca.webp',
        textura: 'assets/livros/plana-autoconfianca.webp',
        // Capa preta com dourado: a lombada segue a mesma paleta.
        lombadaTexto: {
          fundoCapa: 'assets/livros/plana-autoconfianca.webp',
          fundo: '#111010',
          corAutor: '#c9a05c',
          corTitulo: '#f4f1ea',
          autor: 'RAFAEL ÁVILA',
          titulo: 'AUTOCONFIANÇA — PARE DE SE DIMINUIR'
        },
        // Razão medida na retificação do mockup, corrigida pelo escorço: a
        // largura projetada é menor que a real pelo cosseno do ângulo.
        razao: 1.65,
        espessura: 0.16,
        capaAlt: 'Capa do e-book Autoconfiança: Pare de se Diminuir',
        link: 'https://hotmart.com/pt-br/marketplace/produtos/autoconfianca-pare-de-se-diminuir/I107140439F',
        disponivel: true
      }
    ]
  },

  depoimentos: {
    eyebrow: 'Feedbacks reais',
    titulo: 'Experiências contadas por quem viveu o processo.',
    intro: 'Os cards abaixo usam os relatos originais compartilhados por pessoas que passaram pelo acompanhamento.',
    itens: [
      { nome: 'Daiane Lacerda', imagem: 'assets/depoimento (1).png', alt: 'Depoimento original de Daiane Lacerda' },
      { nome: 'Felipe Brito', imagem: 'assets/depoimento (2).png', alt: 'Depoimento original de Felipe Brito' },
      { nome: 'Renata Frota', imagem: 'assets/depoimento (3).png', alt: 'Depoimento original de Renata Frota' },
      { nome: 'Victor Lima', imagem: 'assets/depoimento (4).png', alt: 'Depoimento original de Victor Lima' },
      { nome: 'Greicy Batista', imagem: 'assets/depoimento (5).png', alt: 'Depoimento original de Greicy Batista' }
    ]
  },

  contato: {
    eyebrow: 'Contato',
    titulo: 'Dois canais. Uma conversa direta.',
    texto: 'Para marcar uma consulta, use o WhatsApp. Para acompanhar conteúdos e publicações, encontre Rafael no Instagram.',
    canais: [
      { tipo: 'whatsapp', label: 'WhatsApp', valor: 'Marcar uma consulta' },
      { tipo: 'instagram', label: 'Instagram', valor: '@rafa.aviila' }
    ]
  },

  rodape: {
    copyright: `© ${new Date().getFullYear()} Rafael Ávila. Todos os direitos reservados.`
  }
};
