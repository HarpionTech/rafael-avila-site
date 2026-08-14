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
            <p class="glass-label">Método 3A · atendimento individual</p>
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
          </div>

          <div class="showcase__panel glass-panel" data-showcase-panel aria-live="polite">
            ${data.itens.map((book, i) => `
              <article class="showcase__card${i === 0 ? ' is-active' : ''}" data-showcase-card="${i}">
                <h3>${esc(book.titulo)}</h3>
                <p>${esc(book.descricao)}</p>
                <ul>${book.detalhes.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
                ${book.disponivel ? `
                  <div class="book-offer"><a class="liquid-button liquid-button-bronze" href="${esc(hotmartLink(book.link))}" target="_blank" rel="noopener">Ver detalhes <span aria-hidden="true">↗</span></a></div>` : `
                  <button class="liquid-button liquid-button-light is-disabled" type="button" disabled>Em breve</button>`}
              </article>`).join('')}
          </div>

          <div class="showcase__nav">
            <button class="showcase__arrow liquid-control" type="button" data-showcase-prev aria-label="Publicação anterior">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 8 12l6.5 7"/></svg>
            </button>

            <div class="showcase__pager">
              <span class="showcase__conta"><b data-showcase-atual>01</b><i aria-hidden="true">/</i><em>${String(data.itens.length).padStart(2, '0')}</em></span>
              <ol class="showcase__trilha">
                ${data.itens.map((book, i) => `
                  <li><button type="button" data-showcase-ir="${i}" aria-label="Ver ${esc(book.titulo)}"><span></span></button></li>`).join('')}
              </ol>
            </div>

            <button class="showcase__arrow liquid-control" type="button" data-showcase-next aria-label="Próxima publicação">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5 16 12l-6.5 7"/></svg>
            </button>

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

    rodape: (data) => `
      <div class="container footer-inner">
        <div><strong>${esc(C.marca.nome)}</strong><span>${esc(C.marca.titulo)}</span></div>
        <nav aria-label="Contatos no rodapé"><a data-wa href="#">WhatsApp</a><a href="${esc(C.marca.instagram)}" target="_blank" rel="noopener">Instagram</a></nav>
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
  const BRAIN_FOCUS = { thought: [-.5, -.28], emotion: [-.2, .32], action: [.52, -.3] };

  function setupBrain() {
    const stage = $('[data-brain-stage]');
    const canvas = $('[data-brain-gl]', stage);
    const insight = $('.brain-insight');
    if (!stage || !insight) return;
    // Nuvem de pontos em WebGL; o render do Blender fica como pôster de fallback.
    const particleBrain = canvas
      ? window.Brain3D?.init({ canvas, stage, fallback: $('.brain-render', stage) })
      : null;
    const nodes = $$('.brain-node', stage);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    let pinnedNode = null;
    let currentNode = null;
    let hideTimer = 0;
    const content = {
      thought: { index: '01 · Pensamentos', title: 'O padrão começa antes da ação.', copy: 'Nomear a interpretação muda a forma de responder ao que acontece.' },
      emotion: { index: '02 · Emoções', title: 'Sentir também informa.', copy: 'Emoções deixam de ser ruído quando são lidas dentro do contexto.' },
      action: { index: '03 · Comportamentos', title: 'Compreender precisa virar movimento.', copy: 'Mudança sustentável aparece naquilo que pode ser praticado no cotidiano.' }
    };

    const updateContent = (mode) => {
      const data = content[mode];
      if (!data) return;
      $('[data-brain-index]', insight).textContent = data.index;
      $('[data-brain-title]', insight).textContent = data.title;
      $('[data-brain-copy]', insight).textContent = data.copy;
    };

    const positionInsight = (node) => {
      if (!finePointer || innerWidth < 760) return;
      const stageRect = stage.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const cardWidth = Math.min(330, stageRect.width * .54);
      const cardHeight = insight.offsetHeight || 168;
      let left = nodeRect.right - stageRect.left + 22;
      let top = nodeRect.bottom - stageRect.top + 18;
      let originX = '0%';
      let originY = '0%';

      if (left + cardWidth > stageRect.width - 8) {
        left = nodeRect.left - stageRect.left - cardWidth - 22;
        originX = '100%';
      }
      if (top + cardHeight > stageRect.height - 8) {
        top = nodeRect.top - stageRect.top - cardHeight - 18;
        originY = '100%';
      }

      left = Math.max(8, Math.min(left, stageRect.width - cardWidth - 8));
      top = Math.max(8, Math.min(top, stageRect.height - cardHeight - 8));
      insight.style.setProperty('--insight-left', `${left}px`);
      insight.style.setProperty('--insight-top', `${top}px`);
      insight.style.setProperty('--insight-origin-x', originX);
      insight.style.setProperty('--insight-origin-y', originY);
    };

    const selectNode = (node) => {
      nodes.forEach((item) => {
        const selected = item === node;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
    };

    const reveal = (mode, node, pulse = true) => {
      const data = content[mode];
      if (!data) return;
      clearTimeout(hideTimer);
      currentNode = node;
      updateContent(mode);
      selectNode(node);
      stage.dataset.brainState = mode;
      if (pulse) particleBrain?.focus(...(BRAIN_FOCUS[mode] || [0, 0]));
      positionInsight(node);
      insight.classList.add('is-visible');
      insight.setAttribute('aria-hidden', 'false');

      if (window.gsap && !reduce) {
        window.gsap.killTweensOf(insight);
        window.gsap.fromTo(insight,
          { autoAlpha: 0, y: 14, scale: .94, filter: 'blur(8px)' },
          { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: .32, ease: 'power3.out', overwrite: 'auto' }
        );
      } else {
        insight.style.opacity = '1';
        insight.style.visibility = 'visible';
        insight.style.transform = 'none';
      }
    };

    const conceal = (force = false) => {
      if (pinnedNode && !force) return;
      clearTimeout(hideTimer);
      currentNode = null;
      selectNode(null);
      stage.dataset.brainState = 'idle';
      particleBrain?.focus(0, 0);
      const complete = () => {
        insight.classList.remove('is-visible');
        insight.setAttribute('aria-hidden', 'true');
      };
      if (window.gsap && !reduce) {
        window.gsap.killTweensOf(insight);
        window.gsap.to(insight, { autoAlpha: 0, y: 7, scale: .97, filter: 'blur(5px)', duration: .18, ease: 'power2.in', overwrite: 'auto', onComplete: complete });
      } else {
        insight.style.opacity = '0';
        insight.style.visibility = 'hidden';
        complete();
      }
    };

    const restorePinnedOrHide = (node) => {
      hideTimer = setTimeout(() => {
        if (currentNode !== node) return;
        if (pinnedNode && pinnedNode !== node) reveal(pinnedNode.dataset.brainMode, pinnedNode, false);
        else if (!pinnedNode) conceal();
      }, 36);
    };

    nodes.forEach((node) => {
      const mode = node.dataset.brainMode;
      node.addEventListener('pointerenter', () => {
        if (finePointer) reveal(mode, node);
      });
      node.addEventListener('pointerleave', () => {
        if (finePointer && pinnedNode !== node) restorePinnedOrHide(node);
      });
      node.addEventListener('focus', () => reveal(mode, node));
      node.addEventListener('blur', () => {
        if (pinnedNode !== node) restorePinnedOrHide(node);
      });
      node.addEventListener('click', () => {
        if (pinnedNode === node) {
          pinnedNode = null;
          conceal(true);
          return;
        }
        pinnedNode = node;
        reveal(mode, node);
      });
    });

    stage.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      pinnedNode = null;
      conceal(true);
    });
    addEventListener('resize', () => {
      if (currentNode) positionInsight(currentNode);
    }, { passive: true });
  }

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
    const pinta = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      pintaFundo(capaCarregada);

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
      const vaoFim = (wSelo ? xSelo : alt / 2 - folga) - corpo * 1.1;
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

    /* Um renderer por livro. Quatro contextos WebGL cabem folgados no limite do
       navegador (16), e cada um desenha sob demanda — em repouso nenhum deles
       tem loop rodando. */
    if (window.Book3D) {
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
    }

    show(0);

    /* Fica pendurado para o ScrollTrigger chamar quando a seção entra na tela.
       Só o livro da frente se apresenta: os outros estão invisíveis, e girá-los
       seria gastar GPU em quatro cenas que ninguém vê. */
    entradaVitrine = () => { if (books[index]) books[index].entrada(); };
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
      .fromTo('.brain-node', { autoAlpha: 0, scale: .2 }, { autoAlpha: 1, scale: 1, duration: .46, stagger: .1, ease: 'back.out(2)', clearProps: 'opacity,visibility,transform' }, .62)
      .from('.brain-hint', { opacity: 0, x: 34, duration: .5 }, .7);

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

    gsap.from('.about-intro .kicker, .about-intro > p', ent({ opacity: 0, x: -44, duration: .55, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '.about-section', start: 'top 78%', once: true } }));
    gsap.fromTo('.about-portrait', { opacity: 0, scale: 1.08, clipPath: 'inset(10% 14% 8% 4% round 3rem)' }, { opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0% round 1.5rem)', duration: 1.05, ease: 'power4.out', clearProps: 'opacity,transform,clipPath', scrollTrigger: { trigger: '.about-grid', start: 'top 74%', once: true } });
    gsap.from('[data-about-card]', ent({ opacity: 0, x: 120, y: 50, rotation: 3, scale: .96, duration: .92, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.about-grid', start: 'top 68%', once: true, fastScrollEnd: true } }));
    gsap.from('.about-stats > div', { opacity: 0, y: 18, duration: .42, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: '[data-about-card]', start: 'top 78%', once: true } });

    gsap.from('.method-visual', ent({ opacity: 0, x: -110, rotation: -3, scale: .92, duration: .9, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.method-layout', start: 'top 76%', once: true } }));
    gsap.to('.method-visual img', { yPercent: -7, ease: 'none', scrollTrigger: { trigger: '.method-layout', start: 'top bottom', end: 'bottom top', scrub: .65 } });
    gsap.from('.life-areas li', { opacity: 0, y: 16, duration: .5, stagger: .07, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.life-areas', start: 'top 82%', once: true } });
    // A régua de cada item é traçada da esquerda para a direita: é o item que
    // "assina" a própria linha, em vez de tudo aparecer inteiro de uma vez.
    gsap.from('.life-areas__regua', { scaleX: 0, duration: .7, stagger: .07, ease: 'power3.inOut', clearProps: 'transform', scrollTrigger: { trigger: '.life-areas', start: 'top 82%', once: true } });
    gsap.from('.method-closing', { opacity: 0, y: 18, duration: .6, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.method-closing', start: 'top 88%', once: true } });
    gsap.from('.method-approach p', ent({ opacity: 0, y: 26, duration: .68, stagger: .12, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.method-approach', start: 'top 84%', once: true } }));
    gsap.fromTo('.method-invite', { opacity: 0, y: 30, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .75, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.method-invite', start: 'top 88%', once: true } });

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
    gsap.from('.showcase__panel', ent({ opacity: 0, x: 90, y: 24, duration: .85, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.showcase', start: 'top 72%', once: true } }));
    gsap.from('.showcase__nav', { opacity: 0, y: 22, duration: .6, ease: 'power3.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.showcase', start: 'top 62%', once: true } });


    /* Grade, nao mais faixa: deslizar 240px na horizontal jogava os cards
       para fora da coluna. Sobe curto, com cascata. */
    gsap.from('.testimonial-card', ent({ opacity: 0, y: 40, scale: .96, duration: .68, stagger: .07, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.testimonial-grid', start: 'top 84%', once: true, fastScrollEnd: true } }));
    gsap.from('.contact-copy .kicker, .contact-copy > p:last-child', ent({ opacity: 0, x: -54, duration: .55, stagger: .1, ease: 'power3.out', scrollTrigger: { trigger: '.contact-section', start: 'top 76%', once: true } }));
    gsap.from('.contact-channel', ent({ opacity: 0, x: 120, y: 34, rotation: 2, duration: .7, stagger: .12, ease: 'power4.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.contact-channels', start: 'top 84%', once: true, fastScrollEnd: true } }));
    addEventListener('load', () => window.ScrollTrigger.refresh(), { once: true });
  }

  /* Preloader: a cortina sobe levando o cérebro junto, e ele cai na posição da
     hero. O cérebro é o MESMO elemento nas duas pontas — o que muda é onde ele
     está desenhado, não qual objeto é.

     A técnica é FLIP: mede-se antes a caixa natural dele na hero, prende-se em
     `position: fixed` nessa mesma caixa e usa-se `transform` para levá-lo até o
     centro da cortina. Animar de volta para transform zero devolve a posição
     exata do layout, sem número mágico e sem depender do tamanho da tela. */
  function setupPreloader() {
    const cortina = $('[data-preloader]');
    if (!cortina) return;
    const shell = $('.brain-canvas-shell');
    const canvas = $('[data-brain-gl]');
    const marca = $('.preloader__marca', cortina);
    if (!shell) { cortina.remove(); return; }

    document.body.classList.add('esta-carregando');
    scrollTo(0, 0);

    const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const caixa = shell.getBoundingClientRect();
    /* Sem movimento não há o que coreografar: a cortina só some e a hero entra.
       Vale também quando o cérebro não tem caixa — aí a escala daria Infinity e
       o FLIP quebraria. */
    if (reduzido || !caixa.width || !caixa.height) {
      cortina.remove();
      document.body.classList.remove('esta-carregando');
      if (introHero) introHero.play();
      return;
    }
    const alvo = Math.min(innerHeight * 0.46, 400);
    const escala = alvo / Math.max(1, caixa.width);
    const dx = innerWidth / 2 - (caixa.left + caixa.width / 2);
    // Um pouco acima do meio: é onde o texto embaixo tem ar para respirar.
    const dy = innerHeight * 0.42 - (caixa.top + caixa.height / 2);

    /* O cérebro sai da árvore da hero e passa a pendurar direto no body.
       `z-index` sozinho não resolveria: `.brain-stage` tem `isolation: isolate` e
       `.hero-grid` tem `z-index: 2`, e cada um cria um contexto de empilhamento —
       lá dentro o cérebro pode pedir 320 que ainda assim fica atrás da cortina.
       Mover um <canvas> no DOM não perde o contexto WebGL nem o que ele desenhou.
       Vai para o BODY, e não para dentro da cortina: a cortina é animada, e como
       filho dele o cérebro herdaria esse transform no meio da queda. */
    const ninho = shell.parentNode;
    const irmao = shell.nextSibling;
    shell.classList.add('no-preloader');
    shell.style.cssText += `position:fixed;left:${caixa.left}px;top:${caixa.top}px;`
      + `width:${caixa.width}px;height:${caixa.height}px;margin:0;transform:none;`;
    document.body.appendChild(shell);

    const solta = () => {
      shell.classList.remove('no-preloader');
      shell.style.cssText = '';
      ninho.insertBefore(shell, irmao);      // de volta ao lugar de origem
      document.body.classList.remove('esta-carregando');
      cortina.remove();
    };

    if (!window.gsap || reduzido) {
      shell.style.transform = `translate(${dx}px, ${dy}px) scale(${escala})`;
    } else {
      window.gsap.set(shell, { x: dx, y: dy, scale: escala });
    }

    let saiu = false;
    const sair = () => {
      if (saiu) return;
      saiu = true;

      if (!window.gsap || reduzido) {
        cortina.style.opacity = '0';
        setTimeout(solta, 320);
        return;
      }

      const tl = window.gsap.timeline({ onComplete: solta });
      tl.to(marca, { opacity: 0, y: -14, duration: .38, ease: 'power2.in' })
        // A hero entra junto com a cortina subindo, não depois dela sair.
        .add(() => { if (introHero) introHero.play(); }, .35)
        // Sobe levando a cortina junto: os dois partem no mesmo instante, e é
        // isso que dá a leitura de que o cérebro é quem puxa a transição.
        .to(shell, { y: dy - innerHeight * 0.16, duration: .8, ease: 'power2.out' }, 0)
        .to(cortina, { yPercent: -100, duration: .95, ease: 'power3.inOut' }, .18)
        // Queda com ease de ENTRADA: acelerando, que é como cai o que tem peso.
        .to(shell, { x: 0, y: 0, scale: 1, duration: .78, ease: 'power2.in' }, .62)
        // Impacto: achata e volta. Sem isto a queda para seca e denuncia que é
        // interpolação, não massa.
        .to(shell, { scaleX: 1.05, scaleY: .95, duration: .12, ease: 'power2.out' })
        .to(shell, { scaleX: 1, scaleY: 1, duration: .55, ease: 'elastic.out(1, .45)' });
    };

    /* Quem manda é o cérebro, o asset mais pesado; o teto evita a página presa se
       algo falhar. O piso deixou de ser só anti-flash: 4s é tempo de leitura, o
       bastante para o "Bem-vindo" ser lido antes de a cortina subir. Vale
       lembrar que ele é PISO, não espera fixa — numa visita com tudo em cache o
       cérebro fica pronto em milissegundos e a cortina segura assim mesmo. */
    const piso = new Promise((r) => setTimeout(r, 4000));
    const cerebro = new Promise((r) => {
      if (!canvas || canvas.classList.contains('is-ready')) { r(); return; }
      canvas.addEventListener('cerebro:pronto', r, { once: true });
    });
    const teto = new Promise((r) => setTimeout(r, 7000));
    Promise.all([piso, Promise.race([cerebro, teto])]).then(sair);
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
    setupBrain();
    setupPreloader();
    setupShowcase();
    setupTestimonialLightbox();
    setupLiquidControls();
    setupMotion();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
