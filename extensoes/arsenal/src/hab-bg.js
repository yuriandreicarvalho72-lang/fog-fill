import { controls } from "./visibility.js";
// Habilidades em segundo plano: ferramenta própria (ícone na barra), mira, prévia e animação para todos.
import OBR, { buildShape, buildPath, buildLabel } from "@owlbear-rodeo/sdk";
import { CH_HAB, CH_FX, CH_FX_END, CH_HAB_USE, DOSSIE, buildAbility, shapeOf } from "./abil.js";
import { setupAtivos, endByTag } from "./ativos.js";
import { halfSize } from "./cover.js";
import { loadMeus, prepareCustom } from "./meus.js";
import { url, isToken, itemName, ACTIVE, WEAPONS, weaponFrom, decodeCatalog, CENARIO, CH_CEN_USE, CH_CEN_RES, CH_HAB_DANO } from "./shared.js";
import { applyEvents } from "./scenery.js";
import { HAB_TOOL, HAB_MODE, HAB_PANEL, HAB_AIM, HAB_PREVIEW, getAim, setAim, useAbility, dossieOf, metersPerCell, playFx, useFromTrigger, useScenery, FX_MARCA, colocarMarcador, soltarMarcador, BIBLIOTECA, CH_INV_ARMA, CH_INV_EFEITO } from "./hab-ops.js";

