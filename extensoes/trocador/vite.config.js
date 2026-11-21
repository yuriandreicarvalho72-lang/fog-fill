import { defineConfig } from "vite";
import { resolve } from "path";

// Hospedada como subpasta do repositório fog-fill no GitHub Pages.
// Sem ícone na barra de cima (pedido do Yuri): tudo pelo botão direito; o painel completo abre pelo ⚙ do menu.
const BASE = process.env.BASE ?? "/fog-fill/trocador/";

function manifest() {
  return {
    name: "obr-manifest",
    generateBundle() {
      const m = {
        name: "Trocador",
        version: "1.0.3",
        manifest_version: 1,
        author: "Yuri",
        description: "Troca a arte de tokens e objetos entre imagens guardadas neles. Integra com Gatilhos e Estados.",
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
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        background: resolve(__dirname, "background.html"),
        menu: resolve(__dirname, "menu.html"),
      },
    },
  },
  server: { cors: { origin: "https://www.owlbear.rodeo" } },
}));
