// Ruído, ronda de guardas e verdade por jogador (lógica pura, sem SDK; testada em Node).

export const RUIDO = "vigilancia/ruido";      // metadado da cena: configuração do ruído
export const RONDA = "vigilancia/ronda";      // metadado do item: ronda do guarda
export const PONTO = "vigilancia/ponto";      // metadado do marcador de rota: { g: id do guarda, n: ordem }
export const VERDADE = "vigilancia/verdade";  // metadado do item: versões que cada jogador vê

// ---------------- ruído ----------------
// on: chave geral (desligada, ninguém ouve nada). tiro/corpo/passos: alcance em quadrados (0 = essa fonte não faz ruído).
// paredes: a cada parede no caminho o alcance fica multiplicado por isso (0.5 = metade).
export const DEFAULT_RUIDO = { on: true, tiro: 15, corpo: 4, passos: 0, paredes: 0.5 };
export const ruidoCfg = (md) => ({ ...DEFAULT_RUIDO, ...(md?.[RUIDO] || {}) });

const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
/** Quantas paredes o trecho a→b atravessa. */
export function crossings(a, b, walls) {
  let n = 0;
  for (const w of walls || []) {
    const d1 = ccw(a, b, w.a), d2 = ccw(a, b, w.b), d3 = ccw(w.a, w.b, a), d4 = ccw(w.a, w.b, b);
    if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0) n++;
  }
  return n;
}

/** O ruído (de raio em quadrados) chega ao ouvinte? As paredes abafam. */
export function hears(listener, source, raio, cell, walls, factor = 0.5) {
  const dist = Math.hypot(listener.x - source.x, listener.y - source.y);
  const cuts = crossings(listener, source, walls);
  const reach = raio * cell * Math.pow(Math.max(0, Math.min(1, factor)), cuts);
  return { hears: raio > 0 && dist <= reach, dist, cuts, reach };
}

/** Alcance do ruído de um disparo do Arsenal (corpo a corpo faz menos barulho). */
export function shotRaio(data, cfg) {
  const melee = !!(data?.spec?.melee || data?.melee);
  return melee ? cfg.corpo : cfg.tiro;
}

// ---------------- ronda ----------------
export const DEFAULT_RONDA = { on: false, speed: 1.5, pausa: 2, modo: "ciclo", girar: true, parar: 5, investiga: true, espera: 6 };
export const rondaOf = (it) => (it?.metadata?.[RONDA] ? { ...DEFAULT_RONDA, ...it.metadata[RONDA] } : null);

/** Pontos da rota de um guarda, na ordem. */
export function routeOf(items, guardId) {
  return items.filter((i) => i.metadata?.[PONTO]?.g === guardId)
    .sort((a, b) => (a.metadata[PONTO].n ?? 0) - (b.metadata[PONTO].n ?? 0))
    .map((i) => ({ x: i.position.x, y: i.position.y, id: i.id }));
}

/** Estado novo de ronda: começa no ponto mais perto. */
export function patrolInit(pos, route) {
  let best = 0, bd = Infinity;
  route.forEach((p, i) => { const d = Math.hypot(p.x - pos.x, p.y - pos.y); if (d < bd) { bd = d; best = i; } });
  return { i: best, dir: 1, wait: 0, hold: 0, inv: null };
}

/** Manda o guarda investigar um ponto (ruído). Devolve o estado novo. */
export const investigate = (st, pt, cfg) => ({ ...st, inv: { x: pt.x, y: pt.y }, wait: 0, hold: 0, esperar: (cfg.espera ?? 6) * 1000 });
/** Segura o guarda parado (viu alguém). */
export const hold = (st, ms) => ({ ...st, hold: Math.max(st.hold || 0, ms) });

/** Um passo da ronda (dt em ms). Devolve { pos, rotation|null, st }. */
export function patrolStep(st0, pos, route, cfg, dt, cell) {
  const st = { ...st0 };
  if (st.hold > 0) { st.hold = Math.max(0, st.hold - dt); return { pos, rotation: null, st }; }
  if (st.wait > 0) { st.wait = Math.max(0, st.wait - dt); return { pos, rotation: null, st }; }
  const target = st.inv || (route.length ? route[Math.min(st.i, route.length - 1)] : null);
  if (!target) return { pos, rotation: null, st };
  const dx = target.x - pos.x, dy = target.y - pos.y, d = Math.hypot(dx, dy);
  const step = Math.max(0, cfg.speed) * cell * (dt / 1000);
  const rotation = d > 1e-6 && cfg.girar !== false ? (Math.atan2(dy, dx) * 180) / Math.PI : null;
  if (d > step) return { pos: { x: pos.x + (dx / d) * step, y: pos.y + (dy / d) * step }, rotation, st };
  // chegou
  const at = { x: target.x, y: target.y };
  if (st.inv) { st.inv = null; st.wait = st.esperar ?? (cfg.espera ?? 6) * 1000; st.esperar = 0; return { pos: at, rotation, st }; }
  st.wait = (cfg.pausa ?? 0) * 1000;
  const n = route.length;
  if (n > 1) {
    if (cfg.modo === "vaivem") {
      if (st.i + st.dir >= n || st.i + st.dir < 0) st.dir = -st.dir;
      st.i += st.dir;
    } else st.i = (st.i + 1) % n;
  }
  return { pos: at, rotation, st };
}

// ---------------- verdade por jogador ----------------
export const verdadeOf = (it) => {
  const v = it?.metadata?.[VERDADE];
  return v && v.on !== false && Array.isArray(v.versoes) ? v : null;
};
/** Versão que este jogador vê: a que cita ele; senão a de "todos os outros"; senão nenhuma (não vê o item). */
export function versionFor(v, playerId) {
  const list = v?.versoes || [];
  return list.find((x) => Array.isArray(x.para) && x.para.includes(playerId)) || list.find((x) => x.para === "*") || null;
}
/** Cópia do item como o jogador deve ver, ou null se ele não vê nada. */
export function appearance(it, ver) {
  if (!ver || ver.esconder) return null;
  const copy = JSON.parse(JSON.stringify(it));
  delete copy.attachedTo;
  if (ver.imagem && copy.image) copy.image = { ...copy.image, url: ver.imagem };
  if (ver.nome != null && ver.nome !== "") copy.name = ver.nome;
  if (ver.texto != null && ver.texto !== "") {
    if (copy.text) copy.text = { ...copy.text, plainText: ver.texto };
    else copy.text = { richText: undefined, plainText: ver.texto, type: "PLAIN", style: { fillColor: "#ffffff", fillOpacity: 1, strokeColor: "#000000", strokeOpacity: 1, strokeWidth: 0, textAlign: "CENTER", textAlignVertical: "BOTTOM", fontFamily: "Roboto", fontSize: 24, fontWeight: 600, lineHeight: 1.5, padding: 8 }, width: "AUTO", height: "AUTO" };
  }
  return copy;
}
