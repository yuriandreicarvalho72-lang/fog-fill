import { defineConfig } from "vite";
import { resolve } from "path";

// Hospedada como subpasta do repositório fog-fill no GitHub Pages.
const BASE = process.env.BASE ?? "/fog-fill/anonimato/";

function manifest() {
  return {
    name: "obr-manifest",
    generateBundle() {
      const m = {
        name: "Anonimato",
        version: "1.2.0",
        manifest_version: 1,
        author: "Yuri",
        description: "Deixa qualquer item anônimo para os jogadores (nome, texto e imagem) sem quebrar luz, visão e extensões.",
        icon: `${BASE}icon.svg`,
        background_url: `${BASE}background.html`,
        action: { title: "Anonimato", icon: `${BASE}icon.svg`, popover: `${BASE}index.html`, height: 560, width: 380 },
      };
      if (m.description.length > 128) throw new Error("descrição do manifest passa de 128 caracteres");
      this.emitFile({ type: "asset", fileName: "manifest.json", source: JSON.stringify(m, null, 2) });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? BASE : "/",
  plugins: [manifest()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        background: resolve(__dirname, "background.html"),
      },
    },
  },
  server: { cors: { origin: "https://www.owlbear.rodeo" } },
}));
