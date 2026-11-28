import { controls } from "./visibility.js";
// Vigilância em segundo plano (todos os navegadores):
// - desenha os cones das câmeras e a camada RA da Matriz como itens LOCAIS (cada um vê o que pode ver);
// - no mestre líder: vê quem entrou nos cones, avisa e manda o evento para o Gatilhos; aplica pedidos de hack.
import OBR, { buildPath, buildLabel, buildShape, buildEffect, buildCurve } from "@owlbear-rodeo/sdk";
import {
  CAM, NODE, DECK, ACCESS, STATE_COLOR, camOf, camOn, nodeOf, coneDir, toWorld, OLHAR, olharOf, conePolygon, seenBy, wallsFrom,
  hasAccess, canWatch, maskCommands, cmdsBounds, FEED, nodeChanges, doorLock, iconOf, stateLabel,
  VISION, ONLY, TINT, activeModes, toggleVision, visionOf, ownedBy, EST_GROUPS, sameFloor,
  LASER, laserOf, laserOn, isLaserShape, laserSegments, laserTouched, laserWatchers, laserStep,
} from "./core.js";
import {
  ruidoCfg, hears, shotRaio, rondaOf, routeOf, portasStep, doorTrigger, isDoorLine, doorOpenNow, doorLockedNow, patrolInit, patrolStep, investigate, hold, verdadeOf, versionFor, appearance, ETIQ, etiquetaOf, etiquetaTexto, etiquetaVisivel,
} from "./extra.js";
import {
  CH_RUIDO, CH_OUVIU, ID, PENDING, CH_SEEN, CH_NODE, CH_SET, CH_REQ, CH_RES, CH_PREFS, CH_VISION, APPROVE,
  CH_LASER, CH_LASER_TESTE, url, itemName, uid, getPrefs, setState, makeCamera, makeNode, makeLaser, decide, editEtiqueta,
} from "./ops.js";
import { readPerf, onPerf, onClean } from "./perf.js";

const LOCAL = `${ID}/local`; // marca dos nossos itens locais
let role = "PLAYER", myId = "", myConn = "";
let items = [];          // itens da cena
let walls = [];          // trechos de parede (névoa dinâmica / Smoke & Spectre)
let wallSig = "";
let localWalls = []; // paredes locais (a névoa dinâmica desenha as paredes como itens locais)
let access = { players: [], autoApprove: false };
let prefs = getPrefs();
let perf = null; // perfil do Otimizador neste navegador (null = sem perfil): filtro de cor e frequência da varredura
let lastSweep = 0;
let dpi = 150;
let watch = "";      // câmera que ESTE jogador está vendo (metadado do jogador)
let viewBefore = null; // enquadramento antes de ver pela câmera
let ready = false;
let estGroups = []; // prédios/andares do Estados (câmeras só veem o próprio andar)
let ruido = ruidoCfg({});    // chave geral e alcances do ruído (metadado da cena)
const noises = [];           // barulhos recentes, só para o mestre ver o círculo { id, x, y, raio, until }
const patrols = new Map();   // guarda -> estado da ronda (só no líder)

const shown = new Map();      // id local -> assinatura do que está desenhado
const prevSeen = new Map();   // câmera -> Set(tokens) (só no líder)
const prevState = new Map();  // nó -> estado (só no líder)

async function isLeader() {
  if (role !== "GM") return false;
  const gms = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role === "GM").map((p) => p.connectionId);
  return [myConn, ...gms].sort()[0] === myConn;
}
let leader = false;
const refreshLeader = async () => { leader = await isLeader(); };

const tag = (b) => b.locked(true).disableHit(true).metadata({ [LOCAL]: true });
const lid = (kind, id) => `${ID}-${kind}-${id}`;

// ---------- desenho ----------
function coneLook(it, seen) {
  const st = nodeOf(it)?.state ?? "ativo";
  if (st === "ativo") return seen ? { fill: "#ff3b30", op: 0.28, stroke: "#ff3b30", dash: [] } : { fill: "#4fc3ff", op: 0.16, stroke: "#4fc3ff", dash: [] };
  if (st === "loop") return { fill: STATE_COLOR.loop, op: 0.1, stroke: STATE_COLOR.loop, dash: [dpi / 8, dpi / 10] };
  if (st === "hackeado") return { fill: STATE_COLOR.hackeado, op: 0.12, stroke: STATE_COLOR.hackeado, dash: [dpi / 8, dpi / 10] };
  return { fill: "#8a8f98", op: 0, stroke: "#8a8f98", dash: [dpi / 16, dpi / 8] }; // desativado: só o contorno
}

function coneCommands(it, cam, now) {
  const pts = conePolygon(coneDir(it, cam, now), cam, walls, dpi, it.position);
  return [...pts.map((p, i) => [i ? 1 : 0, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]), [5]];
}

