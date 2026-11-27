import { ANON, DEFAULT_CFG, cfgOf, isAnon, faceOf, desiredFace, applyTo, needs, realLabel, snapOf, sameSnap, revert, byPlayer } from "../src/core.js";
let bad = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };
const G = "https://x/anonimo.png";
const tok = (md = {}) => ({ id: "t", name: "Kassandra", type: "IMAGE", layer: "CHARACTER", position: { x: 10, y: 20 }, rotation: 15, scale: { x: 1, y: 1 }, visible: true, locked: false,
  image: { url: "https://x/kass.png", width: 100, height: 100 }, text: { plainText: "Kassandra", richText: [], style: {} }, attachments: [], metadata: { "outra/coisa": 1, ...md } });

// ---- ligar só o nome
let t = tok({ [ANON]: { on: true } });
ok("ligado: padrão", [isAnon(t), cfgOf(t).nome, cfgOf(t).modo, cfgOf(t).trava], [true, "???", "nome", true]);
ok("precisa de ajuste", needs(t, G), true);
ok("needs não mexeu no original", [t.name, t.metadata[ANON].real], ["Kassandra", undefined]);
ok("aplica", applyTo(t, G), true);
ok("rosto: nome e texto trocados, imagem igual", [t.name, t.text.plainText, t.image.url], ["???", "???", "https://x/kass.png"]);
ok("guardou o rosto verdadeiro", t.metadata[ANON].real, { name: "Kassandra", text: "Kassandra", url: "https://x/kass.png" });
ok("o resto continua igual (posição, rotação, metadados de outras extensões)", [t.position, t.rotation, t.metadata["outra/coisa"]], [{ x: 10, y: 20 }, 15, 1]);
ok("de novo: nada a fazer (idempotente)", [applyTo(t, G), needs(t, G)], [false, false]);
ok("rótulo do mestre", realLabel(t), "🕶 Kassandra");

// ---- trocar para nome + imagem, com imagem própria e com a genérica
t.metadata[ANON].modo = "imagem";
applyTo(t, G);
ok("modo imagem: imagem genérica", t.image.url, G);
t.metadata[ANON].imagem = "https://x/vulto.png"; applyTo(t, G);
ok("imagem própria do item", t.image.url, "https://x/vulto.png");
t.metadata[ANON].nome = "Encapuzado"; applyTo(t, G);
ok("nome falso editado", [t.name, t.text.plainText], ["Encapuzado", "Encapuzado"]);
t.metadata[ANON].modo = "nome"; applyTo(t, G);
ok("voltar para só nome devolve a imagem verdadeira", t.image.url, "https://x/kass.png");

// ---- desligar devolve tudo
t.metadata[ANON].on = false;
ok("desligado precisa ajustar", needs(t, G), true);
applyTo(t, G);
ok("desligado: tudo de volta e sem cópia", [t.name, t.text.plainText, t.image.url, t.metadata[ANON].real], ["Kassandra", "Kassandra", "https://x/kass.png", undefined]);
ok("desligado e já restaurado: nada a fazer", needs(t, G), false);

// ---- outros tipos: sem texto / sem imagem
const forma = { id: "f", name: "Painel secreto", type: "SHAPE", metadata: { [ANON]: { on: true, modo: "imagem" } } };
applyTo(forma, G);
ok("forma sem texto/imagem: só o nome", [forma.name, forma.text, forma.image], ["???", undefined, undefined]);
const semTexto = tok({ [ANON]: { on: true } }); semTexto.text = { plainText: "", richText: [] };
applyTo(semTexto, G);
ok("rótulo vazio continua vazio", [semTexto.name, semTexto.text.plainText], ["???", ""]);
ok("item sem anonimato: ignorado", [needs(tok(), G), applyTo(tok(), G)], [false, false]);
ok("nome vazio vira ???", desiredFace({ nome: "  ", modo: "nome" }, { name: "A", text: "A", url: "u" }, G).name, "???");

// ---- trava para jogadores
const a = tok({ [ANON]: { on: true } }); applyTo(a, G);
const snap = snapOf(a);
ok("snapshot igual a si mesmo", sameSnap(snap, snapOf(a)), true);
const mexido = JSON.parse(JSON.stringify(a)); mexido.position = { x: 99, y: 99 }; mexido.name = "Kassandra"; mexido.metadata[ANON].on = false;
ok("mexida do jogador muda o snapshot", sameSnap(snap, snapOf(mexido)), false);
revert(mexido, snap);
ok("revert devolve posição, nome e o anonimato ligado", [mexido.position, mexido.name, mexido.metadata[ANON].on, sameSnap(snap, snapOf(mexido))], [{ x: 10, y: 20 }, "???", true, true]);
const gms = new Set(["gm1"]);
ok("quem mexeu: jogador x mestre x ninguém", [byPlayer({ lastModifiedUserId: "ana" }, gms), byPlayer({ lastModifiedUserId: "gm1" }, gms), byPlayer({}, gms)], [true, false, false]);
{
  const d = { name: "K", layer: "CHARACTER", locked: false, metadata: { [ANON]: { on: true, trava: true } } };
  applyTo(d, "g");
  ok("anonimizar manda para a camada MAP e trava", [d.layer, d.locked], ["MAP", true]);
  d.metadata[ANON].on = false; applyTo(d, "g");
  ok("revelar devolve camada e cadeado", [d.layer, d.locked, d.metadata[ANON].prevLayer], ["CHARACTER", false, undefined]);
  const e = { name: "K", layer: "CHARACTER", metadata: { [ANON]: { on: true, trava: false } } };
  applyTo(e, "g");
  ok("sem trava fica na camada original", e.layer, "CHARACTER");
}
{
  const f = { name: "Z", type: "SHAPE", layer: "DRAWING", style: { fillOpacity: 0.6, strokeOpacity: 1 }, metadata: { [ANON]: { on: true, esconder: true } } };
  applyTo(f, "g");
  ok("esconder: forma fica transparente e guarda o estilo", [f.style.fillOpacity, f.style.strokeOpacity, f.metadata[ANON].prevStyle], [0, 0, { fo: 0.6, so: 1 }]);
  ok("esconder é idempotente", needs(f, "g"), false);
  f.metadata[ANON].esconder = false; applyTo(f, "g");
  ok("desmarcar devolve o estilo", [f.style.fillOpacity, f.style.strokeOpacity, f.metadata[ANON].prevStyle], [0.6, 1, undefined]);
  f.metadata[ANON].esconder = true; applyTo(f, "g"); f.metadata[ANON].on = false; applyTo(f, "g");
  ok("revelar devolve o estilo", [f.style.fillOpacity, f.metadata[ANON].prevStyle], [0.6, undefined]);
}
process.exit(bad ? 1 : 0);
