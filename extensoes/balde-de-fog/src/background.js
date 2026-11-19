import OBR, { buildPath, buildWall, buildCurve, buildLine, isImage, Command } from "@owlbear-rodeo/sdk";
import { fogFill, sweepVoid, simplifyLoop } from "./core.js";
import { itemPolylines, fillFromWalls } from "./walls.js";
import {
  ID, TOOL_ID, MODE_ID, MODE_WALL_ID, MODE_SWEEP_ID, META, DEFAULTS, SMOKE_PREFIX,
  getMapFile, sceneToImagePixel, imagePixelToScene,
} from "./shared.js";

const icon = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;

// cache de pixels por URL da imagem do mapa
const cache = new Map();

async function decode(blob, maxDim) {
  const bmp = await createImageBitmap(blob);
  const f = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * f)), h = Math.max(1, Math.round(bmp.height * f));
  const cv = new OffscreenCanvas(w, h);
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.drawImage(bmp, 0, 0, w, h);
  const { data } = cx.getImageData(0, 0, w, h);
  return { data, width: w, height: h };
}

async function loadPixels(item, maxDim) {
  const key = `${item.image.url}@${maxDim}`;
  if (cache.has(key)) return cache.get(key);
  let blob = await getMapFile(item.image.url);          // arquivo carregado no painel
  if (!blob) {
    try {
      const r = await fetch(item.image.url, { mode: "cors" });
      if (!r.ok) throw new Error(String(r.status));
      blob = await r.blob();
    } catch (e) {
      throw new Error("NO_PIXELS");
    }
  }
  const px = await decode(blob, maxDim);
  cache.set(key, px);
  return px;
}

async function findMapUnder(point, sceneDpi) {
  const maps = await OBR.scene.items.getItems((i) => i.layer === "MAP" && isImage(i) && i.visible);
  maps.sort((a, b) => b.zIndex - a.zIndex);
  for (const m of maps) {
    const p = sceneToImagePixel(m, sceneDpi, point);
    if (p.x >= 0 && p.y >= 0 && p.x < m.image.width && p.y < m.image.height) return { map: m, p };
  }
  return null;
}


/** Contornos extra (parede nativa, linha para converter ou obstrução do Smoke) a partir dos laços da imagem. */
function outlineItems(loopsIn, map, sceneDpi, f, s) {
  const items = [];
  const outline = s.outline || (s.walls ? "wall" : "none");
  if (outline === "none") return items;
  const loops = loopsIn
    .map((l) => simplifyLoop(l, Math.max(s.simplify, s.outlineSimplify) * f))
    .filter((l) => l.length >= 3);
  const toScene = (loop) => {
    const pts = loop.map(([x, y]) => imagePixelToScene(map, sceneDpi, x / f, y / f));
    pts.push({ ...pts[0] }); // fecha o laço repetindo o primeiro ponto
    return pts;
  };
  const tag = { [META]: true };
  for (const loop of loops) {
    const pts = toScene(loop);
    if (outline === "wall") {
      items.push(buildWall().points(pts).name("Parede (balde)").metadata(tag).build());
    } else if (outline === "curve") {
      // linha comum, igual à da ferramenta de desenho: botão direito → Convert to Obstruction
      items.push(
        buildCurve().points(pts).tension(0).closed(false)
          .strokeColor("#ff4fd8").strokeOpacity(1).strokeWidth(4).fillOpacity(0)
          .layer("DRAWING").name("Contorno (balde)").metadata(tag).build(),
      );
    } else if (outline === "smoke") {
      const t = s.smokeTemplate;
      if (!t) {
        OBR.notification.show("Balde de Fog: ensine o formato do Smoke no painel antes (selecione uma obstrução e clique em Aprender).", "WARNING");
        break;
      }
      const meta = { ...t.metadata, ...tag };
      if (t.type === "LINE") {
        for (let i = 0; i < pts.length - 1; i++) {
          const b = buildLine().startPosition(pts[i]).endPosition(pts[i + 1]).layer(t.layer).name(t.name || "Obstruction").metadata(meta).locked(!!t.locked);
          if (t.style) b.style(t.style);
          items.push(b.build());
        }
      } else {
        const b = buildCurve().points(pts).layer(t.layer).name(t.name || "Obstruction").metadata(meta).locked(!!t.locked);
        if (t.style) b.style({ ...t.style, closed: false });
        items.push(b.build());
      }
    }
  }
  return items;
}

