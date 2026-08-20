/* Converte para WebP as texturas do livro 3D.
   ==========================================================================
   Sao as duas maiores transferencias do carregamento — 304 KB dos 1278 KB
   totais — para alimentar um objeto que entra DEPOIS dos botoes da hero.

   Os JPEG originais ficam no repositorio: sao a fonte de qualquer reconversao.

   Qualidade 82 e nao 90: diferente dos depoimentos (que sao texto e abrem em
   tamanho integral), estas viram textura de um livro em perspectiva, iluminado
   por shader e amostrado a poucos pixels por centimetro. O detalhe que a
   compressao come nao chega a ser desenhado na tela.

   Reduz de 901 para 768 de largura. Com DPR 2 o livro ocupa ~800 px de textura
   efetiva no desktop e ~520 no celular, entao 768 e praticamente 1:1 no pior
   caso — e ele aparece em perspectiva, girando, o que perdoa mais que uma foto
   plana. O render foi comparado lado a lado antes e depois. */
import { readFile, writeFile, stat } from 'node:fs/promises';
import sharp from 'sharp';

/* largura escolhida pelo tamanho EFETIVO na tela (CSS x device pixel ratio),
   nao pelo tamanho do arquivo original. */
const ALVOS = [
  { origem: 'assets/capa do livro fisico.jpeg',   largura: 768,  qualidade: 80 },
  { origem: 'assets/frente do livro fisico.jpeg', largura: 768,  qualidade: 80 },
  // Exibida a 329 px CSS num celular com DPR 3 = 988 px efetivos; 1080 cobre.
  { origem: 'assets/terapia-online.jpg',          largura: 1080, qualidade: 82 },
];

let antes = 0, depois = 0;
for (const { origem, largura, qualidade } of ALVOS) {
  const destino = origem.replace(/\.jpe?g$/i, '.webp');
  const buf = await readFile(origem);
  const img = sharp(buf);
  const meta = await img.metadata();
  await writeFile(destino, await img.resize({ width: largura }).webp({ quality: qualidade, effort: 6 }).toBuffer());
  const a = (await stat(origem)).size, d = (await stat(destino)).size;
  antes += a; depois += d;
  console.log(`  ${origem.split('/').pop()}`);
  console.log(`    ${meta.width}x${meta.height}  ${(a/1024).toFixed(0)} KB -> ${(d/1024).toFixed(0)} KB  (-${Math.round((1-d/a)*100)}%)`);
}
console.log(`\n  total: ${(antes/1024).toFixed(0)} KB -> ${(depois/1024).toFixed(0)} KB  (-${Math.round((1-depois/antes)*100)}%)`);