/** O que este navegador deve ver agora: { id: { sig, build, live? } } */
function wanted(now) {
  const out = new Map();
  const gm = role === "GM";
  const ra = prefs.ra && hasAccess(myId, role, items, access);
  const modes = activeModes(myId, role, items);
  const myDecks = ownedBy(myId, items).filter((i) => i.metadata?.[DECK] === true).map((i) => i.position);
  // filtro de cor na tela (térmica laranja, baixa luz verde) para quem está com o modo ligado
  if (modes.length && prefs.tint !== false && perf?.vig?.tint !== false) {
    const m = modes.includes("termica") ? "termica" : "baixa";
    const [r, g, b] = TINT[m];
    out.set(lid("filtro", m), {
      sig: m,
      build: () => tag(buildEffect().effectType("VIEWPORT").sksl(`half4 main(float2 c) { return half4(${r.toFixed(2)}, ${g.toFixed(2)}, ${b.toFixed(2)}, 0.5); }`)
        .blendMode("COLOR").layer("POST_PROCESS").name(`Visão: ${m}`)).id(lid("filtro", m)).build(),
    });
  }
  for (const it of items) {
    const cam = camOf(it);
    if (cam && ((gm && prefs.cones) || (cam.showAll && it.visible !== false))) {
      const st = nodeOf(it)?.state ?? "ativo";
      if (st !== "desativado" || gm) {
        const seen = camOn(it) && seenBy(it, items, walls, dpi, now, estGroups).length > 0;
        const look = coneLook(it, seen);
        const cmds = coneCommands(it, cam, now);
        out.set(lid("cone", it.id), {
          sig: JSON.stringify([it.position, look, cmds]),
          live: { cmds, look },
          build: () => tag(buildPath().position(it.position).commands(cmds).fillColor(look.fill).fillOpacity(look.op)
            .strokeColor(look.stroke).strokeOpacity(0.8).strokeWidth(Math.max(2, dpi / 50)).strokeDash(look.dash)
            .layer("DRAWING").name(`Cone: ${itemName(it)}`)).id(lid("cone", it.id)).build(),
        });
      }
    }
    // laser: brilho vermelho em volta do feixe (some se o laser não está ativo); o item escondido só aparece para o mestre
    const las = laserOf(it);
    if (las && laserOn(it) && (gm || it.visible !== false)) {
      const segs = laserSegments(it);
      const cmds = segs.flatMap((sg, i) => (i && sg.a.x === segs[i - 1].b.x && sg.a.y === segs[i - 1].b.y ? [[1, sg.b.x, sg.b.y]] : [[0, sg.a.x, sg.a.y], [1, sg.b.x, sg.b.y]]));
      if (cmds.length) out.set(lid("laser", it.id), {
        sig: JSON.stringify([cmds, las.cor]),
        build: () => tag(buildPath().position({ x: 0, y: 0 }).commands(cmds).fillOpacity(0).strokeColor(las.cor).strokeOpacity(0.28)
          .strokeWidth(Math.max(10, dpi / 6)).layer("DRAWING").name(`Brilho do laser: ${itemName(it)}`)).id(lid("laser", it.id)).build(),
      });
    }
    // ver pela câmera: escurece tudo fora do cone, só nesta tela
    if (cam && watch === it.id && canWatch(it, myId, role, items, access)) {
      const cmds = maskCommands(coneCommands(it, cam, now));
      out.set(lid("feed", it.id), {
        sig: JSON.stringify([it.position, cmds]),
        live: { cmds, mask: true },
        build: () => tag(buildPath().position(it.position).commands(cmds).fillRule("evenodd").fillColor("#05070a").fillOpacity(0.9)
          .strokeOpacity(0).strokeWidth(0).layer("POINTER").name(`Vendo pela câmera: ${itemName(it)}`)).id(lid("feed", it.id)).build(),
      });
    }
    // visão especial: o item "só em térmica/baixa luz" fica escondido; quem tem o modo ligado vê uma cópia local
    const only = it.metadata?.[ONLY];
    if (only && modes.includes(only)) {
      const copy = JSON.parse(JSON.stringify(it));
      delete copy.attachedTo;
      Object.assign(copy, { id: lid("vis", it.id), visible: true, locked: true, disableHit: true, metadata: { [LOCAL]: true } });
      out.set(copy.id, { sig: JSON.stringify([it.position, it.rotation, it.scale, it.image?.url, it.text?.plainText, it.style, it.layer]), build: () => copy });
      if (only === "termica") {
        const r = dpi * 0.75;
        out.set(lid("calor", it.id), {
          sig: JSON.stringify([it.position]),
          build: () => tag(buildShape().shapeType("CIRCLE").position(it.position).width(r * 2).height(r * 2).fillColor("#ff6a1a").fillOpacity(0.28)
            .strokeColor("#ffb347").strokeOpacity(0.7).strokeWidth(Math.max(2, dpi / 40)).layer("DRAWING")).id(lid("calor", it.id)).build(),
        });
      }
    }
    // verdade por jogador: o original fica escondido; cada jogador vê a versão dele (o mestre vê o original)
    const verdade = verdadeOf(it);
    if (verdade && !gm) {
      const copy = appearance(it, versionFor(verdade, myId));
      if (copy) {
        Object.assign(copy, { id: lid("ver", it.id), visible: true, locked: true, disableHit: true, metadata: { [LOCAL]: true } });
        out.set(copy.id, { sig: JSON.stringify([it.position, it.rotation, it.scale, it.layer, copy.image?.url, copy.text?.plainText, copy.name]), build: () => copy });
      }
    }
    // ronda: o mestre vê a rota (linha e números)
    const ronda = rondaOf(it);
    if (ronda && gm && prefs.cones) {
      const route = routeOf(items, it.id);
      if (route.length) {
        const pts = [...route.map((p) => ({ x: p.x, y: p.y })), ...(route.length > 2 && ronda.modo !== "vaivem" ? [{ x: route[0].x, y: route[0].y }] : [])];
        out.set(lid("rota", it.id), {
          sig: JSON.stringify([pts, ronda.on]),
          build: () => tag(buildCurve().points(pts).tension(0).closed(false).strokeColor(ronda.on ? "#ffb347" : "#8a8f98").strokeWidth(Math.max(2, dpi / 40))
            .strokeDash([dpi / 6, dpi / 8]).strokeOpacity(0.85).fillOpacity(0).layer("DRAWING").name(`Rota: ${itemName(it)}`)).id(lid("rota", it.id)).position({ x: 0, y: 0 }).build(),
        });
        route.forEach((p, i) => out.set(lid("rn", p.id), {
          sig: JSON.stringify([p.x, p.y, i]),
          build: () => tag(buildLabel().position({ x: p.x, y: p.y - dpi * 0.32 }).plainText(String(i + 1)).fontSize(Math.max(12, dpi / 8)).fontWeight(700)
            .backgroundColor("#2a1a00").backgroundOpacity(0.85).fillColor("#ffb347").cornerRadius(6).pointerDirection("DOWN").pointerHeight(5).pointerWidth(8)
            .layer("TEXT")).id(lid("rn", p.id)).build(),
        }));
      }
    }
    const node = nodeOf(it);
    if (node && ra && (gm || (!node.hidden && it.visible !== false))) {
      const color = STATE_COLOR[node.state] || "#4fc3ff";
      const size = Math.max(dpi * 0.9, (it.image ? (it.image.width * dpi) / (it.grid?.dpi || it.image.width) : dpi) * Math.abs(it.scale?.x ?? 1)) * 1.1;
      const text = `${iconOf(node.type)} ${node.name} · ${stateLabel(node.state)}${node.hidden ? " (oculto)" : ""}`;
      out.set(lid("ra", it.id), {
        sig: JSON.stringify([it.position, size, text, color]),
        build: () => tag(buildLabel().position({ x: it.position.x, y: it.position.y - size / 2 }).plainText(text)
          .backgroundColor("#061a24").backgroundOpacity(0.85).fillColor(color).fontWeight(700).fontSize(Math.max(14, dpi / 7))
          .cornerRadius(6).pointerDirection("DOWN").pointerHeight(6).pointerWidth(10).layer("TEXT").name(`Matriz: ${node.name}`))
          .id(lid("ra", it.id)).build(),
      });
      out.set(lid("ring", it.id), {
        sig: JSON.stringify([it.position, size, color]),
        build: () => tag(buildShape().shapeType("HEXAGON").position(it.position).width(size).height(size).fillOpacity(0)
          .strokeColor(color).strokeOpacity(0.9).strokeWidth(Math.max(2, dpi / 40)).strokeDash([dpi / 12, dpi / 16])
          .layer("DRAWING")).id(lid("ring", it.id)).build(),
      });
    }
    // etiqueta de RA: rótulo embaixo do item, só para quem tem RA (e, se configurado, perto e na lista "só para")
    const et = etiquetaOf(it);
    if (et && ra && (gm || it.visible !== false || et.mesmoOculto)
        && etiquetaVisivel(et, it.position, { gm, playerId: myId, decks: myDecks, cell: dpi })) {
      const size = Math.max(dpi * 0.9, (it.image ? (it.image.width * dpi) / (it.grid?.dpi || it.image.width) : dpi) * Math.abs(it.scale?.x ?? 1));
      const text = etiquetaTexto(et, nodeOf(it) ? stateLabel(nodeOf(it).state) : "");
      const col = /^#[0-9a-f]{6}$/i.test(et.cor) ? et.cor : "#4fc3ff";
      out.set(lid("etiq", it.id), {
        sig: JSON.stringify([it.position, size, text, col]),
        build: () => tag(buildLabel().position({ x: it.position.x, y: it.position.y + size / 2 }).plainText(text)
          .backgroundColor("#061a24").backgroundOpacity(0.85).fillColor(col).fontWeight(600).fontSize(Math.max(12, dpi / 8))
          .cornerRadius(6).pointerDirection("UP").pointerHeight(6).pointerWidth(10).layer("TEXT").name(`RA: ${text.split("\n")[0]}`))
          .id(lid("etiq", it.id)).build(),
      });
    }
  }
  if (gm) {
    const now2 = Date.now();
    for (const n of noises) {
      if (n.until < now2) continue;
      const r = n.raio * dpi;
      out.set(lid("ruido", n.id), {
        sig: JSON.stringify([n.x, n.y, n.raio]),
        build: () => tag(buildShape().shapeType("CIRCLE").position({ x: n.x, y: n.y }).width(r * 2).height(r * 2).fillColor("#ffd23f").fillOpacity(0.08)
          .strokeColor("#ffd23f").strokeOpacity(0.8).strokeWidth(Math.max(2, dpi / 40)).strokeDash([dpi / 10, dpi / 10]).layer("DRAWING").name("Ruído")).id(lid("ruido", n.id)).build(),
      });
    }
  }
  return out;
}