async function onClick(context, event, sweep = false) {
  const role = await OBR.player.getRole();
  if (role !== "GM") return;
  const s = { ...DEFAULTS, ...(context.metadata || {}) };
  const sceneDpi = await OBR.scene.grid.getDpi();
  const hit = await findMapUnder(event.pointerPosition, sceneDpi);
  if (!hit) {
    OBR.notification.show("Balde de Fog: clique em cima de um mapa (camada Mapa).", "WARNING");
    return;
  }
  const { map, p } = hit;
  let img;
  try {
    img = await loadPixels(map, s.maxDim);
  } catch (e) {
    OBR.notification.show(
      "Balde de Fog: não consegui ler a imagem deste mapa. Abra o painel do Balde de Fog e carregue o mesmo arquivo de imagem.",
      "ERROR",
    );
    return;
  }
  // a imagem processada pode estar reduzida em relação ao tamanho original do mapa
  const f = img.width / map.image.width;
  const sx = Math.min(img.width - 1, Math.max(0, Math.floor(p.x * f)));
  const sy = Math.min(img.height - 1, Math.max(0, Math.floor(p.y * f)));
  const cellPx = (map.grid?.dpi || 150) * f; // tamanho de um quadrado na imagem processada
  const res = sweep
    // varredura: tudo no mapa com a mesma "cor média" do ponto clicado (o vazio), conectado ou não
    ? sweepVoid(img, sx, sy, {
      tolerance: s.tolerance,
      smooth: s.smooth * f,
      grow: s.grow * f,
      simplify: s.simplify * f,
      minIsland: Math.max(64, 1.5 * cellPx * cellPx),
      minHole: Math.max(s.minHole * f * f, 0.5 * cellPx * cellPx),
    })
    : fogFill(img, sx, sy, {
      tolerance: s.tolerance,
      contiguous: s.contiguous,
      smooth: s.smooth * f,
      grow: s.grow * f,
      simplify: s.simplify * f,
      minHole: s.minHole * f * f,
      minIsland: 64,
    });
  if (!res.loops.length) {
    OBR.notification.show("Balde de Fog: nada selecionado aqui. Tente aumentar a tolerância.", "WARNING");
    return;
  }
  if (res.pixels > (sweep ? 0.95 : 0.85) * img.width * img.height) {
    OBR.notification.show("Balde de Fog: a seleção pegou quase o mapa inteiro. Diminua a tolerância e tente de novo.", "WARNING");
    return;
  }

  // Path na camada de fog, com as mesmas posição/rotação/escala do mapa
  const k = sceneDpi / map.grid.dpi;
  const commands = [];
  for (const loop of res.loops) {
    loop.forEach(([x, y], i) => {
      const ix = x / f - map.grid.offset.x, iy = y / f - map.grid.offset.y;
      commands.push(i === 0 ? [Command.MOVE, ix, iy] : [Command.LINE, ix, iy]);
    });
    commands.push([Command.CLOSE]);
  }
  const color = s.color || (await OBR.scene.fog.getColor());
  const fill = buildPath()
    .commands(commands)
    .fillRule("evenodd")
    .position(map.position)
    .rotation(map.rotation)
    .scale({ x: map.scale.x * k, y: map.scale.y * k })
    .fillColor(color)
    .fillOpacity(1)
    .strokeColor(color)
    .strokeOpacity(0)
    .strokeWidth(0)
    .layer("FOG")
    .name("Fog (balde)")
    .metadata({ [META]: true })
    .build();
  const items = [fill];

  // contorno extra (paredes / obstruções), com simplificação própria
  const outline = s.outline || (s.walls ? "wall" : "none");
  items.push(...outlineItems(res.loops, map, sceneDpi, f, s));
  await OBR.scene.items.addItems(items);
  await OBR.tool.setMetadata(TOOL_ID, { lastIds: items.map((i) => i.id) });
  OBR.notification.show(
    `Balde de Fog: ${sweep ? "varredura feita" : "área preenchida"} (${res.loops.length} contorno${res.loops.length > 1 ? "s" : ""}${outline === "wall" ? ", com paredes" : outline === "smoke" ? ", com obstruções do Smoke" : outline === "curve" ? ", com contorno para converter" : ""}).`,
    "SUCCESS",
  );
}

// ---------- Modo 2: balde por obstrução ----------
function isBoundary(i, s) {
  if (!["CURVE", "LINE", "PATH", "WALL"].includes(i.type)) return false;
  const meta = i.metadata || {};
  if (meta[META] && i.layer === "FOG" && i.type === "PATH") return false; // o próprio fog do balde
  if (i.type === "WALL") return true;
  if (Object.keys(meta).some((k) => k.startsWith(SMOKE_PREFIX))) return true;
  return !!s.useDrawings && i.layer === "DRAWING" && (i.type === "CURVE" || i.type === "LINE");
}

