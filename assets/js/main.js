/* Renderização, navegação e interações da página. Sem tracking. */
(function () {
  'use strict';

  const C = window.CONFIG;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function waLink() {
    return `https://wa.me/${C.whatsapp.numero}?text=${encodeURIComponent(C.whatsapp.mensagem)}`;
  }

  function hotmartLink(base) {
    const sck = (C.publicacoes.sck || '').replace(/_/g, '|').slice(0, 30);
    return sck ? `${base}${base.includes('?') ? '&' : '?'}sck=${encodeURIComponent(sck)}` : base;
  }

  /* Ícones cheios, com os vazados feitos por `evenodd` — rodas e janela são
     buracos de verdade, não círculos pintados da cor do fundo: o card tem
     degradê atrás, e cor chapada apareceria como remendo.
     O alfiler entra em tom mais claro sobre o baú, e o topo do baú tem o V onde
     ele encaixa: é o que faz o desenho ler como entrega, e não como caminhão. */
  const ICONES = {
    caminhao:
      '<path fill-rule="evenodd" d="M1.5 8.1h3.9l1.9 2.4 1.9-2.4h4v8.7H1.5V8.1Z'
      + 'M13.3 10.3h4.6l3.7 3.7v2.8h-8.3v-6.5Zm1.9 1.4v2.3h4.1l-2.3-2.3h-1.8Z'
      + 'M6.2 15.6a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Zm0 1.7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z'
      + 'M17.6 15.6a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Zm0 1.7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>'
      // Alfinete em vermelho, o mesmo da fita de lançamento: é a cor que a página
      // reservou para "isto é novo", e repeti-la aqui amarra os dois sinais.
      + '<path fill-rule="evenodd" fill="#e5392a" d="M7.3 1.1a3.7 3.7 0 0 0-3.7 3.7c0 2.8 3.7 6.6 3.7 6.6'
      + 's3.7-3.8 3.7-6.6a3.7 3.7 0 0 0-3.7-3.7Zm0 2.2a1.5 1.5 0 1 1 0 3.1 1.5 1.5 0 0 1 0-3.1Z"/>',
    raio: '<path d="M13.4 1.8 4.6 13.4h5.2l-1 8.8 8.8-11.7h-5.2z"/>'
  };

  /* Oferta = um selo mais o seu botão, na mesma coluna.
     O par existe para a escolha se explicar sozinha: ao lado de "Físico" está o
     que só o físico tem, ao lado de "Digital" o que só o digital tem. Livro com
     dois formatos rende duas colunas; e-book rende uma, com o selo padrão da
     seção — assim nenhum card fica sem a vantagem do seu formato. */
  const ofertas = (book) => {
    const lista = book.formatos || [{
      rotulo: 'Ver detalhes', link: book.link, selo: C.publicacoes.seloDigital
    }];
    const coluna = (f) => `
      <div class="oferta">
        ${f.selo ? `<p class="oferta__selo">
          <svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[f.selo.icone] || ''}</svg>
          <span><b>${esc(f.selo.titulo)}</b><i>${esc(f.selo.desc)}</i></span>
        </p>` : ''}
        ${f.link
          ? `<a class="liquid-button liquid-button-bronze" href="${esc(hotmartLink(f.link))}" target="_blank" rel="noopener">${esc(f.rotulo)} <span aria-hidden="true">↗</span></a>`
          : `<button class="liquid-button liquid-button-light is-disabled" type="button" disabled>${esc(f.rotulo)} · em breve</button>`}
      </div>`;
    return `<div class="book-offer${lista.length > 1 ? ' book-offer--duplo' : ''}">${lista.map(coluna).join('')}</div>`;
  };

  const renderers = {
    sobre: (data) => `
      <div class="container">
        <header class="section-intro about-intro">
          <p class="kicker">${esc(data.eyebrow)}</p>
          <h2 data-motion-title>${esc(data.titulo)}</h2>
          <p>Uma atuação construída entre comportamento, contexto e responsabilidade.</p>
        </header>

        <div class="about-grid">
          <figure class="about-portrait">
            <img src="${esc(data.imagem)}" alt="${esc(data.imagemAlt)}" width="1254" height="1254" loading="lazy" decoding="async">
            <figcaption class="about-portrait-tag glass-panel"><span>${esc(C.marca.nome)}</span></figcaption>
          </figure>

          <article class="about-glass glass-panel" data-about-card>
            <h3>${esc(C.marca.nome)}</h3>
            <p class="about-role">${esc(C.marca.titulo)}</p>
            <p>${esc(data.bio)}</p>
            <p>${esc(data.complemento)}</p>
            <div class="about-stats">
              ${data.destaques.map((item) => `<div><strong>${esc(item.valor)}</strong><span>${esc(item.label)}</span></div>`).join('')}
            </div>
          </article>
        </div>
      </div>`,

    metodo: (data) => `
      <div class="container">
        <header class="section-intro">
          <p class="kicker">${esc(data.eyebrow)}</p>
          <h2 data-motion-title>${esc(data.titulo)}</h2>
          <p>${esc(data.intro)}</p>
        </header>

        <div class="method-layout">
          <figure class="method-visual">
            <img src="${esc(data.imagem)}" alt="${esc(data.imagemAlt)}" width="1080" height="1080" loading="lazy" decoding="async">
          </figure>

          <div class="method-side">
            <ul class="life-areas">
              ${(data.areas || []).map((area) => `
                <li><strong>${esc(area.nome)}</strong><span>${esc(area.desc)}</span><i class="life-areas__regua" aria-hidden="true"></i></li>`).join('')}
            </ul>
            <p class="method-closing">${esc(data.fecho || '')}</p>
          </div>
        </div>

        ${data.abordagem || data.alem ? `
          <div class="method-approach">
            ${data.abordagem ? `<p>${esc(data.abordagem)}</p>` : ''}
            ${data.alem ? `<p>${esc(data.alem)}</p>` : ''}
          </div>` : ''}

        <ol class="method-steps method-steps--row">
          ${data.passos.map((step) => `
            <li>
              <span>${esc(step.n)}</span>
              <div><h3>${esc(step.nome)}</h3><p>${esc(step.desc)}</p></div>
            </li>`).join('')}
        </ol>

        ${data.convite ? `
          <div class="method-invite">
            <p>${esc(data.convite)}</p>
            <a class="liquid-button liquid-button-gold" data-wa href="#">Começar agora <span aria-hidden="true">↗</span></a>
          </div>` : ''}
      </div>`,

    /* Vitrine giratoria: os quatro livros ficam num anel 3D em CSS, e nao mais
       empilhados um por linha. O painel de texto e um so, ao lado, e troca
       conforme o livro que estiver de frente. */
    publicacoes: (data) => `
      <div class="container">
        <header class="section-intro">
          <p class="kicker">${esc(data.eyebrow)}</p><h2 data-motion-title>${esc(data.titulo)}</h2>
        </header>

        <div class="showcase" data-showcase>
          <div class="showcase__stage">
            <div class="showcase__ring" data-showcase-ring>
              ${data.itens.map((book, i) => `
                <div class="showcase__item" data-showcase-item="${i}" style="--i:${i}; --razao:${book.razao || 1.5}">
                  <canvas class="showcase__canvas" data-book3d
                    data-capa="${esc(book.textura || book.capa)}"
                    ${book.contracapa ? `data-contracapa="${esc(book.contracapa)}"` : ''}
                    ${book.lombada ? `data-lombada="${esc(book.lombada)}"` : ''}
                    data-razao="${book.razao || 1.5}" data-espessura="${book.espessura || 0.16}"
                    ${book.pose !== undefined ? `data-pose="${book.pose}"` : ''}
                    aria-label="${esc(book.titulo)} — arraste para girar"></canvas>
                  <img class="showcase__poster" src="${esc(book.capa)}" alt="${esc(book.capaAlt)}" decoding="async">
                </div>`).join('')}
            </div>
            <div class="showcase__floor" aria-hidden="true"></div>

            <!-- As setas moram DENTRO do palco, nao na barra. O palco e a caixa
                 do livro tanto na coluna dupla do desktop quanto empilhado no
                 telefone, entao ancora-las nele acerta a lateral do livro em
                 qualquer largura, sem depender de onde a grade quebra. -->
            <button class="showcase__arrow liquid-control" type="button" data-showcase-prev aria-label="Publicação anterior">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 8 12l6.5 7"/></svg>
            </button>
            <button class="showcase__arrow liquid-control" type="button" data-showcase-next aria-label="Próxima publicação">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5 16 12l-6.5 7"/></svg>
            </button>

            <!-- Contador na lateral esquerda, na vertical. Embaixo do palco ele
                 passava por baixo do card em telas medias; aqui ocupa a folga
                 que sobra ao lado do livro, que nenhum outro elemento usa. -->
            <div class="showcase__pager">
              <span class="showcase__conta"><b data-showcase-atual>01</b><i aria-hidden="true">/</i><em>${String(data.itens.length).padStart(2, '0')}</em></span>
              <ol class="showcase__trilha">
                ${data.itens.map((book, i) => `
                  <li><button type="button" data-showcase-ir="${i}" aria-label="Ver ${esc(book.titulo)}"><span></span></button></li>`).join('')}
              </ol>
            </div>
          </div>

          <div class="showcase__panel glass-panel" data-showcase-panel aria-live="polite">
            ${data.itens.map((book, i) => `
              <article class="showcase__card${i === 0 ? ' is-active' : ''}" data-showcase-card="${i}">
                ${book.etiqueta ? `<p class="showcase__fita"><span>${esc(book.etiqueta)}</span></p>` : ''}
                <h3>${esc(book.titulo)}</h3>
                <p>${esc(book.descricao)}</p>
                <ul>${book.detalhes.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
                ${!book.disponivel ? `
                  <button class="liquid-button liquid-button-light is-disabled" type="button" disabled>Em breve</button>`
                : ofertas(book)}
              </article>`).join('')}
          </div>

          <div class="showcase__nav">
            <p class="showcase__hint">${esc(data.intro)}</p>
          </div>
        </div>
      </div>`,

    depoimentos: (data) => `
      <div class="container">
        <header class="section-intro">
          <p class="kicker">${esc(data.eyebrow)}</p><h2 data-motion-title>${esc(data.titulo)}</h2>
        </header>

        <div class="testimonial-grid">
          ${data.itens.map((item) => `
            <a class="testimonial-card" href="${esc(item.imagem)}" target="_blank" rel="noopener" aria-label="Abrir ${esc(item.alt)} em tamanho integral">
              <span class="testimonial-shot"><img src="${esc(item.imagem)}" alt="${esc(item.alt)}" width="640" height="1138" loading="lazy" decoding="async"></span>
              <span class="testimonial-foot"><strong>${esc(item.nome)}</strong><em aria-hidden="true">↗</em></span>
            </a>`).join('')}
        </div>
      </div>`,

    contato: (data) => `
      <div class="container contact-layout">
        <div class="contact-copy">
          <p class="kicker">${esc(data.eyebrow)}</p>
          <h2 data-motion-title>${esc(data.titulo)}</h2>
          <p>${esc(data.texto)}</p>
        </div>

        <div class="contact-channels">
          <a class="contact-channel glass-panel" data-wa href="#">
            <span class="contact-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 3.2A12.8 12.8 0 0 0 5.1 22.7L3.6 28.4l5.9-1.5A12.8 12.8 0 1 0 16 3.2Zm0 23.3a10.5 10.5 0 0 1-5.3-1.5l-.4-.2-3.5.9.9-3.4-.2-.4A10.5 10.5 0 1 1 16 26.5Zm5.8-7.8c-.3-.2-1.9-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1a8.6 8.6 0 0 1-4.3-3.7c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.7 5.9 5.1 2.2.9 3 1 4.1.8.7-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5-.1-.2-.3-.2-.6-.4Z"/></svg></span>
            <span><small>WhatsApp</small><strong>Marcar uma consulta</strong></span><i aria-hidden="true">↗</i>
          </a>
          <a class="contact-channel glass-panel" href="${esc(C.marca.instagram)}" target="_blank" rel="noopener">
            <span class="contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.7" r="1"/></svg></span>
            <span><small>Instagram</small><strong>${esc(C.marca.arroba)}</strong></span><i aria-hidden="true">↗</i>
          </a>
        </div>
      </div>`,

    /* O rodapé espelha a NAVEGAÇÃO DO CABEÇALHO lendo os próprios links dele, em
       vez de repetir a lista aqui. São a mesma coisa — o mapa da página — e
       duplicar garantiria que um dia divergissem. O cabeçalho já está no HTML
       quando render() roda, então a leitura é segura. */
    rodape: (data) => `
      <div class="container footer-inner">
        <div class="footer-marca">
          <strong>${esc(C.marca.nome)}</strong>
          <span>${esc(C.marca.titulo)}</span>
          <a class="liquid-button liquid-button-gold" data-wa href="#">Agendar terapia <span aria-hidden="true">↗</span></a>
        </div>

        <nav class="footer-col" aria-label="Seções">
          <h2>Navegar</h2>
          ${$$('.site-nav a').map((a) => `<a href="${esc(a.getAttribute('href'))}">${esc(a.textContent)}</a>`).join('')}
        </nav>

        <nav class="footer-col" aria-label="Publicações">
          <h2>Publicações</h2>
          ${(C.publicacoes?.itens || []).map((b) => `<a href="${esc(hotmartLink(b.link))}" target="_blank" rel="noopener">${esc(b.titulo)}</a>`).join('')}
        </nav>

        <nav class="footer-col" aria-label="Contato">
          <h2>Falar</h2>
          <a data-wa href="#">WhatsApp</a>
          <a href="${esc(C.marca.instagram)}" target="_blank" rel="noopener">Instagram · ${esc(C.marca.arroba)}</a>
          <!-- Unica porta de volta depois que a pessoa ja decidiu: sem ela, a
               escolha seria definitiva, e a LGPD exige que dê para revogar. -->
          <button type="button" class="footer-col__botao" onclick="abrePainelCookies()">Preferências de cookies</button>
        </nav>

        <p>${esc(data.copyright)}</p>
      </div>`
  };

  function render() {
    $$('[data-render]').forEach((element) => {
      const key = element.dataset.render;
      if (renderers[key] && C[key]) element.innerHTML = renderers[key](C[key]);
    });
  }

  function setupMotionText() {
    const wrap = (element) => {
      if (!element || element.dataset.motionReady === 'true') return;
      const label = element.textContent.trim();
      element.dataset.motionReady = 'true';
      element.setAttribute('aria-label', label);
      element.innerHTML = label.split(/\s+/).map((word) => `<span class="word-mask" aria-hidden="true"><span>${esc(word)}</span></span>`).join(' ');
    };
    $$('[data-motion-title]').forEach(wrap);
    $$('#hero-title > span, #hero-title > em').forEach(wrap);
  }


  function applyLinks() {
    /* Sem glifo nos CTAs: "Marcar consulta" nao precisa dizer por qual app —
       o icone so aparece onde o canal E a informacao (card de contato). */
    $$('[data-wa]').forEach((element) => {
      element.href = waLink();
      element.target = '_blank';
      element.rel = 'noopener';
    });
  }

  function setupMenu() {
    const toggle = $('.nav-toggle');
    const nav = $('.site-nav');
    if (!toggle || !nav) return;
    const close = () => {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
      document.body.classList.remove('menu-open');
    };
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
      document.body.classList.toggle('menu-open', !open);
      if (!open && window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.gsap.fromTo($$('a', nav), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: .25, stagger: .035, ease: 'power3.out', clearProps: 'all' });
      }
    });
    $$('a', nav).forEach((link) => link.addEventListener('click', close));
    window.addEventListener('resize', () => { if (innerWidth > 860) close(); }, { passive: true });
  }

  function setupHeader() {
    const header = $('[data-header]');
    const progress = $('.scroll-progress span');
    let queued = false;
    const update = () => {
      const max = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
      header?.classList.toggle('is-scrolled', scrollY > 20);
      if (progress) progress.style.transform = `scaleX(${Math.min(Math.max(scrollY / max, 0), 1)})`;
      queued = false;
    };
    const request = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };
    update();
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request, { passive: true });
  }

  function setupActiveNavigation() {
    if (!('IntersectionObserver' in window)) return;
    const links = $$('.site-nav a[href^="#"]');
    const visible = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => visible.set(entry.target.id, entry));
      const active = [...visible.entries()].filter(([, entry]) => entry.isIntersecting)
        .sort((a, b) => b[1].intersectionRatio - a[1].intersectionRatio)[0]?.[0];
      links.forEach((link) => {
        const selected = link.getAttribute('href') === `#${active}`;
        link.classList.toggle('is-active', selected);
        if (selected) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-26% 0px -58% 0px', threshold: [0, .15, .35, .6] });
    links.map((link) => $(link.getAttribute('href'))).filter(Boolean).forEach((section) => observer.observe(section));
  }

  function setupStickyWhatsApp() {
    const sticky = $('.sticky-wa');
    const hero = $('.hero');
    const contact = $('#contato');
    if (!sticky || !hero || !contact || !('IntersectionObserver' in window)) return;
    let shown = false;
    let heroVisible = true;
    let contactVisible = false;
    const render = () => {
      const shouldShow = !heroVisible && !contactVisible;
      if (shouldShow === shown) return;
      shown = shouldShow;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (shouldShow) {
        sticky.hidden = false;
        if (window.gsap && !reduce) window.gsap.fromTo(sticky, { opacity: 0, y: 12, scale: .96 }, { opacity: 1, y: 0, scale: 1, duration: .28, ease: 'back.out(1.5)', clearProps: 'opacity,transform' });
      } else if (window.gsap && !reduce) {
        window.gsap.to(sticky, { opacity: 0, y: 8, duration: .16, ease: 'power2.in', onComplete: () => { sticky.hidden = true; window.gsap.set(sticky, { clearProps: 'opacity,transform' }); } });
      } else sticky.hidden = true;
    };
    new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      render();
    }, { rootMargin: '-76px 0px 0px 0px' }).observe(hero);
    new IntersectionObserver(([entry]) => {
      contactVisible = entry.isIntersecting;
      render();
    }, { threshold: .08 }).observe(contact);
  }

  // Para onde a nuvem se inclina em cada etapa (x, y em -1..1).

  /* Vitrine giratória das publicações.

     O anel inteiro gira (uma transform só no container) em vez de cada livro
     girar sozinho: assim os quatro compartilham a mesma perspectiva e o que
     está na frente é sempre o mesmo ponto do palco. Girar item por item deixava
     cada livro preso na própria caixa, sem relação espacial com os outros. */
  /* Lombada DESENHADA, para o livro que tem arte impressa de verdade.
     Escrever ganha de extrair da foto: a lombada aparece de lado na foto, e o
     eixo comprimido é justamente onde mora o texto — foi esse aperto que limitou
     a nitidez da lombada do Mentalidade, tirada de uns 100 px reais.

     O canvas nasce na PROPORÇÃO FÍSICA da lombada (largura = espessura, altura =
     altura do livro). Com a proporção certa, o que é desenhado quadrado aparece
     quadrado no modelo, e não é preciso pré-esticar nada. */
  function lombadaDesenhada(book, aoChegarLogo) {
    const arte = book.lombadaTexto;
    if (!arte) return null;
    const razao = book.razao || 1.5;
    const espessura = book.espessura || 0.16;
    const alt = 1536;
    const larg = Math.max(64, Math.round(alt * (2 * espessura / razao) / 2));

    const cv = document.createElement('canvas');
    cv.width = larg;
    cv.height = alt;
    const ctx = cv.getContext('2d');

    /* O fundo pode ser chapado ou vir da BORDA DA CAPA. Com `fundoCapa`, a coluna
       da beirada é esticada na largura da lombada: assim uma faixa de cor que
       existe na capa — a tarja verde do pé do Relacionamentos — dobra a quina e
       continua na lateral, em vez de morrer na aresta. */
    const pintaFundo = (capa) => {
      ctx.fillStyle = arte.fundo || '#0a0a0c';
      ctx.fillRect(0, 0, larg, alt);
      if (!capa) return;
      const faixa = Math.max(2, Math.round(capa.naturalWidth * 0.012));
      // Uma tira estreita esticada: a cor acompanha a altura, o desenho não vem junto.
      ctx.drawImage(capa, 0, 0, faixa, capa.naturalHeight, 0, 0, larg, alt);
    };
    let capaCarregada = null;
    let logoCarregado = null;

    /* Espacejamento glifo a glifo: `letterSpacing` do canvas 2D ainda não existe
       em todo navegador, e a lombada impressa é toda tracking largo. */
    const medir = (texto, tam, peso, espaco) => {
      ctx.font = `${peso} ${tam}px "IBM Plex Sans", sans-serif`;
      return [...texto].reduce((n, ch) => n + ctx.measureText(ch).width + espaco, -espaco);
    };
    const escreve = (texto, x, y, tam, peso, espaco, cor) => {
      ctx.font = `${peso} ${tam}px "IBM Plex Sans", sans-serif`;
      ctx.fillStyle = cor;
      let cursor = x;
      for (const ch of texto) {
        ctx.fillText(ch, cursor, y);
        cursor += ctx.measureText(ch).width + espaco;
      }
    };

    /* Redesenha a lombada inteira. É chamada de novo a cada imagem que chega
       (capa, logotipo), porque a ordem importa: o fundo precisa ir antes do
       texto, e pintar por cima do que já estava deixaria fantasma. */
    /* Onde começa a tarja do pé, lida do fundo JÁ PINTADO.
       O vão do título sai de folgas geométricas, que não sabem nada do DESENHO
       do fundo. A capa do Relacionamentos tem uma tarja verde escura no pé: o
       título terminava 17px dentro dela e, sendo verde escuro sobre verde
       escuro (luminância 45 contra 40), a última letra sumia. Parecia corte de
       texto, era contraste zero.
       Medir o fundo em vez de fixar a posição na configuração faz a regra valer
       para qualquer capa — inclusive as que não têm tarja, onde ela não aperta
       nada. Varre de baixo para cima e para no primeiro degrau de luz. */
    const inicioDaTarja = () => {
      if (!capaCarregada) return alt;
      let faixa;
      try {
        faixa = ctx.getImageData(Math.floor(larg / 2), 0, 1, alt).data;
      } catch (e) {
        return alt;            // canvas maculado: segue sem a restrição
      }
      const luz = (y) => 0.2126 * faixa[y * 4] + 0.7152 * faixa[y * 4 + 1] + 0.0722 * faixa[y * 4 + 2];
      const pe = luz(alt - 8);
      for (let y = alt - 8; y > alt * 0.55; y--) {
        if (Math.abs(luz(y) - pe) > 26) return y;
      }
      return alt;
    };

    const pinta = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      pintaFundo(capaCarregada);
      // Precisa ser lido com o fundo pronto e antes do texto entrar.
      const tarjaX = inicioDaTarja() - alt / 2;

      /* +90° e não -90°: assim o texto corre de CIMA para baixo, com o topo das
         letras virado para a direita — a convenção brasileira, a mesma da foto
         do livro impresso. Girando para o outro lado ele sobe, que é o padrão
         europeu. Como efeito colateral, x = -alt/2 vira o TOPO da lombada, então
         a ordem autor → título → editora já cai no lugar certo. */
      ctx.translate(larg / 2, alt / 2);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const corpo = Math.round(larg * 0.32);
      const folga = alt * 0.05;
      const branco = arte.corTitulo || '#f4f1ea';
      const dourado = arte.corAutor || '#c8a05a';

      // Autor na cabeça e editora no pé são âncoras fixas; o título fica com o
      // vão entre elas. Sem reservar o pé antes, um título longo invade o selo.
      const tAutor = corpo * 0.74;
      const wAutor = medir(arte.autor, tAutor, 600, tAutor * 0.30);
      const xAutor = -alt / 2 + folga;
      escreve(arte.autor, xAutor, 0, tAutor, 600, tAutor * 0.30, dourado);

      const tSelo = corpo * 0.60;
      const tSub = corpo * 0.34;
      const wSelo = arte.seloImagem ? alt * 0.13
        : (arte.selo ? medir(arte.selo, tSelo, 600, tSelo * 0.26) : 0);
      const xSelo = alt / 2 - folga - wSelo;

      if (logoCarregado) {
        // Encaixa pela ALTURA da lombada, que é a dimensão apertada; a largura
        // sai da proporção do logotipo, já recortado no próprio contorno.
        const prop = logoCarregado.naturalWidth / logoCarregado.naturalHeight;
        const h = Math.min(larg * 0.62, wSelo / prop);
        ctx.drawImage(logoCarregado, alt / 2 - folga - h * prop, -h / 2, h * prop, h);
      } else if (arte.selo) {
        escreve(arte.selo, xSelo, -tSub * 0.75, tSelo, 600, tSelo * 0.26, branco);
        if (arte.seloSub) {
          const wSub = medir(arte.seloSub, tSub, 400, tSub * 0.18);
          ctx.globalAlpha = 0.8;
          escreve(arte.seloSub, xSelo + (wSelo - wSub) / 2, tSelo * 0.85, tSub, 400, tSub * 0.18, branco);
          ctx.globalAlpha = 1;
        }
      }

      // Título centrado no vão, encolhendo só o quanto for preciso para caber.
      const vaoIni = xAutor + wAutor + corpo * 1.1;
      // O menor entre o limite geométrico e o começo da tarja: o que vier antes.
      const vaoFim = Math.min((wSelo ? xSelo : alt / 2 - folga) - corpo * 1.1,
                              tarjaX - corpo * 0.35);
      const vao = Math.max(1, vaoFim - vaoIni);
      let tTitulo = corpo;
      let wTitulo = medir(arte.titulo, tTitulo, 700, tTitulo * 0.06);
      if (wTitulo > vao) {
        tTitulo = Math.max(corpo * 0.5, tTitulo * (vao / wTitulo));
        wTitulo = medir(arte.titulo, tTitulo, 700, tTitulo * 0.06);
      }
      escreve(arte.titulo, vaoIni + (vao - wTitulo) / 2, 0, tTitulo, 700, tTitulo * 0.06, branco);
    };

    const carrega = (url, guarda) => {
      if (!url) return;
      const im = new Image();
      im.onload = () => { guarda(im); pinta(); if (aoChegarLogo) aoChegarLogo(cv); };
      im.onerror = () => console.warn('[lombada]', url);
      im.src = url;
    };

    pinta();
    carrega(arte.fundoCapa, (im) => { capaCarregada = im; });
    carrega(arte.seloImagem, (im) => { logoCarregado = im; });

    return cv;
  }

  function setupShowcase() {
    const root = $('[data-showcase]');
    if (!root) return;
    const ring = $('[data-showcase-ring]', root);
    const items = $$('[data-showcase-item]', root);
    const cards = $$('[data-showcase-card]', root);
    const atalhos = $$('[data-showcase-ir]', root);
    const conta = $('[data-showcase-atual]', root);
    if (!ring || !items.length) return;

    const total = items.length;
    /* Anel FECHADO: os 360° divididos pelo número de livros. O leque de 52° que
       havia antes existia para os vizinhos aparecerem de esguelha; agora que só
       o livro em foco fica visível, o leque perdeu a função e atrapalhava — um
       leque não fecha a volta, então o giro tinha de voltar atrás para ir do
       último ao primeiro. Fechando o anel, avançar é sempre o mesmo movimento. */
    const step = 360 / total;
    /* `volta` acumula sem limite e é dela que sai o ângulo; o índice é o resto.
       Assim o quarto livro leva ao primeiro seguindo em frente, em vez de
       rebobinar três posições. */
    let volta = 0;
    let index = 0;
    const books = [];
    ring.style.setProperty('--step', `${step}deg`);

    const show = (delta) => {
      volta += delta;
      index = ((volta % total) + total) % total;
      ring.style.setProperty('--turn', `${-volta * step}deg`);

      items.forEach((item, i) => {
        item.classList.toggle('is-front', i === index);
        item.style.zIndex = String(i === index ? total : 1);
        // Um livro de cada vez: os outros somem em vez de aparecer pela metade.
        item.style.opacity = i === index ? '1' : '0';
      });
      cards.forEach((card, i) => card.classList.toggle('is-active', i === index));
      atalhos.forEach((b, i) => b.classList.toggle('is-active', i === index));
      if (conta) conta.textContent = String(index + 1).padStart(2, '0');
      books.forEach((api, i) => { if (i !== index) api?.reset(); });
    };

    /* Atalho direto: caminho mais curto no anel, e não o índice cru. Sem isso,
       pular do quarto para o primeiro rebobinaria três posições para trás em vez
       de seguir em frente uma. */
    atalhos.forEach((botao, alvo) => botao.addEventListener('click', () => {
      let d = (alvo - index) % total;
      if (d > total / 2) d -= total;
      if (d < -total / 2) d += total;
      if (d) show(d);
    }));

    $('[data-showcase-prev]', root)?.addEventListener('click', () => show(-1));
    $('[data-showcase-next]', root)?.addEventListener('click', () => show(1));

    root.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); show(1); }
    });

    /* Trocar de livro é só pelas setas (e pelas teclas de seta, que são o mesmo
       controle). O arrasto ficou reservado para girar o livro da frente: quando
       as duas coisas dividiam o mesmo gesto, girar a capa trocava a publicação
       no meio do caminho. */

    /* Um renderer por livro, montados SÓ quando a vitrine se aproxima da tela.
       São cinco contextos WebGL, cinco jogos de textura e cinco lombadas
       desenhadas em canvas de 1536px. Criados junto com a página, eles disputam
       a abertura com o cérebro da hero — que é o que a pessoa está de fato
       olhando nesse momento, e no telefone essa disputa aparece.
       O limite do navegador é 16 contextos, então os cinco cabem folgados: o
       custo que se paga aqui é de PARTIDA, não de permanência. Depois de
       prontos, cada um desenha sob demanda e em repouso nenhum tem loop. */
    let montados = false;
    const montaLivros = () => {
      if (montados || !window.Book3D) return;
      montados = true;
      $$('[data-book3d]', root).forEach((canvas) => {
        // Índice tirado do item, não da ordem dos canvas: são listas diferentes
        // no momento em que um livro deixar de ter render.
        const i = Number(canvas.closest('[data-showcase-item]')?.dataset.showcaseItem || 0);
        let api = null;
        const lomb = lombadaDesenhada(C.publicacoes.itens[i], (cv) => { if (api) api.lombada(cv); });
        api = window.Book3D.create(canvas, canvas.dataset.capa, {
          contracapa: canvas.dataset.contracapa,
          lombada: lomb || canvas.dataset.lombada,
          razao: Number(canvas.dataset.razao),
          espessura: Number(canvas.dataset.espessura),
          pose: canvas.dataset.pose !== undefined ? Number(canvas.dataset.pose) : undefined
        });
        if (api) books[i] = api;
      });
      show(0);            // reassenta a pose agora que os renderers existem
    };

    show(0);

    if ('IntersectionObserver' in window) {
      /* 400px de antecedência: dá tempo de compilar shader e subir textura antes
         de a seção aparecer, então a montagem não é vista. */
      const olho = new IntersectionObserver((entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        olho.disconnect();
        montaLivros();
      }, { rootMargin: '400px 0px' });
      olho.observe(root);
    } else {
      montaLivros();
    }

    /* Fica pendurado para o ScrollTrigger chamar quando a seção entra na tela.
       Só o livro da frente se apresenta: os outros estão invisíveis, e girá-los
       seria gastar GPU em quatro cenas que ninguém vê. */
    /* Monta antes de pedir a entrada: se o visitante chegar aqui por link direto
       (#ebooks), o ScrollTrigger pode disparar junto com o observer, e sem esta
       chamada o livro da frente não existiria ainda para se apresentar. */
    entradaVitrine = () => { montaLivros(); if (books[index]) books[index].entrada(); };
  }

  /* Lightbox dos depoimentos. O card continua sendo um <a> para a imagem: sem JS
     ainda abre normalmente. Com JS, intercepta e mostra o print inteiro numa
     janela — abrir imagem crua em aba nova e ruim no celular, que e onde esta
     quase todo o trafego. */
  function setupTestimonialLightbox() {
    const cards = $$('.testimonial-card');
    if (!cards.length) return;

    const box = document.createElement('div');
    box.className = 'lightbox';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<button class="lightbox__close" type="button" aria-label="Fechar">&times;</button>'
      + '<figure class="lightbox__frame"><img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(box);

    const image = $('img', box);
    const caption = $('figcaption', box);
    const close = $('.lightbox__close', box);
    let lastFocus = null;

    const open = (src, alt, nome) => {
      lastFocus = document.activeElement;
      image.src = src;
      image.alt = alt;
      caption.textContent = nome;
      box.hidden = false;
      document.body.classList.add('menu-open');   // trava o scroll do fundo
      requestAnimationFrame(() => box.classList.add('is-open'));
      close.focus();
    };

    const hide = () => {
      box.classList.remove('is-open');
      document.body.classList.remove('menu-open');
      setTimeout(() => { box.hidden = true; image.src = ''; }, 220);
      if (lastFocus) lastFocus.focus();
    };

    cards.forEach((card) => {
      card.addEventListener('click', (event) => {
        event.preventDefault();
        const img = $('img', card);
        open(card.getAttribute('href'), img ? img.alt : '', $('strong', card).textContent);
      });
    });

    close.addEventListener('click', hide);
    box.addEventListener('click', (event) => { if (event.target === box) hide(); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !box.hidden) hide();
    });
  }

  function setupLiquidControls() {
    const controls = $$('.liquid-control, .liquid-button, .contact-channel');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    controls.forEach((control) => {
      control.addEventListener('pointermove', (event) => {
        const rect = control.getBoundingClientRect();
        control.style.setProperty('--glass-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
        control.style.setProperty('--glass-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
      });
      if (!window.gsap || reduce || !fine || control.matches(':disabled')) return;
      /* Sem magnetismo: o botao nao segue o cursor. Fica so o brilho do vidro
         acompanhando o ponteiro e o retorno tatil do clique. */
      control.addEventListener('pointerleave', () => { window.gsap.to(control, { scale: 1, duration: .24, ease: 'back.out(1.6)' }); });
      control.addEventListener('pointerdown', () => window.gsap.to(control, { scale: .97, duration: .1 }));
      control.addEventListener('pointerup', () => window.gsap.to(control, { scale: 1, duration: .24, ease: 'back.out(1.6)' }));
    });
  }

  let introHero = null;
  let entradaVitrine = null;
  /* Liberado pelo preloader quando a cortina sai: o livro da hero fica parado na
     capa enquanto ela estiver no ar. */
  let girarHeroLivro = null;

  function setupMotion() {
    if (!window.gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const gsap = window.gsap;
    /* Em pausa enquanto a cortina existir: a hero deve entrar QUANDO ela sobe, não
       atrás dela. Sem cortina (JS do preloader não rodou), toca na hora. */
    const hero = gsap.timeline({ paused: !!$('[data-preloader]'), defaults: { ease: 'power4.out' } });
    introHero = hero;
    hero.from('.site-header', { opacity: 0, y: -18, duration: .45 })
      .from('.hero .kicker', { opacity: 0, x: -28, duration: .45 }, .08)
      .from('#hero-title .word-mask > span', { yPercent: 125, rotate: 3, duration: .76, stagger: .055 }, .12)
      .from('.hero-lead', { opacity: 0, y: 28, duration: .55 }, .38)
      .fromTo('.hero-actions .liquid-button', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .46, clearProps: 'opacity,visibility,transform' }, .48)
      .fromTo('.hero-actions .text-link, .microcopy', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .42, stagger: .07, clearProps: 'opacity,visibility,transform' }, .54)
      .fromTo('.hero-obj', { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: .8, clearProps: 'opacity,visibility,transform' }, .5);

    // A linha de varredura saiu quando o cérebro ganhou a onda de ativação: o
    // elemento não existe mais no markup, e o tween em loop só sobrava avisando
    // no console que não achava o alvo.
    if (!window.ScrollTrigger) return;
    gsap.registerPlugin(window.ScrollTrigger);
    const ScrollTrigger = window.ScrollTrigger;
    window.ScrollTrigger.config({ ignoreMobileResize: true });

    /* No telefone a entrada vira vertical, curta e mais rápida.
       Os mesmos 120px de deslize são 8% da largura num monitor de 1440 e 31%
       num aparelho de 390: o que lá lê como um empurrão discreto aqui é um voo
       atravessando a tela — e atravessando na horizontal, contra o sentido em
       que a pessoa está rolando. A rotação sai pelo mesmo motivo: num card que
       ocupa a coluna inteira ela joga o canto para fora da margem.
       A duração encolhe porque no polegar a rolagem é rápida: com .92s o
       conteúdo ainda está chegando quando o olho já passou por ele. */
    const compacto = matchMedia('(max-width: 900px)').matches;
    const ent = (v) => {
      if (!compacto) return v;
      const o = Object.assign({}, v);
      delete o.x;
      delete o.rotation;
      const dy = o.y || 24;
      o.y = Math.min(Math.abs(dy), 28) * (dy < 0 ? -1 : 1);
      if (o.duration) o.duration = +(o.duration * 0.72).toFixed(2);
      if (o.stagger) o.stagger = +(o.stagger * 0.7).toFixed(3);
      return o;
    };

    const revealTitle = (section) => {
      const target = $(`${section} [data-motion-title]`);
      if (!target) return;
      gsap.from($$('.word-mask > span', target), {
        yPercent: 118,
        rotate: 2.5,
        duration: .72,
        stagger: .045,
        ease: 'power4.out',
        scrollTrigger: { trigger: section, start: 'top 76%', once: true, fastScrollEnd: true }
      });
    };

    ['.about-section', '.method-section', '.books-section', '.testimonials-section', '.contact-section'].forEach(revealTitle);

    gsap.from('.about-intro .kicker, .about-intro > p', ent({ opacity: 0, x: -44, duration: .55, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '.about-section', start: 'top 78%', once: true, fastScrollEnd: true } }));
    gsap.fromTo('.about-portrait', { opacity: 0, scale: 1.08, clipPath: 'inset(10% 14% 8% 4% round 3rem)' }, { opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0% round 1.5rem)', duration: 1.05, ease: 'power4.out', clearProps: 'opacity,transform,clipPath', scrollTrigger: { trigger: '.about-grid', start: 'top 74%', once: true, fastScrollEnd: true } });
    gsap.from('[data-about-card]', ent({ opacity: 0, x: 120, y: 50, rotation: 3, scale: .96, duration: .92, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.about-grid', start: 'top 68%', once: true, fastScrollEnd: true } }));
    gsap.from('.about-stats > div', { opacity: 0, y: 18, duration: .42, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '[data-about-card]', start: 'top 78%', once: true, fastScrollEnd: true } });

    gsap.from('.method-visual', ent({ opacity: 0, x: -110, rotation: -3, scale: .92, duration: .9, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.method-layout', start: 'top 76%', once: true, fastScrollEnd: true } }));
    gsap.to('.method-visual img', { yPercent: -7, ease: 'none', scrollTrigger: { trigger: '.method-layout', start: 'top bottom', end: 'bottom top', scrub: .65 } });
    gsap.from('.life-areas li', { opacity: 0, y: 16, duration: .5, stagger: .07, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.life-areas', start: 'top 82%', once: true, fastScrollEnd: true } });
    // A régua de cada item é traçada da esquerda para a direita: é o item que
    // "assina" a própria linha, em vez de tudo aparecer inteiro de uma vez.
    gsap.from('.life-areas__regua', { scaleX: 0, duration: .7, stagger: .07, ease: 'power3.inOut', clearProps: 'transform', scrollTrigger: { trigger: '.life-areas', start: 'top 82%', once: true, fastScrollEnd: true } });
    gsap.from('.method-closing', { opacity: 0, y: 18, duration: .6, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.method-closing', start: 'top 88%', once: true, fastScrollEnd: true } });
    gsap.from('.method-approach p', ent({ opacity: 0, y: 26, duration: .68, stagger: .12, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.method-approach', start: 'top 84%', once: true, fastScrollEnd: true } }));
    gsap.fromTo('.method-invite', { opacity: 0, y: 30, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .75, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.method-invite', start: 'top 88%', once: true, fastScrollEnd: true } });

    gsap.from('.method-steps li', ent({ opacity: 0, x: 120, duration: .68, stagger: .1, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.method-steps', start: 'top 82%', once: true, fastScrollEnd: true } }));

    /* Vitrine: o livro da frente CHEGA GIRANDO, de quase perfil ate a pose de
       repouso, e o painel entra ao lado. A entrada e feita pela rotacao do
       proprio renderer WebGL, nao por transform de CSS — e o unico elemento da
       pagina que e um objeto 3D de verdade, e girar por dentro le como o objeto
       se apresentando, enquanto um transform por fora leria como um cartao. */
    ScrollTrigger.create({
      trigger: '.showcase', start: 'top 72%', once: true,
      onEnter: () => { if (typeof entradaVitrine === 'function') entradaVitrine(); }
    });
    gsap.from('.showcase__panel', ent({ opacity: 0, x: 90, y: 24, duration: .85, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.showcase', start: 'top 72%', once: true, fastScrollEnd: true } }));
    gsap.from('.showcase__nav', { opacity: 0, y: 22, duration: .6, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.showcase', start: 'top 62%', once: true, fastScrollEnd: true } });


    /* Grade, nao mais faixa: deslizar 240px na horizontal jogava os cards
       para fora da coluna. Sobe curto, com cascata. */
    gsap.from('.testimonial-card', ent({ opacity: 0, y: 40, scale: .96, duration: .68, stagger: .07, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.testimonial-grid', start: 'top 84%', once: true, fastScrollEnd: true } }));
    /* Dica de arrasto no trilho dos depoimentos.
       No telefone a lista deita e vira carrossel; a única pista de que ela anda
       é a fatia do próximo card na borda, e fatia sozinha não ensina gesto. Um
       empurrão curto e a volta mostram o movimento uma vez.
       Quem decide se roda é o DOM, não uma media query: só existe trilho quando
       o conteúdo é mais largo que a caixa. No desktop a lista é grade e a
       condição é falsa sozinha.
       O snap é desligado durante a dica — com `mandatory` ligado ele briga com
       a rolagem programada e o empurrão sai aos trancos. */
    const trilho = $('.testimonial-grid');
    if (trilho) {
      ScrollTrigger.create({
        trigger: trilho, start: 'top 80%', once: true,
        onEnter: () => {
          if (trilho.scrollWidth <= trilho.clientWidth + 4) return;
          const snap = trilho.style.scrollSnapType;
          trilho.style.scrollSnapType = 'none';
          gsap.timeline({ onComplete: () => { trilho.style.scrollSnapType = snap; } })
            .to(trilho, { scrollLeft: 34, duration: .42, ease: 'power2.out' })
            .to(trilho, { scrollLeft: 0, duration: .58, ease: 'power2.inOut' }, '+=.14');
        }
      });
    }

    gsap.from('.contact-copy .kicker, .contact-copy > p:last-child', ent({ opacity: 0, x: -54, duration: .55, stagger: .1, ease: 'power3.out', scrollTrigger: { trigger: '.contact-section', start: 'top 76%', once: true, fastScrollEnd: true } }));
    gsap.from('.contact-channel', ent({ opacity: 0, x: 120, y: 34, rotation: 2, duration: .7, stagger: .12, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.contact-channels', start: 'top 84%', once: true, fastScrollEnd: true } }));
    addEventListener('load', () => window.ScrollTrigger.refresh(), { once: true });
  }

  /* Preloader: a cortina segura a pagina ate o objeto da hero existir e sobe.

     Antes o objeto viajava junto - subia com a cortina e caia na posicao da
     hero, por FLIP. Isso saiu: a cortina agora e a transicao inteira, e a hero
     entra por baixo dela pela propria timeline de intro. */
  function setupPreloader() {
    const cortina = $('[data-preloader]');
    if (!cortina) return;
    const canvas = $('[data-hero-livro]');
    const marca = $('.preloader__marca', cortina);
    const luz = $('.preloader__luz', cortina);
    const topo = $('.preloader__metade--topo', cortina);
    const base = $('.preloader__metade--base', cortina);

    document.body.classList.add('esta-carregando');
    scrollTo(0, 0);

    const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const solta = () => {
      document.body.classList.remove('esta-carregando');
      cortina.remove();
      // Só agora o livro começa a girar: até aqui ele espera de capa para a frente.
      if (girarHeroLivro) girarHeroLivro();
    };

    let saiu = false;
    const sair = () => {
      if (saiu) return;
      saiu = true;

      if (!window.gsap || reduzido) {
        cortina.style.opacity = '0';
        setTimeout(solta, 320);
        return;
      }

      /* A luz nasce no meio do "Bem-vindo", corre para as duas pontas e a
         cortina se abre pela fresta que ela deixou.
         A ordem importa: a luz vai PRIMEIRO e sozinha — é ela que anuncia o
         corte. O texto só se apaga depois que ela já o atravessou, senão a
         palavra some antes de a luz ter o que cortar. As metades só partem
         quando a luz chegou às bordas; abrir antes entregaria que a fresta e a
         abertura são duas coisas separadas em vez de uma consequência da outra. */
      const tl = window.gsap.timeline({ onComplete: solta });
      tl.fromTo(luz, { scaleX: 0, opacity: 1 },
                     { scaleX: 1, duration: .78, ease: 'power3.inOut' })
        /* A hero começa a entrar ANTES de a fresta abrir. A fresta mostra o que
           está atrás, e se o conteúdo ainda estivesse em opacidade zero ela
           revelaria uma página vazia — o mesmo vazio que o fundo do contêiner
           causava, só que por outro motivo. */
        .add(() => { if (introHero) introHero.play(); }, .5)
        /* O texto só se apaga DEPOIS que a luz o atravessou. Apagando antes, a
           palavra sumia e a luz ficava cortando o nada — e é o corte no meio do
           "Bem-vindo" que dá sentido ao movimento. */
        .to(marca, { opacity: 0, duration: .38, ease: 'power2.in' }, .62)
        .to(topo, { yPercent: -100, duration: 1.05, ease: 'power3.inOut' }, .68)
        .to(base, { yPercent: 100, duration: 1.05, ease: 'power3.inOut' }, .68)
        // A luz se apaga enquanto as metades abrem: cumpriu o papel, e mantê-la
        // acesa deixaria um risco atravessando a hero já visível.
        .to(luz, { opacity: 0, duration: .55, ease: 'power2.out' }, .92);
    };

    /* Quem manda e o objeto da hero, o asset mais pesado; o teto evita a pagina
       presa se algo falhar.
       O piso e 2,5s: tempo de ler "Bem-vindo" e ver a luz nascer, sem que a
       espera vire pedagio. Somando a coreografia de saida, sao ~4s ate a hero
       inteira - que e onde os 4s de piso anteriores ja estavam colocando so a
       cortina. Vale lembrar que ele e PISO, nao espera fixa: numa visita com
       tudo em cache o livro fica pronto em milissegundos e o piso e quem manda;
       numa conexao ruim quem manda e o livro. */
    const piso = new Promise((r) => setTimeout(r, 2500));
    const objeto = new Promise((r) => {
      if (!canvas || canvas.classList.contains('is-ready')) { r(); return; }
      canvas.addEventListener('livro:pronto', r, { once: true });
    });
    const teto = new Promise((r) => setTimeout(r, 7000));
    Promise.all([piso, Promise.race([objeto, teto])]).then(sair);
  }

  /* Objeto da hero: o livro impresso, no mesmo renderizador da vitrine.
     Ele é o único título físico do catálogo e o que dá lastro editorial à
     página — daí estar aqui e não na vitrine apenas. Reaproveita a textura, a
     contracapa e a lombada que já existiam, então não custa asset novo.
     A lombada é desenhada em canvas (traz o selo da Âncora); por isso o `api`
     é declarado antes, para o retorno assíncrono do logotipo achar o objeto. */
  function setupHeroLivro() {
    const canvas = $('[data-hero-livro]');
    if (!canvas || !window.Book3D || !C.publicacoes) return null;
    const livro = C.publicacoes.itens.find((i) => i.id === 'mundo-real');
    if (!livro) return null;

    let api = null;
    const lomb = lombadaDesenhada(livro, (cv) => { if (api) api.lombada(cv); });
    api = window.Book3D.create(canvas, livro.textura, {
      contracapa: livro.contracapa,
      lombada: lomb || livro.lombada,
      razao: livro.razao,
      espessura: livro.espessura
    });
    if (!api) return null;

    /* Uma volta a cada ~20s: devagar o bastante para não disputar atenção com a
       manchete, e ainda assim mostrar lombada e contracapa a quem ficar olhando.
       O arrasto continua funcionando por cima — o giro é somado, não exclusivo. */
    const VOLTA = (Math.PI * 2) / (20 * 60);
    const reduzido = matchMedia('(prefers-reduced-motion: reduce)');
    let naTela = true;
    /* Com cortina, o giro só começa quando ela sai. Girando por baixo dela, o
       livro chegava de costas na abertura — a capa é o que precisa estar de
       frente no instante em que a página aparece. */
    let liberado = !$('[data-preloader]');

    const aplica = () => api.girar(naTela && liberado && !reduzido.matches ? VOLTA : 0);
    girarHeroLivro = () => { liberado = true; aplica(); };
    reduzido.addEventListener?.('change', aplica);

    /* Fora da tela o giro para. Não é economia teórica: é o único rAF que rodaria
       o tempo todo na página, e a hero fica no topo — a pessoa passa o resto da
       visita com ele fora de vista. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { naTela = e.isIntersecting; aplica(); },
        { threshold: 0 }).observe(canvas);
    }
    aplica();
    return api;
  }

  /* Consentimento (LGPD).
     O banner NÃO carrega nada e não conhece o Pixel: ele só registra a decisão e
     avisa. Quem mede se inscreve em `Consentimento.ao(...)` e é carregado ali
     dentro. Essa separação é o que faz o "recusar" valer de verdade — sem ela, o
     script de medição já estaria na página e o banner seria enfeite. */
  const CHAVE = 'avila:consentimento';

  const Consentimento = (() => {
    const inscritos = [];                       // { categoria, fn }
    const cfg = () => C.consentimento || {};
    const cats = () => cfg().categorias || [];
    // Categoria `fixo` nasce ligada e não desliga: é o mínimo para o site operar.
    const base = () => cats().reduce((o, c) => (o[c.id] = !!c.fixo, o), {});

    const lido = () => {
      try {
        const d = JSON.parse(localStorage.getItem(CHAVE) || 'null');
        // Versão diferente = política mudou, decisão antiga não vale mais.
        return d && d.versao === cfg().versao ? d.escolhas : null;
      } catch (e) { return null; }
    };
    let escolhas = lido();
    const permitido = (id) => !!(escolhas && escolhas[id]);

    /* Percorre de trás para frente porque remove da própria lista enquanto anda.
       Rodar de novo depois de uma mudança de preferência é seguro: quem já
       disparou saiu da fila. */
    const dispara = () => {
      for (let i = inscritos.length - 1; i >= 0; i--) {
        if (permitido(inscritos[i].categoria)) inscritos.splice(i, 1)[0].fn();
      }
    };

    const grava = (novo) => {
      escolhas = Object.assign(base(), novo);
      try {
        localStorage.setItem(CHAVE, JSON.stringify({
          escolhas, versao: cfg().versao, em: new Date().toISOString()
        }));
      } catch (e) { /* navegação privada: vale para esta sessão e pronto */ }
      dispara();
    };

    return {
      decidido: () => !!escolhas,
      permitido,
      escolhas: () => Object.assign(base(), escolhas || {}),
      registra: grava,
      tudo: () => grava(cats().reduce((o, c) => (o[c.id] = true, o), {})),
      nada: () => grava({}),
      /* Executa agora se a categoria já estiver liberada, senão guarda para
         quando estiver. É o que permite escrever o Pixel sem saber se o
         visitante é novo — e sem o Pixel conhecer o banner. */
      ao: (categoria, fn) => {
        if (permitido(categoria)) fn(); else inscritos.push({ categoria, fn });
      }
    };
  })();
  window.Consentimento = Consentimento;

  /* Painel de preferências. Aberto pelo banner e também pelo link do rodapé, que
     é como alguém volta atrás depois de ter decidido — exigência da LGPD: a
     escolha tem de ser revogável com a mesma facilidade com que foi dada. */
  /* `aoDecidir` só é chamado quando SAI uma decisão — salvar ou recusar. Fechar
     no X, no Esc ou no véu não decide nada, e é justamente por isso que o aviso
     que abriu este painel continua de pé atrás dele: sem decisão, o visitante
     volta para onde estava em vez de ficar sem nenhuma das duas coisas. */
  function abrePainelCookies(aoDecidir) {
    const cfg = C.consentimento;
    if (!cfg || $('.prefs')) return;
    const atual = Consentimento.escolhas();

    const painel = document.createElement('div');
    painel.className = 'prefs';
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-modal', 'true');
    painel.setAttribute('aria-label', cfg.tituloPainel || 'Preferências de cookies');
    painel.innerHTML = `
      <div class="prefs__caixa">
        <button class="prefs__fechar" type="button" aria-label="Fechar">&times;</button>
        <h2>${esc(cfg.tituloPainel || 'Preferências de cookies')}</h2>
        <p class="prefs__intro">${esc(cfg.introPainel || '')}${cfg.politica
          ? ` <a href="${esc(cfg.politica)}" target="_blank" rel="noopener">Política de privacidade</a>` : ''}</p>
        <ul class="prefs__lista">
          ${(cfg.categorias || []).map((c) => `
            <li>
              <label class="prefs__chave">
                <input type="checkbox" data-cat="${esc(c.id)}"
                  ${atual[c.id] ? 'checked' : ''} ${c.fixo ? 'disabled' : ''}>
                <i aria-hidden="true"></i>
              </label>
              <div>
                <strong>${esc(c.nome)}${c.fixo ? ' <small>sempre ativos</small>' : ''}</strong>
                <span>${esc(c.desc)}</span>
              </div>
            </li>`).join('')}
        </ul>
        <div class="prefs__acoes">
          <button class="liquid-button liquid-button-dark" type="button" data-prefs="nada">${esc(cfg.recusar)}</button>
          <button class="liquid-button liquid-button-gold" type="button" data-prefs="salvar">${esc(cfg.salvar || 'Salvar')}</button>
        </div>
      </div>`;

    const fecha = () => {
      painel.remove();
      document.body.classList.remove('menu-open');
      document.removeEventListener('keydown', tecla);
    };
    const tecla = (e) => { if (e.key === 'Escape') fecha(); };

    const decide = (registra) => { registra(); if (aoDecidir) aoDecidir(); fecha(); };
    $('[data-prefs="salvar"]', painel).addEventListener('click', () => decide(() => {
      const escolha = {};
      $$('input[data-cat]', painel).forEach((i) => { escolha[i.dataset.cat] = i.checked; });
      Consentimento.registra(escolha);
    }));
    $('[data-prefs="nada"]', painel).addEventListener('click', () => decide(() => Consentimento.nada()));
    $('.prefs__fechar', painel).addEventListener('click', fecha);
    // Clique no véu fecha; dentro da caixa, não.
    painel.addEventListener('click', (e) => { if (e.target === painel) fecha(); });
    document.addEventListener('keydown', tecla);

    document.body.appendChild(painel);
    document.body.classList.add('menu-open');       // trava o scroll do fundo
    requestAnimationFrame(() => painel.classList.add('is-visivel'));
    $('.prefs__fechar', painel).focus();
  }
  window.abrePainelCookies = abrePainelCookies;

  function setupConsentimento() {
    const cfg = C.consentimento;
    if (!cfg || Consentimento.decidido()) return;   // já decidiu: não pergunta de novo

    const caixa = document.createElement('aside');
    caixa.className = 'consent';
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-label', 'Aviso de cookies');
    caixa.innerHTML = `
      <!-- A mordida sao duas conchas cavadas na borda, nao um arco liso: liso
           lia como lua minguante. As gotas sao VAZADOS (evenodd), entao o fundo
           aparece por elas — pintar de cor escura viraria remendo sobre o
           degrade da caixa. -->
      <svg class="consent__icone" viewBox="0 0 24 24" aria-hidden="true">
        <path fill-rule="evenodd" d="M14.7 2.5A9.6 9.6 0 1 0 21.5 11.5 3.05 3.05 0 0 1 17.6 8.1 3.15 3.15 0 0 1 14.7 2.5ZM9.1 9.3a1.55 1.55 0 1 0 0 3.1 1.55 1.55 0 0 0 0-3.1ZM14.8 14.3a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9ZM8.3 15.7a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5ZM12.6 6.4a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3ZM17.9 13.1a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z"/>
      </svg>
      <div class="consent__corpo">
        ${cfg.titulo ? `<p class="consent__titulo">${esc(cfg.titulo)}</p>` : ''}
        <p class="consent__texto">${esc(cfg.texto)}${cfg.politica
          ? ` <a href="${esc(cfg.politica)}" target="_blank" rel="noopener">Política de privacidade</a>` : ''}</p>
      </div>
      <!-- Uma acao em destaque na primeira tela; a recusa mora no painel, a um
           clique de "Personalizar". Decisao do cliente, tomada com a ressalva
           registrada: e o padrao do mercado brasileiro, e e tambem o desenho que
           autoridades europeias ja multaram. Para voltar ao par visivel, basta
           reintroduzir aqui um botao com data-consent="nada". -->
      <div class="consent__acoes">
        <button class="consent__link" type="button" data-consent="personalizar">${esc(cfg.personalizar || 'Personalizar')}</button>
        <button class="liquid-button liquid-button-gold" type="button" data-consent="tudo">${esc(cfg.aceitar)}</button>
      </div>`;

    const some = () => {
      caixa.classList.remove('is-visivel');
      caixa.addEventListener('transitionend', () => caixa.remove(), { once: true });
      setTimeout(() => caixa.remove(), 600);   // rede de segurança se a transição não correr
    };
    $$('[data-consent]', caixa).forEach((b) => b.addEventListener('click', () => {
      const acao = b.dataset.consent;
      // O aviso NÃO some aqui: fica atrás do painel e só sai quando houver
      // decisão. Fechar o painel no X devolve a pessoa ao aviso.
      if (acao === 'personalizar') { abrePainelCookies(some); return; }
      Consentimento[acao]();          // `tudo` ou `nada`
      some();
    }));

    document.body.appendChild(caixa);
    /* Espera a cortina sair. Aparecer por cima do preloader seria pedir decisão
       antes de a pessoa ver o que é a página. */
    const mostra = () => requestAnimationFrame(() => caixa.classList.add('is-visivel'));
    if ($('[data-preloader]')) {
      const espia = new MutationObserver(() => {
        if (!$('[data-preloader]')) { espia.disconnect(); mostra(); }
      });
      espia.observe(document.body, { childList: true });
    } else mostra();
  }

  function init() {
    if (!C) { console.error('config.js não carregou.'); return; }
    render();
    setupMotionText();
    applyLinks();
    setupMenu();
    setupHeader();
    setupActiveNavigation();
    setupStickyWhatsApp();
    setupHeroLivro();
    setupPreloader();
    setupShowcase();
    setupTestimonialLightbox();
    setupLiquidControls();
    setupMotion();
    setupConsentimento();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
