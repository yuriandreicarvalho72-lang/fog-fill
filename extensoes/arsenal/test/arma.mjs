// Armas com efeito próprio e corpo a corpo (arma-vfx.js) e as regras de alcance.
import { weaponAnim, abilityOf, hasOwnFx } from "../src/arma-vfx.js";
import { weaponFrom } from "../src/shared.js";
import { GOLPES } from "../src/abil.js";
let bad = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };
const base = { from: { x: 0, y: 0 }, targets: [{ id: "a", at: { x: 150, y: 0 } }], hit: true, cell: 150, seed: 7, weaponName: "Katana" };
const all = () => true;

ok("golpes: corte, estocada, impacto, soco", GOLPES.map(([k]) => k), ["corte", "estocada", "impacto", "soco"]);
ok("arma comum não tem efeito próprio", hasOwnFx({ fx: "pistol" }), false);
ok("corpo a corpo tem", hasOwnFx({ melee: { golpe: "corte", alcance: 1.5 } }), true);
ok("corte usa o visual arma_corte", abilityOf({ ...base, melee: { golpe: "corte" } }).visual, "arma_corte");
ok("estocada usa o visual arma_perfuracao", abilityOf({ ...base, melee: { golpe: "estocada" } }).visual, "arma_perfuracao");
ok("visual próprio vence o golpe", abilityOf({ ...base, melee: { golpe: "corte" }, vfx: { visual: "garra" } }).visual, "garra");
ok("link próprio vence o visual", abilityOf({ ...base, melee: { golpe: "corte" }, vfx: { visual: "garra", video: { url: "https://x.io/a.webm", tipo: "golpe" } } }).video.tipo, "golpe");
ok("link inválido é ignorado", abilityOf({ ...base, vfx: { video: { url: "ftp://x", tipo: "golpe" } } }).video, undefined);

// golpe no alvo ao lado (1 quadrado): vídeo no alvo
const acerto = weaponAnim({ ...base, melee: { golpe: "corte" } }, all).anim;
const principal = (a) => a.videos.filter((v) => v.main);
ok("corte: um vídeo principal, começando um quadrado antes do alvo", [principal(acerto).length, principal(acerto)[0]?.position], [1, { x: 0, y: 0 }]);
// errou: o golpe cai ao lado do alvo
const erro = weaponAnim({ ...base, hit: false, melee: { golpe: "corte" } }, all).anim;
ok("errou: o golpe não vai para o alvo e não tem sangue", [principal(erro).length, principal(erro)[0].position.y !== 0 || principal(erro)[0].position.x !== 0, erro.videos.length], [1, true, 1]);
// sem vídeos: risco rápido para o golpe aparecer
const seco = weaponAnim({ ...base, melee: { golpe: "estocada" } }, null).anim;
ok("vídeos desligados: só o risco do golpe", [seco.videos.length, seco.elements.map((e) => e.kind)], [0, ["line"]]);
// arma de distância com efeito próprio: projétil do atirador ao alvo; rajada repete
const rajada = weaponAnim({ ...base, targets: [{ id: "a", at: { x: 900, y: 0 } }], rounds: 3, vfx: { visual: "raio_energia" } }, all).anim;
ok("rajada de 3: três vídeos principais escalonados", [principal(rajada).length, principal(rajada)[1].t0 > principal(rajada)[0].t0], [3, true]);
ok("corpo a corpo não repete (um golpe só)", principal(weaponAnim({ ...base, rounds: 3, melee: { golpe: "corte" } }, all).anim).length, 1);
// guardar na arma
const w = weaponFrom({ n: "Katana", c: "Própria", fx: "melee", m: ["single"], mag: null, r: [1.5, 1.5], melee: { golpe: "corte", alcance: 1.5 }, vfx: { visual: "garra" } });
ok("weaponFrom guarda melee e vfx", [w.melee, w.vfx, w.mag, w.modes], [{ golpe: "corte", alcance: 1.5 }, { visual: "garra" }, null, ["single"]]);
ok("arma comum não ganha campos extras", Object.keys(weaponFrom({ n: "P", c: "x", fx: "pistol", m: ["single"], mag: 10 })).includes("melee"), false);
if (bad) process.exit(1);