let drawing = false, again = false;
async function draw() {
  if (!ready) return;
  if (drawing) { again = true; return; }
  drawing = true;
  try {
    do {
      again = false;
      const want = wanted(Date.now());
      const del = [...shown.keys()].filter((k) => !want.has(k));
      const add = [], live = [];
      for (const [k, w] of want) {
        const old = shown.get(k);
        if (old === undefined) add.push(k);
        else if (old !== w.sig) (w.live && old !== "" ? live : add).push(k);
      }
      // cones que só giraram (varredura) ou mudaram de cor: atualiza no lugar
      const relive = live.filter((k) => !add.includes(k));
      if (relive.length) {
        await OBR.scene.local.updateItems(relive, (d) => {
          for (const it of d) {
            const w = want.get(it.id);
            const camItem = items.find((x) => lid("cone", x.id) === it.id || lid("feed", x.id) === it.id);
            if (camItem) it.position = { ...camItem.position };
            it.commands = w.live.cmds;
            if (w.live.mask) continue;
            it.style.fillColor = w.live.look.fill; it.style.fillOpacity = w.live.look.op;
            it.style.strokeColor = w.live.look.stroke; it.style.strokeDash = w.live.look.dash;
          }
        }).catch(() => { for (const k of relive) shown.delete(k); });
        for (const k of relive) if (shown.has(k)) shown.set(k, want.get(k).sig);
      }
      const redo = add.filter((k) => shown.has(k));
      if (del.length || redo.length) await OBR.scene.local.deleteItems([...del, ...redo]).catch(() => {});
      for (const k of del) shown.delete(k);
      if (add.length) {
        await OBR.scene.local.addItems(add.map((k) => want.get(k).build())).catch((e) => console.error(`[${ID}]`, e));
        for (const k of add) shown.set(k, want.get(k).sig);
      }
    } while (again);
  } finally { drawing = false; }
}

async function clearLocal() {
  const mine = (await OBR.scene.local.getItems().catch(() => [])).filter((i) => i.metadata?.[LOCAL]);
  if (mine.length) await OBR.scene.local.deleteItems(mine.map((i) => i.id)).catch(() => {});
  shown.clear();
}

