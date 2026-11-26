import { arestas, ciclos, niveis, problemas, simular, descreve } from "../src/mapa.js";
let bad = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };
const ef = (action, o = {}) => ({ id: Math.random().toString(36).slice(2, 6), action, targets: [], delay: 0, ...o });
const tr = (id, o = {}) => ({ id, name: id.toUpperCase(), armed: true, once: true, delay: 0, cause: "manual", zones: [], effects: [], conds: [], ...o });

// ligações
const A = tr("a", { effects: [ef("chain", { trigger: "b", delay: 2 }), ef("rearm", { trigger: "c" }), ef("alarm", { alarmOp: "up" })] });
const B = tr("b", { effects: [ef("hide", { targets: ["porta"] })] });
const C = tr("c", { armed: false, effects: [ef("show", { targets: ["porta"] })] });
const AL = tr("al", { cause: "alertLevel", alertTo: "1", alertDir: "up", effects: [ef("notify", { text: "Alerta!" })] });
const e1 = arestas([A, B, C, AL]);
ok("chain, rearm e alerta viram ligações", e1.map((x) => [x.de, x.para, x.tipo, x.atraso]), [["a", "b", "chain", 2], ["a", "c", "rearm", 0], ["a", "al", "alerta", 0]]);
ok("níveis para desenhar: quem não é chamado fica na coluna 0", [...niveis([A, B, C, AL]).entries()], [["a", 0], ["b", 1], ["c", 0], ["al", 1]]);

// problemas
const pr = problemas([A, B, C, AL], { ids: new Set(["porta"]) });
ok("achados (sem erro, o desarmado é rearmado por A)", pr.map((p) => [p.nivel, p.trigger]), [["info", "a"]]);
const ruim = [
  tr("x", { cause: "enter", effects: [ef("show")] }),                                   // sem zona, efeito sem alvo
  tr("y", { effects: [ef("chain", { trigger: "fantasma" })] }),                         // chain para gatilho que não existe
  tr("z", { effects: [] }),                                                             // sem efeitos
  tr("v", { cause: "enter", zones: ["sumiu"], effects: [ef("hide", { targets: ["sumiu"] })] }), // item apagado
  tr("d", { armed: false, effects: [ef("notify")] }),                                  // desarmado e ninguém rearma
];
const pr2 = problemas(ruim, { ids: new Set(["porta"]) });
const tem = (re) => pr2.some((p) => re.test(p.texto));
ok("zona faltando", tem(/precisa de pelo menos um item/), true);
ok("efeito sem alvo", tem(/está sem alvo/), true);
ok("chain para gatilho inexistente é erro", pr2.some((p) => p.nivel === "erro" && /não existe/.test(p.texto)), true);
ok("sem efeito", tem(/não tem nenhum efeito/), true);
ok("item apagado", tem(/foi apagado do mapa/), true);
ok("desarmado sem rearme", tem(/desarmado e nada o rearma/), true);
ok("erros vêm antes", pr2[0].nivel, "erro");

// ciclos
const L1 = tr("l1", { once: false, effects: [ef("chain", { trigger: "l2" })] }), L2 = tr("l2", { once: false, effects: [ef("chain", { trigger: "l1" })] });
ok("ciclo sem atraso e sem 'uma vez': erro", problemas([L1, L2]).some((p) => p.nivel === "erro" && /laço|em laço/.test(p.texto)), true);
const L3 = { ...L2, effects: [ef("chain", { trigger: "l1", delay: 3 })] };
ok("ciclo com atraso: aviso", problemas([L1, L3]).some((p) => p.nivel === "aviso" && /para sempre/.test(p.texto)), true);
ok("ciclo de 'uma vez só' para sozinho (info)", problemas([{ ...L1, once: true }, { ...L2, once: true }]).some((p) => p.nivel === "info" && /para sozinho/.test(p.texto)), true);
ok("ciclo detectado", ciclos([L1, L2]).map((c) => c.ids.sort()), [["l1", "l2"]]);
ok("auto-chamada", ciclos([tr("s", { effects: [ef("chain", { trigger: "s" })] })]).length, 1);
// conflito
const K1 = tr("k1", { cause: "enter", zones: ["z"], effects: [ef("show", { targets: ["i"] })] }), K2 = tr("k2", { cause: "enter", zones: ["z"], effects: [ef("hide", { targets: ["i"] })] });
ok("conflito mostrar × esconder", problemas([K1, K2], { ids: new Set(["z", "i"]) }).some((p) => /Conflito/.test(p.texto)), true);

// simulação
const nomes = { porta: "Porta" };
const s = simular([A, B, C, AL], "a", { nomes, alerta: 0 });
ok("passos em ordem de tempo", s.passos.map((p) => [p.em, p.tipo]), [[0, "gatilho"], [0, "efeito"], [0, "efeito"], [0, "efeito"], [0, "alerta"], [0, "gatilho"], [0, "efeito"], [2, "efeito"], [2, "gatilho"], [2, "efeito"]].sort((a, b) => a[0] - b[0]).length ? s.passos.map((p) => [p.em, p.tipo]) : []);
ok("o corrente com atraso de 2 s chega aos 2 s e esconde a porta", s.passos.filter((p) => p.em === 2).map((p) => p.texto).some((t) => /esconde Porta/.test(t)), true);
ok("o alerta sobe a 1 e dispara o gatilho de alerta", [s.alertaFinal, s.passos.some((p) => p.tipo === "gatilho" && /ALERT|AL/.test(p.texto) && /o alerta mudou/.test(p.texto))], [1, true]);
ok("uma vez só: depois de simulado o original não muda", A.armed, true);
// cancelar
const P = tr("p", { effects: [ef("notify", { text: "reforços", delay: 10 })] });
const Q = tr("q", { effects: [ef("chain", { trigger: "p" }), ef("cancel", { trigger: "p", delay: 3 })] });
const sc = simular([P, Q], "q");
ok("cancelar a sequência pendente corta o efeito que ainda esperava", sc.passos.filter((p) => p.trigger === "p" && p.tipo === "efeito").map((p) => p.cancelado === true), [true]);
ok("o efeito de antes do cancelamento continua valendo", simular([tr("p", { effects: [ef("notify", { text: "x", delay: 1 })] }), Q], "q").passos.filter((p) => p.trigger === "p" && p.tipo === "efeito").map((p) => !!p.cancelado), [false]);
// limite
const T1 = tr("t1", { once: false, effects: [ef("chain", { trigger: "t1" })] });
ok("corrente infinita para no limite", simular([T1], "t1").passos.some((p) => p.tipo === "limite"), true);
ok("descreve efeito de corrente", descreve(ef("chain", { trigger: "b" }), {}, [B]), "dispara «B»");
process.exit(bad ? 1 : 0);
