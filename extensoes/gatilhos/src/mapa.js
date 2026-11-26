// Mapa lógico dos Gatilhos (funções puras, testadas em Node): quem dispara quem, problemas e o "e se?".
import { ACTIONS, CAUSES, alertMatches, alertNext } from "./shared.js";

export const ZONE_CAUSES = ["enter", "leave", "near", "standAll", "appear", "disappear", "interact", "cameraSees", "nodeState"];
const ACTION_NAME = Object.fromEntries(ACTIONS.map((a) => [a.id, a.label]));
export const causeLabel = (id) => CAUSES.find((c) => c.id === id)?.label || id;
const NEED_TARGETS = ["show", "hide", "toggle", "lock", "unlock", "delete", "door", "swapImage", "camPower", "nodeSet", "vision", "weatherOn", "weatherOff", "lightColor", "attach", "moveTo", "noise"];
const nm = (nomes, id) => (nomes?.[id] ?? (id === "@quem" ? "quem ativou" : "(item apagado)"));
const list = (ids, nomes) => (ids || []).map((id) => nm(nomes, id)).join(", ") || "nada";

/** Frase curta do que um efeito faz. */
export function descreve(e, nomes = {}, trigs = []) {
  const alvo = list(e.targets, nomes);
  const gat = (id) => trigs.find((t) => t.id === id)?.name || "(gatilho apagado)";
  switch (e.action) {
    case "show": return `mostra ${alvo}`;
    case "hide": return `esconde ${alvo}`;
    case "toggle": return `alterna ${alvo}`;
    case "lock": return `trava ${alvo}`;
    case "unlock": return `destrava ${alvo}`;
    case "delete": return `apaga ${alvo}`;
    case "notify": return `mensagem: "${(e.text || "").slice(0, 40)}"`;
    case "chain": return `dispara «${gat(e.trigger)}»`;
    case "rearm": return `rearma «${gat(e.trigger)}»`;
    case "cancel": return e.trigger ? `cancela a sequência de «${gat(e.trigger)}»` : "cancela todas as sequências pendentes";
    case "alarm": return `alerta (${e.alarmOp || "up"}${e.alarmTo !== "" && e.alarmTo != null ? ` → ${e.alarmTo}` : ""})`;
    case "door": return `porta ${e.doorOp || "alternar"}: ${alvo}`;
    case "camPower": return `${e.power === "on" ? "liga" : "desliga"} câmera ${alvo}`;
    case "nodeSet": return `nó ${alvo} → ${e.nodeState || "hackeado"}`;
    case "noise": return `faz barulho (raio ${e.noiseRaio || 10}) em ${alvo}`;
    case "handout": return `mostra handout${e.hoNome ? ` «${e.hoNome}»` : ""}`;
    default: return `${ACTION_NAME[e.action] || e.action}${(e.targets || []).length ? `: ${alvo}` : ""}`;
  }
}

/** Ligações entre gatilhos: chain, rearm, cancel, alerta, nó (Matriz) e ruído. */
export function arestas(trigs) {
  const out = [];
  const by = new Map(trigs.map((t) => [t.id, t]));
  for (const t of trigs) {
    for (const e of t.effects || []) {
      const atraso = (Number(t.delay) || 0) + (Number(e.delay) || 0);
      if (e.action === "chain" || e.action === "rearm") out.push({ de: t.id, para: e.trigger, tipo: e.action, atraso, falta: !by.has(e.trigger) });
      else if (e.action === "cancel") out.push({ de: t.id, para: e.trigger || "*", tipo: "cancel", atraso, falta: !!e.trigger && !by.has(e.trigger) });
      else if (e.action === "alarm") for (const o of trigs) if (o.cause === "alertLevel") out.push({ de: t.id, para: o.id, tipo: "alerta", atraso, falta: false });
      else if (e.action === "nodeSet" || e.action === "camPower") {
        const st = e.action === "camPower" ? (e.power === "on" ? "ativo" : "desativado") : e.nodeState || "hackeado";
        for (const o of trigs) if (o.cause === "nodeState" && (o.zones || []).some((z) => (e.targets || []).includes(z)) && (!o.nodeTo || o.nodeTo === st)) out.push({ de: t.id, para: o.id, tipo: "no", atraso, falta: false });
      } else if (e.action === "noise") for (const o of trigs) if (o.cause === "heard") out.push({ de: t.id, para: o.id, tipo: "ruido", atraso, falta: false });
    }
  }
  return out.filter((a) => a.para !== "*");
}

