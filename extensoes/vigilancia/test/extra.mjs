import { crossings, hears, shotRaio, ruidoCfg, DEFAULT_RUIDO, routeOf, patrolInit, patrolStep, investigate, hold, versionFor, appearance, verdadeOf, PONTO, RUIDO, VERDADE, ETIQ, etiquetaOf, etiquetaTexto, etiquetaVisivel } from "../src/extra.js";
let bad = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };
const cell = 100;
const wall = (x) => ({ a: { x, y: -1000 }, b: { x, y: 1000 } });
ok("cruza uma parede", crossings({ x: 0, y: 0 }, { x: 500, y: 0 }, [wall(250)]), 1);
ok("não cruza", crossings({ x: 0, y: 0 }, { x: 200, y: 0 }, [wall(250)]), 0);
ok("duas paredes", crossings({ x: 0, y: 0 }, { x: 500, y: 0 }, [wall(100), wall(300)]), 2);
ok("ruído no alcance, sem parede", hears({ x: 0, y: 0 }, { x: 1000, y: 0 }, 15, cell, []).hears, true);
ok("fora do alcance", hears({ x: 0, y: 0 }, { x: 1600, y: 0 }, 15, cell, []).hears, false);
ok("uma parede abafa (15 → 7,5 quadrados)", [hears({ x: 0, y: 0 }, { x: 700, y: 0 }, 15, cell, [wall(300)]).hears, hears({ x: 0, y: 0 }, { x: 800, y: 0 }, 15, cell, [wall(300)]).hears], [true, false]);
ok("fator 1: parede não abafa", hears({ x: 0, y: 0 }, { x: 1400, y: 0 }, 15, cell, [wall(300)], 1).hears, true);
ok("alcance 0 = fonte muda", hears({ x: 0, y: 0 }, { x: 0, y: 0 }, 0, cell, []).hears, false);
ok("config padrão e chave geral", [ruidoCfg({}).on, ruidoCfg({ [RUIDO]: { on: false } }).on, ruidoCfg({ [RUIDO]: { tiro: 20 } }).tiro, ruidoCfg({}).corpo], [true, false, 20, 4]);
ok("disparo / corpo a corpo", [shotRaio({ spec: {} }, DEFAULT_RUIDO), shotRaio({ spec: { melee: { x: 1 } } }, DEFAULT_RUIDO)], [15, 4]);