// ---------- ver pela câmera (só nesta tela) ----------
async function stopWatching(msg) {
  if (watch) { watch = ""; await OBR.player.setMetadata({ [FEED]: "" }).catch(() => {}); }
  if (viewBefore) {
    const v = viewBefore; viewBefore = null;
    await OBR.viewport.setPosition(v.pos).catch(() => {}); await OBR.viewport.setScale(v.scale).catch(() => {});
  }
  if (msg) OBR.notification.show(msg, "INFO");
  draw();
}
/** Liga/desliga o modo conforme o metadado do jogador; sai sozinho se a câmera deixou de poder ser vista. */
async function syncFeed(want) {
  want = want || "";
  const it = items.find((i) => i.id === want);
  if (want && !(it && canWatch(it, myId, role, items, access))) {
    watch = want;
    return stopWatching("Matriz: a conexão com a câmera caiu.");
  }
  if (want === watch) return;
  const entering = !!want && !watch;
  watch = want;
  if (entering && !viewBefore) viewBefore = { pos: await OBR.viewport.getPosition().catch(() => ({ x: 0, y: 0 })), scale: await OBR.viewport.getScale().catch(() => 1) };
  if (!want) return stopWatching();
  draw();
  const cam = camOf(it);
  const b = cmdsBounds(coneCommands(it, cam, Date.now()), it.position);
  if (b) {
    const m = dpi * 2;
    const min = { x: b.min.x - m, y: b.min.y - m }, max = { x: b.max.x + m, y: b.max.y + m };
    await OBR.viewport.animateToBounds({ min, max, center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 }, width: max.x - min.x, height: max.y - min.y }).catch(() => {});
  }
}

// ---------- mestre líder: quem as câmeras veem, nós que mudaram ----------
function detect(now) {
  for (const it of items) {
    if (!camOf(it)) continue;
    const seen = camOn(it) ? seenBy(it, items, walls, dpi, now, estGroups) : [];
    const before = prevSeen.get(it.id) || new Set();
    const fresh = seen.filter((t) => !before.has(t));
    prevSeen.set(it.id, new Set(seen));
    if (fresh.length) {
      const rd = rondaOf(it), ps = patrols.get(it.id);
      if (rd?.on && rd.parar > 0 && ps) patrols.set(it.id, hold(ps, rd.parar * 1000)); // viu alguém: para um pouco
      OBR.broadcast.sendMessage(CH_SEEN, { camera: it.id, name: nodeOf(it)?.name || itemName(it), tokens: fresh, all: seen, alertAll: !!camOf(it).alertAll }, { destination: "ALL" }).catch(() => {});
    }
  }
  for (const id of [...prevSeen.keys()]) if (!items.some((i) => i.id === id)) prevSeen.delete(id);
}

// ---------- lasers: o mestre líder vê quem cortou o feixe ----------
const laserInside = new Map(), laserLast = new Map();
let laserPrev = new Map();
function detectLasers(now) {
  const lasers = items.filter((i) => laserOn(i));
  for (const it of lasers) {
    const l = laserOf(it);
    const touched = laserTouched(it, laserWatchers(it, items, estGroups), laserPrev, dpi);
    const st = laserStep(laserInside.get(it.id) || new Set(), touched.map((h) => h.id), laserLast.get(it.id) || 0, now, l.cooldown);
    laserInside.set(it.id, st.inside);
    if (st.fire) { laserLast.set(it.id, now); fireLaser(it, touched.filter((h) => st.fresh.includes(h.id)), touched.map((h) => h.id)); }
  }
  for (const id of [...laserInside.keys()]) if (!lasers.some((i) => i.id === id)) { laserInside.delete(id); laserLast.delete(id); }
  laserPrev = new Map(items.filter((t) => t.type === "IMAGE").map((t) => [t.id, { x: t.position.x, y: t.position.y }]));
}
function fireLaser(it, fresh, all, test = false) {
  const l = laserOf(it), name = nodeOf(it)?.name || itemName(it), q = fresh[0].q;
  if (l.umaVez) setState([it.id], "desativado").catch(() => {});
  if (!test) OBR.broadcast.sendMessage(CH_SEEN, { camera: it.id, name, tokens: fresh.map((h) => h.id), all, alertAll: !!l.alertAll, laser: true }, { destination: "ALL" }).catch(() => {});
  OBR.broadcast.sendMessage(CH_LASER, { id: it.id, q, cor: l.cor, pulso: l.pulso !== false }, { destination: "ALL" }).catch(() => {});
  // efeito do Arsenal (vídeo .webm por link, ou um visual da biblioteca): no ponto do feixe ou em cima de quem cortou
  if (l.video || l.visual) {
    const fx = l.video ? { video: { url: l.video, tipo: l.tipo || "area", giro: Number(l.giro) || 0 } } : { visual: l.visual };
    const where = l.onde === "token" && fresh[0]?.id ? { targets: fresh.map((h) => h.id) } : { point: q };
    OBR.broadcast.sendMessage("arsenal/efeito", { ...fx, ...where, dur: 0, tamanho: Number(l.tamanho) > 0 ? Number(l.tamanho) : undefined, tag: `Laser: ${name}`, origem: "Vigilância" }, { destination: "ALL" }).catch(() => {});
  }
}
/** Pisca o feixe e abre um anel no ponto cortado (item local, some sozinho). */
async function flashLaser(d) {
  const it = items.find((i) => i.id === d.id);
  if (!it || !d.pulso || (role !== "GM" && it.visible === false)) return;
  const segs = laserSegments(it);
  const cmds = segs.flatMap((sg) => [[0, sg.a.x, sg.a.y], [1, sg.b.x, sg.b.y]]);
  const k = uid(), beam = lid("flashb", k), ring = lid("flashr", k);
  const w0 = Math.max(8, dpi / 8), r0 = dpi * 0.2, r1 = dpi * 1.6;
  const list = [];
  if (cmds.length) list.push(tag(buildPath().position({ x: 0, y: 0 }).commands(cmds).fillOpacity(0).strokeColor("#ffffff").strokeOpacity(1).strokeWidth(w0).layer("DRAWING")).id(beam).build());
  list.push(tag(buildShape().shapeType("CIRCLE").position(d.q).width(r0 * 2).height(r0 * 2).fillColor(d.cor || "#ff2a2a").fillOpacity(0.35).strokeColor("#ffffff").strokeOpacity(0.9).strokeWidth(Math.max(3, dpi / 30)).layer("DRAWING")).id(ring).build());
  await OBR.scene.local.addItems(list).catch(() => {});
  const N = 8;
  for (let i = 1; i <= N; i++) {
    await new Promise((r) => setTimeout(r, 110));
    const f = i / N, r = r0 + (r1 - r0) * f;
    await OBR.scene.local.updateItems([ring, beam], (arr) => {
      for (const x of arr) {
        if (x.id === ring) { x.width = r * 2; x.height = r * 2; x.style.fillOpacity = 0.35 * (1 - f); x.style.strokeOpacity = 0.9 * (1 - f); }
        else { x.style.strokeOpacity = 1 - f; x.style.strokeWidth = w0 * (1 + f); x.style.strokeColor = f > 0.4 ? (d.cor || "#ff2a2a") : "#ffffff"; }
      }
    }).catch(() => {});
  }
  await OBR.scene.local.deleteItems([ring, beam]).catch(() => {});
}