/** Ciclos nas ligações que disparam (chain, alerta, nó, ruído). Cada ciclo: lista de ids. */
export function ciclos(trigs, edges = arestas(trigs)) {
  const adj = new Map(trigs.map((t) => [t.id, []]));
  for (const a of edges) if (["chain", "alerta", "no", "ruido"].includes(a.tipo) && adj.has(a.de) && adj.has(a.para)) adj.get(a.de).push(a);
  // Tarjan
  let idx = 0; const st = [], on = new Set(), num = new Map(), low = new Map(), sccs = [];
  const dfs = (v) => {
    num.set(v, idx); low.set(v, idx); idx++; st.push(v); on.add(v);
    for (const a of adj.get(v)) {
      if (!num.has(a.para)) { dfs(a.para); low.set(v, Math.min(low.get(v), low.get(a.para))); }
      else if (on.has(a.para)) low.set(v, Math.min(low.get(v), num.get(a.para)));
    }
    if (low.get(v) === num.get(v)) { const c = []; let w; do { w = st.pop(); on.delete(w); c.push(w); } while (w !== v); sccs.push(c); }
  };
  for (const t of trigs) if (!num.has(t.id)) dfs(t.id);
  return sccs.filter((c) => c.length > 1 || adj.get(c[0]).some((a) => a.para === c[0])).map((c) => ({ ids: c, arestas: edges.filter((a) => c.includes(a.de) && c.includes(a.para) && ["chain", "alerta", "no", "ruido"].includes(a.tipo)) }));
}

/** Coluna de cada gatilho para desenhar (0 = ninguém o dispara). Ciclos não entram na conta. */
export function niveis(trigs, edges = arestas(trigs)) {
  const ids = trigs.map((t) => t.id);
  const nivel = new Map(ids.map((i) => [i, 0]));
  const fwd = edges.filter((a) => ["chain", "alerta", "no", "ruido"].includes(a.tipo) && nivel.has(a.de) && nivel.has(a.para));
  for (let k = 0; k < ids.length; k++) {
    let mudou = false;
    for (const a of fwd) if (a.de !== a.para && nivel.get(a.para) < nivel.get(a.de) + 1 && nivel.get(a.de) + 1 <= ids.length) { nivel.set(a.para, nivel.get(a.de) + 1); mudou = true; }
    if (!mudou) break;
  }
  return nivel;
}

/**
 * Problemas. ctx: { ids?: Set de ids de itens que existem (sem isso não confere item apagado), nomes? }.
 * Cada problema: { nivel: "erro"|"aviso"|"info", trigger, texto }.
 */
