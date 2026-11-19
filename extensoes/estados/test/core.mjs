import { capture, changedProps, applyTo, resolveTarget, findGroup, frame, LUZ } from "../src/core.js";
const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v));
const door = {
  id: "porta", type: "IMAGE", position: { x: 100, y: 100 }, rotation: 0, scale: { x: 1, y: 1 }, visible: true, locked: false,
  image: { url: "fechada.png", mime: "image/png", width: 150, height: 150 }, grid: { dpi: 150, offset: { x: 75, y: 75 } },
  metadata: { [LUZ]: { color: "#ffffff", intensity: 0.7 } },
};
const props = ["position", "visible", "image", "light"];
const s1 = capture(door, props);
ok("captura posição", s1.position, { x: 100, y: 100 });
ok("captura imagem", s1.image.content.url, "fechada.png");
ok("nada mudou", changedProps(door, s1, props), []);
const moved = { ...door, position: { x: 250, y: 100 }, metadata: { [LUZ]: { color: "#ff0000", intensity: 0.7 } } };
ok("mudou posição e luz", changedProps(moved, s1, props), ["position", "light"]);
// estado 2: aberta, outra imagem, sem luz
const s2 = { position: { x: 100, y: 100 }, visible: true, image: { content: { ...door.image, url: "aberta.png" }, grid: door.grid }, light: null };
const draft = JSON.parse(JSON.stringify(door));
applyTo(draft, s2, props);
ok("aplica imagem", draft.image.url, "aberta.png");
ok("aplica sem luz (apaga)", draft.metadata[LUZ], undefined);
// propriedade fora do grupo não é tocada
const d2 = JSON.parse(JSON.stringify(moved));
applyTo(d2, s1, ["visible"]);
ok("só mexe no que o grupo controla", d2.position, { x: 250, y: 100 });
// navegação
const g = { id: "g", name: "Ponte", current: "b", states: [{ id: "a", name: "Intacta" }, { id: "b", name: "Rachada" }, { id: "c", name: "Destruída" }] };
ok("próximo", resolveTarget(g, "next").id, "c");
ok("anterior", resolveTarget(g, "prev").id, "a");
ok("por nome (sem maiúscula)", resolveTarget(g, "destruída").id, "c");
ok("dá a volta", resolveTarget({ ...g, current: "c" }, "next").id, "a");
ok("sem volta para no fim", resolveTarget({ ...g, current: "c", wrap: false }, "next").id, "c");
ok("grupo por nome", findGroup([g], "ponte").id, "g");
// transição
const f = frame({ position: { x: 0, y: 0 }, rotation: 350 }, { position: { x: 100, y: 0 }, rotation: 10 }, 0.5);
ok("meio do caminho", f.position, { x: 50, y: 0 });
ok("gira pelo lado curto", Math.round(f.rotation), 360);
// Vigilância: câmera e nó da Matriz
const camItem = { id: "c", type: "IMAGE", position: { x: 0, y: 0 }, metadata: { "vigilancia/camera": { angle: 90, dir: 30 }, "vigilancia/no": { name: "Câmera", type: "camera", state: "ativo" } } };
const snap = capture(camItem, ["matrix"]);
ok("grava câmera e nó", [snap.matrix.cam.dir, snap.matrix.node.state], [30, "ativo"]);
const off = JSON.parse(JSON.stringify(camItem)); off.metadata["vigilancia/no"].state = "loop"; off.metadata["vigilancia/camera"].dir = 90;
ok("percebe a mudança", changedProps(off, snap, ["matrix"]), ["matrix"]);
applyTo(off, snap, ["matrix"]);
ok("restaura", [off.metadata["vigilancia/camera"].dir, off.metadata["vigilancia/no"].state], [30, "ativo"]);
const plain = { id: "p", type: "IMAGE", position: { x: 0, y: 0 }, metadata: {} };
const none = capture(plain, ["matrix"]);
const later = JSON.parse(JSON.stringify(camItem)); applyTo(later, none, ["matrix"]);
ok("estado sem câmera tira a câmera", [later.metadata["vigilancia/camera"], later.metadata["vigilancia/no"]], [undefined, undefined]);
