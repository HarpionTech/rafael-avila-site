/* Converte os PNG pesados para WebP.
   ==========================================================================
   Os PNG originais FICAM no repositório: são a fonte, e é deles que qualquer
   reconversão futura sai. Só deixam de ser servidos.

   Os cinco depoimentos são capturas de conversa — texto sobre fundo claro, que
   é justamente o conteúdo em que compressão com perda aparece primeiro, como
   borrão na borda das letras. Por isso vão em qualidade alta e sem redimensionar:
   o cartão abre a imagem em tamanho integral num clique, e quem clica é alguém
   que quer LER o depoimento. Economizar aqui derrubaria o único motivo da
   imagem existir.

   O canal alpha dos cinco está inteiro em 255 — opacidade total, um quarto do
   arquivo carregando informação que não existe. `.flatten()` descarta.

   Uso: node build/imagens.mjs [--write]
   Sem --write apenas relata o que faria. */
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ESCREVER = process.argv.includes('--write');

const TAREFAS = [
  // Capturas de conversa: qualidade alta, resolução intacta, sem alpha.
  ...[1, 2, 3, 4, 5].map((n) => ({
    origem: `assets/depoimento (${n}).png`,
    destino: `assets/depoimento-${n}.webp`,
    qualidade: 90,
    achatar: true,
  })),
  /* O retrato é foto: tolera bem mais compressão que texto. Sai em duas
     larguras porque o CSS o limita a 560px — servir 1254px para um espaço de
     560 é pagar quatro vezes a área por nada. */
  { origem: 'assets/perfil.png', destino: 'assets/perfil-1254.webp', qualidade: 82, largura: 1254 },
  { origem: 'assets/perfil.png', destino: 'assets/perfil-640.webp', qualidade: 82, largura: 640 },
];

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

async function main() {
  let antes = 0;
  let depois = 0;
  for (const tarefa of TAREFAS) {
    const origem = path.join(ROOT, tarefa.origem);
    const destino = path.join(ROOT, tarefa.destino);
    const bruto = await readFile(origem);

    let pipeline = sharp(bruto);
    if (tarefa.achatar) pipeline = pipeline.flatten({ background: '#ffffff' });
    if (tarefa.largura) pipeline = pipeline.resize({ width: tarefa.largura, withoutEnlargement: true });
    const saida = await pipeline.webp({ quality: tarefa.qualidade, effort: 6 }).toBuffer();

    const original = (await stat(origem)).size;
    antes += original;
    depois += saida.length;
    const corte = (100 - (saida.length / original) * 100).toFixed(0);
    console.log(`[img] ${path.basename(tarefa.destino).padEnd(22)} ${kb(original).padStart(8)} -> ${kb(saida.length).padStart(8)}  (-${corte}%)`);
    if (ESCREVER) await writeFile(destino, saida);
  }
  console.log(`[img] total ${kb(antes)} -> ${kb(depois)} (-${(100 - (depois / antes) * 100).toFixed(0)}%)`);
  if (!ESCREVER) console.log('[img] simulação — rode com --write para gravar');
}

main().catch((erro) => {
  console.error(`[img] falhou: ${erro.message}`);
  process.exit(1);
});