export function problemas(trigs, ctx = {}) {
  const out = [];
  const add = (nivel, t, texto) => out.push({ nivel, trigger: t?.id || null, texto });
  const by = new Map(trigs.map((t) => [t.id, t]));
  const edges = arestas(trigs);
  const apontados = new Set(edges.filter((a) => ["chain", "rearm", "alerta", "no", "ruido"].includes(a.tipo)).map((a) => a.para));
  const rearmados = new Set(edges.filter((a) => a.tipo === "rearm").map((a) => a.para));
  const existe = (id) => !ctx.ids || id === "@quem" || ctx.ids.has(id);

  for (const t of trigs) {
    if (ZONE_CAUSES.includes(t.cause) && !(t.zones || []).length) add("erro", t, `«${t.name}»: a causa "${causeLabel(t.cause)}" precisa de pelo menos um item (zona, objeto, câmera ou nó), e não há nenhum.`);
    if (!(t.effects || []).length) add("aviso", t, `«${t.name}» não tem nenhum efeito.`);
    for (const z of t.zones || []) if (!existe(z)) add("aviso", t, `«${t.name}»: um dos itens da causa foi apagado do mapa.`);
    if (t.armed === false && !rearmados.has(t.id)) add("aviso", t, `«${t.name}» está desarmado e nada o rearma: ele não dispara sozinho de novo.`);
    if (t.cause === "manual" && !apontados.has(t.id)) add("info", t, `«${t.name}» só dispara quando você o dispara à mão (nada o chama).`);
    for (const e of t.effects || []) {
      if (NEED_TARGETS.includes(e.action) && !(e.targets || []).length) add("aviso", t, `«${t.name}»: o efeito "${ACTION_NAME[e.action] || e.action}" está sem alvo.`);
      for (const id of [...(e.targets || []), e.dest, e.shooter, ...(e.doorImgs || [])]) if (id && !existe(id)) { add("aviso", t, `«${t.name}»: o efeito "${ACTION_NAME[e.action] || e.action}" usa um item que foi apagado do mapa.`); break; }
      if ((e.action === "chain" || e.action === "rearm") && (!e.trigger || !by.has(e.trigger))) add("erro", t, `«${t.name}»: o efeito "${ACTION_NAME[e.action]}" aponta para um gatilho que não existe${e.trigger ? " (foi apagado)" : " (não foi escolhido)"}.`);
      if (e.action === "cancel" && e.trigger && !by.has(e.trigger)) add("aviso", t, `«${t.name}»: o cancelamento aponta para um gatilho apagado.`);
    }
    if (t.cause === "alertLevel" && !trigs.some((o) => (o.effects || []).some((e) => e.action === "alarm"))) add("info", t, `«${t.name}» espera o alerta mudar, mas nenhum gatilho mexe no alerta (só os botões 🚨 do painel).`);
  }
  for (const c of ciclos(trigs, edges)) {
    const nomes = c.ids.map((id) => `«${by.get(id).name}»`).join(" → ");
    const todosUmaVez = c.ids.every((id) => by.get(id).once);
    const atraso = c.arestas.some((a) => a.atraso > 0);
    if (todosUmaVez) add("info", by.get(c.ids[0]), `Ciclo ${nomes}: todos são "uma vez só", então para sozinho.`);
    else add(atraso ? "aviso" : "erro", by.get(c.ids[0]), `Ciclo ${nomes}: ${atraso ? "repete para sempre (com atraso)" : "dispara em laço sem parar (o motor corta em 8 níveis)"}. Marque "uma vez só" em um deles ou cancele a sequência.`);
  }
  // conflito: dois gatilhos com a mesma causa e a mesma zona mexem no mesmo item de jeitos opostos
  const opostos = { show: "hide", hide: "show", lock: "unlock", unlock: "lock" };
  for (let i = 0; i < trigs.length; i++) for (let j = i + 1; j < trigs.length; j++) {
    const a = trigs[i], b = trigs[j];
    if (a.cause !== b.cause || a.cause === "manual" || !(a.zones || []).some((z) => (b.zones || []).includes(z))) continue;
    if ((a.delay || 0) !== (b.delay || 0)) continue;
    for (const ea of a.effects || []) for (const eb of b.effects || []) {
      if (opostos[ea.action] === eb.action && (ea.targets || []).some((x) => (eb.targets || []).includes(x))) {
        add("aviso", a, `Conflito: «${a.name}» e «${b.name}» reagem à mesma coisa e fazem o oposto no mesmo item (${ACTION_NAME[ea.action]} × ${ACTION_NAME[eb.action]}).`);
      }
    }
  }
  const ordem = { erro: 0, aviso: 1, info: 2 };
  return out.sort((x, y) => ordem[x.nivel] - ordem[y.nivel]);
}

/**
 * "E se?": o que acontece se este gatilho disparar agora. Não executa nada.
 * opts: { alerta (nível atual), nomes: { idItem: nome }, maxProf }.
 * Devolve { passos: [{ id, pai, em (s), tipo, trigger?, texto, cancelado? }], alertaFinal, notas }.
 */
