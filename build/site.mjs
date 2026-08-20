import { createHash } from 'node:crypto';
import { readFile, readdir, rename, rm, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD_DIR = path.join(ROOT, 'assets', 'build');
const MANIFEST_PATH = path.join(ROOT, 'build', 'asset-manifest.json');
const HTML_FILES = ['index.html', 'politica.html'];
const CSS_INPUTS = [
  ['assets/fontes/fontes.css', 'assets/build/fonts.min.css'],
  ['assets/css/style.css', 'assets/build/site.min.css'],
];
const JS_INPUTS = [
  ['assets/js/config.js', 'assets/build/config.min.js'],
  ['assets/js/main.js', 'assets/build/main.min.js'],
  ['assets/js/tracking.js', 'assets/build/tracking.min.js'],
  ['assets/js/book-3d.js', 'assets/build/book-3d.min.js'],
  ['assets/js/brain-particles.js', 'assets/build/brain-particles.min.js'],
];
const SOURCE_TO_OUTPUT = new Map([...CSS_INPUTS, ...JS_INPUTS]);
const VERSIONABLE = /\.(?:avif|css|gif|jpe?g|js|png|svg|webp|woff2?)$/i;
const HTML_ATTR = /\b(href|src|srcset|imagesrcset|data-capa|data-contracapa|data-lombada)=(['"])(.*?)\2/gi;

// CSS crítico: o que precisa existir para o primeiro quadro estar CERTO.
// Folha externa é render-blocking — o navegador não pinta um pixel sequer antes
// dela chegar —, e o primeiro quadro desta página é a cortina inteira. Era isso
// que segurava a pintura mesmo com a imagem já baixada e em cache.
//
// Extraído do próprio style.css a cada build, nunca copiado à mão: cópia manual
// de CSS crítico é a que envelhece calada, e o sintoma seria a cortina abrindo
// desmontada meses depois, sem ninguém ligar uma coisa à outra.
const CRITICO = /(?:^|,)\s*(?::root\b|html\b|body\b|\.preloader|\.page-bg|\.esta-carregando|\.preloader-capable)/;

function splitTopLevel(css) {
  const blocks = [];
  let depth = 0;
  let start = 0;
  let inString = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (inString) {
      if (c === inString && css[i - 1] !== '\\') inString = null;
      continue;
    }
    if (c === '"' || c === "'") { inString = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { blocks.push(css.slice(start, i + 1)); start = i + 1; }
    }
  }
  return blocks;
}

/* Percorre também o interior de @media e @supports: as regras que ajustam a
   cortina em tela pequena e em prefers-reduced-motion moram lá, e sem elas o
   primeiro quadro sairia com a régua do desktop no celular. */
function extractCritical(css) {
  const sem = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const saida = [];
  for (const block of splitTopLevel(sem)) {
    const cabeca = block.slice(0, block.indexOf('{')).trim();
    if (/^@(?:media|supports)/.test(cabeca)) {
      const corpo = block.slice(block.indexOf('{') + 1, block.lastIndexOf('}'));
      const dentro = splitTopLevel(corpo).filter((r) => CRITICO.test(r.slice(0, r.indexOf('{'))));
      if (dentro.length) saida.push(`${cabeca}{${dentro.join('')}}`);
    } else if (CRITICO.test(cabeca)) {
      saida.push(block);
    }
  }

  /* Os @keyframes que as regras acima acionam. Sem eles a declaração `animation`
     fica apontando para um nome que ainda não existe, e o texto da cortina
     entraria parado — voltando a se mexer só quando a folha completa chegasse,
     que é exatamente o instante que este bloco existe para não esperar. */
  const usados = new Set();
  for (const nome of saida.join('').matchAll(/animation:\s*([\w-]+)/g)) usados.add(nome[1]);
  if (usados.size) {
    for (const block of splitTopLevel(sem)) {
      const cabeca = block.slice(0, block.indexOf('{')).trim();
      const quadro = cabeca.match(/^@(?:-\w+-)?keyframes\s+([\w-]+)/);
      if (quadro && usados.has(quadro[1])) saida.push(block);
    }
  }
  return saida.join('\n');
}

function publicPath(absolute) {
  return path.relative(ROOT, absolute).split(path.sep).join('/');
}

function absolutePath(publicName) {
  return path.join(ROOT, ...publicName.split('/'));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stripVersion(value) {
  return value.replace(/[?#].*$/, '');
}

function isExternal(value) {
  return /^(?:[a-z]+:|\/\/|#|\/)/i.test(value);
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function assertBuildChild(candidate) {
  const resolved = path.resolve(candidate);
  const prefix = `${BUILD_DIR}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    throw new Error(`limpeza recusada fora de assets/build: ${resolved}`);
  }
}

async function cleanBuild() {
  await mkdir(BUILD_DIR, { recursive: true });
  for (const entry of await readdir(BUILD_DIR)) {
    const target = path.resolve(BUILD_DIR, entry);
    assertBuildChild(target);
    await rm(target, { recursive: true, force: true });
  }
}

function collectHtmlReferences(html) {
  const found = new Set();
  for (const match of html.matchAll(HTML_ATTR)) {
    const attribute = match[1].toLowerCase();
    const value = match[3];
    const candidates = attribute.includes('srcset')
      ? value.split(',').map((part) => part.trim().split(/\s+/)[0])
      : [value];
    for (const candidate of candidates) {
      const clean = decodeURI(stripVersion(candidate));
      if (!clean || isExternal(clean) || !VERSIONABLE.test(clean)
          || clean.startsWith('assets/build/') || SOURCE_TO_OUTPUT.has(clean)) continue;
      found.add(clean);
    }
  }
  return found;
}

function collectJavaScriptReferences(source) {
  const found = new Set();
  const expression = /(['"])(assets\/[^'"\r\n]+?\.(?:avif|gif|jpe?g|png|svg|webp|woff2?))(?:\?v=[^'"]*)?\1/gi;
  for (const match of source.matchAll(expression)) found.add(decodeURI(match[2]));
  return found;
}

function collectFontReferences(source) {
  const found = new Set();
  for (const match of source.matchAll(/url\((['"]?)([^)'"?]+\.woff2)(?:\?v=[^)'"\s]+)?\1\)/gi)) {
    found.add(`assets/fontes/${match[2]}`);
  }
  return found;
}

async function rawAssetEntries(htmlSources, sourceContents) {
  const references = new Set();
  for (const html of htmlSources.values()) {
    for (const ref of collectHtmlReferences(html)) references.add(ref);
  }
  for (const [sourceName] of JS_INPUTS) {
    for (const ref of collectJavaScriptReferences(sourceContents.get(sourceName))) references.add(ref);
  }
  for (const ref of collectFontReferences(sourceContents.get('assets/fontes/fontes.css'))) references.add(ref);

  const entries = new Map();
  for (const name of [...references].sort()) {
    const file = absolutePath(name);
    if (!(await exists(file))) throw new Error(`asset local ausente: ${name}`);
    const bytes = await readFile(file);
    entries.set(name, {
      bytes: bytes.length,
      emitted: name,
      sha256: sha256(bytes).slice(0, 12),
      source: name,
    });
  }
  return entries;
}

function withVersion(publicName, entries) {
  const clean = stripVersion(publicName);
  const entry = entries.get(clean);
  if (!entry) throw new Error(`asset sem hash no manifesto: ${clean}`);
  return `${clean}?v=${entry.sha256}`;
}

function rewriteRuntimeAssets(source, entries) {
  const names = [...entries.keys()].sort((a, b) => b.length - a.length);
  let output = source;
  for (const name of names) {
    const versioned = withVersion(name, entries);
    output = output.replaceAll(name, versioned);
  }
  return output;
}

function rewriteFontUrls(source, entries) {
  return source.replace(/url\((['"]?)([^)'"?]+\.woff2)(?:\?v=[^)'"\s]+)?\1\)/gi, (_all, quote, filename) => {
    const publicName = `assets/fontes/${filename}`;
    return `url(${quote}../fontes/${filename}?v=${entries.get(publicName).sha256}${quote})`;
  });
}

async function compileOutputs(rawEntries, sourceContents) {
  const outputs = new Map();
  for (const [sourceName, emittedName] of CSS_INPUTS) {
    const source = sourceName.endsWith('fontes.css')
      ? rewriteFontUrls(sourceContents.get(sourceName), rawEntries)
      : sourceContents.get(sourceName);
    const result = await transform(source, {
      charset: 'utf8',
      legalComments: 'none',
      loader: 'css',
      minify: true,
      sourcefile: sourceName,
      sourcemap: false,
    });
    outputs.set(emittedName, Buffer.from(result.code.replace(/\r\n/g, '\n')));
  }
  for (const [sourceName, emittedName] of JS_INPUTS) {
    const source = rewriteRuntimeAssets(sourceContents.get(sourceName), rawEntries);
    const result = await transform(source, {
      charset: 'utf8',
      format: 'iife',
      legalComments: 'none',
      loader: 'js',
      minify: true,
      sourcefile: sourceName,
      sourcemap: false,
      target: 'es2020',
    });
    outputs.set(emittedName, Buffer.from(result.code.replace(/\r\n/g, '\n')));
  }
  return outputs;
}

function outputEntries(outputs) {
  const entries = new Map();
  for (const [emitted, bytes] of outputs) {
    const source = [...SOURCE_TO_OUTPUT].find(([, target]) => target === emitted)?.[0] ?? emitted;
    entries.set(emitted, { bytes: bytes.length, emitted, sha256: sha256(bytes).slice(0, 12), source });
  }
  return entries;
}

function versionCandidate(candidate, entries) {
  if (!candidate || isExternal(candidate)) return candidate;
  const descriptor = candidate.match(/^(.*?)(\s+\d+(?:\.\d+)?[wx])$/i);
  const rawUrl = descriptor ? descriptor[1] : candidate;
  const clean = decodeURI(stripVersion(rawUrl));
  const mapped = SOURCE_TO_OUTPUT.get(clean) ?? clean;
  if (!VERSIONABLE.test(mapped)) return candidate;
  const entry = entries.get(mapped);
  if (!entry) throw new Error(`referência local sem manifesto: ${clean}`);
  const versioned = `${mapped}?v=${entry.sha256}`;
  return descriptor ? `${versioned}${descriptor[2]}` : versioned;
}

const MARCADOR_CRITICO = /(\/\* css-critico:inicio \*\/)[\s\S]*?(\/\* css-critico:fim \*\/)/;

function syncHtml(source, entries, critico) {
  const comCritico = critico && MARCADOR_CRITICO.test(source)
    ? source.replace(MARCADOR_CRITICO, (all, abre, fecha) => `${abre}${critico}${fecha}`)
    : source;
  return comCritico.replace(HTML_ATTR, (all, attribute, quote, value) => {
    const updated = attribute.toLowerCase().includes('srcset')
      ? value.split(',').map((part) => versionCandidate(part.trim(), entries)).join(', ')
      : versionCandidate(value, entries);
    return `${attribute}=${quote}${updated}${quote}`;
  }).replace(/\r\n/g, '\n');
}

function manifestBytes(entries) {
  const assets = {};
  for (const name of [...entries.keys()].sort()) assets[name] = entries.get(name);
  return Buffer.from(`${JSON.stringify({ algorithm: 'sha256', assets }, null, 2)}\n`);
}

async function computeBuild() {
  const sourceContents = new Map();
  for (const [sourceName] of [...CSS_INPUTS, ...JS_INPUTS]) {
    const sourcePath = absolutePath(sourceName);
    if (!(await exists(sourcePath))) throw new Error(`entrada obrigatória ausente: ${sourceName}`);
    sourceContents.set(sourceName, await readFile(sourcePath, 'utf8'));
  }
  const htmlSources = new Map();
  for (const htmlName of HTML_FILES) htmlSources.set(htmlName, await readFile(absolutePath(htmlName), 'utf8'));
  const rawEntries = await rawAssetEntries(htmlSources, sourceContents);
  const outputs = await compileOutputs(rawEntries, sourceContents);
  const entries = new Map([...rawEntries, ...outputEntries(outputs)]);

  const criticoBruto = extractCritical(sourceContents.get('assets/css/style.css'));
  if (!criticoBruto.includes('.preloader')) {
    throw new Error('CSS crítico saiu sem as regras da cortina — o extrator perdeu o alvo');
  }
  const critico = (await transform(criticoBruto, {
    charset: 'utf8', legalComments: 'none', loader: 'css', minify: true, sourcemap: false,
  })).code.trim();

  const htmlOutputs = new Map();
  for (const [htmlName, source] of htmlSources) {
    htmlOutputs.set(htmlName, Buffer.from(syncHtml(source, entries, critico)));
  }
  return { entries, htmlOutputs, manifest: manifestBytes(entries), outputs };
}

async function atomicWrite(file, bytes) {
  await mkdir(path.dirname(file), { recursive: true });
  if (await exists(file)) {
    const current = await readFile(file);
    if (current.equals(bytes)) return false;
  }
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.tmp-${process.pid}`);
  await writeFile(temporary, bytes);
  await rename(temporary, file);
  return true;
}

/* HTML servido nao leva comentario.
   ==========================================================================
   CSS e JS podem ser comentados a vontade: o build os minifica e o comentario
   fica pelo caminho. O HTML nao passa por isso — ele vai para o ar exatamente
   como esta escrito, e todo comentario aparece para quem abrir o codigo-fonte
   da pagina. Ja saiu daqui, publicado, a explicacao de como o consentimento
   controla o carregamento do Google e da Meta.

   Documentacao de decisao do HTML vive em build/NOTAS-HTML.md.
   Passam apenas os marcadores que o proprio build consome. */
const MARCADORES_PERMITIDOS = new Set(['seo:inicio', 'seo:fim']);

function recusaComentariosNoHtml(nome, html) {
  const encontrados = [...html.matchAll(/<!--([\s\S]*?)-->/g)]
    .map((m) => m[1].replace(/\s+/g, ' ').trim())
    .filter((t) => !MARCADORES_PERMITIDOS.has(t));
  if (!encontrados.length) return;
  const lista = encontrados
    .map((t) => '    - ' + t.slice(0, 90) + (t.length > 90 ? '...' : ''))
    .join('\n');
  throw new Error(
    '[build] ' + nome + ' tem ' + encontrados.length + ' comentario(s) que iriam para o ar:\n' + lista + '\n' +
    '  Mova a explicacao para build/NOTAS-HTML.md, ou para o .js/.css do assunto (esses sao minificados).');
}

async function writeBuild() {
  const build = await computeBuild();
  for (const [nome, bytes] of build.htmlOutputs) recusaComentariosNoHtml(nome, bytes.toString('utf8'));
  await cleanBuild();
  for (const [name, bytes] of build.outputs) await atomicWrite(absolutePath(name), bytes);
  for (const [name, bytes] of build.htmlOutputs) await atomicWrite(absolutePath(name), bytes);
  await atomicWrite(MANIFEST_PATH, build.manifest);
  console.log(`[build] PASS — ${build.outputs.size} minificados e ${build.entries.size} assets no manifesto`);
}

async function checkBuild() {
  const build = await computeBuild();
  const expected = new Map([
    ...[...build.outputs].map(([name, bytes]) => [absolutePath(name), bytes]),
    ...[...build.htmlOutputs].map(([name, bytes]) => [absolutePath(name), bytes]),
    [MANIFEST_PATH, build.manifest],
  ]);
  const failures = [];
  for (const [file, bytes] of expected) {
    if (!(await exists(file))) failures.push(`${publicPath(file)} ausente`);
    else if (!(await readFile(file)).equals(bytes)) failures.push(`${publicPath(file)} desatualizado`);
  }
  if (failures.length) {
    for (const failure of failures) console.error(`[build:check] FAIL — ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[build:check] PASS — ${expected.size} arquivos reproduzíveis`);
}

const mode = process.argv[2] ?? '--write';
if (mode === '--clean') await cleanBuild();
else if (mode === '--write') await writeBuild();
else if (mode === '--check') await checkBuild();
else throw new Error(`modo inválido: ${mode}`);
