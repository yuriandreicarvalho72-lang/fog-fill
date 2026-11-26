// Condições dos Gatilhos: o gatilho só dispara se... Funções puras, testáveis em Node.
import { zoneShape, insideZone } from "./engine.js";
import { isToken, isFogDoor, doorIsOpen, doorIsLocked, hasRequired, VIG_NODE_META } from "./shared.js";

export const cmp = (a, op, b) => (op === ">=" ? a >= b : op === "<=" ? a <= b : op === "!=" ? a !== b : a === b);
const inv = (c, v) => (c.op === "!=" ? !v : v);
const doorIs = (i, is) => (is === "aberta" ? doorIsOpen(i) : is === "fechada" ? !doorIsOpen(i) : is === "trancada" ? doorIsLocked(i) : !doorIsLocked(i));

/**
 * Uma condição. env: { alert, items, groups (Estados), dpi, zones (zonas do gatilho), actorIds (quem ativou) }.
 * Condição sem os itens/grupo escolhidos é ignorada (vale como cumprida): o painel avisa.
 */
export function evalCond(c, env) {
  const byId = (id) => env.items.find((i) => i.id === id);
  switch (c.type) {
    case "alert": return cmp(env.alert, c.op || ">=", Number(c.n) || 0);
    case "node": { // "==": algum dos nós está nesse estado; "!=": nenhum está
      const ns = (c.ids || []).map(byId).filter(Boolean);
      return ns.length ? inv(c, ns.some((i) => i.metadata?.[VIG_NODE_META]?.state === (c.is || "hackeado"))) : true;
    }
    case "door": { // "==": alguma das portas; "!=": nenhuma
      const ds = (c.ids || []).map(byId).filter((i) => i && isFogDoor(i));
      return ds.length ? inv(c, ds.some((i) => doorIs(i, c.is || "aberta"))) : true;
    }
    case "state": {
      const g = (env.groups || []).find((x) => x.id === c.group);
      return g && c.is ? inv(c, g.current === c.is) : true;
    }
    case "count": {
      const ids = (c.zones || []).length ? c.zones : env.zones || [];
      const shapes = ids.map(byId).filter(Boolean).map((i) => zoneShape(i, env.dpi));
      if (!shapes.length) return true;
      const n = env.items.filter((i) => isToken(i) && (c.hid || i.visible !== false) && !ids.includes(i.id) && shapes.some((s) => insideZone(i.position, s))).length;
      return cmp(n, c.op || ">=", Number(c.n) || 0);
    }
    case "has": {
      if (!String(c.name || "").trim()) return true;
      const any = (env.actorIds || []).some((id) => hasRequired(id, env.items, c.name, env.inv));
      return inv(c, any);
    }
    default: return true;
  }
}

/** Todas (ou qualquer uma, com condAny) as condições do gatilho valem? Sem condições: sim. */
export function condsOk(t, env) {
  const cs = t.conds || [];
  if (!cs.length) return true;
  return t.condAny ? cs.some((c) => evalCond(c, env)) : cs.every((c) => evalCond(c, env));
}
