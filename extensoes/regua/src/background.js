import { controls } from "./visibility.js";
import OBR from "@owlbear-rodeo/sdk";
import { ID, META_AREA, TOOL_ID, MODES, MODAL_ID, TRAIL_CHANNEL, url, loadGrid, loadSettings, saveSettings, shouldPin } from "./shared.js";
import { RulerSession, movableToken, showTrail } from "./session.js";
import { GrabController } from "./grab.js";
import { AreaSession, areaOrigin, clearAreas } from "./area.js";
import { toggleDifficult } from "./terrain.js";
import { VisionSession, loadObstacles, sceneTokens, COVER_KEY, PEEKABOO_KEY } from "./vision.js";

let ruler = null;   // medição / movimento no modo nativo
let area = null;    // área sendo desenhada
let grab = null;    // segurar e soltar (modo nativo, sem a camada do botão direito)
let role = "PLAYER";
let grabDownTarget = null;

// metadado da ferramenta: muda o cursor (measuring) e qual ícone de "fixar" aparece na barra (pin)
const toolMeta = { measuring: false, pin: true };
const pushMeta = () => OBR.tool.setMetadata(TOOL_ID, { ...toolMeta }).catch(() => {});
const setMeasuring = (v) => { toolMeta.measuring = v; pushMeta(); };
const syncPin = () => { toolMeta.pin = !!loadSettings().pin; pushMeta(); };

function endRuler() { if (ruler) { ruler.cancel(); ruler = null; } setMeasuring(false); }
function endArea() { if (area) { area.cancel(); area = null; } setMeasuring(false); }
function endGrab() { if (grab) { grab.cancel(); grab = null; } setMeasuring(false); }

/** Começa um movimento (token) ou uma medição (chão). */
async function startRuler(kind, event) {
  const settings = loadSettings();
  const token = kind === "move" && movableToken(event.target, role) ? event.target : null;
  const k = token ? "move" : "measure";
  const grid = await loadGrid();
  const start = token ? token.position : (grid.square && !event.altKey
    ? { x: (Math.floor(event.pointerPosition.x / grid.dpi) + 0.5) * grid.dpi, y: (Math.floor(event.pointerPosition.y / grid.dpi) + 0.5) * grid.dpi }
    : event.pointerPosition);

  if (settings.confirm === "right") {
    // camada transparente sobre o mapa: é ela que recebe o botão direito
    const q = new URLSearchParams({ kind: k, sx: start.x, sy: start.y, px: event.pointerPosition.x, py: event.pointerPosition.y });
    if (token) q.set("token", token.id);
    try {
      await controls.modal.open({ id: MODAL_ID, url: url(`overlay.html?${q}`), fullScreen: true, hideBackdrop: true, hidePaper: true });
      return;
    } catch (e) {
      console.warn(`[${ID}] camada indisponível, usando o modo nativo`, e);
    }
  }
  const [color, owner] = await Promise.all([OBR.player.getColor(), OBR.player.getId()]);
  ruler = new RulerSession({ kind: k, grid, start, token, color, trailMs: settings.trailMs, stepMs: settings.stepMs, persist: shouldPin(settings, k), owner, cellRule: settings.cellRule });
  await ruler.begin();
  await ruler.move(event.pointerPosition, event.altKey);
  setMeasuring(true);
}

async function confirmRuler() {
  if (!ruler) return;
  const r = ruler; ruler = null;
  setMeasuring(false);
  await r.confirm();
}

