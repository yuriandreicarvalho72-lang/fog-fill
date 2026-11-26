import { normImagem, limpa, deveMostrar, paraOf, achaPorNome, resolve, addDiario, fmt, vazio, MAX_TEXTO } from "../src/core.js";
let bad = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };

ok("link comum fica", normImagem(" https://a.com/x.png "), "https://a.com/x.png");
ok("sem http é recusado", normImagem("javascript:alert(1)"), "");
ok("ftp é recusado", normImagem("ftp://a.com/x.png"), "");
ok("github blob vira raw", normImagem("https://github.com/yuri/fog-fill/blob/main/img/a.png"), "https://raw.githubusercontent.com/yuri/fog-fill/main/img/a.png");
ok("dropbox dl=0 vira raw=1", normImagem("https://www.dropbox.com/s/abc/a.png?dl=0"), "https://www.dropbox.com/s/abc/a.png?raw=1");
ok("drive vira link direto", normImagem("https://drive.google.com/file/d/1AbC_-9/view?usp=sharing"), "https://lh3.googleusercontent.com/d/1AbC_-9");
ok("link enorme é recusado", normImagem("https://a.com/" + "x".repeat(700)), "");

const h = limpa({ id: "a", titulo: "  Cartaz  ", imagem: "https://a.com/c.png", texto: "x".repeat(MAX_TEXTO + 50) });
ok("limpa corta o texto e apara o título", [h.titulo, h.texto.length], ["Cartaz", MAX_TEXTO]);
ok("vazio", vazio(limpa({})), true);
ok("só imagem não é vazio", vazio(limpa({ imagem: "https://a.com/c.png" })), false);

ok("todos", deveMostrar("todos", "u1", "PLAYER"), true);
ok("gm: jogador não vê", deveMostrar("gm", "u1", "PLAYER"), false);
ok("gm: mestre vê", deveMostrar("gm", "g", "GM"), true);
ok("lista: quem está vê", deveMostrar(["u1", "u2"], "u2", "PLAYER"), true);
ok("lista: quem não está não vê", deveMostrar(["u1"], "u2", "PLAYER"), false);
ok("lista vazia não mostra a ninguém", deveMostrar([], "u2", "PLAYER"), false);
ok("paraOf normaliza", [paraOf(undefined), paraOf("gm"), paraOf(["a", "a", "", 3, "b"])], ["todos", "gm", ["a", "b"]]);

const lib = [{ id: "1", titulo: "Cartaz de procurado", imagem: "https://a.com/p.png", texto: "RECOMPENSA" }, { id: "2", titulo: "Mapa do metrô", imagem: "https://a.com/m.png", texto: "" }];
ok("acha por nome sem acento/caixa", achaPorNome(lib, "mapa do METRO")?.id, "2");
ok("acha por parte do nome", achaPorNome(lib, "procurado")?.id, "1");
ok("nome inexistente", achaPorNome(lib, "nada"), null);
const r = resolve({ nome: "mapa do metro", texto: "Rota B marcada" }, lib);
ok("resolve: a biblioteca completa e o escrito vence", [r.id, r.titulo, r.imagem, r.texto], ["2", "Mapa do metrô", "https://a.com/m.png", "Rota B marcada"]);
ok("resolve: sem nome usa o que veio", resolve({ titulo: "Bilhete", texto: "oi" }, lib).titulo, "Bilhete");

let d = addDiario([], limpa({ titulo: "A", texto: "1" }), 1);
d = addDiario(d, limpa({ titulo: "B", texto: "2" }), 2);
d = addDiario(d, limpa({ titulo: "A", texto: "1" }), 3);
ok("diário: repetido sobe para o topo sem duplicar", d.map((x) => [x.titulo, x.quando]), [["A", 3], ["B", 2]]);
ok("diário: limite", addDiario([{ k: "x" }, { k: "y" }], limpa({ titulo: "N" }), 4, 2).length, 2);

ok("fmt escapa HTML", fmt("<script>x</script>"), "&lt;script&gt;x&lt;/script&gt;");
ok("fmt negrito, itálico e quebra", fmt("**ouro** e _prata_\nfim"), "<b>ouro</b> e <i>prata</i><br>fim");
if (bad) process.exit(1);
