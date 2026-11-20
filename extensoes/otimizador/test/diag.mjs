import { sceneStats, localStats, tips, ownerOf } from "../src/diag.js";
const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v));
const img = (id, layer, w, h, url, md = {}) => ({ id, type: "IMAGE", layer, image: { url, width: w, height: h }, metadata: md, name: id });
const items = [
  img("mapa", "MAP", 8000, 6000, "m.png"),
  img("rex", "CHARACTER", 2048, 2048, "rex.png", { "rodeo.owlbear.dynamic-fog/light": {}, "luz-colorida/cor": { color: "#f00" } }),
  img("rex2", "CHARACTER", 2048, 2048, "rex.png"),
  img("caixa", "PROP", 256, 256, "c.png", { "arsenal/destrutivel": {} }),
  { id: "w", type: "WALL", layer: "FOG", points: [{}, {}, {}], metadata: {} },
  { id: "z", type: "SHAPE", layer: "DRAWING", metadata: { "clima/camadas": [{ on: true }, { on: false }, {}] }, visible: false },
];
const sc = sceneStats(items);
ok("contagem", [sc.total, sc.images, sc.unique, sc.walls, sc.wallPts, sc.hidden, sc.colored, sc.climaLayers, sc.destr], [6, 4, 3, 1, 3, 1, 1, 2, 1]);
ok("imagem pesada", sc.big.map((u) => [u.names[0], u.w]), [["mapa", 8000]]);
ok("token enorme (2 tokens, 1 imagem)", sc.bigTokens.map((u) => u.ids), [["rex", "rex2"]]);
ok("dono dos itens locais", [ownerOf({ metadata: { "arsenal/fx": 1 } }), ownerOf({ metadata: { "luz-colorida/effect": true } }), ownerOf({ type: "LIGHT", metadata: {} }), ownerOf({ metadata: { "com.battle-system.smoke/x": 1 } }), ownerOf({ metadata: { "x.y/z": 1 } })], ["Arsenal", "Luz Colorida", "Owlbear (névoa dinâmica)", "Smoke & Spectre", "Outras extensões"]);
const lc = localStats([{ type: "EFFECT", metadata: { "clima/effect": true } }, { type: "EFFECT", metadata: { "clima/effect": true } }, { type: "SHAPE", metadata: { "arsenal/mira": true } }]);
ok("itens locais", [lc.total, lc.effects, lc.byOwner], [3, 2, [["Clima", { n: 2, fx: 2 }], ["Arsenal", { n: 1, fx: 0 }]]]);
const t = tips(sc, lc, null);
ok("dicas: imagem e token", [t.length, t[0].startsWith("1 imagem"), t[1].startsWith("1 token")], [2, true, true]);
ok("cena leve: sem dicas", tips(sceneStats([]), localStats([]), null), ["Nada pesado à vista nesta cena."]);
