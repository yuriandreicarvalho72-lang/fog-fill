// Operações da Vigilância com o SDK (usadas pelo segundo plano, pelo painel e pelo popover de aprovação).
import OBR from "@owlbear-rodeo/sdk";
import { CAM, NODE, ACCESS, DEFAULT_CAM, newNode, nodeOf, stateLabel } from "./core.js";

export const ID = "vigilancia";
export const PENDING = `${ID}/pedidos`;         // metadado da cena: [{ id, node, nodeName, action, by, byName, at }]
// canais (destino ALL; só um mestre executa o que muda a cena)
export const CH_SEEN = `${ID}/viu`;             // líder -> todos: { camera, name, tokens: [novos], all: [todos], alertAll }
export const CH_NODE = `${ID}/no-mudou`;        // líder -> todos: { id, name, type, state, prev }
export const CH_SET = `${ID}/mudar`;            // outras extensões (Gatilhos) -> líder: { targets: [id], state, from? }
export const CH_REQ = `${ID}/pedido`;           // jogador -> líder: { node, action }
export const CH_RES = `${ID}/resposta`;         // mestre -> todos: { by, nodeName, action, ok }
export const CH_VISION = `${ID}/visao`;          // painel do jogador / Gatilhos -> líder: { targets: [id], mode: "termica"|"baixa"|"todos", on, from? }
export const CH_PREFS = `${ID}/prefs`;          // painel -> segundo plano (LOCAL): preferências deste navegador mudaram
export const APPROVE = `${ID}/aprovar`;         // id do popover de aprovação

export const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;
export const itemName = (i) => i?.text?.plainText?.trim() || i?.name || "item";
export const uid = () => Math.random().toString(36).slice(2, 9);

// preferências deste navegador (ver cones / ver a camada RA)
const PREFS_KEY = `${ID}/prefs`;
export function getPrefs() {
  try { return { cones: true, ra: true, tint: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return { cones: true, ra: true, tint: true }; }
}
export function setPrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* sem armazenamento: vale só agora */ }
  OBR.broadcast.sendMessage(CH_PREFS, p, { destination: "LOCAL" }).catch(() => {});
}

export const getAccess = async () => ({ players: [], autoApprove: false, ...((await OBR.scene.getMetadata())[ACCESS] || {}) });
export async function setAccess(fn) {
  const cur = await getAccess();
  await OBR.scene.setMetadata({ [ACCESS]: fn(JSON.parse(JSON.stringify(cur))) });
}

/** Muda o estado dos nós (câmera sem nó ganha um). Devolve quantos mudaram. */
export async function setState(ids, state) {
  const items = (await OBR.scene.items.getItems(ids)).filter((i) => i.metadata?.[NODE] || i.metadata?.[CAM]);
  if (!items.length) return 0;
  await OBR.scene.items.updateItems(items.map((i) => i.id), (d) => {
    for (const it of d) {
      const n = { ...(it.metadata[NODE] || newNode(it, "camera")) };
      n.state = state;
      it.metadata[NODE] = n;
    }
  });
  return items.length;
}

/** Transforma itens em câmeras (e em nós do tipo câmera). */
export async function makeCamera(ids) {
  await OBR.scene.items.updateItems(ids, (d) => {
    for (const it of d) {
      if (!it.metadata[CAM]) it.metadata[CAM] = { ...DEFAULT_CAM };
      if (!it.metadata[NODE]) it.metadata[NODE] = newNode(it, "camera");
    }
  });
}

/** Transforma itens em nós da Matriz (adivinha "porta" pelo nome). */
export async function makeNode(ids) {
  await OBR.scene.items.updateItems(ids, (d) => {
    for (const it of d) {
      if (it.metadata[NODE]) continue;
      const nm = itemName(it).toLowerCase();
      it.metadata[NODE] = newNode(it, it.metadata[CAM] ? "camera" : /porta|door|port[aã]o|grade/.test(nm) ? "porta" : /painel|terminal|console/.test(nm) ? "painel" : "outro");
    }
  });
}

export async function editCam(id, fn) {
  await OBR.scene.items.updateItems([id], (d) => { for (const it of d) it.metadata[CAM] = fn({ ...DEFAULT_CAM, ...(it.metadata[CAM] || {}) }); });
}
export async function editNode(id, fn) {
  await OBR.scene.items.updateItems([id], (d) => { for (const it of d) it.metadata[NODE] = fn({ ...(nodeOf(it) || newNode(it)) }); });
}

/** Mestre decide um pedido de hack (aprova: muda o estado do nó). */
export async function decide(reqId, ok) {
  const md = await OBR.scene.getMetadata();
  const list = Array.isArray(md[PENDING]) ? md[PENDING] : [];
  const r = list.find((x) => x.id === reqId);
  if (!r) return;
  await OBR.scene.setMetadata({ [PENDING]: list.filter((x) => x.id !== reqId) });
  if (ok) await setState([r.node], r.action);
  OBR.broadcast.sendMessage(CH_RES, { by: r.by, nodeName: r.nodeName, action: r.action, ok }, { destination: "ALL" }).catch(() => {});
  OBR.notification.show(`Vigilância: ${ok ? "aprovado" : "negado"} — ${r.byName} → ${r.nodeName} (${stateLabel(r.action)}).`, ok ? "SUCCESS" : "INFO");
}

export function applyTheme(theme) {
  const r = document.documentElement.style;
  document.documentElement.classList.toggle("light", theme.mode === "LIGHT");
  if (theme.text?.primary) r.setProperty("--fg", theme.text.primary);
  if (theme.text?.secondary) r.setProperty("--muted", theme.text.secondary);
  if (theme.primary?.main) r.setProperty("--accent", theme.primary.main);
}
