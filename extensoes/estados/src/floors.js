// Operações dos prédios com andares (usadas pelo painel e pelo segundo plano).
import OBR from "@owlbear-rodeo/sdk";
import { FLOOR, floorData, neighborFloor, isBuilding } from "./core.js";
import { DATA } from "./shared.js";

/**
 * Põe itens num andar. No andar dele o item fica visível (ou escondido, se já estava escondido de propósito);
 * nos outros andares, escondido. Se o andar não é o mostrado agora, o item some na hora.
 */
export async function assignFloor(g, ids, floorId) {
  if (!ids.length) return;
  const here = floorId === g.current;
  await OBR.scene.items.updateItems(ids, (d) => {
    for (const it of d) {
      const old = it.metadata[FLOOR];
      // visível no andar dele? quem já morava no prédio leva o que tinha; quem entra agora no andar mostrado fica como está
      const own = old?.g === g.id ? it.metadata[DATA]?.[g.id]?.[old.f]?.visible !== false : here ? it.visible !== false : true;
      const all = JSON.parse(JSON.stringify(it.metadata[DATA] || {}));
      all[g.id] = floorData(g, floorId, own);
      it.metadata[DATA] = all;
      it.metadata[FLOOR] = { g: g.id, f: floorId };
      it.visible = here ? own : false;
    }
  });
}

/** Tira itens do prédio (voltam a aparecer). */
export async function leaveBuilding(gid, ids) {
  if (!ids.length) return;
  await OBR.scene.items.updateItems(ids, (d) => {
    for (const it of d) {
      if (it.metadata[FLOOR]?.g !== gid) continue;
      const all = JSON.parse(JSON.stringify(it.metadata[DATA] || {}));
      delete all[gid];
      it.metadata[DATA] = Object.keys(all).length ? all : undefined;
      it.metadata[FLOOR] = undefined;
      it.visible = true;
    }
  });
}

/** Leva itens um andar para cima (dir 1) ou para baixo (-1). Devolve quantos foram. */
export async function moveFloor(groups, items, dir) {
  let n = 0;
  const by = new Map();
  for (const it of items) {
    const fl = it.metadata?.[FLOOR];
    const g = groups.find((x) => x.id === fl?.g);
    if (!g || !isBuilding(g)) continue;
    const to = neighborFloor(g, fl.f, dir);
    if (!to) continue;
    const key = `${g.id}|${to.id}`;
    if (!by.has(key)) by.set(key, { g, to, ids: [] });
    by.get(key).ids.push(it.id);
  }
  for (const { g, to, ids } of by.values()) { await assignFloor(g, ids, to.id); n += ids.length; }
  return n;
}