/** play(anim, base), base = pasta dos vídeos, has() = função "o vídeo está disponível" (ou null), isLeader() = este é o mestre que executa pedidos. */
export async function setupHabilities({ play, base, has, isLeader }) {
  let role = await OBR.player.getRole();
  const myId = await OBR.player.getId().catch(() => "");
  OBR.player.onChange((p) => { role = p.role; });

  // ---------- todos: tocar a habilidade ----------
  loadMeus();
  OBR.broadcast.onMessage(CH_HAB, async (e) => {
    const ev = e.data;
    if (!ev?.ab) return;
    const h = has(); // null = vídeos desligados (painel ou Otimizador)
    if (h) await prepareCustom(ev.ab, ev.subs); // vídeos próprios: tamanho e duração lidos do arquivo
    const anim = buildAbility(ev, h, (n) => ev.subs?.[n]);
    play(anim, base).catch(() => {});
  });

  // ---------- efeitos que ficam (duração) ----------
  const ativos = await setupAtivos({ base, has, isLeader });

  // ---------- pedidos do Gatilhos (só o mestre líder executa) ----------
  const warn = (d, msg) => OBR.notification.show(`Arsenal${d?.origem ? ` (${d.origem})` : ""}: ${msg}`, "WARNING");
  OBR.broadcast.onMessage(CH_FX, async (e) => {
    if (!(await isLeader())) return;
    const r = await playFx(e.data || {}).catch((err) => ({ error: err.message }));
    if (r.error) warn(e.data, r.error);
  });
  OBR.broadcast.onMessage(CH_FX_END, async (e) => {
    if (!(await isLeader())) return;
    await endByTag(e.data?.tag || "").catch(() => {});
  });
  OBR.broadcast.onMessage(CH_HAB_USE, async (e) => {
    if (!(await isLeader())) return;
    const r = await useFromTrigger(e.data || {}).catch((err) => ({ error: err.message }));
    if (r.error) warn(e.data, r.error);
  });

  // ---------- arma de cenário: jogador pede, o líder confere o alcance e usa; todos recebem o resultado ----------
  OBR.broadcast.onMessage(CH_CEN_USE, async (e) => {
    if (!(await isLeader())) return;
    const d = e.data || {};
    const r = await useScenery(d).catch((err) => ({ error: err.message }));
    await OBR.broadcast.sendMessage(CH_CEN_RES, { by: d.by, ...(r.error ? { error: r.error } : { text: r.text }) }, { destination: "ALL" });
  });
  OBR.broadcast.onMessage(CH_CEN_RES, (e) => {
    const r = e.data || {};
    if (r.error) { if (r.by === myId) OBR.notification.show(`Arma de cenário: ${r.error}`, "WARNING"); return; }
    if (r.text && (r.by === myId || role === "GM")) OBR.notification.show(`Arma de cenário: ${r.text}`, "INFO");
  });
  // dano de habilidade no cenário destrutível (vindo de um mestre que não é o líder)
  OBR.broadcast.onMessage(CH_HAB_DANO, async (e) => {
    if (!(await isLeader())) return;
    await applyEvents(Array.isArray(e.data?.events) ? e.data.events : [], e.data?.by || null).catch(() => {});
  });

  // ---------- vindo do Inventário de mesa (mesmo navegador) ----------
  const nm = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  OBR.broadcast.onMessage(CH_INV_ARMA, async (e) => {
    const nome = nm(e.data?.nome);
    if (!nome) return;
    const raw = (await import("./catalog.json")).default;
    const all = decodeCatalog(raw);
    // o nome do item contém o da arma (ou o contrário); vence o nome mais comprido
    const hit = all.filter((w) => { const n = nm(w.n); return n && (nome.includes(n) || n.includes(nome)); }).sort((a, b) => b.n.length - a.n.length)[0];
    if (!hit) return OBR.notification.show(`Arsenal: não achei "${e.data.nome}" no catálogo. Crie a arma própria no painel do Arsenal.`, "WARNING");
    const md = await OBR.player.getMetadata();
    const items = await OBR.scene.items.getItems();
    const id = await OBR.player.getId();
    const act = md[ACTIVE] || {};
    const shooter = items.find((i) => i.id === act.shooter) || items.find((i) => isToken(i) && i.createdUserId === id);
    if (!shooter) return OBR.notification.show("Arsenal: escolha um atirador (token) primeiro.", "WARNING");
    let w = (shooter.metadata?.[WEAPONS] || []).find((x) => nm(x.name) === nm(hit.n));
    if (!w) {
      w = weaponFrom(hit);
      await OBR.scene.items.updateItems([shooter.id], (d) => { for (const it of d) it.metadata[WEAPONS] = [...(it.metadata[WEAPONS] || []), w]; })
        .catch(() => OBR.notification.show("Arsenal: você não tem permissão para mudar este token.", "WARNING"));
    }
    await OBR.player.setMetadata({ [ACTIVE]: { ...act, shooter: shooter.id, weapon: w.id, mode: w.mode } });
    OBR.notification.show(`Arsenal: ${hit.n} na mão de ${itemName(shooter)}. Abra o Arsenal e mire.`, "SUCCESS");
  });
  OBR.broadcast.onMessage(CH_INV_EFEITO, async (e) => {
    const nome = nm(e.data?.nome);
    const lib = (await OBR.room.getMetadata())[BIBLIOTECA] || [];
    const f = lib.find((x) => nm(x.nome) === nome) || lib.find((x) => nm(x.nome).includes(nome) || nome.includes(nm(x.nome)));
    if (!f) return OBR.notification.show(`Arsenal: não há efeito "${e.data?.nome}" na biblioteca (página Efeitos).`, "WARNING");
    const spec = { visual: f.visual || "", tamanho: Number(f.tamanho) || 0, dur: f.dur === "" || f.dur == null ? 0 : f.dur === "fim" ? "fim" : Number(f.dur) || 0, camada: f.camada === "sob" ? "sob" : "", luz: f.luz || null, tag: f.nome || f.visual };
    if (role === "GM") {
      await colocarMarcador(spec, false);
      return OBR.notification.show(`Efeitos: "${spec.tag}" no centro da tela. Arraste o marcador e use "Soltar efeito aqui" (botão direito).`, "INFO");
    }
    // jogador: o efeito cai nos tokens selecionados (ou no dele); o mestre líder executa
    const id = await OBR.player.getId();
    let targets = (await OBR.player.getSelection()) || [];
    if (!targets.length) targets = (await OBR.scene.items.getItems((i) => isToken(i) && i.createdUserId === id)).map((i) => i.id).slice(0, 1);
    if (!targets.length) return OBR.notification.show("Efeitos: selecione um token para receber o efeito.", "WARNING");
    await OBR.broadcast.sendMessage(CH_FX, { ...spec, targets, origem: "Inventário" }, { destination: "ALL" });
  });

  // ---------- painel ----------
  // jogador: janela pequena com as armas de cenário que ele pode usar
  const openPlayerPanel = async () => {
    await controls.popover.open({
      id: HAB_PANEL, url: url("cenario.html"), width: 320, height: 360,
      anchorReference: "POSITION", anchorPosition: { left: 72, top: 64 },
      anchorOrigin: { horizontal: "LEFT", vertical: "TOP" }, transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
      disableClickAway: true, marginThreshold: 8,
    }).catch(() => {});
  };
  const openPanel = async () => {
    if (role !== "GM") return openPlayerPanel();
    const vh = await OBR.viewport.getHeight().catch(() => 800);
    await controls.popover.open({
      id: HAB_PANEL, url: url("hab.html"), width: 340, height: Math.max(360, Math.min(640, vh - 96)),
      anchorReference: "POSITION", anchorPosition: { left: 72, top: 64 },
      anchorOrigin: { horizontal: "LEFT", vertical: "TOP" }, transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
      disableClickAway: true, marginThreshold: 8,
    }).catch(() => {});
  };

  // ---------- prévia da mira (só para o mestre que mira) ----------
  let prevIds = [];
  let busy = false, again = false;
  async function drawPreview() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      do {
        again = false;
        const aim = await getAim();
        const add = [];
        const [tok] = aim.token ? await OBR.scene.items.getItems([aim.token]).catch(() => []) : [];
        const ab = dossieOf(tok)?.habilidades?.find((h) => h.nome === aim.nome);
        if (tok && ab && aim.armed) {
          const cell = await OBR.scene.grid.getDpi().catch(() => 150);
          const mpc = await metersPerCell();
          const selfHalf = halfSize(tok, cell) || cell / 2;
          const tag = (b) => b.layer("ATTACHMENT").locked(true).disableHit(true).metadata({ [HAB_PREVIEW]: true }).build();
          const far = aim.point && ab.alcance > 0 && Math.hypot(aim.point.x - tok.position.x, aim.point.y - tok.position.y) / cell * mpc > ab.alcance + 0.01;
          const color = far ? "#9aa0a6" : "#ff5a4a";
          const shape = shapeOf(ab, tok.position, { point: aim.point }, cell, mpc, selfHalf);
          if (shape && (ab.forma !== "area" || aim.point || !ab.alcance)) {
            if (shape.kind === "circle") add.push(tag(buildShape().shapeType("CIRCLE").position(shape.c).width(shape.r * 2).height(shape.r * 2).fillColor(color).fillOpacity(0.12).strokeColor(color).strokeOpacity(0.9).strokeWidth(Math.max(3, cell / 30)).strokeDash([cell / 8, cell / 12])));
            else add.push(tag(buildPath().position({ x: 0, y: 0 }).commands([...shape.pts.map((p, i) => [i ? 1 : 0, p.x, p.y]), [5]]).fillColor(color).fillOpacity(0.12).strokeColor(color).strokeOpacity(0.9).strokeWidth(Math.max(3, cell / 30)).strokeDash([cell / 8, cell / 12])));
          }
          if (ab.forma === "movimento" && aim.point) add.push(tag(buildPath().position({ x: 0, y: 0 }).commands([[0, tok.position.x, tok.position.y], [1, aim.point.x, aim.point.y]]).strokeColor(color).strokeWidth(Math.max(3, cell / 25)).strokeOpacity(0.9).strokeDash([cell / 8, cell / 12]).fillOpacity(0)));
          const ids = aim.targets || [];
          const its = ids.length ? await OBR.scene.items.getItems(ids).catch(() => []) : [];
          for (const it of its) {
            const r = (halfSize(it, cell) || cell / 2) * 1.15;
            add.push(tag(buildShape().shapeType("CIRCLE").position(it.position).width(r * 2).height(r * 2).fillOpacity(0).strokeColor("#ff3b30").strokeOpacity(0.95).strokeWidth(Math.max(3, cell / 30)).strokeDash([cell / 10, cell / 14])));
          }
          if (far) add.push(tag(buildLabel().position({ x: aim.point.x, y: aim.point.y + cell * 0.6 }).plainText(`fora do alcance (${String(ab.alcance).replace(".", ",")} m)`).backgroundColor("#7a1010").backgroundOpacity(0.85).fillColor("#ffffff").fontWeight(600).cornerRadius(6).pointerHeight(0)));
        }
        const old = prevIds;
        prevIds = add.map((i) => i.id);
        if (add.length) await OBR.scene.local.addItems(add).catch(() => {});
        if (old.length) await OBR.scene.local.deleteItems(old).catch(() => {});
      } while (again);
    } finally { busy = false; }
  }
  const left = await OBR.scene.local.getItems((i) => i.metadata?.[HAB_PREVIEW]).catch(() => []);
  if (left.length) await OBR.scene.local.deleteItems(left.map((i) => i.id)).catch(() => {});
  let lastAim = "";
  OBR.player.onChange((p) => { const k = JSON.stringify(p.metadata?.[HAB_AIM] || null); if (k !== lastAim) { lastAim = k; drawPreview(); } });

  const fireNow = async () => {
    const aim = await getAim();
    if (!aim.token || !aim.nome) return OBR.notification.show("Habilidades: escolha uma habilidade no painel.", "WARNING");
    if (role !== "GM") { // jogador: o líder confere o alcance e usa
      await OBR.broadcast.sendMessage(CH_CEN_USE, { item: aim.token, nome: aim.nome, targets: aim.targets || [], point: aim.point || null, by: myId }, { destination: "ALL" });
      await setAim({ token: aim.token }, true);
      return;
    }
    const r = await useAbility(aim.token, aim.nome, aim);
    if (r.error) return OBR.notification.show(`Habilidades: ${r.error}`, "WARNING");
    await setAim({ token: aim.token }, true);
  };

  // ---------- ferramenta (ícone próprio, só o mestre) ----------
  await controls.tool.create({ id: HAB_TOOL, icons: [{ icon: url("hab.svg"), label: "Habilidades (dossiê dos NPCs e armas de cenário)" }], defaultMode: HAB_MODE });
  await controls.tool.createMode({
    id: HAB_MODE,
    icons: [{ icon: url("hab.svg"), label: "Mirar a habilidade (clique: alvo ou ponto · Enter: usar · Esc: cancelar)", filter: { activeTools: [HAB_TOOL] } }],
    cursors: [{ cursor: "crosshair" }],
    onActivate: () => openPanel(),
    onDeactivate: async () => { controls.popover.close(HAB_PANEL).catch(() => {}); const a = await getAim(); if (a.armed) await setAim({ token: a.token }, true); },
    onToolClick: async (_ctx, ev) => {
      const aim = await getAim();
      const it = ev.target;
      // sem habilidade armada: clicar num NPC com dossiê escolhe ele
      if (!aim.armed) {
        if (role === "GM" && it && it.type === "IMAGE" && it.layer !== "MAP" && dossieOf(it)) { await setAim({ token: it.id }, true); return false; }
        OBR.notification.show("Habilidades: escolha uma habilidade no painel (▶ ou 🎯) e depois clique no mapa.", "INFO");
        return false;
      }
      const [tok] = await OBR.scene.items.getItems([aim.token]).catch(() => []);
      const ab = dossieOf(tok)?.habilidades?.find((h) => h.nome === aim.nome);
      if (!ab) return false;
      if (ab.forma === "alvo") {
        if (!it || it.id === aim.token || it.layer === "MAP") return false;
        const max = ab.faz?.length || ab.alvos || 1;
        const cur = aim.targets || [];
        const next = cur.includes(it.id) ? cur.filter((x) => x !== it.id) : [...cur, it.id].slice(-max);
        await setAim({ targets: next });
      } else {
        await setAim({ point: ev.pointerPosition });
      }
      return false;
    },
    onKeyDown: async (_ctx, ev) => {
      if (ev.key === "Enter") await fireNow();
      else if (ev.key === "Escape") { const a = await getAim(); await setAim({ token: a.token }, true); }
    },
  });
  // marcador de efeito (criado na página Efeitos): botão direito nele solta o efeito ali
  await controls.contextMenu.create({
    id: `${HAB_TOOL}/solta`,
    icons: [{ icon: url("fire.svg"), label: "Soltar efeito aqui", filter: { roles: ["GM"], max: 1, every: [{ key: ["metadata", FX_MARCA], value: undefined, operator: "!=" }] } }],
    onClick: async (ctx) => {
      const r = await soltarMarcador(ctx.items[0].id);
      if (r.error) OBR.notification.show(`Efeitos: ${r.error}`, "WARNING");
    },
  });
  await controls.tool.createAction({
    id: `${HAB_TOOL}/usar`,
    icons: [{ icon: url("fire.svg"), label: "Usar a habilidade (Enter)", filter: { activeTools: [HAB_TOOL] } }],
    onClick: () => fireNow(),
  });
  // botão direito num NPC: abre as habilidades dele
  await controls.contextMenu.create({
    id: `${HAB_TOOL}/menu`,
    icons: [{ icon: url("hab.svg"), label: "Habilidades (dossiê)", filter: { roles: ["GM"], max: 1, every: [{ key: "type", value: "IMAGE" }] } }],
    onClick: async (ctx) => {
      await setAim({ token: ctx.items[0].id }, true);
      await OBR.tool.activateTool(HAB_TOOL).catch(() => {});
      openPanel();
      if (!ctx.items[0].metadata?.[DOSSIE]) OBR.notification.show(`Habilidades: cole o dossiê de ${itemName(ctx.items[0])} no painel.`, "INFO");
    },
  });
  // botão direito numa arma de cenário liberada para jogadores: abre a janela dela
  await controls.contextMenu.create({
    id: `${HAB_TOOL}/jogador`,
    icons: [{ icon: url("hab.svg"), label: "Usar arma de cenário", filter: { roles: ["PLAYER"], max: 1, every: [{ key: ["metadata", CENARIO, "jogadores"], value: true }] } }],
    onClick: async (ctx) => {
      await setAim({ token: ctx.items[0].id }, true);
      await OBR.tool.activateTool(HAB_TOOL).catch(() => {});
      openPlayerPanel();
    },
  });
  // o painel pede para usar (aura, si, passiva) pelo canal local
  OBR.broadcast.onMessage(`${HAB_TOOL}/usar`, () => fireNow());
  return { ativos, fireNow, drawPreview, clearPreview: async () => { const ids = prevIds; prevIds = []; if (ids.length) await OBR.scene.local.deleteItems(ids).catch(() => {}); } };
}
