import { pack, orphans, instantiate, PKG, DONO } from "../src/prefab.js";
let bad = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad++; console.log((g ? "ok  " : "ERRO") + " " + n + (g ? "" : ": " + JSON.stringify(v))); };
const ef = (action, o = {}) => ({ id: "e" + action, action, targets: [], delay: 0, ...o });
const it = (id, md = {}) => ({ id, metadata: md });

// a porta: imagem (img), linha do fog (fog) e um gatilho que usa as duas + chama outro gatilho; o alarme global é de fora
const T1 = { id: "t1", name: "Porta", armed: false, once: false, cause: "interact", zones: ["img"], conds: [{ id: "c", type: "door", ids: ["fog"], zones: [] }],
  effects: [ef("animDoor", { targets: ["fog"], doorImgs: ["img"] }), ef("chain", { trigger: "t2" }), ef("show", { targets: ["luzfora"] })] };
const T2 = { id: "t2", name: "Som", armed: true, cause: "manual", zones: [], effects: [ef("hide", { targets: ["img"] })] };
const T3 = { id: "t3", name: "Outro", armed: true, cause: "manual", zones: ["longe"], effects: [] };
const list = [T1, T2, T3];

const p = pack([it("img"), it("fog")], list);
ok("empacota t1 e o t2 chamado, não o t3", p.triggers.map((t) => t.name), ["Porta", "Som"]);
ok("ids dos itens viram chaves", p.triggers[0].zones[0] === "@i:" + p.keys.img && p.triggers[0].effects[0].targets[0] === "@i:" + p.keys.fog, true);
ok("item de fora fica com o id", p.triggers[0].effects[2].targets, ["luzfora"]);
ok("corrente aponta para o gatilho empacotado", p.triggers[0].effects[1].trigger, "@t:1");
ok("condição também troca", p.triggers[0].conds[0].ids[0], "@i:" + p.keys.fog);
ok("sem gatilho nenhum, nada", pack([it("zzz")], list), null);

// guarda no item (como o menu faz) e simula o Prefabs: cópia com ids novos e os mesmos metadados
const meta = (id, k) => ({ [PKG]: { id: p.pkg, k, triggers: p.triggers }, [DONO]: id });
const orig = [it("img", meta("img", p.keys.img)), it("fog", meta("fog", p.keys.fog))];
ok("originais não são cópias", orphans(orig), []);
const copia = [it("img2", meta("img", p.keys.img)), it("fog2", meta("fog", p.keys.fog))]; // DONO ainda é o id do original
const inst = orphans([...orig, ...copia]);
ok("a cópia é detectada", inst.map((x) => x.items), [{ [p.keys.img]: "img2", [p.keys.fog]: "fog2" }]);
const r = instantiate(p.triggers, inst[0]);
ok("dois gatilhos novos, ids novos", [r.triggers.length, r.triggers[0].id !== "t1", r.triggers[1].id !== "t2"], [2, true, true]);
ok("apontam para a cópia", [r.triggers[0].zones, r.triggers[0].effects[0].targets, r.triggers[0].effects[0].doorImgs], [["img2"], ["fog2"], ["img2"]]);
ok("a corrente chama o novo t2", r.triggers[0].effects[1].trigger === r.triggers[1].id, true);
ok("item de fora continua", r.triggers[0].effects[2].targets, ["luzfora"]);
ok("começa armado", r.triggers[0].armed, true);
ok("o original não muda", T1.zones, ["img"]);

// duas cópias de uma vez; e cópia só da imagem (a linha não veio): o gatilho que usa a linha é pulado
const duas = orphans([it("a1", meta("a", p.keys.img)), it("b1", meta("b", p.keys.fog)), it("a2", meta("a", p.keys.img)), it("b2", meta("b", p.keys.fog))]);
ok("duas cópias formam duas instâncias", duas.length, 2);
const meia = orphans([it("so", meta("x", p.keys.img))]);
const rm = instantiate(p.triggers, meia[0]);
ok("só a imagem: pula o que precisa da linha (e o t2 que só usa a imagem fica)", [rm.triggers.length, rm.skipped, rm.triggers[0].name], [1, 1, "Som"]);

// reempacotar mantém pacote e chaves
const p2 = pack([it("img", meta("img", p.keys.img)), it("fog", meta("fog", p.keys.fog))], list);
ok("reempacotar mantém o pacote e as chaves", [p2.pkg === p.pkg, p2.keys.img === p.keys.img], [true, true]);
console.log(bad ? `${bad} ERRO(S)` : "tudo certo");
process.exit(bad ? 1 : 0);
