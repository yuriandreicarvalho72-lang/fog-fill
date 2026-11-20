// Gera public/meus-efeitos/lista.json com os efeitos próprios do mestre (arquivos .webm na pasta meus-efeitos).
// Pastas = tipo: alvo, area, em-si, projetil, linha, cone (arquivo solto na raiz = area). Nome do visual = "meu_" + nome do arquivo.
import { readdir, writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { meuNome, TIPOS_PROPRIOS } from "../src/abil.js";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "meus-efeitos");
const tipos = TIPOS_PROPRIOS.map(([k]) => k);
const lista = [];
const nomes = new Set();
const add = (tipo, pasta, arq) => {
  if (!/\.webm$/i.test(arq)) { if (!/^(LEIA-ME\.txt|lista\.json|\.gitkeep)$/.test(arq)) console.warn(`[meus-efeitos] ignorado (não é .webm): ${pasta}${arq}`); return; }
  let nome = meuNome(arq);
  if (nomes.has(nome)) { let i = 2; while (nomes.has(`${nome}_${i}`)) i++; nome = `${nome}_${i}`; }
  nomes.add(nome);
  lista.push({ nome, tipo, file: `meus-efeitos/${pasta}${arq}` });
};
try {
  await mkdir(DIR, { recursive: true });
  for (const ent of await readdir(DIR, { withFileTypes: true })) {
    if (ent.isFile()) add("area", "", ent.name);
    else if (ent.isDirectory() && tipos.includes(ent.name)) for (const f of await readdir(join(DIR, ent.name))) add(ent.name, `${ent.name}/`, f);
    else if (ent.isDirectory()) console.warn(`[meus-efeitos] pasta ${ent.name} ignorada (use: ${tipos.join(", ")})`);
  }
  lista.sort((a, b) => a.nome.localeCompare(b.nome));
  await writeFile(join(DIR, "lista.json"), JSON.stringify(lista, null, 1));
  console.log(`[meus-efeitos] ${lista.length} efeito(s) próprio(s)`);
} catch (e) {
  console.warn("[meus-efeitos] sem lista:", e.message);
}
