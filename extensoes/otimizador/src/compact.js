// Painel compacto: seções que fecham (lembra o que você deixou aberto), ajuda escondida atrás do ⓘ e espaçamento menor.
// Cópia igual em todas as extensões (cada uma compila sozinha). Não mexe na lógica do painel.
const NS = "compacto:" + location.pathname.replace(/[^/]*$/, "");
const get = (k) => { try { return localStorage.getItem(NS + k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(NS + k, v); } catch { /* sem armazenamento: só não lembra */ } };

const css = document.createElement("style");
css.textContent = `
main { padding: 8px 10px 10px !important; }
main > h1 { font-size: 14px !important; margin: 0 0 4px !important; display: flex; align-items: center; gap: 4px; }
main > h1 .cx { margin-left: auto; display: flex; gap: 2px; }
main > h1 .cx button { padding: 0 6px; font-size: 12px; line-height: 20px; border-radius: 5px; }
main > h1 + .hint { display: none; margin: 0 0 6px; font-size: 12px; }
main.info > h1 + .hint { display: block; }
section { padding-top: 6px !important; margin-top: 6px !important; }
section.cz > h2:first-child { cursor: pointer; user-select: none; margin-bottom: 4px !important; }
section.cz > h2:first-child::before { content: "▾"; display: inline-block; width: 14px; }
section.cz.fechado > h2:first-child { margin-bottom: 0 !important; }
section.cz.fechado > h2:first-child::before { content: "▸"; }
section.cz.fechado > :not(h2:first-child) { display: none !important; }
label { margin-top: 5px !important; }
.hint, small { font-size: 12px; }
`;
document.head.appendChild(css);

const title = (s) => (s.querySelector(":scope > h2:first-child")?.textContent || "").trim().slice(0, 60);

function enhance(root) {
  const main = document.querySelector("main");
  if (!main) return;
  const h1 = main.querySelector(":scope > h1");
  if (h1 && !h1.querySelector(".cx")) {
    const box = document.createElement("span");
    box.className = "cx";
    const mk = (txt, tip, fn) => { const b = document.createElement("button"); b.type = "button"; b.textContent = txt; b.title = tip; b.addEventListener("click", fn); box.appendChild(b); };
    if (main.querySelector(":scope > h1 + .hint")) mk("ⓘ", "mostrar/esconder a ajuda", () => main.classList.toggle("info"));
    mk("▾", "abrir todas as seções", () => all(false));
    mk("▸", "fechar todas as seções", () => all(true));
    h1.appendChild(box);
  }
  for (const s of root.querySelectorAll("section")) {
    if (s.dataset.cz) continue;
    const t = title(s);
    if (!t) continue;
    const jaTemAberta = !!document.querySelector("section.cz:not(.fechado):not([hidden])");
    s.dataset.cz = "1";
    s.classList.add("cz");
    const saved = get(t);
    const fechado = saved == null ? (s.hidden || jaTemAberta) : saved === "1"; // padrão: só a primeira seção visível aberta
    if (fechado) s.classList.add("fechado");
    s.querySelector(":scope > h2:first-child").addEventListener("click", () => {
      s.classList.toggle("fechado");
      set(t, s.classList.contains("fechado") ? "1" : "0");
    });
  }
}
function all(fechar) {
  for (const s of document.querySelectorAll("section.cz")) {
    s.classList.toggle("fechado", fechar);
    set(title(s), fechar ? "1" : "0");
  }
}

const start = () => {
  enhance(document);
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => enhance(document), 30); })
    .observe(document.body, { childList: true, subtree: true });
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