// ronda
const pts = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }];
const items = [
  { id: "p2", position: { x: 300, y: 0 }, metadata: { [PONTO]: { g: "g", n: 2 } } }, { id: "p1", position: { x: 0, y: 0 }, metadata: { [PONTO]: { g: "g", n: 1 } } },
  { id: "p3", position: { x: 300, y: 300 }, metadata: { [PONTO]: { g: "g", n: 3 } } }, { id: "x", position: { x: 9, y: 9 }, metadata: { [PONTO]: { g: "outro", n: 1 } } },
];
ok("rota em ordem, só deste guarda", routeOf(items, "g").map((p) => p.id), ["p1", "p2", "p3"]);
const cfg = { speed: 1, pausa: 1, modo: "ciclo", girar: true, espera: 2 };
let st = patrolInit({ x: 10, y: 0 }, pts);
ok("começa no ponto mais perto", st.i, 0);
let pos = { x: 0, y: 0 };
let r = patrolStep(st, pos, pts, cfg, 1000, cell);   // chegou ao ponto 0 (já estava), pausa e segue para o 1
ok("chega e pausa 1 s, alvo vira o ponto 1", [r.pos, r.st.wait, r.st.i], [{ x: 0, y: 0 }, 1000, 1]);
r = patrolStep(r.st, r.pos, pts, cfg, 1000, cell);
ok("esperando", [r.pos, r.st.wait], [{ x: 0, y: 0 }, 0]);
r = patrolStep(r.st, r.pos, pts, cfg, 1000, cell);
ok("anda 1 quadrado por segundo na direção do alvo, olhando para ele", [r.pos, r.rotation], [{ x: 100, y: 0 }, 0]);
let q = { pos: { x: 300, y: 250 }, st: { ...r.st, i: 2, wait: 0 } };
q = patrolStep(q.st, q.pos, pts, cfg, 1000, cell);
ok("não passa do alvo", q.pos, { x: 300, y: 300 });
ok("ciclo volta ao primeiro", q.st.i, 0);
const vv = { ...cfg, modo: "vaivem" };
let s2 = { i: 2, dir: 1, wait: 0, hold: 0, inv: null };
let a = patrolStep(s2, { x: 300, y: 300 }, pts, vv, 1000, cell);
ok("vai-e-volta inverte no fim", [a.st.i, a.st.dir], [1, -1]);
ok("girar desligado não gira", patrolStep({ i: 1, dir: 1, wait: 0, hold: 0, inv: null }, { x: 0, y: 0 }, pts, { ...cfg, girar: false }, 1000, cell).rotation, null);
// viu alguém: segura parado
let h = patrolStep(hold(st, 3000), { x: 0, y: 0 }, pts, cfg, 1000, cell);
ok("seguro parado por 3 s", [h.pos, h.st.hold], [{ x: 0, y: 0 }, 2000]);
// investigar
let iv = investigate({ i: 1, dir: 1, wait: 0, hold: 0, inv: null }, { x: 0, y: 200 }, cfg);
let w = patrolStep(iv, { x: 0, y: 0 }, pts, cfg, 1000, cell);
ok("vai para o ruído", w.pos, { x: 0, y: 100 });
w = patrolStep(w.st, w.pos, pts, cfg, 1000, cell);
ok("chega ao ruído", [w.pos, w.st.inv], [{ x: 0, y: 200 }, null]);
w = patrolStep(w.st, w.pos, pts, cfg, 1000, cell);
ok("fica olhando em volta (espera) e depois volta à rota", [w.st.wait, w.pos], [1000, { x: 0, y: 200 }]);

// verdade
const v = { on: true, versoes: [{ para: ["ana"], imagem: "https://x/y.png", texto: "Guarda" }, { para: "*", esconder: true }] };
ok("quem é citado vê a versão dele", versionFor(v, "ana").texto, "Guarda");
ok("os outros caem em 'todos os outros'", versionFor(v, "bob").esconder, true);
ok("sem versão para ele: não vê", versionFor({ versoes: [{ para: ["ana"] }] }, "bob"), null);
const it = { id: "i", type: "IMAGE", image: { url: "orig.png", width: 150, height: 150 }, name: "Real", attachedTo: "z", metadata: { [VERDADE]: v } };
const c = appearance(it, versionFor(v, "ana"));
ok("cópia com a imagem trocada, sem prender a outro item", [c.image.url, c.image.width, c.attachedTo, c.text.plainText], ["https://x/y.png", 150, undefined, "Guarda"]);
ok("escondido para ele", appearance(it, versionFor(v, "bob")), null);
ok("desligado não vale", verdadeOf({ metadata: { [VERDADE]: { on: false, versoes: [] } } }), null);

// etiquetas de RA
const et = { on: true, titulo: "Painel B-12", linhas: "Dono: Horizon\nSeg.: 4\nEstado: {estado}", alcance: 0, para: [] };
ok("etiqueta ligada com texto", etiquetaOf({ metadata: { [ETIQ]: et } })?.titulo, "Painel B-12");
ok("sem texto ou desligada: nada", [etiquetaOf({ metadata: { [ETIQ]: { titulo: " " } } }), etiquetaOf({ metadata: { [ETIQ]: { ...et, on: false } } }), etiquetaOf({ metadata: {} })], [null, null, null]);
ok("texto com {estado} e linhas vazias", etiquetaTexto({ titulo: "X", linhas: "a\n\n b " }, "hackeado"), "X\na\nb");
ok("{estado} vira o estado do nó", etiquetaTexto(et, "hackeado").split("\n").pop(), "Estado: hackeado");
const e1 = { ...et, alcance: 5 };
const at = { x: 0, y: 0 };
ok("mestre sempre vê", etiquetaVisivel(e1, at, { gm: true, decks: [{ x: 9999, y: 0 }] }), true);
ok("alcance: perto vê, longe não", [etiquetaVisivel(e1, at, { playerId: "a", decks: [{ x: 400, y: 0 }], cell: 100 }), etiquetaVisivel(e1, at, { playerId: "a", decks: [{ x: 600, y: 0 }], cell: 100 })], [true, false]);
ok("vale o token mais perto", etiquetaVisivel(e1, at, { playerId: "a", decks: [{ x: 900, y: 0 }, { x: 0, y: 300 }], cell: 100 }), true);
ok("marcado sem token com commlink: vê sempre", etiquetaVisivel(e1, at, { playerId: "a", decks: [], cell: 100 }), true);
ok("só para: fora da lista não vê", [etiquetaVisivel({ ...et, para: ["ana"] }, at, { playerId: "bob" }), etiquetaVisivel({ ...et, para: ["ana"] }, at, { playerId: "ana" })], [false, true]);

