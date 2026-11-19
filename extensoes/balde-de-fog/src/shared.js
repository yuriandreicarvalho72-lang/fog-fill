// Coisas compartilhadas entre o painel (popover) e o background.
export const ID = "fog-fill";
export const TOOL_ID = `${ID}/tool`;
export const MODE_ID = `${ID}/mode`;          // por cor do mapa
export const MODE_WALL_ID = `${ID}/mode-wall`; // por obstrução
export const MODE_SWEEP_ID = `${ID}/mode-sweep`; // varredura do mapa inteiro
export const META = `${ID}/fill`;

export const DEFAULTS = {
  tolerance: 22,     // 0–100: quanto a cor pode variar dentro da área
  smooth: 2,         // px: arredonda a borda e tapa porosidade
  grow: 0,           // px: + expande o fog para dentro da borda / − recua
  simplify: 1.5,     // px: menos pontos no contorno
  minHole: 800,      // px²: buracos menores que isso são tapados
  contiguous: true,  // só a área conectada ao clique
  outline: "none",   // contorno extra: "none" | "smoke" | "curve" | "wall"
  outlineSimplify: 3,// px: simplificação extra do contorno (menos pontos = mais leve para a visão)
  smokeTemplate: null, // formato de obstrução aprendido de um item do Smoke & Spectre!
  maxDim: 2048,      // processa a imagem reduzida a este tamanho (velocidade)
  color: "",         // vazio = cor de fog da cena
  useDrawings: false, // modo obstrução: também usa linhas comuns de desenho como borda
};

// ---- IndexedDB: arquivos de mapa carregados no painel, por URL da imagem ----
const DB = "fog-fill-db";
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("maps");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function putMapFile(url, blob) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction("maps", "readwrite");
    tx.objectStore("maps").put(blob, url);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function getMapFile(url) {
  const d = await db();
  return new Promise((res) => {
    const tx = d.transaction("maps", "readonly");
    const q = tx.objectStore("maps").get(url);
    q.onsuccess = () => res(q.result || null);
    q.onerror = () => res(null);
  });
}

// ---- Geometria: cena <-> pixel da imagem do mapa ----
// No Owlbear, um Image tem position (onde fica grid.offset da imagem), rotation (graus) e scale.
// 1 pixel da imagem = sceneDpi / grid.dpi unidades de cena (antes do scale).
export function sceneToImagePixel(item, sceneDpi, p) {
  const k = sceneDpi / item.grid.dpi;
  const a = (-item.rotation * Math.PI) / 180;
  const dx = p.x - item.position.x, dy = p.y - item.position.y;
  const rx = dx * Math.cos(a) - dy * Math.sin(a);
  const ry = dx * Math.sin(a) + dy * Math.cos(a);
  return {
    x: rx / (item.scale.x * k) + item.grid.offset.x,
    y: ry / (item.scale.y * k) + item.grid.offset.y,
  };
}
export function imagePixelToScene(item, sceneDpi, px, py) {
  const k = sceneDpi / item.grid.dpi;
  const lx = (px - item.grid.offset.x) * item.scale.x * k;
  const ly = (py - item.grid.offset.y) * item.scale.y * k;
  const a = (item.rotation * Math.PI) / 180;
  return {
    x: item.position.x + lx * Math.cos(a) - ly * Math.sin(a),
    y: item.position.y + lx * Math.sin(a) + ly * Math.cos(a),
  };
}

// ---- Smoke & Spectre! ----
export const SMOKE_PREFIX = "com.battle-system";
/** Extrai de um item do Smoke o "molde" que o Balde copia para criar obstruções iguais. */
export function templateFromItem(item) {
  const meta = {};
  for (const [k, v] of Object.entries(item.metadata || {})) if (k.startsWith(SMOKE_PREFIX)) meta[k] = v;
  if (!Object.keys(meta).length) return null;
  return {
    type: item.type,
    layer: item.layer,
    name: item.name,
    locked: item.locked,
    style: item.style ? { ...item.style } : null,
    metadata: meta,
  };
}

// ---- Ajustes do mestre: no metadado da ferramenta (o Owlbear entrega igual ao painel e ao background) ----
// O "Apagar o último" NÃO vai mais para o metadado (era isso que lotava e travava os ajustes):
// a lista fica na memória do background, e o painel pede o desfazer por mensagem.
export const UNDO_CHANNEL = `${ID}/undo`;
export async function loadSettings(OBR, TOOL_ID) {
  const md = (await OBR.tool.getMetadata(TOOL_ID).catch(() => null)) || {};
  const { lastIds, ...rest } = md;
  return { ...DEFAULTS, ...rest };
}
export async function saveSettings(OBR, TOOL_ID, patch) {
  await OBR.tool.setMetadata(TOOL_ID, patch);
}
/**
 * Limpeza das versões 1.3/1.4: tira a lista "lastIds" do metadado e,
 * se este navegador tiver ajustes salvos pela 1.4 (localStorage), devolve-os ao metadado uma única vez.
 */
export async function cleanupLegacy(OBR, TOOL_ID, fromLocal = false) {
  try {
    const md = (await OBR.tool.getMetadata(TOOL_ID)) || {};
    const patch = {};
    if (Array.isArray(md.lastIds) && md.lastIds.length) patch.lastIds = [];
    if (fromLocal) {
      let local = null;
      try { if (!localStorage.getItem(`${ID}/migrated-back`)) local = JSON.parse(localStorage.getItem(`${ID}/settings`) || "null"); } catch { /* sem acesso */ }
      if (local) {
        delete local.lastIds;
        if (!local.smokeTemplate && md.smokeTemplate) delete local.smokeTemplate;
        Object.assign(patch, local);
        try { localStorage.setItem(`${ID}/migrated-back`, "1"); } catch { /* idem */ }
      }
    }
    if (Object.keys(patch).length) await OBR.tool.setMetadata(TOOL_ID, patch);
  } catch (e) { console.warn("[fog-fill] limpeza dos ajustes antigos", e); }
}
