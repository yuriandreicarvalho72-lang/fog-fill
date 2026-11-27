// Núcleo da Vigilância (sem SDK, testado em Node): câmeras com cone de visão bloqueado pelas paredes
// e nós da Matriz (camada de Realidade Aumentada).

export const CAM = "vigilancia/camera";     // metadado do item: configuração da câmera
export const NODE = "vigilancia/no";        // metadado do item: nó da Matriz { name, type, state, hidden }
export const DECK = "vigilancia/commlink";  // metadado do token: tem commlink/cyberdeck (o dono do token vê a Matriz)
export const ACCESS = "vigilancia/acesso";  // metadado da cena: { players: [id do jogador] }
export const ARSENAL_OWNER = "arsenal/dono"; // dono do token marcado no Arsenal (também conta como dono)

export const STATES = [
  ["ativo", "ativo"], ["desativado", "desativado"], ["loop", "em loop"], ["hackeado", "hackeado"],
];
export const TYPES = [
  ["camera", "Câmera", "📷"], ["porta", "Porta", "🚪"], ["painel", "Painel", "🎛"], ["arquivo", "Arquivo", "🗂"], ["outro", "Outro", "◈"],
];
export const STATE_COLOR = { ativo: "#4fc3ff", desativado: "#8a8f98", loop: "#c07bff", hackeado: "#3ddc84" };
export const iconOf = (type) => TYPES.find((t) => t[0] === type)?.[2] || "◈";
export const stateLabel = (s) => STATES.find((x) => x[0] === s)?.[1] || s;

export const DEFAULT_CAM = { angle: 90, range: 8, dir: 0, sweep: 0, period: 8, showAll: false, alertAll: false, ignore: [], hiddenSeen: false, ouve: false };

export const camOf = (it) => (it?.metadata?.[CAM] ? { ...DEFAULT_CAM, ...it.metadata[CAM] } : null);
export function nodeOf(it) {
  const n = it?.metadata?.[NODE];
  if (!n) return null;
  return { name: n.name || it.name || "Nó", type: n.type || "outro", state: n.state || "ativo", hidden: !!n.hidden };
}
/** Só câmera ATIVA vê. Desligada, em loop ou hackeada não vê nem avisa. */
export const camOn = (it) => !!camOf(it) && (nodeOf(it)?.state ?? "ativo") === "ativo";

/** Nó novo para um item (câmera vira nó do tipo câmera). */
export const newNode = (it, type = "outro") => ({ name: (it?.text?.plainText || it?.name || "Nó").trim(), type, state: "ativo", hidden: false });

// ---------------- geometria ----------------
const rad = (d) => (d * Math.PI) / 180;
export function toWorld(item, p) {
  const sx = item.scale?.x ?? 1, sy = item.scale?.y ?? 1, a = rad(item.rotation ?? 0);
  const x = p.x * sx, y = p.y * sy;
  return { x: item.position.x + x * Math.cos(a) - y * Math.sin(a), y: item.position.y + x * Math.sin(a) + y * Math.cos(a) };
}
const segsOf = (pts, closed) => {
  const out = [];
  for (let i = 1; i < pts.length; i++) out.push({ a: pts[i - 1], b: pts[i] });
  if (closed && pts.length > 2) out.push({ a: pts[pts.length - 1], b: pts[0] });
  return out;
};
const SMOKE_VISION = "com.battle-system.smoke/isVisionLine";
const SMOKE_OFF = "com.battle-system.smoke/disabled";

/**
 * Paredes que bloqueiam a visão, a partir dos itens da cena e dos locais:
 * paredes da névoa dinâmica do Owlbear (WALL, bloqueando) e linhas de visão do Smoke & Spectre.
 */
export function wallsFrom(items) {
  const walls = [];
  for (const it of items) {
    if (it.type === "WALL" && it.blocking !== false) walls.push(...segsOf((it.points || []).map((p) => toWorld(it, p)), false));
    else if (it.metadata?.[SMOKE_VISION] === true && it.metadata?.[SMOKE_OFF] !== true) {
      if (it.type === "CURVE") walls.push(...segsOf((it.points || []).map((p) => toWorld(it, p)), !!it.style?.closed));
      else if (it.type === "LINE") walls.push({ a: toWorld(it, it.startPosition), b: toWorld(it, it.endPosition) });
    }
  }
  return walls;
}

