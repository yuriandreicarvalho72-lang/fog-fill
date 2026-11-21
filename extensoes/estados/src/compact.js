// Painel em páginas, com menu lateral como o do Smoke: o botão ☰ abre a lista de páginas e só a escolhida aparece.
// Página "Principal" = tudo que não está numa <section> com título; cada <section> com <h2> vira uma página.
// Cópia igual em todas as extensões (cada uma compila sozinha). Não mexe na lógica do painel.
const NS = "menu:" + location.pathname.replace(/[^/]*$/, "");
const get = (k) => { try { return localStorage.getItem(NS + k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(NS + k, v); } catch { /* sem armazenamento: só não lembra */ } };

const css = document.createElement("style");
css.textContent = `
main { padding: 8px 10px 10px !important; }
main > h1 { font-size: 14px !important; margin: 0 0 6px !important; display: flex; align-items: center; gap: 6px; }
main > h1 .cmenu, main > h1 .cinfo { padding: 0 7px; font-size: 14px; line-height: 22px; border-radius: 6px; }
main > h1 .cpg { color: var(--muted); font-weight: 400; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
main > h1 .cinfo { margin-left: auto; }
main > h1 + .hint { display: none; margin: 0 0 6px; font-size: 12px; }
main.info > h1 + .hint { display: block; }
main > .pgoff { display: none !important; }
section.cz { border-top: 0 !important; padding-top: 0 !important; margin-top: 0 !important; }
section.cz > h2:first-child { display: none !important; }
label { margin-top: 5px !important; }
.hint, small { font-size: 12px; }
.cbg { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 50; display: none; }
.cdrawer { position: fixed; top: 0; left: 0; bottom: 0; width: 62%; max-width: 170px; z-index: 51; background: #2b2535; color: #e8eef5; display: flex; flex-direction: column; transform: translateX(-104%); transition: transform .14s ease; box-shadow: 2px 0 10px rgba(0,0,0,.4); }
:root.light .cdrawer { background: #ece8f3; color: #1d2129; }
main.menu .cdrawer { transform: none; }
main.menu .cbg { display: block; }
.cdrawer .ctop { background: var(--accent); color: #17141c; font-weight: 800; font-size: 17px; padding: 18px 12px 14px; }
.cdrawer .citems { overflow-y: auto; padding: 6px 0; }
.cdrawer button { display: block; width: 100%; text-align: left; background: none; border: 0; border-radius: 0; padding: 10px 14px; font-size: 13px; color: inherit; }
.cdrawer button:hover { background: rgba(255,255,255,.08); }
.cdrawer button.on { background: var(--accent); color: #17141c; font-weight: 700; }
`;
document.head.appendChild(css);

const PRINCIPAL = "Principal";
let active = null;
const titleOf = (s) => (s.querySelector(":scope > h2:first-child")?.textContent || "").trim().slice(0, 40);
const skip = (el, main) => el.tagName === "H1" || el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.classList.contains("cdrawer") || el.classList.contains("cbg") || el === main.querySelector(":scope > h1 + .hint");
const pageOf = (el) => (el.tagName === "SECTION" && titleOf(el)) || PRINCIPAL;

function enhance() {
  const main = document.querySelector("main");
  if (!main) return;
  const kids = [...main.children].filter((el) => !skip(el, main));
  // páginas na ordem do documento; "Principal" só existe se tiver algo visível
  const pages = [];
  const vis = (el) => !el.hidden;
  for (const el of kids) {
    const p = pageOf(el);
    if (p === PRINCIPAL && !vis(el)) continue;
    if (el.tagName === "SECTION" && p !== PRINCIPAL) el.classList.add("cz");
    if (!pages.includes(p)) pages.push(p);
  }
  if (!pages.length) return;
  if (pages.includes(PRINCIPAL)) pages.splice(0, pages.length, PRINCIPAL, ...pages.filter((x) => x !== PRINCIPAL));
  if (!active || !pages.includes(active)) {
    const saved = get("pagina");
    active = pages.includes(saved) ? saved : pages[0];
  }
  for (const el of kids) el.classList.toggle("pgoff", pageOf(el) !== active);

  const h1 = main.querySelector(":scope > h1");
  if (h1) {
    if (pages.length > 1) {
      if (!h1.querySelector(".cmenu")) {
        const b = document.createElement("button"); b.type = "button"; b.className = "cmenu"; b.textContent = "☰"; b.title = "menu";
        b.addEventListener("click", () => main.classList.add("menu"));
        h1.prepend(b);
      }
      let tag = h1.querySelector(".cpg");
      if (!tag) {
        tag = document.createElement("span"); tag.className = "cpg";
        const txt = [...h1.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        if (txt) txt.after(tag); else h1.appendChild(tag);
      }
      const want = active !== PRINCIPAL ? "· " + active : "";
      if (tag.textContent !== want) tag.textContent = want;
    }
    if (main.querySelector(":scope > h1 + .hint") && !h1.querySelector(".cinfo")) {
      const b = document.createElement("button"); b.type = "button"; b.className = "cinfo"; b.textContent = "ⓘ"; b.title = "mostrar/esconder a ajuda";
      b.addEventListener("click", () => main.classList.toggle("info"));
      h1.appendChild(b);
    }
  }
  // menu lateral
  let drawer = main.querySelector(":scope > .cdrawer");
  if (pages.length < 2) { drawer?.remove(); main.querySelector(":scope > .cbg")?.remove(); return; }
  if (!drawer) {
    const bg = document.createElement("div"); bg.className = "cbg"; bg.addEventListener("click", () => main.classList.remove("menu"));
    drawer = document.createElement("nav"); drawer.className = "cdrawer";
    main.append(bg, drawer);
  }
  const nome = (h1?.childNodes && [...h1.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim())?.textContent.trim()) || document.title;
  const sig = pages.join("|") + "|" + active + "|" + nome;
  if (drawer.dataset.sig === sig) return;
  drawer.dataset.sig = sig;
  drawer.textContent = "";
  const top = document.createElement("div"); top.className = "ctop"; top.textContent = nome; drawer.appendChild(top);
  const list = document.createElement("div"); list.className = "citems"; drawer.appendChild(list);
  for (const p of pages) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = p; if (p === active) b.className = "on";
    b.addEventListener("click", () => { active = p; set("pagina", p); main.classList.remove("menu"); enhance(); window.scrollTo(0, 0); });
    list.appendChild(b);
  }
}

const start = () => {
  enhance();
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(enhance, 30); }).observe(document.body, { childList: true, subtree: true });
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