function watchNodes() {
  const changes = nodeChanges(prevState, items);
  prevState.clear();
  for (const it of items) { const n = nodeOf(it); if (n) prevState.set(it.id, n.state); }
  if (!leader) return;
  for (const c of changes) {
    OBR.broadcast.sendMessage(CH_NODE, c, { destination: "ALL" }).catch(() => {});
    const lock = doorLock(c);
    if (lock !== null) OBR.scene.items.updateItems([c.id], (d) => { for (const it of d) it.locked = lock; }).catch(() => {});
  }
}

// ---------- pedidos de hack ----------
async function openApproval() {
  const w = await OBR.viewport.getWidth().catch(() => 1200);
  controls.popover.open({ id: APPROVE, url: url("aprovar.html"), width: 340, height: 230, anchorReference: "POSITION", anchorPosition: { left: Math.round(w / 2), top: 70 }, anchorOrigin: { horizontal: "CENTER", vertical: "TOP" }, transformOrigin: { horizontal: "CENTER", vertical: "TOP" }, disableClickAway: true }).catch(() => {});
}

async function onRequest(e) {
  if (!(await isLeader())) return;
  const d = e.data || {};
  const players = await OBR.party.getPlayers().catch(() => []);
  const p = players.find((x) => x.connectionId === e.connectionId);
  const by = p?.id || d.by, byName = p?.name || d.byName || "Jogador";
  const node = items.find((i) => i.id === d.node);
  const n = nodeOf(node);
  if (!n || !["hackeado", "loop", "desativado", "ativo"].includes(d.action)) return;
  if (p && p.role !== "GM" && !hasAccess(by, "PLAYER", items, access)) return;
  const req = { id: uid(), node: node.id, nodeName: n.name, action: d.action, by, byName, at: Date.now() };
  const md = await OBR.scene.getMetadata();
  const list = Array.isArray(md[PENDING]) ? md[PENDING] : [];
  if (list.some((x) => x.node === req.node && x.by === req.by && x.action === req.action)) return; // já pediu
  await OBR.scene.setMetadata({ [PENDING]: [...list, req] });
  if (access.autoApprove) return decide(req.id, true);
  OBR.notification.show(`Vigilância: ${byName} quer ${d.action === "ativo" ? "reativar" : `deixar ${stateLabel(d.action)}`} "${n.name}".`, "WARNING");
  openApproval();
}

// ---------- Gatilhos (e outras extensões) mudam o estado ----------
async function onSet(e) {
  const d = e.data || {};
  if (!Array.isArray(d.targets) || !d.targets.length || !d.state || !(await isLeader())) return;
  const n = await setState(d.targets, d.state);
  if (!n) OBR.notification.show(`Vigilância${d.from ? ` (${d.from})` : ""}: nenhum dos itens é câmera ou nó da Matriz.`, "WARNING");
}

// ---------- visão especial: liga/desliga um modo (painel do jogador, Gatilhos) ----------
async function onVision(e) {
  const d = e.data || {};
  if (!Array.isArray(d.targets) || !d.targets.length || !d.mode || !(await isLeader())) return;
  const sender = (await OBR.party.getPlayers().catch(() => [])).find((x) => x.connectionId === e.connectionId);
  let ids = d.targets;
  // jogador só mexe nos tokens dele
  if (sender && sender.role !== "GM") { const mine = new Set(ownedBy(sender.id, items).map((i) => i.id)); ids = ids.filter((id) => mine.has(id)); }
  const its = items.filter((i) => ids.includes(i.id) && visionOf(i));
  if (!its.length) {
    if (d.from) OBR.notification.show(`Vigilância (${d.from}): nenhum desses tokens tem visão especial.`, "WARNING");
    return;
  }
  await OBR.scene.items.updateItems(its.map((i) => i.id), (dr) => { for (const it of dr) it.metadata[VISION] = toggleVision(visionOf(it), d.mode, d.on !== false); });
}

