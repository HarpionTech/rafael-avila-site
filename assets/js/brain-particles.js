/* Sinapses Vivas — cérebro pontilhista generativo, sem tracking ou dependências externas. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  /* Champanhe -> dourado -> dourado profundo -> branco quente. O tom segue a
     estrutura (relevo, luz, regiao), nunca sorteio. */
  const PALETTE = [
    [226, 200, 143],
    [200, 169, 106],
    [140, 113, 62],
    [246, 242, 234]
  ];
  /* Regiões na vista lateral: frontal (pensar), temporal (sentir), motora (agir). */
  const REGIONS = {
    thought: [-0.52, -0.30],
    emotion: [-0.18, 0.28],
    action: [0.02, -0.52]
  };

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let next = value;
      next = Math.imul(next ^ (next >>> 15), next | 1);
      next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  }

  /* Silhueta lateral do encéfalo em coordenadas normalizadas (-1..1), traçada por
     âncoras e suavizada por Catmull-Rom. Frontal à esquerda, occipital à direita,
     cerebelo embaixo à direita, tronco descendo ao centro. */
  const OUTLINE = [
    [-0.80, -0.02], [-0.78, -0.26], [-0.68, -0.48], [-0.50, -0.63],
    [-0.28, -0.71], [-0.04, -0.72], [0.20, -0.66], [0.42, -0.53],
    [0.60, -0.34], [0.71, -0.12], [0.72, 0.06],
    [0.66, 0.20], [0.56, 0.30], [0.42, 0.36], [0.30, 0.34],
    [0.22, 0.44], [0.17, 0.62], [0.12, 0.80], [0.00, 0.84],
    [-0.05, 0.66], [-0.04, 0.48],
    [-0.12, 0.44], [-0.26, 0.46], [-0.42, 0.42], [-0.56, 0.32],
    [-0.68, 0.20], [-0.77, 0.10]
  ];
  const SYLVIAN = [[-0.62, 0.14], [-0.40, 0.12], [-0.16, 0.06], [0.08, -0.02], [0.30, -0.06]];
  const CENTRAL = [[-0.04, -0.70], [-0.10, -0.42], [-0.16, -0.16], [-0.20, 0.02]];
  const TENTORIUM = [[0.24, 0.28], [0.42, 0.20], [0.60, 0.14], [0.72, 0.05]];
  const MASK_SIZE = 320;
  const FOCUS = [-0.16, 0.06];

  let MASK = null;

  /* Catmull-Rom convertido em bézier cúbica: passa por todas as âncoras. */
  function splineTo(ctx, points, closed, tx, ty) {
    const total = points.length;
    const at = (index) => (closed
      ? points[((index % total) + total) % total]
      : points[Math.max(0, Math.min(total - 1, index))]);

    ctx.moveTo(tx(points[0][0]), ty(points[0][1]));
    const segments = closed ? total : total - 1;
    for (let i = 0; i < segments; i += 1) {
      const p0 = at(i - 1);
      const p1 = at(i);
      const p2 = at(i + 1);
      const p3 = at(i + 2);
      ctx.bezierCurveTo(
        tx(p1[0] + (p2[0] - p0[0]) / 6), ty(p1[1] + (p2[1] - p0[1]) / 6),
        tx(p2[0] - (p3[0] - p1[0]) / 6), ty(p2[1] - (p3[1] - p1[1]) / 6),
        tx(p2[0]), ty(p2[1])
      );
    }
    if (closed) ctx.closePath();
  }

  /* Rasteriza a máscara UMA vez. Nada é carregado de fora e nada disso vai para a
     tela: a máscara existe só como campo de amostragem para a rejeição. */
  function buildMask(random) {
    const canvas = document.createElement('canvas');
    canvas.width = MASK_SIZE;
    canvas.height = MASK_SIZE;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const tx = (nx) => (nx + 1) * 0.5 * MASK_SIZE;
    const ty = (ny) => (ny + 1) * 0.5 * MASK_SIZE;
    const unit = MASK_SIZE;

    g.fillStyle = '#fff';
    g.beginPath();
    splineTo(g, OUTLINE, true, tx, ty);
    g.fill();

    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    g.lineJoin = 'round';

    const stroke = (points, width) => {
      g.lineWidth = width * unit;
      g.beginPath();
      splineTo(g, points, false, tx, ty);
      g.stroke();
    };

    /* Giros corticais: arcos ABERTOS, com centro e raio jitterados. Anéis fechados
       concêntricos leem como tronco de árvore — o que faz parecer córtex é a
       irregularidade, não a simetria. */
    for (let i = 0; i < 24; i += 1) {
      const radius = 0.3 + random() * 0.62;
      const cx = FOCUS[0] + (random() - 0.5) * 0.26;
      const cy = FOCUS[1] + (random() - 0.5) * 0.22;
      const span = 0.5 + random() * 0.85;
      const start = random() * TAU;
      const wobble = 0.012 + random() * 0.026;
      const frequency = 2 + Math.floor(random() * 5);
      const phase = random() * TAU;
      const steps = 22;
      const points = [];
      for (let step = 0; step <= steps; step += 1) {
        const angle = start + ((step / steps) * Math.PI * span);
        const r = radius + Math.sin((angle * frequency) + phase) * wobble;
        points.push([cx + Math.cos(angle) * r * 1.24, cy + Math.sin(angle) * r]);
      }
      stroke(points, 0.004 + random() * 0.0045);
    }

    stroke(SYLVIAN, 0.016);
    stroke(CENTRAL, 0.01);
    stroke(TENTORIUM, 0.016);

    /* Folia do cerebelo: estrias finas e paralelas, a assinatura visual dele. */
    for (let i = 0; i < 7; i += 1) {
      const y = 0.17 + (i / 6) * 0.19;
      stroke([[0.27, y + 0.06], [0.41, y + 0.01], [0.55, y - 0.02], [0.67, y - 0.07]], 0.005);
    }

    const pixels = g.getImageData(0, 0, MASK_SIZE, MASK_SIZE).data;
    const field = new Float32Array(MASK_SIZE * MASK_SIZE);
    for (let i = 0; i < field.length; i += 1) field[i] = pixels[(i * 4) + 3] / 255;
    return field;
  }

  function maskAt(nx, ny) {
    const px = Math.round((nx + 1) * 0.5 * MASK_SIZE);
    const py = Math.round((ny + 1) * 0.5 * MASK_SIZE);
    if (px < 0 || py < 0 || px >= MASK_SIZE || py >= MASK_SIZE) return 0;
    return MASK[(py * MASK_SIZE) + px];
  }

  /* Cobertura local: 1 no miolo, cai perto da borda e dos sulcos. É o que dá relevo
     — substitui o campo de distância fabricado por senoides da versão anterior. */
  function coverage(nx, ny) {
    const step = 7 / MASK_SIZE;
    return (maskAt(nx, ny) * 0.36)
      + ((maskAt(nx + step, ny) + maskAt(nx - step, ny)
        + maskAt(nx, ny + step) + maskAt(nx, ny - step)) * 0.16);
  }

  class ParticleBrain {
    constructor(canvas, stage) {
      this.canvas = canvas;
      this.stage = stage;
      this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
      this.particles = [];
      this.edges = [];
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.running = false;
      this.visible = true;
      this.frame = 0;
      this.startTime = performance.now();
      this.lastTime = this.startTime;
      this.focusMode = null;
      this.pulseStarted = -Infinity;
      this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.pointer = { x: -9999, y: -9999, active: false };
      this.boundTick = (time) => this.tick(time);
      this.resizeTimer = 0;

      this.bind();
      this.resize();
      if (this.reduceMotion) this.render(performance.now(), 1);
      else this.start();
    }

    bind() {
      const move = (event) => {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = event.clientX - rect.left;
        this.pointer.y = event.clientY - rect.top;
        this.pointer.active = true;
        this.stage.style.setProperty('--pointer-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
        this.stage.style.setProperty('--pointer-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
      };
      this.stage.addEventListener('pointermove', move, { passive: true });
      this.stage.addEventListener('pointerleave', () => { this.pointer.active = false; }, { passive: true });
      this.stage.addEventListener('pointerdown', (event) => {
        move(event);
        this.pulseStarted = performance.now();
        this.disturb(this.pointer.x, this.pointer.y, 1.35);
      }, { passive: true });

      if ('ResizeObserver' in window) {
        this.resizeObserver = new ResizeObserver(() => {
          clearTimeout(this.resizeTimer);
          this.resizeTimer = setTimeout(() => this.resize(), 80);
        });
        this.resizeObserver.observe(this.canvas);
      } else addEventListener('resize', () => this.resize(), { passive: true });

      if ('IntersectionObserver' in window) {
        this.visibilityObserver = new IntersectionObserver(([entry]) => {
          this.visible = entry.isIntersecting;
          if (this.visible) this.start();
          else this.stop();
        }, { rootMargin: '120px 0px' });
        this.visibilityObserver.observe(this.stage);
      }
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stop();
        else if (this.visible) this.start();
      });
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const nextWidth = Math.max(280, Math.round(rect.width));
      const nextHeight = Math.max(360, Math.round(rect.height));
      if (nextWidth === this.width && nextHeight === this.height && this.particles.length) return;

      this.width = nextWidth;
      this.height = nextHeight;
      this.dpr = Math.min(devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.generate();
      if (this.reduceMotion) this.render(performance.now(), 1);
    }

    density() {
      if (this.reduceMotion) return this.width < 520 ? 1800 : 3200;
      if (this.width < 420) return 2400;
      if (this.width < 680) return 4200;
      return 6800;
    }

    mapPoint(nx, ny) {
      const scaleX = this.width * 0.42;
      const scaleY = this.height * 0.40;
      return {
        x: (this.width * 0.49) + (nx * scaleX),
        y: (this.height * 0.42) + (ny * scaleY)
      };
    }

    generate() {
      if (!MASK) MASK = buildMask(seededRandom(90811));
      const random = seededRandom(27081990);
      const total = this.density();
      const particles = [];
      let attempts = 0;

      while (particles.length < total && attempts < total * 42) {
        attempts += 1;
        const nx = (random() * 2) - 1;
        const ny = (random() * 1.9) - 0.95;

        /* Rejeição contra a máscara: a borda parcial vira densidade menor, o que
           suaviza o contorno em vez de recortá-lo. */
        const solid = maskAt(nx, ny);
        if (solid < 0.5 || random() > solid) continue;

        const volume = coverage(nx, ny);
        const relief = clamp(1 - (volume / 0.98));
        const base = this.mapPoint(nx, ny);
        const angle = random() * TAU;
        const scatter = (0.32 + random() * 0.9) * Math.max(this.width, this.height);
        const depth = random();

        /* Luz vinda de cima e da frente; o relevo dos sulcos escurece o vale. O
           gradiente vertical precisa ser largo, senão o tom de sombra nunca entra. */
        const light = clamp(0.06 + (volume * 0.46) - (relief * 0.28) - (ny * 0.34) - (nx * 0.06));

        /* Tom segue a estrutura, nunca um sorteio: era isso que fazia a versão
           anterior ler como confete em vez de tecido. */
        const sentinel = relief > 0.42 && light > 0.58 && random() > 0.9;
        let tone = 0;
        if (sentinel) tone = 3;
        else if (relief > 0.3) tone = 1;
        else if (light < 0.36) tone = 2;

        particles.push({
          bx: base.x,
          by: base.y,
          nx,
          ny,
          x: base.x + Math.cos(angle) * scatter,
          y: base.y + Math.sin(angle) * scatter,
          vx: 0,
          vy: 0,
          size: 0.5 + (depth * 0.5) + (volume * 0.7) + (sentinel ? 0.85 : 0),
          alpha: 0.26 + (depth * 0.2) + (light * 0.4),
          depth: 0.4 + depth * 0.9,
          light,
          relief,
          sentinel,
          phase: random() * TAU,
          frequency: 0.65 + random() * 0.75,
          tone
        });
      }

      this.particles = particles;
      this.edges = this.buildEdges(random);
      this.startTime = performance.now();
      this.pulseStarted = -Infinity;
    }

    buildEdges(random) {
      const edges = [];
      const stride = Math.max(12, Math.floor(this.particles.length / 118));
      for (let index = 0; index < this.particles.length; index += stride) {
        const source = this.particles[index];
        let nearest = -1;
        let nearestDistance = Infinity;
        for (let sample = 0; sample < 46; sample += 1) {
          const candidateIndex = Math.floor(random() * this.particles.length);
          if (candidateIndex === index) continue;
          const target = this.particles[candidateIndex];
          const dx = source.bx - target.bx;
          const dy = source.by - target.by;
          const distance = (dx * dx) + (dy * dy);
          if (distance < nearestDistance && distance < Math.pow(this.width * 0.115, 2)) {
            nearestDistance = distance;
            nearest = candidateIndex;
          }
        }
        if (nearest >= 0) edges.push([index, nearest, random() * TAU]);
      }
      return edges;
    }

    regionPoint(mode = this.focusMode) {
      const region = REGIONS[mode];
      if (!region) return null;
      return this.mapPoint(region[0], region[1]);
    }

    disturb(x, y, multiplier) {
      const radius = Math.min(this.width, this.height) * 0.24;
      this.particles.forEach((particle) => {
        const dx = particle.x - x;
        const dy = particle.y - y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance >= radius) return;
        const force = Math.pow(1 - distance / radius, 2) * multiplier;
        particle.vx += ((dx / distance) * 10 - (dy / distance) * 2.6) * force;
        particle.vy += ((dy / distance) * 10 + (dx / distance) * 2.6) * force;
      });
    }

    setFocus(mode) {
      if (!REGIONS[mode]) {
        this.focusMode = null;
        this.pulseStarted = -Infinity;
        if (this.reduceMotion) this.render(performance.now(), 1);
        return;
      }
      this.focusMode = mode;
      this.pulseStarted = performance.now();
      const point = this.regionPoint(mode);
      this.disturb(point.x, point.y, 0.7);
      if (this.reduceMotion) this.render(performance.now(), 1);
      else this.start();
    }

    start() {
      if (this.running || this.reduceMotion || document.hidden || !this.visible) return;
      this.running = true;
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame(this.boundTick);
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.frame);
    }

    tick(time) {
      if (!this.running) return;
      const delta = Math.min((time - this.lastTime) / 16.667, 2);
      this.lastTime = time;
      this.render(time, delta);
      this.frame = requestAnimationFrame(this.boundTick);
    }

    render(time, delta) {
      const ctx = this.ctx;
      const seconds = time * 0.001;
      const elapsed = Math.max(0, time - this.startTime);
      const formation = this.reduceMotion ? 1 : 1 - Math.exp(-elapsed * 0.0032);
      const breath = 1 + Math.sin(seconds * 1.15) * 0.018;
      const centerX = this.width * 0.49;
      const centerY = this.height * 0.42;
      const pointerRadius = Math.min(this.width, this.height) * 0.18;
      const focus = this.regionPoint();
      const pulseAge = Math.max(0, (time - this.pulseStarted) * 0.001);
      const pulseRadius = pulseAge * Math.min(this.width, this.height) * 0.5;
      const pulseBand = Math.max(18, this.width * 0.035);
      const buckets = Array.from({ length: PALETTE.length * 3 }, () => []);

      ctx.clearRect(0, 0, this.width, this.height);

      for (let index = 0; index < this.particles.length; index += 1) {
        const particle = this.particles[index];
        const floatX = Math.cos(seconds * particle.frequency + particle.phase + particle.ny * 3) * 1.9 * particle.depth;
        const floatY = Math.sin(seconds * particle.frequency * 0.86 + particle.phase + particle.nx * 4) * 1.55 * particle.depth;
        const targetX = centerX + ((particle.bx - centerX) * breath) + floatX;
        const targetY = centerY + ((particle.by - centerY) * breath) + floatY;
        const spring = (0.022 + formation * 0.022) * delta;
        particle.vx += (targetX - particle.x) * spring;
        particle.vy += (targetY - particle.y) * spring;

        if (this.pointer.active && !this.reduceMotion) {
          const dx = particle.x - this.pointer.x;
          const dy = particle.y - this.pointer.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance < pointerRadius) {
            const force = Math.pow(1 - distance / pointerRadius, 2) * delta;
            particle.vx += ((dx / distance) * 1.25 - (dy / distance) * 0.34) * force;
            particle.vy += ((dy / distance) * 1.25 + (dx / distance) * 0.34) * force;
          }
        }

        const focusDistance = focus ? Math.hypot(particle.x - focus.x, particle.y - focus.y) : Infinity;
        const regionGlow = focus ? Math.max(0, 1 - focusDistance / (this.width * 0.27)) : 0;
        const waveGlow = focus && pulseAge < 2.25 ? Math.max(0, 1 - Math.abs(focusDistance - pulseRadius) / pulseBand) : 0;
        const damping = Math.pow(0.88, delta);
        particle.vx *= damping;
        particle.vy *= damping;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;

        const liveLight = clamp(particle.light + (regionGlow * 0.14) + (waveGlow * 0.56) + (particle.sentinel ? 0.1 : 0));
        const level = liveLight > 0.78 || waveGlow > 0.46 ? 2 : liveLight > 0.43 ? 1 : 0;
        buckets[(particle.tone * 3) + level].push([particle.x, particle.y, particle.size * (1 + waveGlow * 0.68 + regionGlow * 0.14), particle.alpha]);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.drawConnections(ctx, seconds, focus, pulseRadius, pulseBand, pulseAge);
      buckets.forEach((bucket, bucketIndex) => {
        if (!bucket.length) return;
        const tone = Math.floor(bucketIndex / 3);
        const level = bucketIndex % 3;
        const color = PALETTE[tone];
        ctx.beginPath();
        bucket.forEach(([x, y, size]) => {
          ctx.moveTo(x + size, y);
          ctx.arc(x, y, size, 0, TAU);
        });
        const opacity = level === 2 ? 0.78 : level === 1 ? 0.54 : 0.29;
        ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${opacity})`;
        ctx.shadowColor = level === 2 ? `rgba(${color[0]},${color[1]},${color[2]},0.48)` : 'transparent';
        ctx.shadowBlur = level === 2 ? 6 : 0;
        ctx.fill();
      });
      ctx.restore();
    }

    drawConnections(ctx, seconds, focus, pulseRadius, pulseBand, pulseAge) {
      ctx.lineWidth = 0.7;
      this.edges.forEach(([fromIndex, toIndex, phase]) => {
        const from = this.particles[fromIndex];
        const to = this.particles[toIndex];
        if (!from || !to) return;
        const midpointX = (from.x + to.x) * 0.5;
        const midpointY = (from.y + to.y) * 0.5;
        const focusDistance = focus ? Math.hypot(midpointX - focus.x, midpointY - focus.y) : Infinity;
        const pulse = focus && pulseAge < 2.25 ? Math.max(0, 1 - Math.abs(focusDistance - pulseRadius) / pulseBand) : 0;
        const flicker = Math.max(0, Math.sin(seconds * 2.2 + phase));
        const spark = Math.pow(flicker, 8) * 0.08;
        const alpha = 0.022 + flicker * 0.045 + spark + pulse * 0.34;
        ctx.strokeStyle = `rgba(226,200,143,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        const bend = Math.sin(phase + seconds * 0.45) * 9;
        ctx.quadraticCurveTo(midpointX - bend, midpointY + bend, to.x, to.y);
        ctx.stroke();
      });
    }
  }

  window.BrainParticles = {
    init(options) {
      if (!options?.canvas || !options?.stage) return null;
      return new ParticleBrain(options.canvas, options.stage);
    }
  };
})();