async function onWallClick(context, event) {
  const role = await OBR.player.getRole();
  if (role !== "GM") return;
  const s = { ...DEFAULTS, ...(context.metadata || {}) };
  const dpi = await OBR.scene.grid.getDpi();
  const items = await OBR.scene.items.getItems((i) => isBoundary(i, s));
  const polylines = items.flatMap((i) => itemPolylines(i, dpi * 0.3));
  const r = fillFromWalls(event.pointerPosition, polylines, dpi);
  if (r.error) {
    const msg = {
      NO_WALLS: "não achei obstruções na cena.",
      NOT_CLOSED: "essa área não está totalmente fechada por obstruções. Feche o vão ou use o modo por cor.",
      ON_WALL: "você clicou em cima de uma linha. Clique um pouco mais para dentro da área.",
    }[r.error] || "não consegui preencher aqui.";
    OBR.notification.show(`Balde de Fog: ${msg}`, "WARNING");
    return;
  }
  const commands = [];
  for (const loop of r.loops) {
    loop.forEach((p, i) => commands.push(i === 0 ? [Command.MOVE, p.x, p.y] : [Command.LINE, p.x, p.y]));
    commands.push([Command.CLOSE]);
  }
  const color = s.color || (await OBR.scene.fog.getColor());
  const fill = buildPath()
    .commands(commands)
    .fillRule("evenodd")
    .position({ x: 0, y: 0 })
    .fillColor(color).fillOpacity(1)
    .strokeColor(color).strokeOpacity(0).strokeWidth(0)
    .layer("FOG")
    .name("Fog (balde)")
    .metadata({ [META]: true })
    .build();
  await OBR.scene.items.addItems([fill]);
  await OBR.tool.setMetadata(TOOL_ID, { lastIds: [fill.id] });
  const holes = r.loops.length - 1;
  OBR.notification.show(`Balde de Fog: área preenchida pela obstrução${holes > 0 ? ` (${holes} ilha${holes > 1 ? "s" : ""} deixada${holes > 1 ? "s" : ""} de fora)` : ""}.`, "SUCCESS");
}

OBR.onReady(async () => {
  await OBR.tool.create({
    id: TOOL_ID,
    icons: [{ icon: icon("icon.svg"), label: "Balde de Fog", filter: { roles: ["GM"] } }],
    shortcut: "Shift+F",
    defaultMode: MODE_WALL_ID,
    defaultMetadata: { ...DEFAULTS },
  });
  await OBR.tool.createMode({
    id: MODE_WALL_ID,
    icons: [{ icon: icon("icon-wall.svg"), label: "Balde por obstrução", filter: { activeTools: [TOOL_ID] } }],
    cursors: [{ cursor: "crosshair" }],
    onToolClick: (context, event) => {
      onWallClick(context, event).catch((e) => {
        console.error(`[${ID}]`, e);
        OBR.notification.show("Balde de Fog: erro inesperado (veja o console).", "ERROR");
      });
      return false;
    },
  });
  await OBR.tool.createMode({
    id: MODE_ID,
    icons: [{ icon: icon("icon.svg"), label: "Balde por cor do mapa", filter: { activeTools: [TOOL_ID] } }],
    cursors: [{ cursor: "crosshair" }],
    onToolClick: (context, event) => {
      onClick(context, event).catch((e) => {
        console.error(`[${ID}]`, e);
        OBR.notification.show("Balde de Fog: erro inesperado (veja o console).", "ERROR");
      });
      return false;
    },
  });
  await OBR.tool.createMode({
    id: MODE_SWEEP_ID,
    icons: [{ icon: icon("icon-sweep.svg"), label: "Varrer o mapa inteiro (clique no vazio)", filter: { activeTools: [TOOL_ID] } }],
    cursors: [{ cursor: "crosshair" }],
    onToolClick: (context, event) => {
      OBR.notification.show("Balde de Fog: varrendo o mapa...");
      onClick(context, event, true).catch((e) => {
        console.error(`[${ID}]`, e);
        OBR.notification.show("Balde de Fog: erro inesperado (veja o console).", "ERROR");
      });
      return false;
    },
  });
  // se o mapa trocar de imagem, esquece o cache
  OBR.scene.onReadyChange(() => cache.clear());
});
