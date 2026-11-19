import { COVER, obstaclesFrom, coverBetween, coverText, halfSize, outline } from "../src/cover.js";
const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v));
const dpi = 100;
const wall = (x, y0, y1, extra = {}) => ({ id: `w${x}${y0}`, type: "WALL", blocking: true, position: { x, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, points: [{ x: 0, y: y0 }, { x: 0, y: y1 }], ...extra });
const tok = (x, y) => ({ type: "IMAGE", position: { x, y }, scale: { x: 1, y: 1 }, image: { width: 100, height: 100 }, grid: { dpi: 100, offset: { x: 50, y: 50 } } });
const from = { x: 0, y: 0 };
const H = halfSize(tok(0, 0), dpi);
ok("meio tamanho do token", H, 50);

const cases = [
  ["sem nada no caminho", [], "none"],
  ["parede inteira no meio = total", [wall(200, -500, 500)], "total"],
  ["parede só até a metade de baixo = meia", [wall(200, 10, 500)], "half"],
  ["parede cobrindo o centro e um lado = três quartos", [wall(200, -10, 500)], "three"],
  ["parede que não bloqueia (porta aberta)", [wall(200, -500, 500, { blocking: false })], "none"],
];
for (const [n, items, want] of cases) ok(n, coverBetween(from, { x: 400, y: 0 }, H, obstaclesFrom(items, dpi)).key, want);

const crate = { id: "caixote", type: "IMAGE", position: { x: 200, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100 }, grid: { dpi: 100, offset: { x: 50, y: 50 } }, metadata: { [COVER]: "meia" } };
ok("caixote marcado como meia cobertura", coverBetween(from, { x: 400, y: 0 }, H, obstaclesFrom([crate], dpi)), { key: "half", by: "caixote", blockedLines: 0, lines: 5 });
ok("caixote fora do caminho não conta", coverBetween(from, { x: 0, y: 400 }, H, obstaclesFrom([crate], dpi)).key, "none");
ok("o próprio alvo marcado não cobre a si mesmo", coverBetween(from, { x: 200, y: 0 }, H, obstaclesFrom([crate], dpi), ["caixote"]).key, "none");
const bunker = { ...crate, id: "bunker", metadata: { [COVER]: "total" } };
ok("item marcado como total", coverBetween(from, { x: 400, y: 0 }, H, obstaclesFrom([bunker], dpi)).key, "total");
ok("vale o maior: parede meia + caixote três quartos", coverBetween(from, { x: 400, y: 0 }, H, obstaclesFrom([wall(300, 10, 500), { ...crate, metadata: { [COVER]: "tres" } }], dpi)).key, "three");
ok("ponto no mapa (sem cantos): parede no meio = total", coverBetween(from, { x: 400, y: 0 }, 0, obstaclesFrom([wall(200, -500, 500)], dpi)).key, "total");
ok("forma desenhada vira contorno", outline({ type: "SHAPE", shapeType: "RECTANGLE", position: { x: 0, y: 0 }, width: 10, height: 10 }, dpi).length, 4);
ok("texto com o bônus d20 padrão", [coverText("half"), coverText("three"), coverText("total"), coverText("none")], ["meia cobertura (+2 defesa)", "três quartos (+5 defesa)", "cobertura total (sem linha de tiro)", "sem cobertura"]);
ok("bônus configurável", coverText("half", { half: 1 }), "meia cobertura (+1 defesa)");

// a bala bate no obstáculo
import { firstHit } from "../src/cover.js";
{
  const obs = obstaclesFrom([wall(200, -500, 500)], dpi);
  const h = firstHit(from, { x: 400, y: 0 }, 0, obs, [], 4);
  ok("bate na parede (um pouquinho antes)", [Math.round(h.at.x), h.at.y, h.id, h.wall], [196, 0, "w200-500", true]);
  ok("sem obstáculo: nada", firstHit(from, { x: 400, y: 0 }, 0, obstaclesFrom([], dpi)), null);
  const crate = { id: "cx", type: "SHAPE", shapeType: "RECTANGLE", position: { x: 150, y: -50 }, rotation: 0, scale: { x: 1, y: 1 }, width: 50, height: 100, metadata: { [COVER]: "total" } };
  const h2 = firstHit(from, { x: 400, y: 0 }, 0, obstaclesFrom([crate, wall(300, -500, 500)], dpi), [], 4);
  ok("bate no caixote antes da parede", [h2.id, h2.wall, Math.round(h2.at.x)], ["cx", false, 146]);
  const low = obstaclesFrom([wall(200, 10, 500)], dpi);
  ok("centro livre: bate onde o canto bloqueado cruza", firstHit(from, { x: 400, y: 0 }, H, low, [], 4)?.id, "w20010");
}