// ---- portas por gatilho ----
{
  const { doorTrigger } = await import("../src/extra.js");
  const ef = (o) => ({ action: "animDoor", targets: ["lin"], doorOp: "alternar", vfxOpen: "https://x.io/a.webm", vfxClose: "", vfxWait: 2, delay: 0, ...o });
  const t = (o = {}, e = {}) => ({ id: "g1", cause: "interact", armed: true, delay: 0, effects: [ef(e)], ...o });
  ok("acha o gatilho da porta e espera a animação", doorTrigger([t()], "lin", true), { id: "g1", wait: 2 });
  ok("fechar sem vídeo de fechar: sem espera", doorTrigger([t()], "lin", false), { id: "g1", wait: 0 });
  ok("outra porta: nada", doorTrigger([t()], "outra", true), null);
  ok("desarmado não vale", doorTrigger([t({ armed: false })], "lin", true), null);
  ok("só abrir não serve para fechar", [doorTrigger([t({}, { doorOp: "abrir" })], "lin", false), doorTrigger([t({}, { doorOp: "abrir" })], "lin", true)?.id], [null, "g1"]);
  ok("porta com imagem (sem vídeo)", doorTrigger([t({}, { action: "imgDoor" })], "lin", true), { id: "g1", wait: 0 });
  ok("só gatilho Interagir", doorTrigger([t({ cause: "enter" })], "lin", true), null);
}
// ---- portas na ronda ----
{
  const { portasStep } = await import("../src/extra.js");
  const door = { id: "d", segs: [{ a: { x: 500, y: 0 }, b: { x: 500, y: 150 } }], open: false, locked: false };
  const cfgF = { portas: "fecha" };
  let r = portasStep({}, { x: 100, y: 50 }, [door], cfgF, 150);
  ok("longe da porta: nada", [r.abrir, r.fechar], [[], []]);
  r = portasStep(r.st, { x: 400, y: 50 }, [door], cfgF, 150);
  ok("perto: abre", r.abrir, ["d"]);
  const open = { ...door, open: true };
  r = portasStep(r.st, { x: 600, y: 50 }, [open], cfgF, 150);
  ok("passou mas ainda perto: não fecha", r.fechar, []);
  r = portasStep(r.st, { x: 800, y: 50 }, [open], cfgF, 150);
  ok("longe depois de passar: fecha", r.fechar, ["d"]);
  const rd = portasStep({}, { x: 400, y: 50 }, [door], { portas: "deixa" }, 150);
  const rd2 = portasStep(rd.st, { x: 900, y: 50 }, [open], { portas: "deixa" }, 150);
  ok("deixa aberta: não fecha", rd2.fechar, []);
  ok("ignora: não abre", portasStep({}, { x: 400, y: 50 }, [door], { portas: "nao" }, 150).abrir, []);
  ok("trancada: não abre", portasStep({}, { x: 400, y: 50 }, [{ ...door, locked: true }], cfgF, 150).abrir, []);
  const op = portasStep({}, { x: 400, y: 50 }, [open], cfgF, 150);
  ok("já estava aberta: guarda não fecha depois", portasStep(op.st, { x: 900, y: 50 }, [open], cfgF, 150).fechar, []);
}

process.exit(bad ? 1 : 0);
