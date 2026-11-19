import { fromItem, fromDownload, variantsOf, currentIndex, addVariants, resolve, applyVariant, variantFor, namesIn, KEY } from "../src/core.js";
const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v));

const img = (url, extra = {}) => ({ id: "t", type: "IMAGE", name: "Rex", position: { x: 10, y: 20 }, rotation: 45, scale: { x: 2, y: 2 },
  image: { url, width: 300, height: 300, mime: "image/png" }, grid: { dpi: 300, offset: { x: 150, y: 150 } }, metadata: {}, ...extra });
const a = { id: "a", name: "Normal", url: "u/normal.png", mime: "image/png", w: 300, h: 300, dpi: 300, offset: { x: 150, y: 150 } };
const b = { id: "b", name: "Ferido", url: "u/ferido.png", mime: "image/png", w: 512, h: 512, dpi: 256, offset: { x: 256, y: 256 } };
const c = { id: "c", name: "Disfarçado", url: "u/disfarce.webm", mime: "video/webm", w: 400, h: 400, dpi: 400, offset: { x: 200, y: 220 } };
const tok = img("u/normal.png", { metadata: { [KEY]: [a, b, c] } });

ok("imagem do próprio token", (({ id, ...r }) => r)(fromItem(img("u/x.png"), "Original")), { name: "Original", url: "u/x.png", mime: "image/png", w: 300, h: 300, dpi: 300, offset: { x: 150, y: 150 } });
ok("imagem do seletor do Owlbear", (({ id, ...r }) => r)(fromDownload({ name: "Lobo", image: { url: "u/l.png", width: 10, height: 20, mime: "image/png" }, grid: { dpi: 10, offset: { x: 5, y: 10 } } })).name, "Lobo");
ok("atual = pela URL", currentIndex(tok), 0);
ok("arte fora da lista = -1", currentIndex(img("u/outra.png", { metadata: { [KEY]: [a, b] } })), -1);
ok("próxima", resolve(tok, "next").name, "Ferido");
ok("anterior dá a volta", resolve(tok, "prev").name, "Disfarçado");
ok("pelo nome, sem acento e maiúscula", resolve(tok, "disfarcado").id, "c");
ok("pelo id", resolve(tok, "b").name, "Ferido");
ok("nome que não existe", resolve(tok, "zumbi"), null);
ok("token sem lista", resolve(img("u/x.png"), "next"), null);
ok("não repete URL", addVariants([a], [{ ...a, id: "z" }, b]).map((v) => v.id), ["a", "b"]);

const d = JSON.parse(JSON.stringify(tok));
applyVariant(d, c);
ok("troca arte, tamanho, mime e grade", [d.image.url, d.image.width, d.image.mime, d.grid.dpi, d.grid.offset], ["u/disfarce.webm", 400, "video/webm", 400, { x: 200, y: 220 }]);
ok("não mexe em posição, escala, rotação nem nome", [d.position, d.scale, d.rotation, d.name], [{ x: 10, y: 20 }, { x: 2, y: 2 }, 45, "Rex"]);
applyVariant(d, b, true);
ok("renomear quando pedido", d.name, "Ferido");

const outro = img("u/g.png", { metadata: { [KEY]: [{ ...b, id: "x", url: "u/guarda-ferido.png" }] } });
ok("vários tokens: cada um usa a sua imagem de mesmo nome", variantFor(outro, b).url, "u/guarda-ferido.png");
ok("vários tokens: quem não tem recebe a escolhida", variantFor(img("u/z.png"), b).url, "u/ferido.png");
ok("nomes na cena (sem repetir)", namesIn([tok, outro]), ["Normal", "Ferido", "Disfarçado"]);
