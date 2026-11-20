import { defineConfig } from "vite";
import { resolve } from "path";

// Hospedada como subpasta do repositório fog-fill no GitHub Pages.
const BASE = process.env.BASE ?? "/fog-fill/otimizador/";

function manifest() {
  return {
    name: "obr-manifest",
    generateBundle() {
      const m = {
        name: "Otimizador",
        version: "1.0.0",
        manifest_version: 1,
        author: "Yuri",
        description: "Deixa as nossas extensões mais leves no seu computador (perfis Leve/Equilibrado/Máximo) e mostra o que pesa na cena.",
        icon: `${BASE}icon.svg`,
        action: { title: "Otimizador", icon: `${BASE}icon.svg`, popover: `${BASE}index.html`, height: 620, width: 360 },
      };
      if (m.description.length > 128) throw new Error("descrição do manifest passa de 128 caracteres");
      this.emitFile({ type: "asset", fileName: "manifest.json", source: JSON.stringify(m, null, 2) });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? BASE : "/",
  plugins: [manifest()],
  build: { rollupOptions: { input: { main: resolve(__dirname, "index.html") } } },
  server: { cors: { origin: "https://www.owlbear.rodeo" } },
}));
