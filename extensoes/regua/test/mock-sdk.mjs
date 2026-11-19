// SDK falso, só o necessário para exercitar session.js e area.js em Node.
export const log = [];
let n = 0;
const mk = (type) => {
  const it = { type, id: `id${++n}`, position: { x: 0, y: 0 }, metadata: {}, layer: "DRAWING", style: {} };
  const b = new Proxy({}, { get: (_, k) => k === "build" ? () => it : (v) => {
    if (k === "plainText") it.text = { plainText: v, style: {} }; else it[k] = v; return b; } });
  return b;
};
export const buildCurve = () => mk("CURVE"), buildLabel = () => mk("LABEL"), buildPath = () => mk("PATH");
export const state = { interactions: [], scene: [] };
const OBR = {
  interaction: { startItemInteraction: async (items) => {
    const rec = { items: structuredClone(items), stopped: false };
    state.interactions.push(rec);
    return [(fn) => { fn(rec.items); return rec.items; }, () => { rec.stopped = true; }];
  } },
  scene: {
    local: { getItems: async () => [], addItems: async () => {}, updateItems: async () => {}, deleteItems: async () => {} },
    grid: { snapPosition: async (p) => p, getDistance: async (a, b) => Math.hypot(b.x - a.x, b.y - a.y) / 150 },
    items: {
      updateItems: async (ids, fn) => { const d = state.scene.filter((i) => ids.includes(i.id)); fn(d); log.push(["update", ids, d.map((i) => i.position)]); },
      addItems: async (items) => { state.scene.push(...items); log.push(["add", items.length]); },
      getItems: async (f) => state.scene.filter(f), deleteItems: async (ids) => { state.scene = state.scene.filter((i) => !ids.includes(i.id)); },
    },
  },
  room: { getMetadata: async () => ({}) },
  notification: { show: (m) => log.push(["notify", m]) },
  player: { getId: async () => "me" },
};
export default OBR;
