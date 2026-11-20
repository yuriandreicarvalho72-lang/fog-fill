// Baixa os vídeos do JB2A usados pelo Arsenal (armas e habilidades) para public/jb2a/ (o Vite copia para o site publicado).
// Fonte: repositório oficial gratuito do JB2A, num commit fixo. Licença dos vídeos: CC BY-NC-SA 4.0.
// Também baixa os vídeos "BLFX/..." do pacote gratuito Boss Loot FX (commit fixo; licença com atribuição, ver src/abil.js).
// Nunca derruba o build: se algum arquivo não baixar, ele fica de fora de ok.json e o Arsenal usa o
// efeito desenhado no lugar dele.
import { mkdir, writeFile, stat } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { allFiles, JB2A_REPO, JB2A_COMMIT, JB2A_CREDIT } from "../src/jb2a.js";
import { BLFX_REPO, BLFX_COMMIT, BLFX_CREDIT, BLFX_LICENSE } from "../src/abil.js"; // registra os vídeos das habilidades na mesma lista

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "jb2a");
const RAW = `https://raw.githubusercontent.com/${JB2A_REPO}/${JB2A_COMMIT}/Library/`;
// arquivos "BLFX/..." vêm do Boss Loot FX (pasta artwork/ do repositório, commit fixo)
const RAW_BLFX = `https://raw.githubusercontent.com/${BLFX_REPO}/${BLFX_COMMIT}/artwork/`;
const urlOf = (file) => (file.startsWith("BLFX/") ? RAW_BLFX + encodeURI(file.slice(5)) : RAW + encodeURI(file));
const files = allFiles();
const ok = [];

async function get(file) {
  const dest = join(OUT, file);
  try { if ((await stat(dest)).size > 0) { ok.push(file); return; } } catch { /* ainda não baixado */ }
  for (let tent = 1; tent <= 3; tent++) {
    try {
      const r = await fetch(urlOf(file));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      ok.push(file);
      return;
    } catch (e) {
      if (tent === 3) console.warn(`[jb2a] falhou: ${file} (${e.message})`);
      else await new Promise((res) => setTimeout(res, 800 * tent));
    }
  }
}

try {
  await mkdir(OUT, { recursive: true });
  const fila = [...files];
  await Promise.all(Array.from({ length: 6 }, async () => { while (fila.length) await get(fila.shift()); }));
  ok.sort();
  await writeFile(join(OUT, "ok.json"), JSON.stringify({ commit: JB2A_COMMIT, files: ok }));
  await writeFile(join(OUT, "LEIA-ME.txt"),
    `${JB2A_CREDIT}\nVídeos do pacote gratuito do JB2A (https://jb2a.com), sem alteração.\n` +
    `Licença: Creative Commons Atribuição-NãoComercial-CompartilhaIgual 4.0 — https://creativecommons.org/licenses/by-nc-sa/4.0/\n` +
    `Origem: https://github.com/${JB2A_REPO} (commit ${JB2A_COMMIT})\n\n` +
    `${BLFX_CREDIT}\nPasta BLFX/: vídeos do pacote gratuito Boss Loot FX Assets, sem alteração.\n` +
    `Licença: ${BLFX_LICENSE}\nOrigem: https://github.com/${BLFX_REPO} (commit ${BLFX_COMMIT})\n`);
  console.log(`[jb2a] ${ok.length}/${files.length} vídeos prontos`);
} catch (e) {
  console.warn("[jb2a] sem vídeos:", e.message);
}