function rulerMode(kind, icon, label) {
  return {
    id: MODES[kind],
    icons: [{ icon: url(icon), label, filter: { activeTools: [TOOL_ID] } }],
    cursors: [
      { cursor: "crosshair", filter: { metadata: [{ key: "measuring", value: true }] } },
      ...(kind === "move" ? [
        { cursor: "pointer", filter: { target: [{ key: "type", value: "IMAGE" }, { key: "layer", value: "CHARACTER" }] } },
        { cursor: "pointer", filter: { target: [{ key: "type", value: "IMAGE" }, { key: "layer", value: "MOUNT" }] } },
      ] : []),
      { cursor: kind === "move" ? "move" : "crosshair" },
    ],
    // arrastar um token com a régua ativa não deve movê-lo por fora da régua
    preventDrag: { target: [{ key: "type", value: "IMAGE" }] },
    onToolClick: async (_ctx, event) => {
      if (area) return false;
      if (!ruler) await startRuler(kind, event);
      else { await ruler.move(event.pointerPosition, event.altKey); await ruler.addPoint(); }
      return false;
    },
    onToolDoubleClick: () => { confirmRuler(); return false; },
    onToolMove: (_ctx, event) => { if (ruler) ruler.move(event.pointerPosition, event.altKey); },
    onKeyDown: (_ctx, e) => {
      if (!ruler) return;
      if (e.key === "Escape") endRuler();
      else if (e.key === "Enter" || e.key === " ") confirmRuler();
      else if (e.key === "Backspace") ruler.undoPoint();
    },
    onDeactivate: () => endRuler(),
  };
}

function areaMode(kind, icon, label) {
  return {
    id: MODES[kind],
    icons: [{ icon: url(icon), label, filter: { activeTools: [TOOL_ID] } }],
    cursors: [{ cursor: "crosshair" }],
    preventDrag: { dragging: false, metadata: [{ key: "measuring", value: true }] },
    onToolClick: async (_ctx, event) => {
      if (!area) {
        const [grid, color, playerId] = await Promise.all([loadGrid(), OBR.player.getColor(), OBR.player.getId()]);
        const origin = areaOrigin(kind, event.pointerPosition, grid, event.target, event.altKey);
        const settings = loadSettings();
        // paredes e tokens: a área respeita linha de efeito e mostra a cobertura de quem está dentro
        const [obstacles, tokens] = settings.areaWalls === false ? [null, []] : await Promise.all([loadObstacles(grid.dpi), sceneTokens(grid.dpi)]);
        area = new AreaSession({ kind, origin, grid, color, settings, playerId, obstacles, tokens });
        await area.begin();
        area.move(event.pointerPosition, event.altKey);
        setMeasuring(true);
      } else {
        const a = area; area = null;
        setMeasuring(false);
        a.move(event.pointerPosition, event.altKey);
        // Shift no 2º clique (ou o ajuste do painel) = terreno difícil
        await a.place(event.shiftKey || !!a.settings.difficult);
      }
      return false;
    },
    onToolMove: (_ctx, event) => { if (area) area.move(event.pointerPosition, event.altKey); },
    onKeyDown: (_ctx, e) => { if (e.key === "Escape") endArea(); },
    onDeactivate: () => endArea(),
  };
}

// ---------- Segurar e soltar ----------
async function grabStart(token, p, alt) {
  const settings = loadSettings();
  const [grid, color, owner] = await Promise.all([loadGrid(), OBR.player.getColor(), OBR.player.getId()]);
  grab = new GrabController({ grid, start: token.position, token, color, trailMs: settings.trailMs, stepMs: settings.stepMs, persist: shouldPin(settings, "move"), owner, cellRule: settings.cellRule, shadow: settings.liftShadow !== false });
  await grab.begin();
  setMeasuring(true);
  await grab.down(p, alt);
}

/** Soltou: no modo "botão direito", a camada transparente assume (para receber o direito); senão, segue nativo. */
async function grabRelease(p, alt) {
  const g = grab;
  await g.up(p, alt);
  const settings = loadSettings();
  if (settings.confirm !== "right" || !g.ready) return;
  const q = new URLSearchParams({ kind: "move", grab: "1", token: g.s.token.id, pts: JSON.stringify(g.points.map((q2) => [Math.round(q2.x * 100) / 100, Math.round(q2.y * 100) / 100])) });
  try {
    await controls.modal.open({ id: MODAL_ID, url: url(`overlay.html?${q}`), fullScreen: true, hideBackdrop: true, hidePaper: true });
    grab = null;            // a camada cuida do resto
    setTimeout(() => g.cancel(), 450); // some com a prévia do background depois que a camada desenhar a sua
    setMeasuring(false);
  } catch (e) { console.warn(`[${ID}] camada indisponível, segurar e soltar fica no modo nativo`, e); }
}

