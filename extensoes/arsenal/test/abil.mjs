import { readFileSync } from "fs";
import { normalize, extractJson, VISUAIS, canUse, markUse, recharge, newRound, rest, legCost, numbers, shapeText, shapeOf, caughtIn, buildAbility, abilFiles } from "../src/abil.js";
import { allFiles } from "../src/jb2a.js";
const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v));
const raw = readFileSync(new URL("./saciado.json", import.meta.url), "utf8");

// a lista de visuais do prompt (PARTE 2) é exatamente a da extensão
const PROMPT = "garra mordida soco arma_corte arma_impacto arma_perfuracao pinca bala flecha projetil_fogo raio_gelo raio_energia raio_eletrico raio_luz raio_sombra misseis esfera arremesso cone_fogo cone_gelo cone_acido cone_veneno cone_eletrico cone_vento linha_eletrica linha_fogo linha_energia explosao_fogo explosao onda_choque estilhaco tempestade_raios chuva_gelo nevoa escuridao teia vinhas lodo laminas coluna_luz fenda_chao aura_espiritos aura_tentaculos aura_sombra aura_fogo aura_eletrica rugido giro cura escudo bencao marca_alvo golpe_divino teleporte fumaca transformacao regeneracao morcegos investida salto rastro borboletas revoada_borboletas borboletas_laranja petalas folhas rajada_folhas penas fadas vagalumes plantas espinhos sangue jorro_sangue sangramento chuva_sangue coracoes encanto caveira caveiras medo marca_veneno nuvem_veneno atordoado correntes musica notas_musicais olhos vortice portal circulo_magico runas poder bolha fogos_artificio lava espinhos_gelo respingo_agua cartas bola_neve flecha_sangue flecha_arcana lanca rajada_ar raio_hipnotico espiral_hipnotica tornado_fogo chao_chamas explosao_arcana explosao_sangue cratera sinalizador laminas_mecanicas mao_arcana moeda escudo_fogo engrenagens corrente_puxao fenda_linha muro_fogo".split(" ");
ok("visuais do prompt = visuais da extensão", [PROMPT.filter((v) => !VISUAIS.includes(v)), VISUAIS.filter((v) => !PROMPT.includes(v))], [[], []]);
ok("vídeos das habilidades entram no download", abilFiles().every((f) => allFiles().includes(f)), true);

// colar o bloco inteiro (com ```json) funciona
const { dossie: d, avisos } = normalize("Aqui está:\n```json\n" + raw + "\n```\nfim");
ok("Saciado: 15 habilidades, 3 lendárias, sem avisos", [d.habilidades.length, d.lendarias, avisos], [15, 3, []]);
const H = (n) => d.habilidades.find((h) => h.nome === n);
ok("números para o mestre rolar", numbers(H("Vômito de Biomassa")), "resistência DES 16 (metade no sucesso) · 6d8 ácido · Impedido (Escapar CD 16); -1 de Mitigação até o fim do combate");
ok("forma em palavras", [shapeText(H("Vômito de Biomassa")), shapeText(H("Garras do Gânglio")), shapeText(H("Rugido de Sangue"))], ["cone de 6 m", "1 alvo, 3 m", "9 m em volta"]);
ok("aviso de visual inexistente", normalize({ habilidades: [{ nome: "X", visual: "dragao_rosa" }] }).avisos[0], "X: visual \"dragao_rosa\" não existe na lista (ficou sem vídeo).");
ok("JSON quebrado dá erro claro", (() => { try { extractJson("nada aqui"); } catch (e) { return e.message.slice(0, 17); } })(), "não achei um JSON");

// contadores (o mestre rola a recarga no d6 da ficha e marca no painel)
let u = {};
const fr = H("Frenesi da Carnificina"), bq = H("Banquete Canibal"), rug = H("Rugido de Sangue"), gp = H("Golpe Pesado");
u = markUse(fr, u, d).uso;
ok("recarga usada fica bloqueada", canUse(fr, u, d), { ok: false, why: "usada (recarga 5-6)" });
ok("marcar que recarregou", canUse(fr, recharge(fr, u), d).ok, true);
u = markUse(bq, u, d).uso;
ok("1/descanso volta só no descanso", [canUse(bq, newRound(u), d).ok, canUse(bq, rest(u), d).ok], [false, true]);
ok("custo das lendárias", [legCost(rug), legCost(gp)], [2, 1]);
u = markUse(rug, u, d).uso; u = markUse(gp, u, d).uso;
ok("3 lendárias gastas: não sobra para mais nenhuma", [u.leg, canUse(gp, u, d).why], [3, "faltam ações lendárias (0/3)"]);
ok("nova rodada devolve as lendárias", canUse(rug, newRound(u), d).ok, true);
const lodo = H("Válvula de Lodo Tóxico");
const r1 = markUse(lodo, u, d); const r2 = markUse(lodo, r1.uso, d);
ok("covil repetido em seguida avisa", [r1.aviso, r2.aviso.slice(0, 22)], ["", "Válvula de Lodo Tóxico"]);

