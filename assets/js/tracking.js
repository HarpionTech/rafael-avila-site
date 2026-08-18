/* Medição: GA4 e Meta Pixel, subordinados ao consentimento.
   ==========================================================================
   A regra que organiza este arquivo inteiro: NADA de terceiro entra na página
   antes da decisão. Não é o script que decide se mede — ele pede permissão ao
   módulo de consentimento e espera. Enquanto a permissão não vem, o visitante
   não tem cookie de medição, não tem requisição para o Google nem para a Meta,
   e não há o que revogar.

   O caminho comum na internet é o oposto: o snippet fica colado no <head>, já
   carregou e já mediu quando o aviso aparece, e o aviso vira enfeite. Por isso
   o banner desta página pode afirmar, sem asterisco, que nada carrega antes.

   Ligar a medição é preencher `medicao.ga4Id` e `medicao.metaPixelId` no
   config.js. Nenhuma outra linha precisa mudar. */
(() => {
  'use strict';

  const C = window.CONFIG || {};
  const cfg = C.medicao || {};

  /* Formatos oficiais. ID malformado não falha de forma visível: o script
     carrega, mede para uma propriedade que não existe e o problema só aparece
     semanas depois, com o relatório vazio. Barrar aqui transforma isso num
     silêncio honesto — nada carrega — em vez de um sucesso aparente. */
  const FORMATO_GA4 = /^G-[A-Z0-9]{6,12}$/;
  const FORMATO_META = /^\d{15,16}$/;
  const FORMATO_ADS = /^AW-\d{9,12}$/;

  const limpo = (valor) => String(valor == null ? '' : valor).trim();
  const ga4Id = FORMATO_GA4.test(limpo(cfg.ga4Id)) ? limpo(cfg.ga4Id) : '';
  const metaId = FORMATO_META.test(limpo(cfg.metaPixelId)) ? limpo(cfg.metaPixelId) : '';
  const adsId = FORMATO_ADS.test(limpo(cfg.googleAdsId)) ? limpo(cfg.googleAdsId) : '';

  const Consentimento = window.Consentimento;
  if (!Consentimento) return;                 // sem árbitro, não se mede nada

  const permitido = (categoria) => Consentimento.permitido(categoria);
  const estado = { gtag: false, ga4: false, ads: false, meta: false };

  /* `async` porque medição nunca deve atrasar a página, e sem `defer` porque a
     ordem entre os dois provedores é irrelevante — eles não se conhecem. */
  function carregaScript(src) {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  /* Apaga o que o provedor já tiver criado. É o que dá efeito prático à
     revogação: parar de enviar evento novo não bastaria se o identificador
     continuasse no navegador esperando a próxima visita. Cobre o domínio e o
     domínio-pai, que é onde o GA grava quando o site tem subdomínio. */
  function apagaCookies(prefixo) {
    const partes = location.hostname.split('.');
    const dominios = [location.hostname, `.${location.hostname}`];
    if (partes.length > 2) dominios.push(`.${partes.slice(-2).join('.')}`);

    document.cookie.split(';').forEach((bruto) => {
      const nome = bruto.split('=')[0].trim();
      if (!nome || nome.indexOf(prefixo) !== 0) return;
      dominios.forEach((dominio) => {
        document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${dominio}`;
      });
      document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  }

  // ------------------------------------------------- base compartilhada ----

  /* GA4 e Google Ads são o MESMO script (gtag.js) com dois `config` diferentes,
     e a própria Google avisa: "não adicione mais de uma etiqueta Google por
     página". Duas cópias competem pelo mesmo dataLayer e duplicam evento.

     Por isso a base sobe uma vez só, e cada produto entra pela sua categoria:
     GA4 com "estatísticas", Ads com "marketing". Aceitar só uma delas carrega o
     script e configura só o produto correspondente. */
  function preparaGtag(idParaUrl) {
    if (estado.gtag) return;
    estado.gtag = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };

    /* Consent Mode no primeiro comando, antes de qualquer medida. As duas
       categorias são lidas separadamente porque são decisões separadas: quem
       aceita estatísticas e recusa marketing tem análise sem chave de anúncio. */
    const analise = permitido('estatisticas') ? 'granted' : 'denied';
    const anuncio = permitido('marketing') ? 'granted' : 'denied';
    window.gtag('consent', 'default', {
      analytics_storage: analise,
      ad_storage: anuncio,
      ad_user_data: anuncio,
      ad_personalization: anuncio
    });

    window.gtag('js', new Date());
    carregaScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(idParaUrl)}`);
  }

  // ---------------------------------------------------------------- GA4 ----

  function ligaGA4() {
    if (estado.ga4 || !ga4Id) return;         // idempotente: reentrar não duplica
    estado.ga4 = true;
    preparaGtag(ga4Id);

    /* `send_page_view: false` e o page_view logo abaixo, à mão: com o envio
       automático, a visita seria contada no `config` e de novo em qualquer
       reconfiguração — e a diferença só apareceria como tráfego inflado. */
    window.gtag('config', ga4Id, { send_page_view: false });
    window.gtag('event', 'page_view');
  }

  // ---------------------------------------------------------- Google Ads ---

  /* Categoria "marketing", não "estatísticas": a etiqueta do Ads existe para
     medir e atribuir anúncio, e é isso que a categoria de marketing descreve
     para o visitante no aviso de cookies. */
  function ligaAds() {
    if (estado.ads || !adsId) return;
    estado.ads = true;
    preparaGtag(adsId);
    window.gtag('config', adsId);
  }

  // --------------------------------------------------------------- Meta ----

  function ligaMeta() {
    if (estado.meta || !metaId) return;
    estado.meta = true;

    /* Fila oficial do Pixel: os comandos ficam guardados e são reexecutados
       quando o fbevents.js chega. É o que permite chamar `init` e `PageView`
       agora, sem esperar a rede. */
    if (!window.fbq) {
      const fila = function fbq() {
        fila.callMethod
          ? fila.callMethod.apply(fila, arguments)
          : fila.queue.push(arguments);
      };
      fila.push = fila;
      fila.loaded = true;
      fila.version = '2.0';
      fila.queue = [];
      window.fbq = fila;
      window._fbq = window._fbq || fila;
    }

    window.fbq('init', metaId);
    window.fbq('track', 'PageView');
    carregaScript('https://connect.facebook.net/pt_BR/fbevents.js');
  }

  // ------------------------------------------------------------- eventos ---

  /* O nome do evento e os parâmetros saem de atributos no HTML — nunca do href
     nem do texto do botão. Não é preciosismo: o href do WhatsApp carrega o
     telefone e a frase da consulta, e mandar isso para o Google ou para a Meta
     seria transformar um clique em dado pessoal de saúde no relatório de um
     terceiro. Só `position` e `product` atravessam. */
  /* Cada plataforma recebe o nome na convenção DELA. No GA4 vale o nome
     descritivo em snake_case, que é o que aparece legível no relatório. Na Meta
     valem os nomes do catálogo padrão: só eles aparecem sozinhos na lista de
     eventos de conversão ao montar a campanha. Evento de nome próprio exigiria
     criar uma "conversão personalizada" no painel antes — passo a mais que o
     cliente não vai descobrir, e sem ele o anúncio não otimiza por nada disso.

     `AddToCart` no clique do livro e não `InitiateCheckout`: a Hotmart dispara
     InitiateCheckout e Purchase do lado dela, e repetir um dos dois contaria a
     mesma intenção duas vezes. Assim o funil fica AddToCart (aqui) →
     InitiateCheckout → Purchase (lá), sem sobreposição. */
  const NOME_META = {
    whatsapp_click: 'Contact',
    hotmart_click: 'AddToCart'
  };

  function dispara(nome, dados) {
    if (permitido('estatisticas') && estado.ga4) window.gtag('event', nome, dados);
    if (permitido('marketing') && estado.meta) {
      const padrao = NOME_META[nome];
      /* `track` para os do catálogo, `trackCustom` para o resto: mandar um nome
         padrão via trackCustom faz a Meta registrar como personalizado e o
         evento não conta como o padrão que aparenta ser. */
      if (padrao) window.fbq('track', padrao, dados);
      else window.fbq('trackCustom', nome, dados);
    }
  }

  document.addEventListener('click', (evento) => {
    const alvo = evento.target.closest ? evento.target.closest('[data-track-event]') : null;
    if (!alvo) return;

    const dados = {};
    if (alvo.dataset.trackPosition) dados.position = alvo.dataset.trackPosition;
    if (alvo.dataset.trackProduct) dados.product = alvo.dataset.trackProduct;
    dispara(alvo.dataset.trackEvent, dados);
  });

  // ---------------------------------------------------- ciclo de decisão ---

  /* Entram na fila: se a categoria já estiver aceita, roda agora; se não,
     espera a decisão. É o mesmo caminho para quem chega pela primeira vez e
     para quem volta com a escolha já guardada. */
  Consentimento.ao('estatisticas', ligaGA4);
  Consentimento.ao('marketing', ligaMeta);
  Consentimento.ao('marketing', ligaAds);

  /* As condições olham `estado.gtag`, não `estado.ga4`: desde que o Google Ads
     existe, a base do gtag pode ter subido por marketing, com o GA4 desligado.
     Checar o GA4 aqui deixaria a revogação muda justamente para quem aceitou só
     anúncio — o caso em que ela mais importa. */
  Consentimento.aoMudar(() => {
    if (!permitido('estatisticas')) {
      if (estado.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
      apagaCookies('_ga');
    }
    if (!permitido('marketing')) {
      if (estado.gtag) {
        window.gtag('consent', 'update', {
          ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
        });
      }
      if (estado.meta) window.fbq('consent', 'revoke');
      apagaCookies('_fb');
      apagaCookies('_gcl');           // identificador de clique do Google Ads
    } else if (estado.gtag) {
      window.gtag('consent', 'update', {
        ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted'
      });
    }
  });

  /* Superfície mínima para conferência: diz o que está ligado e permite disparar
     um evento à mão. Não expõe os IDs nem o módulo de consentimento. */
  window.SiteTracking = {
    estado: () => ({ ga4: estado.ga4, ads: estado.ads, meta: estado.meta }),
    evento: (nome, dados) => dispara(String(nome), dados || {})
  };
})();
