import { defineConfig } from "vite";
import { resolve } from "path";

// Hospedada como subpasta do repositório fog-fill no GitHub Pages.
const BASE = process.env.BASE ?? "/fog-fill/selecao/";

function manifest() {
  return {
    name: "obr-manifest",
    generateBundle() {
      const m = {
        name: "Seleção total",
        version: "1.0.0",
        manifest_version: 1,
        author: "Yuri",
        description: "Ferramenta de seleção do mestre que pega até itens trancados, o fog e o mapa (clique, ciclo e caixa).",
        icon: `${BASE}icon.svg`,
        background_url: `${BASE}background.html`,
      };
      if (m.description.length > 128) throw new Error("descrição do manifest passa de 128 caracteres");
      this.emitFile({ type: "asset", fileName: "manifest.json", source: JSON.stringify(m, null, 2) });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? BASE : "/",
  plugins: [manifest()],
  build: { rollupOptions: { input: { background: resolve(__dirname, "background.html") } } },
  server: { cors: { origin: "https://www.owlbear.rodeo" } },
}));