// geometria: cone de 6 m (4 quadrados de 1,5 m) para a direita
const cell = 100, from = { x: 0, y: 0 };
const cone = shapeOf(H("Vômito de Biomassa"), from, { point: { x: 500, y: 0 } }, cell, 1.5, 50);
const toks = [{ id: "na_frente", at: { x: 250, y: 0 }, half: 50 }, { id: "na_borda", at: { x: 400, y: 160 }, half: 50 }, { id: "atras", at: { x: -200, y: 0 }, half: 50 }, { id: "fora", at: { x: 250, y: 300 }, half: 50 }];
ok("quem fica no cone", caughtIn(cone, toks), ["na_frente", "na_borda"]);
const aura = shapeOf(H("Rugido de Sangue"), from, {}, cell, 1.5, 50);
ok("aura de 9 m pega tudo a 6 quadrados (menos ele)", caughtIn(aura, [...toks, { id: "eu", at: from, half: 50 }], ["eu"]).length, 4);
const linha = shapeOf(H("Ganchos e Correntes"), from, { point: { x: 0, y: 900 } }, cell, 1.5, 50);
ok("linha de 12 m para baixo, 1 quadrado de largura", caughtIn(linha, [{ id: "a", at: { x: 0, y: 600 }, half: 50 }, { id: "b", at: { x: 150, y: 600 }, half: 50 }]), ["a"]);

// animação: toda habilidade do Saciado gera vídeo
const byName = (n) => H(n);
const tg = [{ id: "rex", at: { x: 200, y: 0 }, half: 50 }];
const res = d.habilidades.map((h) => [h.nome, buildAbility({ ab: h, from, aim: { targets: tg, point: { x: 400, y: 0 } }, cell, mpc: 1.5, selfHalf: 50 }, () => true, byName).videos.length]);
ok("toda habilidade tem vídeo", res.filter(([, n]) => !n).map(([n]) => n), []);
const multi = buildAbility({ ab: H("Ataque Múltiplo"), from, aim: { targets: tg }, cell }, () => true, byName);
ok("ataque múltiplo: 2 garras + 2 sangues, em sequência", [multi.videos.length, multi.videos[2].t0 > multi.videos[0].t0], [4, true]);
const cv = buildAbility({ ab: H("Vômito de Biomassa"), from, aim: { point: { x: 500, y: 0 } }, cell, selfHalf: 50 }, () => true);
ok("cone: o vídeo sai do atacante na direção certa e com o tamanho da área", [Math.round(cv.videos[0].dpi), cv.videos[0].rotation, cv.videos[0].offset.x, cv.elements.length], [150, 0, 0, 1]);

// trocar o visual de uma habilidade (painel 🎨) e a lista de visuais
import { visualGroups, previewFile, setVisual } from "../src/abil.js";
const grupos = visualGroups();
ok("lista: todo visual está em um grupo, uma vez", grupos.flatMap(([, l]) => l).sort(), [...VISUAIS].sort());
ok("lista: todo visual tem vídeo de prévia que entra no download", VISUAIS.filter((v) => !allFiles().includes(previewFile(v))), []);
const d2 = setVisual(d, "Vômito de Biomassa", "cone_fogo");
ok("trocar visual muda só aquela habilidade", [d2.habilidades.find((h) => h.nome === "Vômito de Biomassa").visual, H("Vômito de Biomassa").visual, d2.habilidades.length], ["cone_fogo", "cone_acido", 15]);
ok("sem vídeo tira o campo", "visual" in setVisual(d, "Garras do Gânglio", "").habilidades.find((h) => h.nome === "Garras do Gânglio"), false);
ok("visual inexistente dá erro", (() => { try { setVisual(d, "Garras do Gânglio", "dragao_rosa"); } catch (e) { return e.message; } })(), "visual \"dragao_rosa\" não existe.");
const trocado = buildAbility({ ab: d2.habilidades.find((h) => h.nome === "Vômito de Biomassa"), from, aim: { point: { x: 500, y: 0 } }, cell, selfHalf: 50 }, () => true);
ok("o vídeo novo é o que toca", trocado.videos[0].file.includes("Fire01"), true);

// 1.5.2: visuais novos (borboletas, pétalas, sangue...)
ok("100 visuais (+20 do BLFX)", VISUAIS.length, 120);
const jorro = buildAbility({ ab: { ...H("Garras do Gânglio"), visual: "jorro_sangue", impacto: "nenhum" }, from, aim: { targets: tg }, cell }, () => true);
ok("jorro de sangue sai do alvo na direção do golpe", [jorro.videos[0].rotation, jorro.videos[0].offset.x, jorro.videos[0].position], [0, 72, { x: 200, y: 0 }]);
const pet = buildAbility({ ab: { nome: "P", forma: "area", area: 3, alcance: 9, visual: "petalas" }, from, aim: { point: { x: 400, y: 0 } }, cell }, () => true);
ok("pétalas numa área de 3 m (raio 2 quadrados)", [pet.videos[0].file.includes("Pink"), pet.videos[0].position, Math.round(pet.videos[0].dpi)], [true, { x: 400, y: 0 }, 100]);
const cartas = buildAbility({ ab: { ...H("Garras do Gânglio"), visual: "cartas", impacto: "nenhum" }, from, aim: { targets: [{ id: "x", at: { x: 600, y: 0 }, half: 50 }] }, cell }, () => true);
ok("cartas: projétil de 6 quadrados usa o vídeo de 30 ft", cartas.videos[0].file.includes("_30ft_"), true);

// 1.5.3: Boss Loot FX (BLFX): segunda fonte de vídeos, baixada para jb2a/BLFX/
const blfx = abilFiles().filter((f) => f.startsWith("BLFX/"));
ok("BLFX: 39 vídeos, todos com caminho da pasta artwork", [blfx.length, blfx.every((f) => /^BLFX\/0\d-/.test(f))], [39, true]);
const muro = buildAbility({ ab: { nome: "M", forma: "linha", area: 9, visual: "muro_fogo" }, from, aim: { point: { x: 0, y: 900 } }, cell, selfHalf: 50 }, () => true);
ok("muro de fogo estica na linha (9 m = 6 quadrados, para baixo)", [muro.videos[0].rotation, Math.round(muro.videos[0].dpi), muro.videos[0].position], [90, 200, { x: 0, y: 50 }]);
