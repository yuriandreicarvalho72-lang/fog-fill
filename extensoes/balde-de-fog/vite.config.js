import { defineConfig } from "vite";
import { resolve } from "path";

// BASE: caminho onde o site fica hospedado.
//  - GitHub Pages num repositório chamado "fog-fill":  /fog-fill/   (padrão)
//  - Netlify Drop ou domínio próprio na raiz:            /
const BASE = process.env.BASE ?? "/fog-fill/";

function manifest() {
  return {
    name: "obr-manifest",
    generateBundle() {
      const m = {
        name: "Balde de Fog",
        version: "1.4.4",
        manifest_version: 1,
        author: "Yuri",
        description: "Clique numa área do mapa e ela é coberta de fog: um balde de tinta por cor, com paredes opcionais.",
        icon: `${BASE}icon.svg`,
        background_url: `${BASE}background.html`,
      };
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
