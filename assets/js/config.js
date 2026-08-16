/* Configuração comportamental da página. A copy canônica vive em index.html. */
window.CONFIG = {
  whatsapp: {
    numero: '5548991947402',
    mensagem: 'Olá vim pela pagina e gostaria de marcar uma consulta'
  },

  /* Dados exclusivos dos aprimoramentos 3D. Títulos, descrições, capas
     alternativas, preços e links de compra permanecem no HTML canônico. */
  publicacoes: {
    itens: [
      {
        id: 'mundo-real',
        textura: 'assets/frente do livro fisico.jpeg',
        contracapa: 'assets/capa do livro fisico.jpeg',
        lombadaTexto: {
          fundo: '#0a0a0b',
          corAutor: '#c9a05c',
          corTitulo: '#f4f1ea',
          autor: 'RAFAEL ÁVILA',
          titulo: 'BEM-VINDO AO MUNDO REAL',
          seloImagem: 'assets/icones/ancora-editora.webp'
        },
        razao: 1.40,
        espessura: 0.16
      },
      {
        id: 'mentalidade',
        textura: 'assets/livros/plana-mentalidade.webp',
        lombada: 'assets/livros/lombada-mentalidade.webp',
        razao: 1.46,
        espessura: 0.16
      },
      {
        id: 'relacionamentos',
        textura: 'assets/livros/plana-relacionamentos.webp',
        lombadaTexto: {
          fundoCapa: 'assets/livros/plana-relacionamentos.webp',
          fundo: '#f2f0e8',
          corAutor: '#8a7a52',
          corTitulo: '#1d3226',
          autor: 'RAFAEL ÁVILA',
          titulo: 'O SEGREDO DOS RELACIONAMENTOS SAUDÁVEIS'
        },
        razao: 1.65,
        espessura: 0.16
      },
      {
        id: 'autoterapia',
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
        pose: -0.454
      },
      {
        id: 'autoconfianca',
        textura: 'assets/livros/plana-autoconfianca.webp',
        lombadaTexto: {
          fundoCapa: 'assets/livros/plana-autoconfianca.webp',
          fundo: '#111010',
          corAutor: '#c9a05c',
          corTitulo: '#f4f1ea',
          autor: 'RAFAEL ÁVILA',
          titulo: 'AUTOCONFIANÇA — PARE DE SE DIMINUIR'
        },
        razao: 1.65,
        espessura: 0.16
      }
    ]
  },

  /* Os dois IDs de medição. VAZIO É O ESTADO CORRETO enquanto não chegarem: o
     adaptador não carrega nada, não cria cookie e não há o que revogar. Ligar a
     medição é preencher estas duas linhas — não há segundo lugar para mexer.

     Formato conferido antes de carregar: `G-` seguido do código, e o Pixel só
     dígitos. ID errado não falha visivelmente — ele carrega, mede para lugar
     nenhum e só aparece semanas depois, quando o cliente pergunta por que o
     relatório está vazio. */
  medicao: {
    ga4Id: '',
    /* Conjunto de dados "Rafael Terapeuta". A conta do cliente tem mais de um —
       o outro (1536141878007001) está zerado. Trocar aqui por engano não quebra
       nada de forma visível: mede para o conjunto errado e só aparece semanas
       depois. Se algum dia precisar conferir, é o número que a Meta mostra
       depois de "Identificação", nunca o nome em azul acima dele. */
    metaPixelId: '2509060272852471'
  },

  consentimento: {
    versao: 1,
    titulo: 'Cookies e privacidade',
    /* Diz a FINALIDADE, que é o que a LGPD pede, sem virar jargão. A segunda
       frase não é enfeite: aqui nada de rastreamento carrega antes do aceite, ao
       contrário do padrão do mercado, e afirmar isso é o que justifica o aviso
       existir em vez de ser um "ok" decorativo. */
    texto: 'Usamos cookies para entender como o site é usado e medir o desempenho dos nossos anúncios. Nenhum rastreamento é carregado antes da sua escolha.',
    aceitar: 'Aceitar todos',
    recusar: 'Recusar',
    personalizar: 'Personalizar configurações',
    tituloPainel: 'Preferências de cookies',
    introPainel: 'Você escolhe o que fica ligado. Nada além do essencial é carregado sem a sua permissão, e dá para mudar de ideia quando quiser.',
    salvar: 'Salvar preferências',
    /* SÓ as categorias que existem de verdade aqui. Site grande costuma listar
       quatro ou cinco porque roda dezenas de rastreadores; listar categoria vazia
       para parecer completo é o que transforma o aviso em teatro. Quando entrar
       uma ferramenta nova, ela entra na categoria dela — ou ganha uma linha. */
    categorias: [
      { id: 'essenciais', nome: 'Essenciais', fixo: true,
        desc: 'Guardam apenas a sua escolha sobre cookies. Sem eles, este aviso reapareceria a cada visita.' },
      { id: 'estatisticas', nome: 'Estatísticas',
        desc: 'Medem de forma agregada como as páginas são usadas, para saber o que melhorar.' },
      { id: 'marketing', nome: 'Marketing',
        desc: 'Medem o resultado dos anúncios e evitam mostrar o mesmo anúncio repetidas vezes.' }
    ],
    // Vazio esconderia o link. O Meta exige a política publicada para aprovar
    // anúncios, então isto precisa existir antes da primeira campanha.
    politica: 'politica.html'
  }
};