const grabMode = {
  id: MODES.grab,
  icons: [{ icon: url("mode-grab.svg"), label: "Mover: segurar e soltar (solte para marcar, direito confirma)", filter: { activeTools: [TOOL_ID] } }],
  cursors: [
    { cursor: "grabbing", filter: { dragging: true } },
    { cursor: "grab", filter: { target: [{ key: "type", value: "IMAGE" }, { key: "layer", value: "CHARACTER" }] } },
    { cursor: "grab", filter: { target: [{ key: "type", value: "IMAGE" }, { key: "layer", value: "MOUNT" }] } },
    { cursor: "default" },
  ],
  // atenção: nesse filtro, "verdadeiro" = roda o arrasto PADRÃO do Owlbear (como a ferramenta Mover).
  // Então o arrasto padrão só vale fora dos tokens; em cima de um token quem trata é a régua.
  preventDrag: { target: [{ key: "type", value: "IMAGE", operator: "!=" }] },
  // o alvo vem do "down" (o evento de arrastar nem sempre traz o item sob o ponteiro)
  onToolDown: (_ctx, event) => { grabDownTarget = event.target || null; if (loadSettings().debugGrab) OBR.notification.show(`[régua] botão apertado · alvo: ${event.target ? `${event.target.type}/${event.target.layer}${event.target.locked ? " (travado)" : ""}` : "nenhum"}`, "DEFAULT").catch(() => {}); },
  onToolDragStart: async (_ctx, event) => {
    if (loadSettings().debugGrab) OBR.notification.show(`[régua] arrasto iniciado · alvo: ${event.target ? `${event.target.type}/${event.target.layer}` : (grabDownTarget ? "do down" : "nenhum")}`, "DEFAULT").catch(() => {});
    try {
      if (area) return;
      if (grab) { await grab.down(event.pointerPosition, event.altKey); return; }
      const t = event.target || grabDownTarget;
      if (movableToken(t, role)) await grabStart(t, event.pointerPosition, event.altKey);
    } catch (e) { console.error(`[${ID}] segurar e soltar`, e); OBR.notification.show(`Régua: erro ao pegar o token (${e?.message || e})`, "ERROR").catch(() => {}); endGrab(); }
  },
  onToolDragMove: (_ctx, event) => { if (grab) grab.move(event.pointerPosition, event.altKey); },
  onToolDragEnd: async (_ctx, event) => {
    try { if (grab) await grabRelease(event.pointerPosition, event.altKey); }
    catch (e) { console.error(`[${ID}] segurar e soltar`, e); OBR.notification.show(`Régua: erro ao soltar (${e?.message || e})`, "ERROR").catch(() => {}); endGrab(); }
  },
  onToolDragCancel: () => endGrab(),
  onToolClick: async (_ctx, event) => {
    // modo nativo, com marcas feitas: um clique no chão acrescenta um ponto
    if (grab && grab.phase === "pending") await grab.down(event.pointerPosition, event.altKey);
    return false;
  },
  onToolDoubleClick: () => { if (grab && grab.ready) { const g = grab; grab = null; setMeasuring(false); g.confirm(); } return false; },
  onKeyDown: (_ctx, e) => {
    if (!grab) return;
    if (e.key === "Escape") endGrab();
    else if ((e.key === "Enter" || e.key === " ") && grab.ready) { const g = grab; grab = null; setMeasuring(false); g.confirm(); }
    else if (e.key === "Backspace") grab.undo();
  },
  onDeactivate: () => endGrab(),
};

// ---------- Visão e cobertura ----------
let vision = null;       // { s: VisionSession, locked }
function endVision() { if (vision) { vision.s.stop(); vision = null; } setMeasuring(false); }

