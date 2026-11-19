import { defineConfig } from "vite";
import { resolve } from "path";

// Hospedada como subpasta do repositório fog-fill no GitHub Pages.
const BASE = process.env.BASE ?? "/fog-fill/arsenal/";

function manifest() {
  return {
    name: "obr-manifest",
    generateBundle() {
      const m = {
        name: "Arsenal",
        version: "1.0.0",
        manifest_version: 1,
        author: "Yuri",
        description: "Armas de fogo animadas: monte o repertório do token pelo catálogo de Metrópole, mire e atire. Traçantes, explosões, fumaça.",
        icon: `${BASE}icon.svg`,
        background_url: `${BASE}background.html`,
        action: { title: "Arsenal", icon: `${BASE}icon.svg`, popover: `${BASE}index.html`, height: 680, width: 400 },
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