// ---------- ruído (líder): quem ouve um barulho ----------
function onRuidoEvent(src) {
  if (!ruido.on || !(src.raio > 0)) return;
  noises.push({ id: uid(), x: src.x, y: src.y, raio: src.raio, until: Date.now() + 2500 });
  while (noises.length > 12) noises.shift();
  setTimeout(draw, 2600);
  const origin = src.quem ? items.find((i) => i.id === src.quem) : null;
  for (const it of items) {
    const cam = camOf(it);
    if (!cam?.ouve || !camOn(it) || it.id === src.quem) continue;
    if (origin && !sameFloor(it, origin)) continue; // o barulho de um andar não chega ao outro
    const h = hears(it.position, { x: src.x, y: src.y }, src.raio, dpi, walls, ruido.paredes);
    if (!h.hears) continue;
    const name = nodeOf(it)?.name || itemName(it);
    OBR.broadcast.sendMessage(CH_OUVIU, { camera: it.id, name, x: src.x, y: src.y, origem: src.origem || "um barulho", raio: src.raio }, { destination: "ALL" }).catch(() => {});
    const rd = rondaOf(it), ps = patrols.get(it.id);
    if (rd?.on && rd.investiga && ps) patrols.set(it.id, investigate(ps, { x: src.x, y: src.y }, rd));
  }
  draw();
}

async function onRuidoMsg(e) {
  if (!(await isLeader())) return;
  const d = e.data || {};
  if (typeof d.x !== "number" || typeof d.y !== "number") return;
  onRuidoEvent({ x: d.x, y: d.y, raio: Number(d.raio) || 0, origem: d.origem, quem: d.quem });
}
function onShotNoise(e) {
  if (!leader) return;
  const d = e.data || {};
  const from = d.spec?.from || items.find((i) => i.id === d.shooter)?.position;
  if (!from) return;
  onRuidoEvent({ x: from.x, y: from.y, raio: shotRaio(d, ruido), origem: `o disparo de ${d.shooterName || "alguém"}`, quem: d.shooter });
}
function onStepNoise(e) {
  if (!leader || !(ruido.passos > 0)) return;
  const d = e.data || {};
  const end = Array.isArray(d.points) && d.points.length ? d.points[d.points.length - 1] : null;
  if (end) onRuidoEvent({ x: end.x, y: end.y, raio: ruido.passos, origem: "passos", quem: d.tokenId });
}

// ---------- ronda (líder): move os guardas pela rota ----------
let lastPatrol = 0;
let gatilhos = []; // gatilhos da cena (extensão Gatilhos): a porta com gatilho "Interagir" é aberta por ele
const doorBusy = new Map(); // "porta:abrir|fechar" -> até quando não dispara de novo
const TRIG_LIST = "gatilhos/lista", CH_TRIG_FIRE = "gatilhos/disparar";
/** Abre/fecha portas: onde há gatilho Interagir da porta, o guarda o dispara (vídeo, troca de imagem e linha juntos); nas outras, mexe na linha. Devolve a espera (ms) do guarda. */
function useDoors(ids, open, guard, first) {
  const now = Date.now(), plain = [];
  let waitMs = 0;
  for (const id of ids) {
    const t = doorTrigger(gatilhos, id, open);
    if (!t) { plain.push(id); continue; }
    const key = `${id}:${open ? "abrir" : "fechar"}`;
    if ((doorBusy.get(key) || 0) > now) continue;
    const win = Math.round((t.wait + 1.5) * 1000);
    doorBusy.set(key, now + (open ? Math.max(win, 6000) : win)); // se a porta não abrir (barrada), não insiste a cada instante
    OBR.broadcast.sendMessage(CH_TRIG_FIRE, { id: t.id, force: true, on: [guard] }, { destination: "LOCAL" }).catch(() => {});
    if (open && first.has(id)) waitMs = Math.max(waitMs, win);
  }
  if (plain.length) setDoors(plain, open);
  return waitMs;
}
const SMK = "com.battle-system.smoke/";
function doorList() {
  return items.filter(isDoorLine).map((it) => {
    const segs = it.type === "LINE" ? [{ a: toWorld(it, it.startPosition), b: toWorld(it, it.endPosition) }]
      : (it.points || []).slice(1).map((p, i) => ({ a: toWorld(it, it.points[i]), b: toWorld(it, p) }));
    return { id: it.id, segs: segs.length ? segs : [{ a: it.position, b: it.position }], open: doorOpenNow(it), locked: doorLockedNow(it) };
  });
}
function setDoors(ids, open) {
  OBR.scene.items.updateItems(ids, (d) => {
    for (const it of d) {
      if (open) { it.metadata[`${SMK}doorOpen`] = true; it.metadata[`${SMK}disabled`] = true; }
      else { delete it.metadata[`${SMK}doorOpen`]; delete it.metadata[`${SMK}disabled`]; }
    }
  }).catch(() => {});
}
function patrolTick() {
  if (!leader || !ready) return;
  const now = Date.now(), dt = Math.min(1000, now - (lastPatrol || now - 250));
  lastPatrol = now;
  const upd = [];
  const doorOps = [];
  const alive = new Set();
  for (const it of items) {
    const rd = rondaOf(it);
    if (!rd?.on) continue;
    alive.add(it.id);
    const route = routeOf(items, it.id);
    if (!route.length && !patrols.get(it.id)?.inv) continue;
    const st = patrols.get(it.id) || patrolInit(it.position, route);
    const r = patrolStep(st, it.position, route, rd, dt, dpi);
    // portas: abre ao chegar perto e fecha (ou deixa aberta) depois de passar
    if (rd.portas !== "nao") {
      const doors = doorList();
      if (doors.length) {
        const had = new Set(r.st.abri || []);
        const pr = portasStep(r.st, r.pos, doors, rd, dpi);
        r.st = pr.st;
        const first = new Set(pr.abrir.filter((id) => !had.has(id)));
        if (first.size) r.st.wait = Math.max(r.st.wait || 0, 600);
        if (pr.abrir.length) doorOps.push({ ids: pr.abrir, open: true, guard: it.id, first, st: r.st });
        if (pr.fechar.length) doorOps.push({ ids: pr.fechar, open: false, guard: it.id, first: new Set(), st: r.st });
      }
    }
    patrols.set(it.id, r.st);
    const moved = r.pos.x !== it.position.x || r.pos.y !== it.position.y;
    // não gira a imagem: guarda só para onde olha (cone) e espelha a imagem quando olha para a esquerda
    const cur = olharOf(it) ?? it.rotation ?? 0;
    const turned = r.rotation != null && Math.abs(((r.rotation - cur + 540) % 360) - 180) > 0.5;
    let flip = null;
    if (r.rotation != null) {
      const c = Math.cos((r.rotation * Math.PI) / 180), left = (it.scale?.x ?? 1) < 0;
      if (c < -0.2 && !left) flip = true; else if (c > 0.2 && left) flip = false;
    }
    if (moved || turned || flip != null) upd.push({ id: it.id, pos: r.pos, rot: r.rotation, flip });
  }
  for (const id of [...patrols.keys()]) if (!alive.has(id)) patrols.delete(id);
  for (const op of doorOps) {
    const w = useDoors(op.ids, op.open, op.guard, op.first);
    if (w > 0) op.st.wait = Math.max(op.st.wait || 0, w); // o guarda espera a animação da porta
  }
  if (!upd.length) return;
  const by = new Map(upd.map((u) => [u.id, u]));
  OBR.scene.items.updateItems(upd.map((u) => u.id), (d) => {
    for (const it of d) { const u = by.get(it.id); it.position = u.pos;
      if (u.rot != null) it.metadata[OLHAR] = u.rot;
      if (u.flip != null) it.scale = { ...it.scale, x: (u.flip ? -1 : 1) * Math.abs(it.scale?.x ?? 1) };
    }
  }).catch(() => {});
}

