/* Cérebro 3D em WebGL cru: superfície texturizada + rede de arestas + pontos.
 *
 * Tudo vem do mesmo mesh do Blender:
 *   assets/cerebro/malha-uv.bin — superfície com UV (build/export_textured.py)
 *   assets/cerebro/textura.webp — textura base_color do asset, usada como detalhe
 *   assets/cerebro/arestas.bin  — arestas de sulco (build/export_edges.py)
 *   assets/cerebro/pontos.bin   — pontos na superfície (build/export_points.py)
 *
 * Sem three.js de propósito: é geometria estática em poucos draw calls, e a
 * biblioteca custaria mais banda do que todos os modelos somados.
 *
 * Se WebGL não existir, o <img> de fallback continua visível e nada acontece.
 */
(function () {
  'use strict';

  const MESH_SRC = 'assets/cerebro/malha-uv.bin';
  const TEX_SRC = 'assets/cerebro/textura.webp';
  const EDGES_SRC = 'assets/cerebro/arestas.bin';
  const POINTS_SRC = 'assets/cerebro/pontos.bin';

  /* Rotação compartilhada pelos dois shaders: a malha e os pontos precisam girar
     exatamente juntos, senão os pontos deslizam sobre a superfície. */
  const ROT = `
    mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
    mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
    mat3 spinMat(vec2 pointer){ return rotX(pointer.y * 0.28) * rotY(pointer.x * 0.45); }
  `;

  /* Onda de ativação: casca esférica que sai de um foco e se espalha pela rede.
     A distância ao foco é medida em espaço de MODELO, então a onda gira junto com
     o cérebro em vez de escorregar por cima dele. Vai como `varying` crua e só
     vira pulso no fragment: o fract precisa acontecer depois da interpolação,
     senão a volta do ciclo caindo no meio de uma aresta a parte em duas. */
  /* Onda de ativação: casca esférica que sai de um foco e se espalha pela rede.
     A distância ao foco é medida em espaço de MODELO, então a onda gira junto com
     o cérebro em vez de escorregar por cima dele.

     A FASE vem pronta de JS, já reduzida ao intervalo [0,1). Duas razões: o tempo
     cru cresce sem limite e um `mediump` perde a fração dele depois de alguns
     minutos, travando a animação; e uniforme com mesmo nome e precisão diferente
     entre vertex e fragment é erro de LINK em GLSL ES 1.0 — declarar tudo mediump
     aqui, num bloco só, garante que os dois estágios digam exatamente a mesma coisa. */
  const ONDA = `
    uniform mediump vec3 uFoco1;
    uniform mediump vec3 uFoco2;
    uniform mediump float uFase1;
    uniform mediump float uFase2;
    uniform mediump float uOnda;   // 0 desliga tudo (prefers-reduced-motion)
    // pico logo depois da virada e cauda decaindo: frente nítida, rastro atrás
    float casca(float x) { float f = fract(x); return exp(-f * f * 30.0); }
  `;


  const MESH_VERT = `
    attribute vec3 aPos;
    attribute vec3 aNormal;
    attribute vec2 aUv;
    uniform mat4 uProj;
    uniform mat4 uView;
    uniform vec2 uPointer;
    varying vec3 vNormal;
    varying vec3 vEye;
    varying vec2 vUv;
    ${ROT}
    void main() {
      mat3 R = spinMat(uPointer);
      vec3 p = R * aPos;
      vNormal = normalize(R * aNormal);
      vUv = aUv;
      vec4 eye = uView * vec4(p, 1.0);
      vEye = eye.xyz;
      gl_Position = uProj * eye;
    }
  `;

  const MESH_FRAG = `
    precision mediump float;
    uniform mediump float uGlow;
    uniform sampler2D uTex;
    varying vec3 vNormal;
    varying vec3 vEye;
    varying vec2 vUv;

    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(-vEye);

      // A textura do asset é AZUL. Multiplicá-la por dourado não funciona — o
      // canal vermelho dela é quase zero e o resultado sai esverdeado sujo. Então
      // só a LUMINÂNCIA é aproveitada, como mapa de detalhe (fibras, veias,
      // sulcos), e a cor vem inteiramente do dourado.
      float detail = dot(texture2D(uTex, vUv).rgb, vec3(0.2126, 0.7152, 0.0722));
      detail = clamp((detail - 0.28) * 1.9, 0.0, 1.0);

      vec3 gold = vec3(1.0, 0.72, 0.30);
      vec3 deep = vec3(0.045, 0.028, 0.012);

      // Luzes fixas no espaço da câmera, não na cena: assim o desenho da luz fica
      // estável enquanto o cérebro gira. Girar as luzes junto faria o volume
      // "piscar" a cada volta.
      vec3 L1 = normalize(vec3(-0.55, 0.45, 0.70));
      vec3 L2 = normalize(vec3(0.75, 0.25, 0.35));
      vec3 L3 = normalize(vec3(0.0, -0.75, 0.30));
      float d = max(dot(N, L1), 0.0) * 0.72
              + max(dot(N, L2), 0.0) * 0.50
              + max(dot(N, L3), 0.0) * 0.24;

      float spec = pow(max(dot(N, normalize(L1 + V)), 0.0), 42.0) * 0.55
                 + pow(max(dot(N, normalize(L2 + V)), 0.0), 26.0) * 0.30;

      // Rim light: é o contorno que separa o cérebro do fundo. Sem ele a silhueta
      // se dissolve contra a foto escura da hero.
      float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);

      // O detalhe modula o difuso: as fibras claras da textura pegam luz, as
      // fendas escuras ficam no fundo. É o que devolve a superfície orgânica.
      vec3 col = deep
               + gold * d * mix(0.16, 0.92, detail)
               + gold * spec * (0.25 + 0.55 * detail)
               + gold * rim * 0.55;
      col *= uGlow;

      // Alpha proporcional ao brilho: onde a superfície é escura ela some e a foto
      // atrás aparece, em vez de ficar um recorte preto. Premultiplicado, porque o
      // contexto foi criado com premultipliedAlpha.
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float a = clamp(0.16 + lum * 4.5, 0.0, 1.0);
      gl_FragColor = vec4(col, a);
    }
  `;

  const PT_VERT = `
    attribute vec3 aPos;
    attribute float aSeed;
    uniform mat4 uProj;
    uniform mat4 uView;
    uniform float uTime;
    uniform float uSize;
    uniform vec2 uPointer;
    uniform mediump float uPass;
    varying float vGlow;
    varying float vDepth;
    ${ROT}
    ${ONDA}
    void main() {
      vec3 dir = normalize(aPos + 0.0001);
      // Deslocado para fora da superfície: no mesmo plano da malha os pontos
      // brigariam com ela no depth buffer (z-fighting).
      vec3 p = aPos + dir * 0.008;
      p += dir * sin(uTime * 0.6 + aSeed * 6.2831) * 0.004;   // respiração
      p = spinMat(uPointer) * p;

      vec4 eye = uView * vec4(p, 1.0);
      gl_Position = uProj * eye;

      vDepth = clamp((-eye.z - 1.6) / 1.6, 0.0, 1.0);
      float twinkle = 0.55 + 0.45 * sin(uTime * 1.7 + aSeed * 12.566);
      float hot = step(0.86, fract(aSeed * 7.31));
      vGlow = mix(twinkle * 0.34, 1.0, hot);

      /* Os nós disparam quando a onda passa por eles. É o que transforma a
         casca numa frente de ativação: sem isto ela seria só um brilho correndo
         pelas linhas, com os pontos parados por fora. */
      float onda = max(casca(length(aPos - uFoco1) * 1.9 - uFase1),
                       casca(length(aPos - uFoco2) * 1.9 - uFase2)) * uOnda;
      vGlow = min(1.0, vGlow + onda * 0.9);

      // Duas passadas com o mesmo buffer: discos largos e fracos (o bloom) e
      // depois o núcleo nítido. Equivale em tempo real ao bloom em pós.
      float spread = mix(4.2, 1.0, uPass);
      gl_PointSize = uSize * spread * mix(1.25, 0.55, vDepth) * mix(0.85, 1.6, hot)
                   * (1.0 + onda * 0.9);
    }
  `;

  /* Anéis do palco. Ficam na MESMA cena do cérebro (mesma projeção, mesmo depth
     buffer), e é isso que faz o conjunto ler como um objeto só projetado na sala
     — anéis desenhados em CSS por cima da foto nunca casam de perspectiva. */
  const RING_VERT = `
    attribute vec3 aPos;
    attribute vec2 aMeta;          // x = índice do anel, y = posição ao longo dele (0..1)
    uniform mat4 uProj;
    uniform mat4 uView;
    uniform float uTime;
    uniform float uSize;
    uniform mediump float uMode;   // 0 = linhas, 1 = partículas
    varying float vFade;
    varying float vRing;

    mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }

    void main() {
      float ring = aMeta.x;
      // Cada anel gira na própria velocidade e sentido: girando todos juntos, o
      // conjunto lê como um disco rígido em vez de camadas independentes.
      float dir = mod(ring, 2.0) < 1.0 ? 1.0 : -1.0;
      vec3 p = rotY(uTime * (0.02 + ring * 0.012) * dir) * aPos;

      vec4 eye = uView * vec4(p, 1.0);
      gl_Position = uProj * eye;
      gl_PointSize = uSize * (1.0 + 0.5 * sin(aMeta.y * 40.0 + ring));

      // Pulso de luz percorrendo o anel: sem ele a linha fica com brilho chapado
      // e denuncia que é geometria, não luz.
      float head = fract(uTime * 0.06 + ring * 0.27);
      float d = abs(fract(aMeta.y - head + 0.5) - 0.5);
      vFade = 0.28 + 0.72 * pow(1.0 - smoothstep(0.0, 0.34, d), 2.0);
      vRing = ring;
    }
  `;

  const RING_FRAG = `
    precision mediump float;
    uniform mediump float uMode;
    varying float vFade;
    varying float vRing;
    void main() {
      float a = vFade;
      if (uMode > 0.5) {
        vec2 d = gl_PointCoord - 0.5;
        float r = dot(d, d) * 4.0;
        a *= 1.0 - smoothstep(0.1, 1.0, r);
        if (a <= 0.004) discard;
      }
      vec3 gold = mix(vec3(0.85, 0.52, 0.16), vec3(1.0, 0.82, 0.45), vFade);
      float strength = mix(0.42, 0.75, uMode);
      float outA = a * strength;
      gl_FragColor = vec4(gold * outA, outA);
    }
  `;


  /* Rede de arestas: as linhas douradas. Vêm de uma malha MUITO decimada
     (assets/cerebro/arestas.bin) — na malha cheia as arestas são sub-pixel e
     desenhá-las daria uma mancha sólida em vez de filamentos. */
  const EDGE_VERT = `
    attribute vec3 aPos;
    attribute vec3 aNormal;
    uniform mat4 uProj;
    uniform mat4 uView;
    uniform vec2 uPointer;
    uniform float uTime;
    varying mediump float vPulse;
    varying mediump float vDepth;
    varying mediump float vRim;
    varying mediump float vD1;
    varying mediump float vD2;
    ${ROT}
    ${ONDA}
    void main() {
      // Sai crua e só vira pulso no fragment: o fract tem de acontecer depois da
      // interpolação, senão a virada do ciclo caindo no meio de uma aresta a parte.
      vD1 = length(aPos - uFoco1) * 1.9 - uFase1;
      vD2 = length(aPos - uFoco2) * 1.9 - uFase2;
      mat3 R = spinMat(uPointer);
      vec3 dir = normalize(aPos + 0.0001);
      // Afastada da superfície: colada nela, a malha ocluiria a própria rede.
      vec3 p = R * (aPos + dir * 0.006);
      vec3 N = normalize(R * aNormal);
      vec4 eye = uView * vec4(p, 1.0);
      gl_Position = uProj * eye;

      // Fresnel: acende as arestas cuja normal está de lado para a câmera (a
      // silhueta e as paredes dos sulcos) e apaga as viradas de frente. Sem isso
      // a rede cobre a superfície inteira por igual e vira uma malha uniforme.
      vec3 V = normalize(-eye.xyz);
      vRim = pow(1.0 - abs(dot(N, V)), 1.5);

      vDepth = clamp((-eye.z - 2.1) / 1.4, 0.0, 1.0);
      vPulse = 0.55 + 0.45 * sin(uTime * 1.1 + aPos.y * 9.0 + aPos.x * 5.0);
    }
  `;

  const EDGE_FRAG = `
    precision mediump float;
    varying mediump float vPulse;
    varying mediump float vDepth;
    varying mediump float vRim;
    varying mediump float vD1;
    varying mediump float vD2;
    ${ONDA}
    void main() {
      vec3 warm = vec3(1.0, 0.66, 0.22);
      vec3 hot = vec3(1.0, 0.88, 0.58);
      vec3 col = mix(warm, hot, vRim * vPulse);
      col *= mix(1.0, 0.30, vDepth);
      float a = (0.10 + 0.9 * vRim) * (0.6 + 0.4 * vPulse);

      /* A onda entra somando, não multiplicando: multiplicar apagaria a rede
         entre uma passagem e outra, e o desenho dourado do sulco tem de
         continuar lá quando nada está passando. */
      float onda = max(casca(vD1), casca(vD2)) * uOnda;
      onda *= mix(0.35, 1.0, vRim);          // acende mais onde a rede já aparece
      col += vec3(1.0, 0.94, 0.74) * onda * 1.5;
      a = clamp(a + onda * 0.75, 0.0, 1.0);

      // Alfa acompanhando o RGB: com premultiplied, alfa alto e RGB baixo
      // escurece o fundo em vez de somar luz — foi o que já deu halo preto aqui.
      gl_FragColor = vec4(col * a, a * dot(col, vec3(0.2126, 0.7152, 0.0722)));
    }
  `;

  const PT_FRAG = `
    precision mediump float;
    uniform mediump float uPass;
    varying float vGlow;
    varying float vDepth;
    void main() {
      vec2 d = gl_PointCoord - 0.5;
      float r = dot(d, d) * 4.0;
      float a = 1.0 - smoothstep(0.15, 1.0, r);
      if (a <= 0.002) discard;

      vec3 warm = vec3(1.0, 0.72, 0.30);
      vec3 core = vec3(1.0, 0.96, 0.85);
      vec3 col = mix(warm, core, mix(0.0, vGlow * vGlow, uPass));
      col *= mix(1.0, 0.40, vDepth);
      float outA = a * vGlow * mix(0.04, 0.62, uPass);
      gl_FragColor = vec4(col * outA, outA);
    }
  `;

  function makeProgram(gl, vertSrc, fragSrc) {
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('[brain3d] shader', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('[brain3d] link', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function uniforms(gl, program, names) {
    const map = {};
    names.forEach((n) => {
      map[n] = gl.getUniformLocation(program, 'u' + n[0].toUpperCase() + n.slice(1));
    });
    return map;
  }

  /* Gera os anéis: um conjunto vertical envolvendo o cérebro (como o halo da foto
     original) e um disco no chão, que é o que ancora o objeto no ambiente.
     Os verticais recebem inclinações diferentes para não virarem um alvo plano. */
  function buildRings() {
    const SEGMENTS = 220;
    const pos = [];
    const meta = [];
    let ring = 0;

    const push = (x, y, z, t) => { pos.push(x, y, z); meta.push(ring, t); };

    const addRing = (radius, tiltX, tiltZ, y, z0) => {
      for (let i = 0; i < SEGMENTS; i += 1) {
        for (const step of [i, i + 1]) {              // gl.LINES: um par por segmento
          const t = (step % SEGMENTS) / SEGMENTS;
          const a = t * Math.PI * 2;
          let px = Math.cos(a) * radius;
          let py = Math.sin(a) * radius;
          let pz = z0;
          // inclina no X (deita o anel) e depois no Z
          const cy = Math.cos(tiltX), sy = Math.sin(tiltX);
          let ry = py * cy - pz * sy;
          let rz = py * sy + pz * cy;
          const cz = Math.cos(tiltZ), sz = Math.sin(tiltZ);
          const rx = px * cz - ry * sz;
          ry = px * sz + ry * cz;
          push(rx, ry + y, rz, (step % SEGMENTS) / SEGMENTS);
        }
      }
      ring += 1;
    };

    // Halo vertical, empurrado para trás do cérebro (z negativo): no mesmo plano
    // dele os anéis cruzariam a silhueta pela frente e cortariam a leitura.
    [0.58, 0.63, 0.68, 0.73, 0.78].forEach((r, i) => {
      addRing(r, 0.05 + i * 0.02, -0.14 + i * 0.045, 0.02, -0.34);
    });
    // Disco no chão: quase deitado, abaixo do cérebro — é o que ancora o objeto
    // no ambiente em vez de deixá-lo flutuando contra a parede.
    [0.42, 0.52, 0.62, 0.72, 0.82].forEach((r, i) => {
      addRing(r, Math.PI / 2 - 0.14, 0, -0.46 - i * 0.005, 0);
    });

    return { pos: new Float32Array(pos), meta: new Float32Array(meta), count: pos.length / 3 };
  }

  function perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    out.set([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0]);
    return out;
  }

  function init(options) {
    const canvas = options.canvas;
    const stage = options.stage;
    const fallback = options.fallback;
    const gl = canvas.getContext('webgl', {
      alpha: true, antialias: true, depth: true,
      premultipliedAlpha: true, powerPreference: 'high-performance'
    });
    if (!gl) return null;

    const meshProg = makeProgram(gl, MESH_VERT, MESH_FRAG);
    const ptProg = makeProgram(gl, PT_VERT, PT_FRAG);
    if (!meshProg || !ptProg) return null;

    const meshU = uniforms(gl, meshProg, ['proj', 'view', 'pointer', 'glow']);
    const meshA = {
      pos: gl.getAttribLocation(meshProg, 'aPos'),
      normal: gl.getAttribLocation(meshProg, 'aNormal'),
      uv: gl.getAttribLocation(meshProg, 'aUv')
    };
    const meshTexU = gl.getUniformLocation(meshProg, 'uTex');
    const ptU = uniforms(gl, ptProg, ['proj', 'view', 'pointer', 'time', 'size', 'pass', 'foco1', 'foco2', 'fase1', 'fase2', 'onda']);
    const ptA = {
      pos: gl.getAttribLocation(ptProg, 'aPos'),
      seed: gl.getAttribLocation(ptProg, 'aSeed')
    };

    const edgeProg = makeProgram(gl, EDGE_VERT, EDGE_FRAG);
    if (!edgeProg) return null;
    const edgeU = uniforms(gl, edgeProg, ['proj', 'view', 'pointer', 'time', 'foco1', 'foco2', 'fase1', 'fase2', 'onda']);
    const edgeA = {
      pos: gl.getAttribLocation(edgeProg, 'aPos'),
      normal: gl.getAttribLocation(edgeProg, 'aNormal')
    };
    const edges = { pos: null, normal: null, index: null, count: 0 };

    const ringProg = makeProgram(gl, RING_VERT, RING_FRAG);
    if (!ringProg) return null;
    const ringU = uniforms(gl, ringProg, ['proj', 'view', 'time', 'size', 'mode']);
    const ringA = {
      pos: gl.getAttribLocation(ringProg, 'aPos'),
      meta: gl.getAttribLocation(ringProg, 'aMeta')
    };
    const ringData = buildRings();
    const rings = { pos: gl.createBuffer(), meta: gl.createBuffer(), count: ringData.count };
    gl.bindBuffer(gl.ARRAY_BUFFER, rings.pos);
    gl.bufferData(gl.ARRAY_BUFFER, ringData.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, rings.meta);
    gl.bufferData(gl.ARRAY_BUFFER, ringData.meta, gl.STATIC_DRAW);

    const proj = new Float32Array(16);
    const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -2.56, 1]);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const mesh = { pos: null, normal: null, uv: null, index: null, count: 0, tex: null };
    const points = { pos: null, seed: null, count: 0 };
    let ready = 0;
    let raf = 0;
    let visible = true;
    let pointSize = 2;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let spin = 0;

    /* Blender é Z-up e a página precisa de Y-up; a troca de eixos com o sinal
       negativo é o que deixa o perfil virado para o lado certo. */
    const toWeb = (x, y, z) => [-y, z, x];

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (w === canvas.width && h === canvas.height) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      perspective(proj, 0.62, w / Math.max(1, h), 0.1, 20);
      // Ponto proporcional à altura: fixo em px ficaria grosso no mobile.
      pointSize = Math.max(1.0, h * 0.0022);
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (ready < 4 || !visible) return;
      const t = now * 0.001;

      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;

      /* Os dois focos da onda. Períodos propositalmente incomensuráveis: com
         períodos múltiplos as duas frentes voltariam a coincidir de tempos em
         tempos e o ciclo ficaria visível. */
      const f1x = 0.34 * Math.cos(t * 0.23);
      const f1y = 0.26 * Math.sin(t * 0.17);
      const f1z = 0.34 * Math.sin(t * 0.29);
      const f2x = -0.30 * Math.cos(t * 0.13 + 2.1);
      const f2y = -0.20 + 0.18 * Math.sin(t * 0.31);
      const f2z = 0.28 * Math.cos(t * 0.19 + 1.3);
      // fase reduzida aqui, não no shader: ver o comentário do bloco ONDA
      const fase1 = (t * 0.30) % 1;
      const fase2 = (t * 0.23 + 0.41) % 1;
      if (!reduce) spin += 0.0016;
      const px = pointer.x + spin;

      resize();
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // 1) Superfície opaca, escrevendo profundidade.
      gl.useProgram(meshProg);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      // Blending ligado com depthMask ligado: a superfície continua ocluindo o que
      // está atrás (rede e pontos do lado oposto), mas deixa a foto passar onde é
      // escura.
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(meshU.proj, false, proj);
      gl.uniformMatrix4fv(meshU.view, false, view);
      gl.uniform2f(meshU.pointer, px, pointer.y);
      gl.uniform1f(meshU.glow, 1.0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pos);
      gl.enableVertexAttribArray(meshA.pos);
      gl.vertexAttribPointer(meshA.pos, 3, gl.SHORT, true, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal);
      gl.enableVertexAttribArray(meshA.normal);
      gl.vertexAttribPointer(meshA.normal, 3, gl.BYTE, true, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv);
      gl.enableVertexAttribArray(meshA.uv);
      gl.vertexAttribPointer(meshA.uv, 2, gl.UNSIGNED_SHORT, true, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, mesh.tex);
      gl.uniform1i(meshTexU, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);

      // 2) Rede de arestas: aditiva, com depth test e sem escrever profundidade.
      //    O corpo escuro desenhado antes oclui a rede do lado oposto — é isso que
      //    dá volume, em vez de virar um emaranhado transparente.
      gl.useProgram(edgeProg);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.uniformMatrix4fv(edgeU.proj, false, proj);
      gl.uniformMatrix4fv(edgeU.view, false, view);
      gl.uniform2f(edgeU.pointer, px, pointer.y);
      gl.uniform1f(edgeU.time, t);
      gl.uniform3f(edgeU.foco1, f1x, f1y, f1z);
      gl.uniform3f(edgeU.foco2, f2x, f2y, f2z);
      gl.uniform1f(edgeU.fase1, fase1);
      gl.uniform1f(edgeU.fase2, fase2);
      gl.uniform1f(edgeU.onda, reduce ? 0 : 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, edges.pos);
      gl.enableVertexAttribArray(edgeA.pos);
      gl.vertexAttribPointer(edgeA.pos, 3, gl.SHORT, true, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, edges.normal);
      gl.enableVertexAttribArray(edgeA.normal);
      gl.vertexAttribPointer(edgeA.normal, 3, gl.BYTE, true, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edges.index);
      gl.drawElements(gl.LINES, edges.count, gl.UNSIGNED_SHORT, 0);

      // 3) Anéis: aditivos e com depth test, então a parte que passa atrás do
      //    cérebro é ocultada por ele — é o que dá a leitura de "o cérebro está
      //    dentro dos anéis", e não colado por cima.
      gl.useProgram(ringProg);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.uniformMatrix4fv(ringU.proj, false, proj);
      gl.uniformMatrix4fv(ringU.view, false, view);
      gl.uniform1f(ringU.time, t);
      gl.uniform1f(ringU.size, Math.max(1.2, pointSize * 1.6));
      gl.bindBuffer(gl.ARRAY_BUFFER, rings.pos);
      gl.enableVertexAttribArray(ringA.pos);
      gl.vertexAttribPointer(ringA.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, rings.meta);
      gl.enableVertexAttribArray(ringA.meta);
      gl.vertexAttribPointer(ringA.meta, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(ringU.mode, 0.0);
      gl.drawArrays(gl.LINES, 0, rings.count);
      gl.uniform1f(ringU.mode, 1.0);   // partículas sobre a mesma trilha
      gl.drawArrays(gl.POINTS, 0, rings.count);

      // 4) Pontos aditivos, testando profundidade mas SEM escrever: os pontos do
      //    lado oposto ficam ocultos pela superfície, e é isso que faz o volume
      //    ler como sólido em vez de nuvem transparente.
      gl.useProgram(ptProg);
      gl.uniformMatrix4fv(ptU.proj, false, proj);
      gl.uniformMatrix4fv(ptU.view, false, view);
      gl.uniform2f(ptU.pointer, px, pointer.y);
      gl.uniform1f(ptU.time, t);
      gl.uniform3f(ptU.foco1, f1x, f1y, f1z);
      gl.uniform3f(ptU.foco2, f2x, f2y, f2z);
      gl.uniform1f(ptU.fase1, fase1);
      gl.uniform1f(ptU.fase2, fase2);
      gl.uniform1f(ptU.onda, reduce ? 0 : 1);
      gl.uniform1f(ptU.size, pointSize);
      gl.bindBuffer(gl.ARRAY_BUFFER, points.pos);
      gl.enableVertexAttribArray(ptA.pos);
      gl.vertexAttribPointer(ptA.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, points.seed);
      gl.enableVertexAttribArray(ptA.seed);
      gl.vertexAttribPointer(ptA.seed, 1, gl.FLOAT, false, 0, 0);
      gl.uniform1f(ptU.pass, 0.0);
      gl.drawArrays(gl.POINTS, 0, points.count);
      gl.uniform1f(ptU.pass, 1.0);
      gl.drawArrays(gl.POINTS, 0, points.count);
    }

    function done() {
      ready += 1;
      if (ready < 4) return;
      canvas.classList.add('is-ready');
      if (fallback) fallback.classList.add('is-hidden');
      // Avisa quem espera (o preloader): é o cérebro que define quando a página
      // pode aparecer, porque é o asset mais pesado e a estrela da hero.
      canvas.dispatchEvent(new CustomEvent('cerebro:pronto', { bubbles: true }));
    }

    fetch(MESH_SRC).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.arrayBuffer();
    }).then((buf) => {
      const header = new Uint32Array(buf, 0, 2);
      const vertCount = header[0];
      const indexCount = header[1];
      let off = 8;
      const rawPos = new Int16Array(buf, off, vertCount * 3); off += vertCount * 6;
      const rawNrm = new Int8Array(buf, off, vertCount * 3); off += vertCount * 3;
      // Uint16Array exige offset par, e a seção de normais (3 bytes por vértice)
      // pode terminar em offset ímpar — daí a cópia quando não alinha.
      const uvOff = off % 2 ? off + 1 : off;
      const uv = uvOff === off
        ? new Uint16Array(buf, off, vertCount * 2)
        : new Uint16Array(buf.slice(off, off + vertCount * 4));
      off += vertCount * 4;
      const idx = off % 2
        ? new Uint16Array(buf.slice(off))
        : new Uint16Array(buf, off, indexCount);

      const pos = new Int16Array(vertCount * 3);
      const nrm = new Int8Array(vertCount * 3);
      for (let i = 0; i < vertCount; i += 1) {
        const p = toWeb(rawPos[i * 3], rawPos[i * 3 + 1], rawPos[i * 3 + 2]);
        const n = toWeb(rawNrm[i * 3], rawNrm[i * 3 + 1], rawNrm[i * 3 + 2]);
        pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
        nrm[i * 3] = n[0]; nrm[i * 3 + 1] = n[1]; nrm[i * 3 + 2] = n[2];
      }

      mesh.pos = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pos);
      gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
      mesh.normal = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal);
      gl.bufferData(gl.ARRAY_BUFFER, nrm, gl.STATIC_DRAW);
      mesh.uv = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv);
      gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
      mesh.index = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      mesh.count = indexCount;
      gl.clearColor(0, 0, 0, 0);
      done();
    }).catch((err) => console.warn('[brain3d] malha', err));

    const texImg = new Image();
    texImg.onload = () => {
      mesh.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, mesh.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   // UV do Blender é bottom-up
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texImg);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      done();
    };
    texImg.onerror = () => console.warn('[brain3d] textura');
    texImg.src = TEX_SRC;

    fetch(EDGES_SRC).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.arrayBuffer();
    }).then((buf) => {
      const header = new Uint32Array(buf, 0, 2);
      const vertCount = header[0];
      const indexCount = header[1];
      let off = 8;
      const rawPos = new Int16Array(buf, off, vertCount * 3); off += vertCount * 6;
      const rawNrm = new Int8Array(buf, off, vertCount * 3); off += vertCount * 3;
      const idx = off % 2
        ? new Uint16Array(buf.slice(off))
        : new Uint16Array(buf, off, indexCount);

      const pos = new Int16Array(vertCount * 3);
      const nrm = new Int8Array(vertCount * 3);
      for (let i = 0; i < vertCount; i += 1) {
        const q = toWeb(rawPos[i * 3], rawPos[i * 3 + 1], rawPos[i * 3 + 2]);
        const m = toWeb(rawNrm[i * 3], rawNrm[i * 3 + 1], rawNrm[i * 3 + 2]);
        pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = q[2];
        nrm[i * 3] = m[0]; nrm[i * 3 + 1] = m[1]; nrm[i * 3 + 2] = m[2];
      }
      edges.pos = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, edges.pos);
      gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
      edges.normal = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, edges.normal);
      gl.bufferData(gl.ARRAY_BUFFER, nrm, gl.STATIC_DRAW);
      edges.index = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edges.index);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      edges.count = indexCount;
      done();
    }).catch((err) => console.warn('[brain3d] arestas', err));

    fetch(POINTS_SRC).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.arrayBuffer();
    }).then((buf) => {
      const raw = new Float32Array(buf);
      const count = raw.length / 3;
      const pos = new Float32Array(count * 3);
      const seeds = new Float32Array(count);
      for (let i = 0; i < count; i += 1) {
        const p = toWeb(raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2]);
        pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
        seeds[i] = Math.random();
      }
      points.pos = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, points.pos);
      gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
      points.seed = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, points.seed);
      gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
      points.count = count;
      done();
    }).catch((err) => console.warn('[brain3d] pontos', err));

    /* Sem parallax de mouse: o listener era global (window), então mexer o cursor
       em QUALQUER ponto da página girava o cérebro — parecia que ele se movia
       sozinho. A rotação agora é só a automática, e `focus()` segue disponível
       para inclinar o cérebro sob comando. */

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; },
        { threshold: 0 }).observe(canvas);
    }

    resize();
    raf = requestAnimationFrame(frame);

    return {
      focus(x, y) { pointer.tx = x; pointer.ty = y; },
      destroy() { cancelAnimationFrame(raf); }
    };
  }

  window.Brain3D = { init };
}());