export function simular(trigs, startId, opts = {}) {
  const { nomes = {}, maxProf = 8 } = opts;
  let alerta = opts.alerta ?? 0;
  const by = new Map(trigs.map((t) => [t.id, { ...t }]));
  const passos = [], cancels = [], notas = [];
  let seq = 0;
  const push = (p) => { const s = { id: ++seq, ...p }; passos.push(s); return s; };

  function fire(t, em, prof, pai, via) {
    if (prof > maxProf) { push({ pai, em, tipo: "limite", texto: `Parou: passou de ${maxProf} níveis de corrente em «${t.name}».` }); return; }
    const st = push({ pai, em, tipo: "gatilho", trigger: t.id, texto: `⚡ «${t.name}»${via ? ` (${via})` : ""}${(t.conds || []).length ? " — só se as condições valerem (a simulação supõe que valem)" : ""}` });
    if (t.once) by.get(t.id).armed = false;
    const t0 = em + (Number(t.delay) || 0);
    for (const e of t.effects || []) efeito(t, e, t0 + (Number(e.delay) || 0), em, prof, st);
  }
  function efeito(t, e, em, fila, prof, pai) {
    const st = push({ pai: pai.id, em, fila, tipo: "efeito", trigger: t.id, texto: descreve(e, nomes, trigs) });
    if (e.action === "chain") { const alvo = by.get(e.trigger); if (alvo) fire(alvo, em, prof + 1, st.id, "corrente"); }
    else if (e.action === "rearm") { const alvo = by.get(e.trigger); if (alvo) alvo.armed = true; }
    else if (e.action === "cancel") cancels.push({ em, de: t.id, alvo: e.trigger || "" });
    else if (e.action === "alarm") {
      const antes = alerta, depois = alertNext(antes, e.alarmOp || "up", e.alarmTo);
      if (depois !== antes) {
        alerta = depois;
        push({ pai: st.id, em, tipo: "alerta", texto: `🚨 alerta ${antes} → ${depois}` });
        for (const o of by.values()) if (o.cause === "alertLevel" && o.armed !== false && alertMatches(o, depois, antes)) fire(o, em, prof + 1, st.id, "o alerta mudou");
      }
    } else if (e.action === "nodeSet" || e.action === "camPower") {
      const sn = e.action === "camPower" ? (e.power === "on" ? "ativo" : "desativado") : e.nodeState || "hackeado";
      for (const o of by.values()) if (o.cause === "nodeState" && o.armed !== false && (o.zones || []).some((z) => (e.targets || []).includes(z)) && (!o.nodeTo || o.nodeTo === sn)) fire(o, em, prof + 1, st.id, "o nó mudou");
    } else if (e.action === "noise") {
      for (const o of by.values()) if (o.cause === "heard" && o.armed !== false) push({ pai: st.id, em, tipo: "talvez", texto: `Se um guarda ouvir, «${o.name}» dispara (depende de quem está perto).` });
    }
  }

  const start = by.get(startId);
  if (!start) return { passos: [], alertaFinal: alerta, notas: ["Gatilho não encontrado."] };
  fire(start, 0, 0, null, "disparado à mão");

  // cancelamentos: o que já estava na fila e só ia rodar depois do cancelamento (e o que ele ia disparar) não acontece
  const filhos = new Map();
  for (const p of passos) if (p.pai != null) (filhos.get(p.pai) || filhos.set(p.pai, []).get(p.pai)).push(p);
  const corta = (p) => { if (p.cancelado) return; p.cancelado = true; for (const f of filhos.get(p.id) || []) corta(f); };
  for (const c of cancels) {
    for (const p of passos) {
      if (p.tipo !== "efeito" || p.cancelado) continue;
      const alvo = c.alvo ? p.trigger === c.alvo : p.trigger !== c.de;
      if (alvo && p.fila <= c.em && p.em > c.em) corta(p);
    }
  }
  const ordenados = passos.slice().sort((a, b) => a.em - b.em || a.id - b.id);
  if (passos.some((p) => p.cancelado)) notas.push("Alguns passos foram cancelados por um efeito de cancelar sequência.");
  return { passos: ordenados, alertaFinal: alerta, notas };
}
