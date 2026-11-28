import { defineConfig } from "vite";
import { resolve } from "path";

// Hospedada como subpasta do repositório fog-fill no GitHub Pages.
const BASE = process.env.BASE ?? "/fog-fill/vigilancia/";

function manifest() {
  return {
    name: "obr-manifest",
    generateBundle() {
      const m = {
        name: "Vigilância",
        version: "1.4.2",
        manifest_version: 1,
        author: "Yuri",
        description: "Câmeras com cone, ruído, ronda de guardas, verdade por jogador e a camada RA da Matriz (hack com aprovação do mestre).",
        icon: `${BASE}icon.svg`,
        background_url: `${BASE}background.html`,
        action: { title: "Vigilância", icon: `${BASE}icon.svg`, popover: `${BASE}index.html`, height: 620, width: 380 },
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
        aprovar: resolve(__dirname, "aprovar.html"),
      },
    },
  },
  server: { cors: { origin: "https://www.owlbear.rodeo" } },
}));
