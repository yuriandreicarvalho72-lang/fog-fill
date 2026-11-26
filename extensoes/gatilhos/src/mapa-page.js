// Mapa lógico dos Gatilhos: diagrama (quem dispara quem), problemas e "e se?". Só leitura: não executa nada sozinho.
import { controls } from "./visibility.js";
import OBR from "@owlbear-rodeo/sdk";
import { ID, LIST, ALERT, alertLevel, ALERT_MAX, CH_FIRE, applyTheme } from "./shared.js";
import { arestas, niveis, problemas, simular, descreve, causeLabel } from "./mapa.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const COR = { chain: "#4fc3ff", rearm: "#3ddc84", cancel: "#ff5c5c", alerta: "#ffb347", no: "#c07bff", ruido: "#ffd23f" };
const NOME = { chain: "dispara", rearm: "rearma", cancel: "cancela", alerta: "alerta", no: "nó da Matriz", ruido: "ruído" };
const W = 220, H = 74, GX = 80, GY = 26;

let trigs = [], nomes = {}, ids = new Set(), alerta = 0;
let sel = null, sim = null, simAlerta = 0, confirmar = false;

async function load() {
  const [md, items] = await Promise.all([OBR.scene.getMetadata(), OBR.scene.items.getItems().catch(() => [])]);
  trigs = Array.isArray(md[LIST]) ? md[LIST] : [];
  nomes = Object.fromEntries(items.map((i) => [i.id, i.text?.plainText || i.name || i.type]));
  ids = new Set(items.map((i) => i.id));
  alerta = alertLevel(md);
  if (sel && !trigs.some((t) => t.id === sel)) { sel = null; sim = null; }
  render();
}

function layout(edges) {
  const lv = niveis(trigs, edges);
  const cols = new Map();
  for (const t of trigs) (cols.get(lv.get(t.id)) || cols.set(lv.get(t.id), []).get(lv.get(t.id))).push(t);
  const pos = new Map();
  let maxY = 0;
  for (const [n, arr] of [...cols.entries()].sort((a, b) => a[0] - b[0])) {
    arr.forEach((t, i) => { const y = 14 + i * (H + GY); pos.set(t.id, { x: 14 + n * (W + GX), y }); maxY = Math.max(maxY, y + H); });
  }
  return { pos, w: 14 + (cols.size ? Math.max(...cols.keys()) + 1 : 1) * (W + GX), h: maxY + 20 };
}

function caminho(a, b, k) {
  // sai pela direita de a e entra pela esquerda de b; para trás (ciclo) contorna por baixo
  const x1 = a.x + W, y1 = a.y + H / 2 + (k % 3 - 1) * 6, x2 = b.x, y2 = b.y + H / 2 + (k % 3 - 1) * 6;
  if (x2 > x1 + 10) { const m = (x1 + x2) / 2; return `M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}`; }
  const by = Math.max(a.y, b.y) + H + 18 + (k % 4) * 6;
  return `M${x1},${y1} C${x1 + 40},${y1} ${x1 + 40},${by} ${x1 - 20},${by} L${x2 + 20},${by} C${x2 - 40},${by} ${x2 - 40},${y2} ${x2},${y2}`;
}

