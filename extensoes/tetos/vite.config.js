import { defineConfig } from "vite";
import { resolve } from "path";

// Hospedada como subpasta do repositório fog-fill no GitHub Pages.
const BASE = process.env.BASE ?? "/fog-fill/tetos/";

function manifest() {
  return {
    name: "obr-manifest",
    generateBundle() {
      const m = {
        name: "Tetos",
        version: "1.0.1",
        manifest_version: 1,
        author: "Yuri",
        description: "Tetos que somem só para quem entra, sem usar a fog: a fog e a visão do Smoke & Spectre continuam por cima.",
        icon: `${BASE}icon.svg`,
        background_url: `${BASE}background.html`,
        action: { title: "Tetos", icon: `${BASE}icon.svg`, popover: `${BASE}index.html`, height: 380, width: 320 },
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
      input: { main: resolve(__dirname, "index.html"), background: resolve(__dirname, "background.html") },
    },
  },
  server: { cors: { origin: "https://www.owlbear.rodeo" } },
}));
