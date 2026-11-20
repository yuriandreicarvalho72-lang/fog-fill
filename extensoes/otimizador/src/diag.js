// Diagnóstico da cena (sem SDK, testado em Node): o que existe, o que pesa e dicas.

/** De quem é cada item local, pelo começo das chaves de metadado. */
export const OWNERS = [
  ["arsenal", "Arsenal"], ["luz-colorida", "Luz Colorida"], ["clima", "Clima"], ["vigilancia", "Vigilância"],
  ["estados", "Estados"], ["gatilhos", "Gatilhos"], ["trocador", "Trocador"], ["regua", "Régua"],
  ["fog-fill", "Balde de Fog"], ["balde", "Balde de Fog"],
  ["com.battle-system", "Smoke & Spectre"], ["rodeo.owlbear", "Owlbear"],
];
export const BIG_SIDE = 4096;   // lado da imagem (px) a partir do qual pesa
export const BIG_MP = 16;       // megapixels a partir dos quais pesa
export const TOKEN_SIDE = 1024; // token (personagem) com imagem maior que isso é desperdício

const name = (i) => i?.text?.plainText?.trim() || i?.name || i?.type?.toLowerCase() || "item";

export function ownerOf(item) {
  const keys = Object.keys(item.metadata || {});
  for (const [p, label] of OWNERS) if (keys.some((k) => k === p || k.startsWith(`${p}/`) || k.startsWith(`${p}.`) || k.startsWith(`${p}-`))) return label;
  if (keys.length) return "Outras extensões";
  if (item.type === "LIGHT" || item.type === "WALL") return "Owlbear (névoa dinâmica)";
  return "Sem dono";
}

/** Números da cena (itens compartilhados). */
export function sceneStats(items) {
  const byLayer = {};
  let hidden = 0, wallPts = 0, walls = 0, dfLights = 0, colored = 0, climaLayers = 0, cameras = 0, destr = 0, charges = 0;
  const urls = new Map(); // url -> { w, h, names: [], ids: [], token }
  for (const i of items) {
    byLayer[i.layer] = (byLayer[i.layer] || 0) + 1;
    if (i.visible === false) hidden++;
    if (i.type === "WALL") { walls++; wallPts += (i.points || []).length; }
    const md = i.metadata || {};
    if (md["rodeo.owlbear.dynamic-fog/light"]) dfLights++;
    if (md["luz-colorida/cor"]?.color && md["rodeo.owlbear.dynamic-fog/light"]) colored++;
    if (Array.isArray(md["clima/camadas"])) climaLayers += md["clima/camadas"].filter((l) => l.on !== false).length;
    if (md["vigilancia/camera"]) cameras++;
    if (md["arsenal/destrutivel"]) destr++;
    if (md["arsenal/carga"]) charges++;
    if (i.type === "IMAGE" && i.image?.url) {
      const u = urls.get(i.image.url) || { w: i.image.width || 0, h: i.image.height || 0, names: [], ids: [], token: false };
      u.names.push(name(i)); u.ids.push(i.id);
      if (i.layer === "CHARACTER" || i.layer === "MOUNT") u.token = true;
      urls.set(i.image.url, u);
    }
  }
  const imgs = [...urls.values()].map((u) => ({ ...u, mp: (u.w * u.h) / 1e6 }));
  const big = imgs.filter((u) => Math.max(u.w, u.h) > BIG_SIDE || u.mp > BIG_MP).sort((a, b) => b.mp - a.mp);
  const bigTokens = imgs.filter((u) => u.token && Math.max(u.w, u.h) > TOKEN_SIDE && !big.includes(u)).sort((a, b) => b.mp - a.mp);
  return {
    total: items.length, byLayer, hidden, walls, wallPts, dfLights, colored, climaLayers, cameras, destr, charges,
    images: items.filter((i) => i.type === "IMAGE").length, unique: imgs.length,
    totalMP: imgs.reduce((m, u) => m + u.mp, 0), big, bigTokens,
  };
}

/** Itens locais deste navegador (efeitos, miras, cones...), por dono. */
export function localStats(local) {
  const by = new Map();
  let effects = 0;
  for (const i of local) {
    const o = ownerOf(i);
    const r = by.get(o) || { n: 0, fx: 0 };
    r.n++;
    if (i.type === "EFFECT") { r.fx++; effects++; }
    by.set(o, r);
  }
  return { total: local.length, effects, byOwner: [...by].sort((a, b) => b[1].n - a[1].n) };
}

/** Dicas a partir dos números. perf = perfil em vigor (ou null). */
export function tips(sc, lc, perf) {
  const out = [];
  if (sc.big.length) out.push(`${sc.big.length} imagem(ns) com mais de ${BIG_SIDE} px ou ${BIG_MP} megapixels. O Owlbear carrega cada imagem inteira na placa de vídeo: reduza mapas para até ${BIG_SIDE} px de lado.`);
  if (sc.bigTokens.length) out.push(`${sc.bigTokens.length} token(s) com imagem maior que ${TOKEN_SIDE} px. Na mesa ele aparece pequeno: 512 px bastam.`);
  if (lc.effects > 20) out.push(`${lc.effects} efeitos de shader ativos neste computador (luz colorida, clima, filtros). São o que mais pesa: o perfil Leve corta boa parte.`);
  if (sc.colored > 10 && (!perf || perf.luz.maxLights > 10)) out.push(`${sc.colored} luzes coloridas na cena. Cada uma é um shader; o perfil Equilibrado limita a 10, o Leve a 6.`);
  if (sc.climaLayers > 3 && (!perf || perf.clima.maxLayers > 2)) out.push(`${sc.climaLayers} camadas de clima ligadas. Junte num mapa só ou use o perfil Equilibrado (2 por mapa).`);
  if (sc.wallPts > 3000) out.push(`Paredes com ${sc.wallPts} pontos. A névoa dinâmica, a luz colorida e a cobertura do Arsenal recalculam tudo isso: simplifique paredes muito detalhadas.`);
  if (sc.total > 600) out.push(`${sc.total} itens na cena. Apague o que não usa ou divida o mapa em mais de uma cena.`);
  const ars = lc.byOwner.find(([o]) => o === "Arsenal")?.[1]?.n || 0;
  if (ars > 150) out.push(`${ars} itens locais do Arsenal agora. Se nada está animando, são sobras: use Limpar sobras.`);
  if (!out.length) out.push("Nada pesado à vista nesta cena.");
  return out;
}