/** Distância até a primeira parede na direção (dx,dy) a partir de o, ou max. */
export function rayDist(o, dx, dy, walls, max) {
  let best = max;
  for (const w of walls) {
    const ex = w.b.x - w.a.x, ey = w.b.y - w.a.y;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const fx = w.a.x - o.x, fy = w.a.y - o.y;
    const t = (fx * ey - fy * ex) / den;   // ao longo do raio
    const u = (fx * dy - fy * dx) / den;   // ao longo da parede
    if (t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9 && t < best) best = t;
  }
  return best;
}

/** A parede corta o trecho de a até b? */
export function blocked(a, b, walls) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
  if (L < 1e-6) return false;
  return rayDist(a, dx / L, dy / L, walls, L) < L - 1e-6;
}

/** Direção do cone agora (graus): rotação do item + direção da câmera + varredura (vai e volta). */
export const OLHAR = "vigilancia/olhar"; // metadado do item: para onde o guarda em ronda olha (graus), sem girar a imagem
export const olharOf = (it) => (typeof it?.metadata?.[OLHAR] === "number" ? it.metadata[OLHAR] : null);
export function coneDir(it, cam, now = Date.now()) {
  let d = (olharOf(it) ?? it.rotation ?? 0) + (cam.dir ?? 0);
  if (cam.sweep > 0 && cam.period > 0) d += (cam.sweep / 2) * Math.sin((2 * Math.PI * now) / (cam.period * 1000));
  return d;
}

const normAng = (a) => ((a % 360) + 540) % 360 - 180; // -180..180

/** Ponto p está dentro do cone (sem contar paredes)? */
export function inCone(o, dir, cam, p, cell) {
  const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
  if (d > cam.range * cell) return false;
  if (d < 1e-6 || cam.angle >= 360) return true;
  const a = (Math.atan2(dy, dx) * 180) / Math.PI;
  return Math.abs(normAng(a - dir)) <= cam.angle / 2;
}

/** A câmera vê o ponto p (cone + linha de visão sem parede)? */
export const sees = (o, dir, cam, p, walls, cell) => inCone(o, dir, cam, p, cell) && !blocked(o, p, walls);

/** Contorno do cone cortado pelas paredes (pontos relativos à câmera, para desenhar). */
export function conePolygon(dir, cam, walls, cell, o) {
  const R = cam.range * cell;
  const full = cam.angle >= 360;
  const span = full ? 360 : cam.angle;
  const n = Math.max(8, Math.min(120, Math.ceil(span / 3)));
  const pts = full ? [] : [{ x: 0, y: 0 }];
  for (let i = 0; i <= n; i++) {
    if (full && i === n) break;
    const a = rad(dir - span / 2 + (span * i) / n);
    const dx = Math.cos(a), dy = Math.sin(a);
    const d = walls.length ? rayDist(o, dx, dy, walls, R) : R;
    pts.push({ x: dx * d, y: dy * d });
  }
  return pts;
}

/** Tokens que podem ser vistos por uma câmera. */
export const isToken = (i) => i.type === "IMAGE" && (i.layer === "CHARACTER" || i.layer === "MOUNT");

/** Quem a câmera vê agora (groups: prédios do Estados, para os andares). */
export function seenBy(camItem, items, walls, cell, now = Date.now(), groups = []) {
  const cam = camOf(camItem);
  if (!cam || !camOn(camItem)) return [];
  const dir = coneDir(camItem, cam, now);
  const ignore = new Set(cam.ignore || []);
  return items.filter((t) => isToken(t) && t.id !== camItem.id && !ignore.has(t.id)
    && sameFloor(camItem, t)
    && (cam.hiddenSeen || presentVisible(t, groups))
    && sees(camItem.position, dir, cam, t.position, walls, cell)).map((t) => t.id);
}

/** Este jogador vê a Matriz? (marcado pelo mestre, ou dono de um token com commlink/cyberdeck) */
export function hasAccess(playerId, role, items, access) {
  if (role === "GM") return true;
  if ((access?.players || []).includes(playerId)) return true;
  return items.some((i) => i.metadata?.[DECK] === true && (i.createdUserId === playerId || i.metadata?.[ARSENAL_OWNER] === playerId));
}

