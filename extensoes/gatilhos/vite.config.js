import { defineConfig } from "vite";
import { resolve } from "path";

// Hospedada como subpasta do repositório fog-fill no GitHub Pages.
const BASE = process.env.BASE ?? "/fog-fill/gatilhos/";

function manifest() {
  return {
    name: "obr-manifest",
    generateBundle() {
      const m = {
        name: "Gatilhos",
        version: "1.16.0",
        manifest_version: 1,
        author: "Yuri",
        description: "Causa e efeito: armadilhas, placas, fios e portas que disparam sozinhos quando qualquer token se move.",
        icon: `${BASE}icon.svg`,
        background_url: `${BASE}background.html`,
        action: { title: "Gatilhos", icon: `${BASE}icon.svg`, popover: `${BASE}index.html`, height: 640, width: 380 },
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
        nota: resolve(__dirname, "nota.html"),
        menu: resolve(__dirname, "menu.html"),
      },
    },
  },
  server: { cors: { origin: "https://www.owlbear.rodeo" } },
}));
