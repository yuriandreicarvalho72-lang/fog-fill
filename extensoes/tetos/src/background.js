// Tetos: cada navegador desenha uma CÓPIA LOCAL de cada teto e a esconde quando o seu personagem está dentro.
// O item original fica escondido (invisível para os jogadores); a fog e a visão do Smoke & Spectre continuam por cima,
// porque a cópia fica na camada ATTACHMENT, abaixo da camada de fog.
import OBR from "@owlbear-rodeo/sdk";
import { ID, META, ABRE, LOCAL, CH_ABRIR, cloneId, newTeto, inside, revealed, opensRoofs, sigOf, nextAberto, url } from "./shared.js";

const live = new Map();   // id do teto -> { sig, shown }
const boxes = new Map();  // id do teto -> { sig, box }
let busy = false, again = false, timer = null, cleaned = false;

const isRoof = (i) => i.metadata?.[META] != null;
const isToken = (i) => i.type === "IMAGE" && i.layer === "CHARACTER" && i.visible !== false;

async function boxOf(it) {
  const sig = sigOf(it);
  const c = boxes.get(it.id);
  if (c && c.sig === sig) return c.box;
  const box = await OBR.scene.items.getItemBounds([it.id]);
  boxes.set(it.id, { sig, box });
  return box;
}

/** Cópia local do teto: mesma imagem, mesmo lugar, na camada ATTACHMENT (abaixo da fog), sem clique. */
function copyOf(it, shown) {
  const c = JSON.parse(JSON.stringify(it));
  delete c.attachedTo;
  return { ...c, id: cloneId(it.id), visible: shown, locked: true, disableHit: true, disableAutoZIndex: true,
    layer: "ATTACHMENT", name: `Teto: ${it.name || "sem nome"}`, metadata: { [LOCAL]: it.id } };
}

async function reconcile() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    do {
      again = false;
      if (!cleaned) { // sobras de uma execução anterior da extensão
        cleaned = true;
        const old = await OBR.scene.local.getItems((i) => i.metadata?.[LOCAL] != null);
        if (old.length) await OBR.scene.local.deleteItems(old.map((i) => i.id));
      }
      const [role, me, players] = await Promise.all([OBR.player.getRole(), OBR.player.getId(), OBR.party.getPlayers()]);
      const isGM = role === "GM";
      const gmIds = new Set(players.filter((p) => p.role === "GM").map((p) => p.id));
      if (isGM) gmIds.add(me);
      const items = await OBR.scene.items.getItems((i) => isRoof(i) || isToken(i));
      const roofs = items.filter(isRoof);
      const tokens = items.filter((i) => !isRoof(i));
      const openers = tokens.filter((t) => opensRoofs(t, gmIds));
      const mine = tokens.filter((t) => t.createdUserId === me);

      const add = [], vis = new Map(), del = [];
      const wanted = new Set(roofs.map((r) => r.id));
      for (const [id] of live) if (!wanted.has(id)) { del.push(cloneId(id)); live.delete(id); boxes.delete(id); }

      for (const r of roofs) {
        const box = await boxOf(r);
        const open = revealed(r.metadata[META], {
          isGM,
          insideAny: openers.some((t) => inside(t.position, box)),
          insideOwn: mine.some((t) => inside(t.position, box)),
        });
        const shown = !open;
        const sig = sigOf(r) + r.zIndex + (r.image?.url || "");
        const cur = live.get(r.id);
        if (cur && cur.sig !== sig) { del.push(cloneId(r.id)); live.delete(r.id); }
        if (!live.get(r.id)) { add.push(copyOf(r, shown)); live.set(r.id, { sig, shown }); }
        else if (cur.shown !== shown) { vis.set(cloneId(r.id), shown); cur.shown = shown; }
      }
      if (del.length) await OBR.scene.local.deleteItems(del);
      if (add.length) await OBR.scene.local.addItems(add);
      if (vis.size) await OBR.scene.local.updateItems([...vis.keys()], (draft) => { for (const d of draft) d.visible = vis.get(d.id); });
    } while (again);
  } finally { busy = false; }
}
const soon = () => { clearTimeout(timer); timer = setTimeout(reconcile, 40); };

// ---------- menus (mestre) ----------
const icon = url("icon.svg");
const MARCADO = ["metadata", META];
async function marcar(items) {
  await OBR.scene.items.updateItems(items, (draft) => {
    for (const it of draft) { it.metadata[META] = newTeto(it.visible); it.visible = false; }
  });
}
async function desmarcar(items) {
  await OBR.scene.items.updateItems(items, (draft) => {
    for (const it of draft) { const antes = it.metadata[META]?.antes !== false; delete it.metadata[META]; it.visible = antes; }
  });
}
function menus() {
  OBR.contextMenu.create({
    id: `${ID}/teto`,
    icons: [
      { icon, label: "Tetos: marcar como teto (some quando o personagem entra)",
        filter: { roles: ["GM"], every: [{ key: "type", value: "IMAGE" }, { key: "layer", value: "CHARACTER", operator: "!=" }, { key: "layer", value: "MOUNT", operator: "!=" }, { key: MARCADO, value: undefined }] } },
      { icon, label: "Tetos: desmarcar (voltar a ser imagem comum)",
        filter: { roles: ["GM"], every: [{ key: MARCADO, value: undefined, operator: "!=" }] } },
    ],
    onClick(ctx) {
      const todos = ctx.items.every((i) => i.metadata?.[META] != null);
      (todos ? desmarcar : marcar)(ctx.items.filter((i) => (i.metadata?.[META] != null) === todos).map((i) => i.id));
    },
  });
  OBR.contextMenu.create({
    id: `${ID}/abre`,
    icons: [
      { icon, label: "Tetos: este token revela tetos", filter: { roles: ["GM"], every: [{ key: "layer", value: "CHARACTER" }, { key: ["metadata", ABRE], value: true, operator: "!=" }] } },
      { icon, label: "Tetos: este token deixa de revelar tetos", filter: { roles: ["GM"], every: [{ key: "layer", value: "CHARACTER" }, { key: ["metadata", ABRE], value: true }] } },
    ],
    onClick(ctx) {
      const on = !ctx.items.every((i) => i.metadata?.[ABRE] === true);
      OBR.scene.items.updateItems(ctx.items.map((i) => i.id), (draft) => { for (const it of draft) { if (on) it.metadata[ABRE] = true; else delete it.metadata[ABRE]; } });
    },
  });
}

// Outras extensões (Gatilhos...) abrem e fecham tetos por aqui: { ids?, nome?, op }
async function onAbrir(data) {
  if ((await OBR.player.getRole()) !== "GM") return;
  const nome = String(data?.nome || "").trim().toLowerCase();
  const ids = Array.isArray(data?.ids) ? data.ids : null;
  const alvo = await OBR.scene.items.getItems((i) => isRoof(i) && (ids ? ids.includes(i.id) : nome ? (i.name || "").toLowerCase().includes(nome) : true));
  if (!alvo.length) return;
  await OBR.scene.items.updateItems(alvo.map((i) => i.id), (draft) => {
    for (const it of draft) it.metadata[META] = { ...it.metadata[META], aberto: nextAberto(data?.op, it.metadata[META].aberto) };
  });
}

OBR.onReady(() => {
  menus();
  OBR.broadcast.onMessage(CH_ABRIR, (e) => onAbrir(e.data));
  OBR.scene.items.onChange(soon);
  OBR.party.onChange(soon);
  OBR.scene.onReadyChange((r) => { if (r) { cleaned = false; live.clear(); boxes.clear(); soon(); } });
  OBR.scene.isReady().then((r) => r && soon());
});
