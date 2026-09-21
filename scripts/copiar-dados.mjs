// Copia data/processed/ para public/dados/, que é o que o Vite serve.
//
// Não é um symlink de propósito: o `vite build` não segue symlinks de forma
// fiável entre plataformas, e os dados têm de ir para o `dist/` publicado.
import { cp, mkdir, rm, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origem = join(raiz, "data", "processed");
const destino = join(raiz, "public", "dados");

await rm(destino, { recursive: true, force: true });
await mkdir(destino, { recursive: true });
await cp(origem, destino, { recursive: true });

const ficheiros = await readdir(destino);
let total = 0;
for (const f of ficheiros) total += (await stat(join(destino, f))).size;
console.log(
  `dados: ${ficheiros.length} ficheiros, ${(total / 1024).toFixed(0)} kB ` +
    `copiados para public/dados/`,
);