function render() {
  const edges = arestas(trigs);
  const probs = problemas(trigs, { ids, nomes });
  const porTrig = new Map();
  for (const p of probs) if (p.trigger) (porTrig.get(p.trigger) || porTrig.set(p.trigger, []).get(p.trigger)).push(p);
  const { pos, w, h } = layout(edges);
  const alcancados = new Set((sim?.passos || []).filter((p) => p.tipo === "gatilho" && !p.cancelado).map((p) => p.trigger));
  const n = { erro: probs.filter((p) => p.nivel === "erro").length, aviso: probs.filter((p) => p.nivel === "aviso").length };
  $("resumo").textContent = `${trigs.length} gatilho${trigs.length === 1 ? "" : "s"} · ${edges.length} ligaç${edges.length === 1 ? "ão" : "ões"} · ${n.erro} erro${n.erro === 1 ? "" : "s"} · ${n.aviso} aviso${n.aviso === 1 ? "" : "s"}`;
  if (!trigs.length) { $("diagrama").innerHTML = '<p class="hint">Nenhum gatilho ainda.</p>'; $("lateral").innerHTML = ""; return; }

  const paths = edges.filter((a) => pos.has(a.de) && pos.has(a.para)).map((a, k) => {
    const d = caminho(pos.get(a.de), pos.get(a.para), k), cor = COR[a.tipo];
    const mid = pos.get(a.de).x + W + 8, my = pos.get(a.de).y + H / 2 - 4 + (k % 3 - 1) * 6;
    return `<path d="${d}" fill="none" stroke="${cor}" stroke-width="2" ${a.tipo === "chain" || a.tipo === "alerta" ? "" : 'stroke-dasharray="6 4"'} marker-end="url(#seta-${a.tipo})" opacity=".9"/>${a.atraso ? `<text x="${mid}" y="${my}" fill="${cor}" font-size="10.5" font-family="system-ui">+${a.atraso}s</text>` : ""}`;
  }).join("");
  const defs = Object.entries(COR).map(([k, c]) => `<marker id="seta-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join("");
  const nodes = trigs.map((t) => {
    const p = pos.get(t.id), pr = porTrig.get(t.id) || [];
    const erro = pr.some((x) => x.nivel === "erro"), av = pr.some((x) => x.nivel === "aviso");
    const nome = t.name.length > 26 ? `${t.name.slice(0, 25)}…` : t.name;
    const causa = causeLabel(t.cause).replace(/\s*\(.*\)$/, "");
    const sub = `${causa.length > 34 ? `${causa.slice(0, 33)}…` : causa}`;
    return `<g class="no${t.armed === false ? "" : " arm"}${sel === t.id ? " sel" : ""}${alcancados.has(t.id) ? " alc" : ""}" data-id="${t.id}" transform="translate(${p.x},${p.y})">
      <rect width="${W}" height="${H}" rx="9" ${t.armed === false ? 'stroke-dasharray="5 4"' : ""}/>
      <text x="12" y="22" font-weight="700">${esc(nome)}</text>
      <text x="12" y="40" class="sub">${esc(sub)}</text>
      <text x="12" y="58" class="sub">${(t.effects || []).length} efeito${(t.effects || []).length === 1 ? "" : "s"}${t.once ? " · uma vez" : ""}${t.delay ? ` · atraso ${t.delay}s` : ""}${t.armed === false ? " · desarmado" : ""}</text>
      ${erro ? `<text x="${W - 22}" y="22" fill="#ff5c5c" font-size="15">✖</text>` : av ? `<text x="${W - 22}" y="22" fill="#ffb347" font-size="15">⚠</text>` : ""}
    </g>`;
  }).join("");
  $("diagrama").innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${paths}${nodes}</svg>`;
  for (const g of $("diagrama").querySelectorAll(".no")) g.onclick = () => { sel = g.dataset.id; sim = null; confirmar = false; render(); };

  // lateral
  const t = trigs.find((x) => x.id === sel);
  const legenda = `<div class="leg">${Object.entries(NOME).map(([k, l]) => `<span><i style="border-color:${COR[k]}${k === "chain" || k === "alerta" ? "" : ";border-top-style:dashed"}"></i>${l}</span>`).join("")}</div>`;
  const lista = probs.length ? probs.map((p, i) => `<div class="prob ${p.nivel}" data-p="${p.trigger || ""}">${p.nivel === "erro" ? "✖" : p.nivel === "aviso" ? "⚠" : "ℹ"} ${esc(p.texto)}</div>`).join("") : '<p class="hint">Nenhum problema encontrado.</p>';
  let det = '<p class="hint">Clique num gatilho para ver o que ele faz e simular o "e se?".</p>';
  if (t) {
    const ins = edges.filter((a) => a.para === t.id).map((a) => `${esc(trigs.find((x) => x.id === a.de)?.name || "?")} (${NOME[a.tipo]})`);
    det = `<h2>${esc(t.name)}</h2>
      <p class="hint">${esc(causeLabel(t.cause))}${(t.zones || []).length ? ` — ${(t.zones || []).map((z) => esc(nomes[z] ?? "(item apagado)")).join(", ")}` : ""}</p>
      ${ins.length ? `<p class="hint">Disparado por: ${ins.join(", ")}</p>` : ""}
      ${(t.conds || []).length ? `<p class="hint">Só se: ${(t.conds || []).length} condição(ões)</p>` : ""}
      ${(t.effects || []).map((e) => `<div class="ef">${e.delay ? `<span class="hint" style="display:inline">+${e.delay}s </span>` : ""}${esc(descreve(e, nomes, trigs))}</div>`).join("") || '<p class="hint">Sem efeitos.</p>'}
      <h2>E se…</h2>
      <div class="row"><span class="hint grow">Nível de alerta de partida:</span><select id="simAlerta" style="width:70px">${Array.from({ length: ALERT_MAX + 1 }, (_, i) => `<option value="${i}" ${i === simAlerta ? "selected" : ""}>${i}</option>`).join("")}</select></div>
      <div class="btns"><button type="button" id="simular">▶ E se este disparar agora?</button><button type="button" id="real" class="${confirmar ? "btn-warn" : ""}">${confirmar ? "Confirmar: disparar de verdade" : "Disparar de verdade"}</button></div>
      ${sim ? simHtml() : ""}`;
  }
  $("lateral").innerHTML = `${legenda}<h2>Problemas</h2>${lista}${det}`;
  for (const el of $("lateral").querySelectorAll("[data-p]")) el.onclick = () => { if (el.dataset.p) { sel = el.dataset.p; sim = null; render(); } };
  $("simAlerta")?.addEventListener("change", (e) => { simAlerta = Number(e.target.value); });
  $("simular")?.addEventListener("click", () => { sim = simular(trigs, sel, { alerta: simAlerta, nomes }); render(); });
  $("real")?.addEventListener("click", () => {
    if (!confirmar) { confirmar = true; render(); return; }
    confirmar = false;
    OBR.broadcast.sendMessage(CH_FIRE, { id: sel, force: true }, { destination: "ALL" }).then(() => OBR.notification.show("Gatilho disparado.", "SUCCESS")).catch(() => {});
    render();
  });
}

function simHtml() {
  const prof = new Map();
  const dep = (p) => { if (prof.has(p.id)) return prof.get(p.id); const pai = sim.passos.find((x) => x.id === p.pai); const d = pai ? dep(pai) + (p.tipo === "gatilho" ? 1 : 0) : 0; prof.set(p.id, d); return d; };
  const linhas = sim.passos.map((p) => `<div class="tl ${p.tipo}${p.cancelado ? " cancelado" : ""}" style="margin-left:${Math.min(dep(p), 5) * 10}px"><span class="t">${p.em ? `+${Math.round(p.em * 10) / 10}s` : "já"}</span>${esc(p.texto)}${p.cancelado ? " (cancelado)" : ""}</div>`).join("");
  return `<h2>O que aconteceria</h2>${linhas}<p class="hint">Alerta no fim: ${sim.alertaFinal}. Simulação: não mexe em nada do mapa. Condições são supostas cumpridas.${sim.notas.map((n) => ` ${esc(n)}`).join("")}</p>`;
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  $("fechar").onclick = () => controls.modal.close(`${ID}/mapa`).catch(() => {});
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") controls.modal.close(`${ID}/mapa`).catch(() => {}); });
  if (await OBR.scene.isReady()) await load();
  simAlerta = alerta;
  let tm = null;
  const later = () => { clearTimeout(tm); tm = setTimeout(load, 200); };
  OBR.scene.onMetadataChange(later);
  OBR.scene.items.onChange(later);
});
