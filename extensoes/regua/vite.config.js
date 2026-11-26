import { defineConfig } from "vite";
import { resolve } from "path";

// Hospedada como subpasta do repositório fog-fill no GitHub Pages.
const BASE = process.env.BASE ?? "/fog-fill/regua/";

function manifest() {
  return {
    name: "obr-manifest",
    generateBundle() {
      const m = {
        name: "Régua",
        version: "1.6.2",
        manifest_version: 1,
        author: "Yuri",
        description: "Régua no estilo Roll20: mover token por pontos, medir, áreas de D&D, terreno difícil, visão e cobertura.",
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
        overlay: resolve(__dirname, "overlay.html"),
      },
    },
  },
  server: { cors: { origin: "https://www.owlbear.rodeo" } },
}));
