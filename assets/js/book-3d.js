/* Livros 3D interativos em WebGL cru.
 *
 * Uma instância por canvas: cada livro é um objeto que o visitante pega e gira,
 * em vez de uma foto presa numa moldura.
 *
 * A malha é GERADA AQUI, não baixada. O modelo escaneado que havia antes trazia
 * proporção errada, nenhuma UV e nenhuma lombada — e lombada é justamente o que
 * o mockup de estúdio mostra escrito. Gerar o livro custa alguns milhares de
 * floats, dá controle exato de cada face e some com um .bin de 371 KB.
 *
 * As proporções (`razao`, `espessura`) e a pose de repouso vêm medidas dos
 * mockups: em repouso o render reproduz o mockup, e girar continua correto.
 *
 * Desenha SOB DEMANDA: em repouso não há requestAnimationFrame rodando. Com
 * quatro contextos WebGL na mesma página, animar todos o tempo todo cozinharia
 * a GPU sem nada acontecendo na tela.
 */
(function () {
  'use strict';

  const FOV = 0.62;
  /* Raio de enquadramento COMUM a todos os livros, não o raio de cada um: a
     malha sempre tem meia-altura 1, então distância igual significa altura igual
     na tela. Calcular por livro empurrava o mais largo para trás e ele saía
     menor que os vizinhos. Precisa cobrir o mais largo do conjunto (razão 1,40
     → raio ~0,75) para nenhum encostar na borda ao girar. */
  const RAIO_PALCO = 0.77;
  const SEG_CANTO = 5;     // segmentos do canto arredondado da capa
  const SEG_LOMBADA = 64;  // segmentos do arco da lombada — a canaleta é estreita
  const TABUA = 0.012;     // espessura da capa dura, em fração da meia-altura
  const SOBRA = 0.015;     // quanto a capa avança além do miolo

  /* ---------------------------------------------------------------- geometria */

  /** Contorno da capa no plano XY: cantos externos arredondados, lado da
   *  lombada reto — é dobra de papel, não canto cortado. */
  function contorno(W, H, r) {
    const p = [[-W, -H]];
    for (let i = 0; i <= SEG_CANTO; i++) {
      const a = -Math.PI / 2 + (Math.PI / 2) * (i / SEG_CANTO);
      p.push([W - r + r * Math.cos(a), -H + r + r * Math.sin(a)]);
    }
    for (let i = 0; i <= SEG_CANTO; i++) {
      const a = (Math.PI / 2) * (i / SEG_CANTO);
      p.push([W - r + r * Math.cos(a), H - r + r * Math.sin(a)]);
    }
    p.push([-W, H]);
    return p;
  }

  function buildBook(razao, espessura) {
    const H = 1;
    const W = H / razao;
    const D = espessura * W;          // meia-espessura
    const bojo = 0.10 * D;            // barriga minima: a lombada e plana
    const r = Math.min(0.045 * W, 0.05);
    const Dp = Math.max(D - TABUA, D * 0.35);   // meia-espessura do miolo

    const pos = [], nrm = [], uv = [], face = [];
    const push = (p, n, t, f) => {
      pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]);
      uv.push(t[0], t[1]); face.push(f);
    };
    const tri = (a, b, c, n, ta, tb, tc, f) => {
      push(a, n, ta, f); push(b, n, tb, f); push(c, n, tc, f);
    };
    const quad = (a, b, c, d, n, ta, tb, tc, td, f) => {
      tri(a, b, c, n, ta, tb, tc, f);
      tri(a, c, d, n, ta, tc, td, f);
    };
    const normal = (a, b, c) => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const L = Math.hypot(n[0], n[1], n[2]) || 1;
      return [n[0] / L, n[1] / L, n[2] / L];
    };

    const capaUV = (x, y) => [(x + W) / (2 * W), (y + H) / (2 * H)];
    const versoUV = (x, y) => [1 - (x + W) / (2 * W), (y + H) / (2 * H)];

    const oc = contorno(W, H, r);                                  // capa
    const om = contorno(W - SOBRA, H - SOBRA, r);                  // miolo
    om[0][0] = -W;                                                 // o miolo encosta na lombada
    om[om.length - 1][0] = -W;

    // Faces das duas capas: leque a partir do centro, para o contorno arredondado
    // entrar inteiro em vez de virar um retângulo com quinas cortadas.
    for (let s = 0; s < 2; s++) {
      const z = s ? -D : D;
      const n = [0, 0, s ? -1 : 1];
      const mapa = s ? versoUV : capaUV;
      const f = s;
      for (let i = 0; i < oc.length; i++) {
        const a = oc[i];
        const b = oc[(i + 1) % oc.length];
        const A = [a[0], a[1], z], B = [b[0], b[1], z], C = [0, 0, z];
        if (s) tri(C, B, A, n, mapa(0, 0), mapa(b[0], b[1]), mapa(a[0], a[1]), f);
        else tri(C, A, B, n, mapa(0, 0), mapa(a[0], a[1]), mapa(b[0], b[1]), f);
      }
    }

    // Canto da capa dura (a espessura da tábua) e a barriga que sobra sobre o
    // miolo. Ambos amostram a própria arte na borda: a cor sai certa sozinha,
    // seja capa branca ou capa preta.
    for (let s = 0; s < 2; s++) {
      const zo = s ? -D : D;                 // face externa
      const zi = s ? -(D - TABUA) : D - TABUA;
      const mapa = s ? versoUV : capaUV;
      const f = s;
      for (let i = 0; i < oc.length - 1; i++) {
        const a = oc[i], b = oc[i + 1];
        const A = [a[0], a[1], zo], B = [b[0], b[1], zo];
        const C = [b[0], b[1], zi], Dd = [a[0], a[1], zi];
        const n = s ? normal(A, C, B) : normal(A, B, C);
        if (s) quad(A, Dd, C, B, n, mapa(a[0], a[1]), mapa(a[0], a[1]), mapa(b[0], b[1]), mapa(b[0], b[1]), f);
        else quad(A, B, C, Dd, n, mapa(a[0], a[1]), mapa(b[0], b[1]), mapa(b[0], b[1]), mapa(a[0], a[1]), f);
        // barriga: anel entre o contorno da capa e o do miolo, virado para dentro
        const e = om[i], g = om[i + 1];
        const E = [e[0], e[1], zi], G = [g[0], g[1], zi];
        const ni = [0, 0, s ? 1 : -1];
        if (s) quad(Dd, C, G, E, ni, mapa(a[0], a[1]), mapa(b[0], b[1]), mapa(g[0], g[1]), mapa(e[0], e[1]), f);
        else quad(Dd, E, G, C, ni, mapa(a[0], a[1]), mapa(e[0], e[1]), mapa(g[0], g[1]), mapa(b[0], b[1]), f);
      }
    }

    // Miolo: topo, base e corte saem todos da mesma parede extrudada em Z, então
    // as estrias das folhas correm no sentido certo nas três faces.
    for (let i = 0; i < om.length - 1; i++) {
      const a = om[i], b = om[i + 1];
      const A = [a[0], a[1], Dp], B = [b[0], b[1], Dp];
      const C = [b[0], b[1], -Dp], Dd = [a[0], a[1], -Dp];
      const n = normal(A, B, C);
      const u0 = i / (om.length - 1), u1 = (i + 1) / (om.length - 1);
      quad(A, B, C, Dd, n, [u0, 1], [u1, 1], [u1, 0], [u0, 0], 3);
    }

    /* Lombada PLANA, com uma barriga mínima. O que importa aqui é o z ser LINEAR
       em t: com o perfil superelíptico que havia antes, t andava mais depressa
       nas pontas do que no meio, e a UV — que corre junto — espremia a arte nas
       bordas da lombada. Numa faixa que já é estreita, isso torcia o selo.

       Fica a CANALETA, o sulco entre a lombada e cada capa num livro encadernado.
       É ela que faz o volume ler como livro quando o visitante gira até o perfil;
       sem ela, de lado o objeto vira uma lâmina. O sino vale zero em t=0, então a
       lombada continua encostando na borda da capa em vez de abrir fresta. */
    const sulco = 0.85 * bojo;
    const larguraSulco = 0.07;
    const sino = (t) => {
      const u = t / larguraSulco;
      return u * Math.exp(1 - u);      // zero na borda, pico em t = larguraSulco
    };
    const perfil = (t) => {
      const barriga = bojo * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2)));
      const dentro = sulco * (sino(t) + sino(1 - t));
      return [-W - barriga + dentro, D * (1 - 2 * t)];
    };
    for (let i = 0; i < SEG_LOMBADA; i++) {
      const p0 = perfil(i / SEG_LOMBADA);
      const p1 = perfil((i + 1) / SEG_LOMBADA);
      const A = [p0[0], -H, p0[1]], B = [p1[0], -H, p1[1]];
      const C = [p1[0], H, p1[1]], Dd = [p0[0], H, p0[1]];
      const n = normal(A, B, C);
      const u0 = 1 - i / SEG_LOMBADA, u1 = 1 - (i + 1) / SEG_LOMBADA;
      quad(A, B, C, Dd, n, [u0, 0], [u1, 0], [u1, 1], [u0, 1], 2);
    }

    return {
      pos: new Float32Array(pos),
      nrm: new Float32Array(nrm),
      uv: new Float32Array(uv),
      face: new Float32Array(face),
      count: pos.length / 3
    };
  }

  /* ----------------------------------------------------------------- shaders */

  const VERT = `
    attribute vec3 aPos;
    attribute vec3 aNormal;
    attribute vec2 aUv;
    attribute float aFace;
    uniform mat4 uProj;
    uniform mat4 uView;
    uniform vec2 uRot;
    varying vec3 vNormal;
    varying vec3 vEye;
    varying vec2 vUv;
    varying float vFace;

    mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
    mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }

    void main() {
      mat3 R = rotX(uRot.y) * rotY(uRot.x);
      vec3 p = R * aPos;
      vNormal = normalize(R * aNormal);
      vUv = aUv;
      vFace = aFace;
      vec4 eye = uView * vec4(p, 1.0);
      vEye = eye.xyz;
      gl_Position = uProj * eye;
    }
  `;

  const FRAG = `
    precision mediump float;
    uniform sampler2D uTex;
    uniform sampler2D uTexBack;
    uniform sampler2D uTexSpine;
    uniform float uHasBack;
    uniform float uHasSpine;
    varying vec3 vNormal;
    varying vec3 vEye;
    varying vec2 vUv;
    varying float vFace;

    void main() {
      // O interior do livro é visível de raspão pela sobra da capa; sem virar a
      // normal do lado de trás, essa fresta acende como se fosse face externa.
      vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
      vec3 V = normalize(-vEye);

      /* 0 capa · 1 contracapa · 2 lombada · 3 miolo */
      vec3 papel = vec3(0.90, 0.885, 0.845);
      vec3 base;
      if (vFace < 0.5) {
        base = texture2D(uTex, vUv).rgb;
      } else if (vFace < 1.5) {
        /* Sem contracapa própria, herda a cor do canto da capa em vez de papel
           branco — num livro de capa preta o verso branco entrega na hora que é
           falso. Um texel só, de uma região chapada, dá cor sólida. Sem fator de
           escurecimento: o verso é a MESMA capa, e quem já faz a diferença entre
           frente, lombada e verso é a luz, não a textura. */
        base = uHasBack > 0.5 ? texture2D(uTexBack, vUv).rgb
                              : texture2D(uTex, vec2(0.03, 0.97)).rgb;
      } else if (vFace < 2.5) {
        // Sem arte de lombada, herda a coluna da borda da capa: numa capa preta
        // uma lombada branca denunciaria na hora que o livro é falso.
        base = uHasSpine > 0.5 ? texture2D(uTexSpine, vUv).rgb
                               : texture2D(uTex, vec2(0.015, vUv.y)).rgb;
      } else {
        /* Folhas. A frequência das estrias é baixa de propósito: o corte tem
           umas poucas dezenas de pixels na tela, e listra procedural não passa
           por mipmap — apertar mais só produziria fervilhamento. */
        float estria = 0.955 + 0.045 * sin(vUv.y * 164.0);
        float miolo = 1.0 - 0.16 * pow(abs(vUv.y - 0.5) * 2.0, 3.0);
        base = papel * estria * miolo;
      }

      /* Luz presa à câmera, não ao objeto: se girasse junto, o desenho da luz
         mudaria a cada volta e a capa pareceria piscar. A chave vem da direita
         e de cima, que é o que deixa a lombada em sombra igual ao mockup.

         A difusa é envolvente (wrap) em vez de max(dot,0): com corte duro, a
         lombada curva atravessa o zero e vira um bloco chapado: era isso que
         fazia o livro de perfil parecer uma lâmina de papel. Com wrap ela ganha
         o degradê que a curvatura pede. */
      vec3 L1 = normalize(vec3(0.45, 0.50, 0.74));
      vec3 L2 = normalize(vec3(-0.60, 0.20, 0.50));
      float wrap = max(dot(N, L1) * 0.5 + 0.5, 0.0);
      float d = 0.34 + pow(wrap, 1.7) * 0.72 + max(dot(N, L2), 0.0) * 0.09;
      float spec = pow(max(dot(N, normalize(L1 + V)), 0.0), 38.0) * 0.13;
      float rim = pow(1.0 - max(dot(N, V), 0.0), 3.5) * 0.10;

      /* Oclusão assada nas canaletas. A geometria do sulco existe, mas num vinco
         de poucos pixels a difusa sozinha quase não o marca — é a sombra presa
         ali que faz o olho ler encadernação em vez de chapa lisa. */
      if (vFace > 1.5 && vFace < 2.5) {
        float borda = smoothstep(0.0, 0.10, min(vUv.x, 1.0 - vUv.x));
        d *= 0.70 + 0.30 * borda;
      }
      // Queda vertical: no mockup a luz vem de cima e o pé do livro fica mais
      // fechado. Só vale nas faces cujo v é altura (capa, contracapa, lombada).
      if (vFace < 2.5) d *= 0.90 + 0.13 * vUv.y;

      gl_FragColor = vec4(base * d + spec + rim, 1.0);
    }
  `;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('[book3d]', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  function perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    out.set([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0]);
    return out;
  }

  function create(canvas, texUrl, options) {
    const opts = options || {};
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl) return null;

    const program = gl.createProgram();
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[book3d]', gl.getProgramInfoLog(program));
      return null;
    }
    gl.useProgram(program);

    const A = {
      pos: gl.getAttribLocation(program, 'aPos'),
      normal: gl.getAttribLocation(program, 'aNormal'),
      uv: gl.getAttribLocation(program, 'aUv'),
      face: gl.getAttribLocation(program, 'aFace')
    };
    const U = {
      proj: gl.getUniformLocation(program, 'uProj'),
      view: gl.getUniformLocation(program, 'uView'),
      rot: gl.getUniformLocation(program, 'uRot'),
      tex: gl.getUniformLocation(program, 'uTex'),
      texBack: gl.getUniformLocation(program, 'uTexBack'),
      texSpine: gl.getUniformLocation(program, 'uTexSpine'),
      hasBack: gl.getUniformLocation(program, 'uHasBack'),
      hasSpine: gl.getUniformLocation(program, 'uHasSpine')
    };

    const mesh = buildBook(opts.razao || 1.5, opts.espessura || 0.16);
    const proj = new Float32Array(16);
    const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -3, 1]);
    const REST_X = opts.pose !== undefined ? opts.pose : 0.454;   // três-quartos
    const REST_Y = 0.09;                                          // visto de leve por cima
    let rotX = REST_X;
    let rotY = REST_Y;
    let pronto = false;
    let raf = 0;
    let dragging = false;
    let velocity = 0;

    function resize() {
      /* Supersampling: desenha acima do tamanho em tela e deixa o navegador
         reduzir. A cena é estática e só redesenha sob demanda, então o custo é
         um frame — e o texto miúdo da lombada, que é o que sofre, ganha
         antialiasing de verdade em vez de depender do MSAA da borda. */
      const dpr = Math.min((devicePixelRatio || 1) * 1.6, 3);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (w === canvas.width && h === canvas.height) return false;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      const aspect = w / Math.max(1, h);
      perspective(proj, FOV, aspect, 0.1, 40);
      gl.uniformMatrix4fv(U.proj, false, proj);
      const t = Math.tan(FOV / 2);
      const R = RAIO_PALCO;
      const dist = Math.max(1.08 / t, (R + 0.06) / (t * aspect)) + R;
      view[14] = -dist;
      gl.uniformMatrix4fv(U.view, false, view);
      return true;
    }

    function draw() {
      if (!pronto) return;
      resize();
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform2f(U.rot, rotX, rotY);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }

    /* Só existe loop quando há movimento. Ao parar, o rAF é cancelado e o canvas
       fica com o último frame desenhado. */
    function glide() {
      raf = 0;
      if (dragging || Math.abs(velocity) < 0.0006) { draw(); return; }
      rotX += velocity;
      velocity *= 0.93;
      draw();
      raf = requestAnimationFrame(glide);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(glide); };

    const mk = (data, loc, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    mk(mesh.pos, A.pos, 3);
    mk(mesh.nrm, A.normal, 3);
    mk(mesh.uv, A.uv, 2);
    mk(mesh.face, A.face, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.uniform1f(U.hasBack, 0);
    gl.uniform1f(U.hasSpine, 0);
    gl.uniform1i(U.tex, 0);
    gl.uniform1i(U.texBack, 1);
    gl.uniform1i(U.texSpine, 2);

    /* WebGL 1 só gera mipmap em textura com os dois lados potência de dois. As
       artes têm 1000x1600, 408x1600, 908x1268 — nenhuma serve. Sem mipmap a
       lombada, que ocupa ~25 px na tela vinda de uma textura de 400, é amostrada
       ponto a ponto e o texto vira chuvisco. Reamostrar para potência de dois
       num canvas resolve, e a UV não se importa: ela é sempre 0..1. */
    const potMaior = (n) => Math.min(2048, Math.pow(2, Math.ceil(Math.log2(n))));
    const paraPot = (image) => {
      const w = potMaior(image.naturalWidth || image.width);
      const h = potMaior(image.naturalHeight || image.height);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, w, h);
      return c;
    };

    const upload = (image, unit) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, paraPot(image));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      return t;
    };

    const extra = (fonte, unit, flag) => {
      if (!fonte) return;
      // Aceita um <canvas> já pronto além de URL: a lombada do livro físico é
      // DESENHADA em tempo de execução, não baixada. Texto desenhado sai nítido
      // em qualquer tamanho; extraído de foto herda a compressão da perspectiva.
      if (typeof fonte !== 'string') {
        upload(fonte, unit);
        gl.uniform1f(flag, 1);
        draw();
        return;
      }
      const im = new Image();
      im.onload = () => { upload(im, unit); gl.uniform1f(flag, 1); draw(); };
      im.onerror = () => console.warn('[book3d] textura', fonte);
      im.src = fonte;
    };

    const img = new Image();
    img.onload = () => {
      upload(img, 0);
      pronto = true;
      canvas.classList.add('is-ready');
      /* Avisa quem espera o objeto existir. O preloader se apoia nisto para
         saber quando pode subir a cortina — antes disso ele levantaria para uma
         hero com o palco vazio. */
      canvas.dispatchEvent(new CustomEvent('livro:pronto'));
      resize();
      draw();
      extra(opts.contracapa, 1, U.hasBack);
      extra(opts.lombada, 2, U.hasSpine);
    };
    img.onerror = () => console.warn('[book3d] textura', texUrl);
    img.src = texUrl;

    let lastX = 0;
    let lastY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      velocity = 0;
      canvas.setPointerCapture?.(e.pointerId);
      canvas.classList.add('is-dragging');
      opts.onGrab?.();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = (e.clientX - lastX) * 0.012;
      const dy = (e.clientY - lastY) * 0.008;
      lastX = e.clientX;
      lastY = e.clientY;
      rotX += dx;
      // Trava vertical: sem ela o livro capota e fica de cabeça para baixo.
      rotY = Math.max(-0.6, Math.min(0.6, rotY + dy));
      velocity = dx;
      draw();
    });
    const release = (e) => {
      if (!dragging) return;
      dragging = false;
      canvas.releasePointerCapture?.(e.pointerId);
      canvas.classList.remove('is-dragging');
      kick();
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    addEventListener('resize', () => { if (resize()) draw(); }, { passive: true });

    return {
      /* Volta lenta ao repouso, usada quando o livro deixa de ser o selecionado:
         se ficasse no ângulo em que foi largado, a vitrine ficaria desalinhada. */
      reset() {
        velocity = 0;
        const startX = rotX;
        const startY = rotY;
        const t0 = performance.now();
        const ease = (k) => 1 - Math.pow(1 - k, 3);
        const step = (now) => {
          const k = Math.min(1, (now - t0) / 600);
          rotX = startX + (REST_X - startX) * ease(k);
          rotY = startY + (REST_Y - startY) * ease(k);
          draw();
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      spin(amount) { velocity = amount; kick(); },

      /* Entrada: o livro chega girando de perfil até a pose de repouso. Roda a
         partir de `rotX` e não de um valor fixo, então serve tanto para o livro
         que entra com a seção quanto para o que já está posto. `power3.out`
         escrito à mão porque isto vive dentro do próprio loop do renderer — o
         desenho é sob demanda, e passar por fora deixaria o canvas parado. */
      entrada(giro = -Math.PI * 0.62, ms = 1150) {
        velocity = 0;
        rotX = REST_X + giro;
        const t0 = performance.now();
        const ease = (k) => 1 - Math.pow(1 - k, 3);
        const step = (now) => {
          const k = Math.min(1, (now - t0) / ms);
          rotX = REST_X + giro * (1 - ease(k));
          draw();
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      /* Troca só a textura da lombada, já com o livro montado. Serve para a arte
         que chega depois do primeiro desenho — o logotipo da editora é um PNG e
         só existe depois do load. */
      lombada(fonte) { extra(fonte, 2, U.hasSpine); },
      redraw: draw
    };
  }

  window.Book3D = { create };
}());