const visionMode = {
  id: MODES.vision,
  icons: [{ icon: url("mode-vision.svg"), label: "Visão e cobertura", filter: { activeTools: [TOOL_ID] } }],
  cursors: [{ cursor: "crosshair" }],
  preventDrag: { target: [{ key: "type", value: "IMAGE" }] },
  onToolClick: async (_ctx, event) => {
    if (vision && !vision.locked) {
      // 2º clique: congela o resultado na tela até o próximo clique ou Esc
      vision.s.aim(event.pointerPosition, event.target, event.altKey);
      vision.locked = true;
      setMeasuring(false);
      return false;
    }
    endVision();
    const settings = loadSettings();
    const grid = await loadGrid();
    const t = event.target;
    const onTok = t && t.type === "IMAGE" && (t.layer === "CHARACTER" || t.layer === "MOUNT");
    const source = onTok ? t.position : event.altKey || !grid.square
      ? event.pointerPosition
      : { x: (Math.floor(event.pointerPosition.x / grid.dpi) + 0.5) * grid.dpi, y: (Math.floor(event.pointerPosition.y / grid.dpi) + 0.5) * grid.dpi };
    const [obstacles, tokens] = await Promise.all([loadObstacles(grid.dpi), sceneTokens(grid.dpi)]);
    const s = new VisionSession({ source, sourceId: onTok ? t.id : null, grid, obstacles, settings, tokens });
    vision = { s, locked: false };
    await s.begin();
    s.aim(event.pointerPosition, event.target, event.altKey);
    setMeasuring(true);
    return false;
  },
  onToolMove: (_ctx, event) => { if (vision && !vision.locked) vision.s.aim(event.pointerPosition, event.target, event.altKey); },
  onKeyDown: (_ctx, e) => { if (e.key === "Escape") endVision(); },
  onDeactivate: () => endVision(),
};

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  OBR.player.onChange((p) => { role = p.role; });

  await controls.tool.create({
    id: TOOL_ID,
    icons: [{ icon: url("icon.svg"), label: "Régua (mover e medir)" }],
    shortcut: "Q",
    defaultMode: MODES.move,
    defaultMetadata: { measuring: false, pin: true },
  });

  await Promise.all([
    controls.tool.createMode(rulerMode("move", "mode-move.svg", "Mover personagem")),
    controls.tool.createMode(grabMode),
    controls.tool.createMode(rulerMode("measure", "mode-measure.svg", "Medir distância")),
    controls.tool.createMode(visionMode),
    controls.tool.createMode(areaMode("circle", "mode-circle.svg", "Área: círculo / esfera (raio)")),
    controls.tool.createMode(areaMode("cone", "mode-cone.svg", "Área: cone")),
    controls.tool.createMode(areaMode("square", "mode-square.svg", "Área: quadrado centrado (aura)")),
    controls.tool.createMode(areaMode("cube", "mode-cube.svg", "Área: cubo (a partir de uma quina)")),
    controls.tool.createMode(areaMode("line", "mode-line.svg", "Área: linha")),
  ]);

  await controls.tool.createAction({
    id: `${ID}/clear-mine`,
    icons: [{ icon: url("act-clear.svg"), label: "Apagar minhas medidas e áreas", filter: { activeTools: [TOOL_ID] } }],
    onClick: async () => {
      const n = await clearAreas(false);
      OBR.notification.show(n ? `Régua: ${n} item(ns) apagado(s).` : "Régua: você não tem áreas no mapa.");
    },
  });
  await controls.tool.createAction({
    id: `${ID}/clear-all`,
    icons: [{ icon: url("act-clear-all.svg"), label: "Apagar todas as medidas e áreas (mestre)", filter: { activeTools: [TOOL_ID], roles: ["GM"] } }],
    onClick: async () => {
      const n = await clearAreas(true);
      OBR.notification.show(n ? `Régua: ${n} item(ns) apagado(s).` : "Régua: não há áreas no mapa.");
    },
  });
  // liga/desliga rápido o "manter no mapa" (o ícone mostra o estado)
  const togglePin = () => {
    const st = loadSettings(); st.pin = !st.pin; saveSettings(st); syncPin();
    OBR.notification.show(st.pin ? "Régua: medidas ficam no mapa, com as dimensões." : "Régua: medidas somem ao terminar.");
  };
  await controls.tool.createAction({
    id: `${ID}/pin-on`,
    icons: [{ icon: url("act-pin-on.svg"), label: "Manter no mapa: LIGADO (clique para desligar)", filter: { activeTools: [TOOL_ID], metadata: [{ key: "pin", value: true }] } }],
    onClick: togglePin,
  });
  await controls.tool.createAction({
    id: `${ID}/pin-off`,
    icons: [{ icon: url("act-pin-off.svg"), label: "Manter no mapa: DESLIGADO (clique para ligar)", filter: { activeTools: [TOOL_ID], metadata: [{ key: "pin", value: true, operator: "!=" }] } }],
    onClick: togglePin,
  });
  await controls.tool.createAction({
    id: `${ID}/help`,
    icons: [{ icon: url("act-help.svg"), label: "Ajustes e atalhos da Régua", filter: { activeTools: [TOOL_ID] } }],
    onClick: (_ctx, elementId) => controls.popover.open({
      id: `${ID}/popover`, url: url("index.html"), width: 330, height: 640,
      anchorElementId: elementId,
      anchorOrigin: { horizontal: "CENTER", vertical: "BOTTOM" },
      transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
    }),
  });

  // o painel grava no localStorage; o evento "storage" avisa o background
  syncPin();
  window.addEventListener("storage", () => syncPin());

  OBR.broadcast.onMessage(TRAIL_CHANNEL, (e) => { showTrail(e.data).catch(() => {}); });

  // menu de contexto nas áreas fixadas: liga/desliga terreno difícil
  const areaFilter = (on) => ({
    every: [
      { key: ["metadata", META_AREA, "kind"], value: undefined, operator: "!=" },
      { key: ["metadata", META_AREA, "kind"], value: "ruler", operator: "!=" },
      { key: ["metadata", META_AREA, "kind"], value: "path", operator: "!=" },
      { key: ["metadata", META_AREA, "difficult"], value: true, operator: on ? "!=" : "==" },
    ],
  });
  await controls.contextMenu.create({
    id: `${ID}/difficult-on`,
    icons: [{ icon: url("ctx-difficult.svg"), label: "Virar terreno difícil", filter: areaFilter(true) }],
    onClick: (ctx) => toggleDifficult(ctx.items.map((i) => i.id), true),
  });
  await controls.contextMenu.create({
    id: `${ID}/difficult-off`,
    icons: [{ icon: url("ctx-difficult-off.svg"), label: "Tirar terreno difícil", filter: areaFilter(false) }],
    onClick: (ctx) => toggleDifficult(ctx.items.map((i) => i.id), false),
  });

  // coberturas parciais (mestre): móveis, carros, muretas... desenhados como linha, forma ou caminho
  const notOurs = { key: ["metadata", META_AREA], value: undefined };
  const setCover = (v) => async (ctx) => {
    await OBR.scene.items.updateItems(ctx.items.map((i) => i.id), (draft) => {
      for (const it of draft) {
        if (v === null) { delete it.metadata[COVER_KEY]; delete it.metadata[PEEKABOO_KEY]; }
        else it.metadata[COVER_KEY] = v;
      }
    });
  };
  const noCover = [{ key: ["metadata", COVER_KEY], value: undefined }, { key: ["metadata", PEEKABOO_KEY], value: undefined }];
  for (const [v, lbl, ic] of [[0.5, "Virar meia cobertura (50%)", "ctx-cover-half.svg"], [0.75, "Virar cobertura ¾ (75%)", "ctx-cover-34.svg"]]) {
    await controls.contextMenu.create({
      id: `${ID}/cover-${v}`,
      icons: [{ icon: url(ic), label: lbl, filter: { roles: ["GM"], every: [...["IMAGE", "LABEL", "TEXT", "WALL", "RULER", "LIGHT", "EFFECT"].map((t) => ({ key: "type", value: t, operator: "!=" })), notOurs, ...noCover] } }],
      onClick: setCover(v),
    });
  }
  await controls.contextMenu.create({
    id: `${ID}/cover-off`,
    icons: [
      { icon: url("ctx-cover-off.svg"), label: "Tirar cobertura parcial", filter: { roles: ["GM"], every: [{ key: ["metadata", COVER_KEY], value: undefined, operator: "!=" }] } },
      { icon: url("ctx-cover-off.svg"), label: "Tirar cobertura parcial (Peekaboo)", filter: { roles: ["GM"], every: [{ key: ["metadata", PEEKABOO_KEY], value: undefined, operator: "!=" }] } },
    ],
    onClick: setCover(null),
  });

  // se a cena trocar no meio de uma medição, descarta tudo
  OBR.scene.onReadyChange((ready) => { if (!ready) { endRuler(); endArea(); endVision(); endGrab(); } });
});
