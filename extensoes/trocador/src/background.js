import { controls } from "./visibility.js";
// Trocador em segundo plano: menu do botão direito (com as miniaturas embutidas) e pedidos de outras extensões.
import OBR from "@owlbear-rodeo/sdk";
import { KEY } from "./core.js";
import { ID, CH_SWAP, swap, url } from "./ops.js";

let role = "PLAYER";
let myConn = "";

/** Só um mestre executa pedidos de outras extensões (se houver dois mestres na sala). */
async function isLeader() {
  if (role !== "GM") return false;
  const gms = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role === "GM").map((p) => p.connectionId);
  return [myConn, ...gms].sort()[0] === myConn;
}

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  myConn = await OBR.player.getConnectionId().catch(() => "");
  OBR.player.onChange((p) => { role = p.role; });

  // botão direito numa imagem: miniaturas para trocar (quem pode editar o item)
  await controls.contextMenu.create({
    id: `${ID}/menu`,
    icons: [{
      icon: url("icon.svg"), label: "Trocar imagem",
      filter: { every: [{ key: "type", value: "IMAGE" }], permissions: ["UPDATE"] },
    }],
    embed: { url: url("menu.html"), height: 96 },
  });
  // atalho: próxima imagem (só aparece em itens que já têm imagens no Trocador)
  await controls.contextMenu.create({
    id: `${ID}/proxima`,
    icons: [{
      icon: url("next.svg"), label: "Próxima imagem",
      filter: { every: [{ key: "type", value: "IMAGE" }, { key: ["metadata", KEY], value: undefined, operator: "!=" }], permissions: ["UPDATE"] },
    }],
    onClick: (ctx) => swap(ctx.items.map((i) => i.id), "next"),
  });

  // pedido de outra extensão (Gatilhos): { targets, to }
  OBR.broadcast.onMessage(CH_SWAP, async (e) => {
    const d = e.data || {};
    if (!Array.isArray(d.targets) || !d.targets.length || !(await isLeader())) return;
    const n = await swap(d.targets, d.to || "next");
    if (!n && d.to && d.to !== "next" && d.to !== "prev") {
      OBR.notification.show(`Trocador${d.from ? ` (${d.from})` : ""}: nenhum item tem a imagem "${d.to}".`, "WARNING");
    }
  });
});
