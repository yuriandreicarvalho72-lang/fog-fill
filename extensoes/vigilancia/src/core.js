// Núcleo da Vigilância (sem SDK, testado em Node): câmeras com cone de visão bloqueado pelas paredes
// e nós da Matriz (camada de Realidade Aumentada).

export const CAM = "vigilancia/camera";     // metadado do item: configuração da câmera
export const NODE = "vigilancia/no";        // metadado do item: nó da Matriz { name, type, state, hidden }
export const DECK = "vigilancia/commlink";  // metadado do token: tem commlink/cyberdeck (o dono do token vê a Matriz)
export const ACCESS = "vigilancia/acesso";  // metadado da cena: { players: [id do jogador] }
export const FEED = "vigilancia/assistindo"; // metadado do jogador: id da câmera que ele está vendo
export const ARSENAL_OWNER = "arsenal/dono"; // dono do token marcado no Arsenal (também conta como dono)

export const STATES = [
  ["ativo", "ativo"], ["desativado", "desativado"], ["loop", "em loop"], ["hackeado", "hackeado"],
];
export const TYPES = [
  ["camera", "Câmera", "📷"], ["laser", "Laser", "🔴"], ["porta", "Porta", "🚪"], ["painel", "Painel", "🎛"], ["arquivo", "Arquivo", "🗂"], ["outro", "Outro", "◈"],
];
export const STATE_COLOR = { ativo: "#4fc3ff", desativado: "#8a8f98", loop: "#c07bff", hackeado: "#3ddc84" };
export const iconOf = (type) => TYPES.find((t) => t[0] === type)?.[2] || "◈";
export const stateLabel = (s) => STATES.find((x) => x[0] === s)?.[1] || s;

export const DEFAULT_CAM = { angle: 90, range: 8, dir: 0, sweep: 0, period: 8, showAll: false, alertAll: false, ignore: [], hiddenSeen: false, ouve: false, verGuardas: false };

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
      else if (it.type === "PATH") { // caminho: comandos 0 mover, 1 reta, 2/3/4 curvas (só os pontos finais), 5 fechar
        let cur = null;
        const fim = () => { if (cur) walls.push(...segsOf(cur.pts, cur.closed)); cur = null; };
        for (const c of it.commands || []) {
          const k = Array.isArray(c) ? c[0] : -1, a = Array.isArray(c) ? c.slice(1) : [];
          if (k === 0) { fim(); cur = { pts: [toWorld(it, { x: a[0], y: a[1] })], closed: false }; }
          else if (cur && k >= 1 && k <= 4) { const o = k === 4 ? 3 : 2; cur.pts.push(toWorld(it, { x: a[a.length - o], y: a[a.length - o + 1] })); }
          else if (k === 5 && cur) cur.closed = true;
        }
        fim();
      } else if (it.type === "SHAPE" && it.shapeType === "RECTANGLE") {
        const w = it.width ?? 0, h = it.height ?? 0;
        walls.push(...segsOf([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }].map((p) => toWorld(it, p)), true));
      }
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
    && (cam.verGuardas || !camOf(t)) // guardas e outras câmeras não disparam a câmera (a menos que ligado)
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

/**
 * Nós da Matriz ao redor: distância (em quadrados) do nó até o commlink/cyberdeck mais perto do jogador.
 * Sem token com commlink (liberado só pelo mestre) não há "ao redor": devolve todos, sem distância.
 * raio 0 = sem limite. Devolve { perto: [{ item, dist }] ordenado, longe: [item], temDeck }.
 */
export function nodesAround(nodes, decks, dpi, raio) {
  if (!decks.length) return { perto: nodes.map((item) => ({ item, dist: null })), longe: [], temDeck: false };
  const rows = nodes.map((item) => ({ item, dist: Math.min(...decks.map((d) => Math.hypot(item.position.x - d.x, item.position.y - d.y))) / dpi }));
  const near = rows.filter((r) => !(raio > 0) || r.dist <= raio).sort((a, b) => a.dist - b.dist);
  return { perto: near, longe: rows.filter((r) => !near.includes(r)).map((r) => r.item), temDeck: true };
}

/** Este jogador pode ver pela câmera? Jogador: só câmera HACKEADA e com acesso à Matriz. Mestre: qualquer câmera (para testar). */
export function canWatch(it, playerId, role, items, access) {
  if (!camOf(it)) return false;
  if (role === "GM") return true;
  return (nodeOf(it)?.state ?? "ativo") === "hackeado" && hasAccess(playerId, role, items, access);
}