/** Pedido de hack: qual estado o nó vai ter. */
export const ACTIONS = [
  ["hackeado", "Hackear"], ["loop", "Pôr em loop"], ["desativado", "Desativar"], ["ativo", "Reativar"],
];

/** Mudou o estado de algum nó? Devolve [{ id, name, type, state, prev }]. */
export function nodeChanges(prev, items) {
  const out = [];
  for (const it of items) {
    const n = nodeOf(it);
    if (!n) continue;
    const p = prev.get(it.id);
    if (p !== undefined && p !== n.state) out.push({ id: it.id, name: n.name, type: n.type, state: n.state, prev: p });
  }
  return out;
}

/** Porta: hackeada ou desativada fica destravada; ativa volta a travar. Devolve true/false ou null (não mexe). */
export function doorLock(node) {
  if (node?.type !== "porta") return null;
  if (node.state === "hackeado" || node.state === "desativado") return false;
  if (node.state === "ativo") return true;
  return null;
}

// ---------------- visão especial (ciberolhos) ----------------
export const VISION = "vigilancia/visao";   // metadado do token: { modes: ["termica","baixa"], on: [...] } (o que ele tem / o que está ligado)
export const ONLY = "vigilancia/so-em";      // metadado do item: só aparece em "termica" ou "baixa" (o item original fica escondido)
export const MODES = [["termica", "Térmica", "🔥"], ["baixa", "Baixa luz", "🌙"]];
export const modeLabel = (m) => MODES.find((x) => x[0] === m)?.[1] || m;
export const TINT = { termica: [1.0, 0.42, 0.08], baixa: [0.35, 1.0, 0.45] }; // cor do filtro na tela

export function visionOf(it) {
  const v = it?.metadata?.[VISION];
  if (!v || !Array.isArray(v.modes) || !v.modes.length) return null;
  return { modes: v.modes.slice(), on: (Array.isArray(v.on) ? v.on : v.modes).filter((m) => v.modes.includes(m)) };
}

/** Tokens deste jogador (criados por ele, ou marcados como dele no Arsenal). */
export const ownedBy = (playerId, items) => items.filter((i) => i.createdUserId === playerId || i.metadata?.[ARSENAL_OWNER] === playerId);

/** Modos de visão ligados para este jogador (a soma dos tokens dele). O mestre vê os itens originais. */
export function activeModes(playerId, role, items) {
  if (role === "GM") return [];
  const out = new Set();
  for (const t of ownedBy(playerId, items)) for (const m of visionOf(t)?.on || []) out.add(m);
  return [...out];
}

/** Liga/desliga um modo num token (só se ele tem o modo). mode "todos" = todos os que ele tem. */
export function toggleVision(v, mode, on) {
  if (!v) return v;
  const which = mode === "todos" ? v.modes : [mode];
  const set = new Set(v.on || []);
  for (const m of which) if (v.modes.includes(m)) { if (on) set.add(m); else set.delete(m); }
  return { modes: v.modes, on: v.modes.filter((m) => set.has(m)) };
}

// ---------------- andares (extensão Estados) ----------------
export const FLOOR = "estados/andar";        // metadado do item: { g: prédio, f: andar }
export const EST_GROUPS = "estados/grupos";  // metadado da cena: grupos e prédios do Estados
export const EST_DATA = "estados/dados";     // metadado do item: dados de cada estado

/** O token está "presente" no andar dele? Num andar que não é o mostrado ele fica escondido pelo Estados,
 *  mas para as câmeras daquele andar ele continua lá (vale o que o Estados guardou para o andar dele). */
export function presentVisible(t, groups) {
  const fl = t?.metadata?.[FLOOR];
  if (fl) {
    const g = (groups || []).find((x) => x.id === fl.g);
    if (g && g.current !== fl.f) return t.metadata?.[EST_DATA]?.[fl.g]?.[fl.f]?.visible !== false;
  }
  return t.visible !== false;
}

/** Câmera e token no mesmo andar? (sem andar marcado = vale para todos os andares) */
export function sameFloor(a, b) {
  const fa = a?.metadata?.[FLOOR], fb = b?.metadata?.[FLOOR];
  if (!fa || !fb || fa.g !== fb.g) return true;
  return fa.f === fb.f;
}