// ---------- ciclo ----------
let tm = null;
function loop() {
  clearTimeout(tm);
  const now = Date.now();
  const sweeping = items.some((i) => camOf(i)?.sweep > 0);
  const hasLasers = items.some((i) => laserOn(i));
  if (ready) {
    if (leader && items.some((i) => camOf(i))) detect(now);
    if (leader && hasLasers) detectLasers(now);
    // câmeras que giram: redesenha no ritmo do perfil do Otimizador (a detecção do mestre não muda)
    if (sweeping && now - lastSweep >= (perf?.vig?.sweepMs ?? 160) - 20) { lastSweep = now; draw(); }
  }
  tm = setTimeout(loop, sweeping ? 160 : hasLasers ? 200 : 400);
}
let ptm = null;
const patrolLoop = () => { clearTimeout(ptm); try { patrolTick(); } catch (e) { console.error(`[${ID}] ronda`, e); } ptm = setTimeout(patrolLoop, 250); };

async function loadScene() {
  ready = false;
  await clearLocal();
  dpi = await OBR.scene.grid.getDpi().catch(() => 150);
  items = await OBR.scene.items.getItems();
  localWalls = (await OBR.scene.local.getItems().catch(() => [])).filter((i) => i.type === "WALL" || i.metadata?.["com.battle-system.smoke/isVisionLine"]);
  walls = wallsFrom([...localWalls, ...items]);
  const md0 = await OBR.scene.getMetadata();
  access = { players: [], autoApprove: false, ...(md0[ACCESS] || {}) };
  gatilhos = Array.isArray(md0[TRIG_LIST]) ? md0[TRIG_LIST] : [];
  estGroups = Array.isArray(md0[EST_GROUPS]) ? md0[EST_GROUPS] : [];
  ruido = ruidoCfg(md0);
  prevSeen.clear(); prevState.clear();
  for (const it of items) { const n = nodeOf(it); if (n) prevState.set(it.id, n.state); }
  // quem já está no cone ao abrir a cena não dispara alarme
  for (const it of items) if (camOf(it)) prevSeen.set(it.id, new Set(seenBy(it, items, walls, dpi, Date.now(), estGroups)));
  ready = true;
  draw();
  const pm = await OBR.player.getMetadata().catch(() => ({}));
  if (pm?.[FEED]) syncFeed(pm[FEED]);
}

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  myId = await OBR.player.getId().catch(() => "");
  myConn = await OBR.player.getConnectionId().catch(() => "");
  await refreshLeader();
  OBR.player.onChange((p) => {
    if (p.role !== role) { role = p.role; refreshLeader(); draw(); }
    const w = p.metadata?.[FEED] || "";
    if (w !== watch) syncFeed(w);
  });
  OBR.party.onChange(() => refreshLeader());

  // ----- ícone do comlink na barra lateral (o jogador abre o painel da Matriz) -----
  await controls.tool.createAction({
    id: `${ID}/comlink`,
    icons: [{ icon: url("comlink.svg"), label: "Comlink (Matriz: nós ao redor e câmeras)", filter: { roles: ["PLAYER"] } }],
    onClick: () => { controls.openPanel().catch(() => {}); },
  });

  // ----- menus do botão direito -----
  const GM = { roles: ["GM"] };
  await controls.contextMenu.create({
    id: `${ID}/camera`,
    icons: [{ icon: url("camera.svg"), label: "Virar câmera (Vigilância)", filter: { ...GM, every: [{ key: ["metadata", CAM], value: undefined }] } }],
    onClick: async (ctx) => { await makeCamera(ctx.items.map((i) => i.id)); controls.openPanel().catch(() => {}); },
  });
  await controls.contextMenu.create({
    id: `${ID}/no`,
    icons: [{ icon: url("node.svg"), label: "Virar nó da Matriz", filter: { ...GM, every: [{ key: ["metadata", NODE], value: undefined }] } }],
    onClick: async (ctx) => { await makeNode(ctx.items.map((i) => i.id)); controls.openPanel().catch(() => {}); },
  });
  await controls.contextMenu.create({
    id: `${ID}/deck`,
    icons: [
      { icon: url("deck.svg"), label: "Dar commlink/cyberdeck (vê a Matriz)", filter: { ...GM, every: [{ key: "layer", value: "CHARACTER" }, { key: ["metadata", DECK], value: undefined }] } },
      { icon: url("deck.svg"), label: "Tirar commlink/cyberdeck", filter: { ...GM, every: [{ key: "layer", value: "CHARACTER" }, { key: ["metadata", DECK], value: true }] } },
    ],
    onClick: (ctx) => {
      const give = ctx.items.some((i) => i.metadata?.[DECK] !== true);
      OBR.scene.items.updateItems(ctx.items.map((i) => i.id), (d) => { for (const it of d) { if (give) it.metadata[DECK] = true; else delete it.metadata[DECK]; } });
    },
  });
  await controls.contextMenu.create({
    id: `${ID}/etiqueta`,
    icons: [{ icon: url("node.svg"), label: "Etiqueta de RA (Vigilância)", filter: { ...GM, max: 1, every: [{ key: ["metadata", ETIQ], value: undefined }] } }],
    onClick: async (ctx) => { await editEtiqueta(ctx.items.map((i) => i.id), (e) => e); controls.openPanel().catch(() => {}); },
  });
  await controls.contextMenu.create({
    id: `${ID}/laser`,
    icons: [{ icon: url("laser.svg"), label: "Virar laser (Vigilância)", filter: { ...GM, some: [{ key: "type", value: "LINE" }, { key: "type", value: "CURVE" }, { key: "type", value: "PATH" }], every: [{ key: ["metadata", LASER], value: undefined }] } }],
    onClick: async (ctx) => { const n = await makeLaser(ctx.items.map((i) => i.id)); OBR.notification.show(n ? "Laser criado: quem cortar o feixe dispara o aviso. Ajuste no painel Vigilância." : "Vigilância: selecione uma linha, curva ou caminho de retas.", n ? "SUCCESS" : "WARNING"); controls.openPanel().catch(() => {}); },
  });
  await controls.contextMenu.create({
    id: `${ID}/hackear`,
    icons: [{ icon: url("node.svg"), label: "Hackear (Matriz)", filter: { roles: ["PLAYER"], max: 1, every: [{ key: ["metadata", NODE], value: undefined, operator: "!=" }] } }],
    onClick: (ctx) => {
      if (!hasAccess(myId, role, items, access)) return OBR.notification.show("Vigilância: você precisa de um commlink ou cyberdeck para mexer na Matriz.", "WARNING");
      OBR.broadcast.sendMessage(CH_REQ, { node: ctx.items[0].id, action: "hackeado" }, { destination: "ALL" });
      OBR.notification.show("Pedido enviado ao mestre: hackear. (Outras ações no painel Vigilância.)", "INFO");
    },
  });

  // ----- avisos -----
  OBR.broadcast.onMessage(CH_SEEN, (e) => {
    const d = e.data || {};
    if (role !== "GM" && !d.alertAll) return;
    const who = (d.tokens || []).map((id) => itemName(items.find((i) => i.id === id))).join(", ");
    OBR.notification.show(d.laser ? `🔴 ${d.name}: ${who} cortou o laser` : `📷 ${d.name} viu: ${who}`, "WARNING");
  });
  OBR.broadcast.onMessage(CH_LASER, (e) => { flashLaser(e.data || {}).catch(() => {}); });
  OBR.broadcast.onMessage(CH_LASER_TESTE, async (e) => {
    if (!(await isLeader())) return;
    const it = items.find((i) => i.id === e.data?.id);
    const sg = it && laserSegments(it)[0];
    if (sg) fireLaser(it, [{ id: "", q: { x: (sg.a.x + sg.b.x) / 2, y: (sg.a.y + sg.b.y) / 2 } }], [], true);
  });
  OBR.broadcast.onMessage(CH_RES, (e) => {
    const d = e.data || {};
    if (d.by !== myId || role === "GM") return;
    OBR.notification.show(d.ok ? `Matriz: "${d.nodeName}" agora está ${stateLabel(d.action)}.` : `Matriz: o mestre negou o pedido em "${d.nodeName}".`, d.ok ? "SUCCESS" : "WARNING");
  });
  OBR.broadcast.onMessage(CH_REQ, onRequest);
  OBR.broadcast.onMessage(CH_SET, onSet);
  OBR.broadcast.onMessage(CH_VISION, onVision);
  OBR.broadcast.onMessage(CH_RUIDO, onRuidoMsg);
  OBR.broadcast.onMessage("arsenal/disparo", onShotNoise);
  OBR.broadcast.onMessage("regua/caminho", onStepNoise);
  OBR.broadcast.onMessage(CH_OUVIU, (e) => {
    const d = e.data || {};
    if (role !== "GM") return;
    OBR.notification.show(`👂 ${d.name} ouviu ${d.origem || "um barulho"}`, "WARNING");
  });
  OBR.broadcast.onMessage(CH_PREFS, (e) => { prefs = { ...prefs, ...(e.data || {}) }; draw(); });

  perf = readPerf();
  onPerf((p) => { perf = p; draw(); });
  onClean(() => { clearLocal().then(() => draw()); });

  // ----- cena -----
  if (await OBR.scene.isReady()) await loadScene();
  OBR.scene.onReadyChange((r) => { if (r) loadScene(); else { ready = false; shown.clear(); } });
  OBR.scene.items.onChange((list) => { items = list; walls = wallsFrom([...localWalls, ...items]); watchNodes(); if (watch) syncFeed(watch); draw(); });
  OBR.scene.local.onChange((list) => {
    const w = list.filter((i) => i.type === "WALL" || i.metadata?.["com.battle-system.smoke/isVisionLine"]);
    const sig = JSON.stringify(w.map((i) => [i.id, i.position, i.rotation, i.points, i.blocking]));
    if (sig === wallSig) return;
    wallSig = sig; localWalls = w;
    walls = wallsFrom([...localWalls, ...items]);
    draw();
  });
  OBR.scene.onMetadataChange((md) => {
    access = { players: [], autoApprove: false, ...(md[ACCESS] || {}) };
    estGroups = Array.isArray(md[EST_GROUPS]) ? md[EST_GROUPS] : [];
    ruido = ruidoCfg(md);
    gatilhos = Array.isArray(md[TRIG_LIST]) ? md[TRIG_LIST] : [];
    draw();
  });
  OBR.scene.grid.onChange((g) => { dpi = g.dpi || dpi; draw(); });
  loop();
  patrolLoop();
});