/** Máscara "vendo pela câmera": retângulo enorme com o cone como buraco (comandos relativos à posição da câmera). */
export function maskCommands(coneCmds, big = 100000) {
  return [[0, -big, -big], [1, big, -big], [1, big, big], [1, -big, big], [5], ...coneCmds];
}
/** Caixa (mín/máx) de um conjunto de comandos de caminho, somada à posição. */
export function cmdsBounds(cmds, pos) {
  const xs = [], ys = [];
  for (const c of cmds) if (c.length >= 3) { xs.push(pos.x + c[1]); ys.push(pos.y + c[2]); }
  if (!xs.length) return null;
  return { min: { x: Math.min(...xs), y: Math.min(...ys) }, max: { x: Math.max(...xs), y: Math.max(...ys) } };
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

// ---------------- lasers (feixes que disparam ao serem cortados) ----------------
export const LASER = "vigilancia/laser";     // metadado do item (linha/curva): configuração do laser
export const DEFAULT_LASER = {
  cor: "#ff2a2a", cooldown: 3, umaVez: false, ignoraGuardas: true, ignore: [], hiddenSeen: false, alertAll: false,
  pulso: true, video: "", tipo: "area", giro: 0, visual: "", tamanho: 0, onde: "laser",
};
export const laserOf = (it) => (it?.metadata?.[LASER] ? { ...DEFAULT_LASER, ...it.metadata[LASER] } : null);
/** Só laser ATIVO dispara (desativado, em loop ou hackeado, não). */
export const laserOn = (it) => !!laserOf(it) && (nodeOf(it)?.state ?? "ativo") === "ativo";
/** Itens que podem virar laser: linha, curva ou caminho de retas. */
export const isLaserShape = (it) => it?.type === "LINE" || it?.type === "CURVE" || it?.type === "PATH";

/** Trechos retos do feixe, em coordenadas do mapa: [{ a, b }]. */
export function laserSegments(it) {
  if (it?.type === "LINE") return [{ a: toWorld(it, it.startPosition), b: toWorld(it, it.endPosition) }];
  if (it?.type === "CURVE") return segsOf((it.points || []).map((p) => toWorld(it, p)), !!it.style?.closed);
  if (it?.type === "PATH") {
    const out = []; let cur = null, start = null;
    for (const c of it.commands || []) {
      if (c[0] === 0) { cur = toWorld(it, { x: c[1], y: c[2] }); start = cur; }
      else if (c[0] === 1 && cur) { const n = toWorld(it, { x: c[1], y: c[2] }); out.push({ a: cur, b: n }); cur = n; }
      else if (c[0] === 5 && cur && start) { out.push({ a: cur, b: start }); cur = start; }
    }
    return out;
  }
  return [];
}

/** Ponto mais perto de p no trecho a-b: { d: distância, q: ponto }. */
export function nearOnSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  const t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  const q = { x: a.x + dx * t, y: a.y + dy * t };
  return { d: Math.hypot(p.x - q.x, p.y - q.y), q };
}
/** O passo p1→p2 cruza o trecho a-b? */
export function stepCrosses(p1, p2, a, b) {
  const o = (u, v, w) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
  const d1 = o(a, b, p1), d2 = o(a, b, p2), d3 = o(p1, p2, a), d4 = o(p1, p2, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
/** "Raio" do token para encostar no feixe (um pouco menos que meia casa do tamanho dele). */
export function tokenRadius(t, dpi) {
  const w = (t.image?.width || dpi) * Math.abs(t.scale?.x ?? 1) / (t.grid?.dpi || dpi);
  return Math.max(dpi * 0.2, w * dpi * 0.35);
}

/**
 * Quem está encostando (ou acabou de atravessar) o feixe. prev: Map id -> posição anterior (para não pular quem anda rápido).
 * Devolve [{ id, q }] com q = ponto do feixe mais perto do token.
 */
export function laserTouched(it, tokens, prev, dpi) {
  const segs = laserSegments(it);
  const out = [];
  for (const t of tokens) {
    const r = tokenRadius(t, dpi);
    let best = null;
    for (const s of segs) {
      const n = nearOnSegment(t.position, s.a, s.b);
      let hit = n.d <= r, q = n.q;
      const pp = prev?.get(t.id);
      if (!hit && pp && stepCrosses(pp, t.position, s.a, s.b)) { hit = true; q = nearOnSegment(t.position, s.a, s.b).q; }
      if (hit && (!best || n.d < best.d)) best = { d: n.d, q };
    }
    if (best) out.push({ id: t.id, q: best.q });
  }
  return out;
}

/** Quem pode cortar este laser: tokens, menos ignorados, guardas/câmeras (se ligado) e quem está em outro andar. */
export function laserWatchers(it, items, groups = []) {
  const l = laserOf(it);
  const ign = new Set(l.ignore || []);
  return items.filter((t) => isToken(t) && t.id !== it.id && !ign.has(t.id) && (!l.ignoraGuardas || !camOf(t))
    && sameFloor(it, t) && (l.hiddenSeen || presentVisible(t, groups)));
}

/**
 * Um passo do detector: quem entrou no feixe agora e se dispara.
 * inside: ids que já estavam no feixe; touching: ids que estão agora; last: quando disparou por último (ms) ou 0.
 */
export function laserStep(inside, touching, last, now, cooldownS) {
  const fresh = touching.filter((id) => !inside.has(id));
  const fire = fresh.length > 0 && now - last >= Math.max(0, cooldownS) * 1000;
  return { fresh, fire, inside: new Set(touching) };
}
