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

// 1.6.0: efeitos próprios (pasta meus-efeitos no GitHub e link direto)
import { meuNome, registerMeus, meusVisuais, registerLink, keyOf, pendingKeys, setDims, setVideo, fileOfKey } from "../src/abil.js";
ok("nome do visual a partir do arquivo", [meuNome("Chuva de Cinzas.webm"), meuNome("explosão-ROXA 2.webm")], ["meu_chuva_de_cinzas", "meu_explosao_roxa_2"]);
registerMeus([{ nome: "meu_cinzas", tipo: "area", file: "meus-efeitos/area/Cinzas.webm" }, { nome: "meu_dardo", tipo: "projetil", file: "meus-efeitos/projetil/dardo.webm" }, { nome: "ruim", tipo: "area", file: "x.webm" }]);
ok("pasta: entram só nomes meu_ válidos, no grupo Meus efeitos", [meusVisuais(), visualGroups().at(-1)], [["meu_cinzas", "meu_dardo"], ["Meus efeitos", ["meu_cinzas", "meu_dardo"]]]);
ok("dossiê aceita meu_ sem aviso", normalize({ habilidades: [{ nome: "C", forma: "area", visual: "meu_cinzas" }] }).avisos, []);
const cz = { nome: "C", forma: "area", area: 3, alcance: 9, visual: "meu_cinzas" };
ok("sem tamanho ainda: espera o vídeo abrir (não toca)", [pendingKeys(cz), buildAbility({ ab: cz, from, aim: { point: { x: 400, y: 0 } }, cell }, () => false).videos.length], [["meu:meu_cinzas"], 0]);
setDims("meu:meu_cinzas", { w: 800, h: 800, dur: 2500 });
const czv = buildAbility({ ab: cz, from, aim: { point: { x: 400, y: 0 } }, cell }, () => false).videos[0];
ok("com tamanho: toca no ponto, arquivo da pasta do site, mesmo fora do ok.json", [czv.file, czv.position, Math.round(czv.dpi), czv.dur], ["../meus-efeitos/area/Cinzas.webm", { x: 400, y: 0 }, 200, 2.5]);
ok("vídeos desligados (has = null): nada toca", buildAbility({ ab: cz, from, aim: { point: { x: 400, y: 0 } }, cell }, null).videos.length, 0);
setDims("meu:meu_dardo", { w: 1600, h: 400, dur: 1000 });
const dd = buildAbility({ ab: { ...H("Garras do Gânglio"), visual: "meu_dardo", impacto: "nenhum" }, from, aim: { targets: tg }, cell }, () => false).videos[0];
ok("projétil próprio: o vídeo inteiro vai do NPC ao alvo (começo no NPC)", [dd.file, dd.rotation, Math.round(dd.dpi), dd.offset.x], ["../meus-efeitos/projetil/dardo.webm", 0, Math.round(1600 / 1.7), 0]);
// link direto
const L = "https://exemplo.com/efeitos/Fogo%20Azul.webm";
const d3 = setVideo(d, "Vômito de Biomassa", { url: L, tipo: "cone" });
const vm = d3.habilidades.find((h) => h.nome === "Vômito de Biomassa");
ok("link guardado na habilidade e vence o visual", [vm.video, vm.visual, keyOf(vm)], [{ url: L, tipo: "cone" }, "cone_acido", `url:cone:${L}`]);
ok("link: arquivo sem %20 (o Owlbear codifica de novo)", fileOfKey(keyOf(vm)), "https://exemplo.com/efeitos/Fogo Azul.webm");
setDims(keyOf(vm), { w: 600, h: 600, dur: 3000 });
const cvl = buildAbility({ ab: vm, from, aim: { point: { x: 500, y: 0 } }, cell, selfHalf: 50 }, () => false).videos[0];
ok("cone com link: sai do NPC com o tamanho do cone", [cvl.file.startsWith("https://"), Math.round(cvl.dpi), cvl.offset.x], [true, 150, 0]);
ok("tirar o link", "video" in setVideo(d3, "Vômito de Biomassa", null).habilidades.find((h) => h.nome === "Vômito de Biomassa"), false);
ok("link inválido dá erro", (() => { try { setVideo(d, "Vômito de Biomassa", { url: "c:/x.webm", tipo: "area" }); } catch (e) { return e.message.slice(0, 20); } })(), "o link precisa começ");
ok("dossiê colado com video.url é aceito", normalize({ habilidades: [{ nome: "X", forma: "alvo", video: { url: L, tipo: "alvo" } }] }).dossie.habilidades[0].video, { url: L, tipo: "alvo" });

// 1.7.0: direção, linha até o ponto, duração
import { parseDuracao, setDuracao, duracaoText, giroOf } from "../src/abil.js";
const coneAb = (vis, pt) => buildAbility({ ab: { nome: "C", forma: "cone", area: 6, visual: vis }, from, aim: { point: pt }, cell, selfHalf: 50 }, () => true);
const down = { x: 0, y: 500 };
const cf = coneAb("cone_fogo", down).videos[0], cn = coneAb("nuvem_veneno", down).videos[0], cr = coneAb("raio_energia", down).videos[0];
ok("cone gira para onde aponta (cone, nuvem e raio)", [cf.rotation, cn.rotation, cr.rotation], [90, 90, 90]);
ok("cone com visual de ponto: um só, no meio do cone", [coneAb("nuvem_veneno", down).videos.filter((v) => v.main).length, cn.position.x, Math.round(cn.position.y)], [1, 0, 50 + Math.round(400 * 0.55)]);
const lin = (vis, pt) => buildAbility({ ab: { nome: "L", forma: "linha", area: 15, visual: vis }, from, aim: { point: pt }, cell, selfHalf: 50 }, () => true);
const lp = lin("laminas", { x: 450, y: 0 });
ok("linha com visual de ponto: um só, lançado até o ponto escolhido", [lp.videos.filter((v) => v.main).length, lp.videos[0].position, lp.videos[0].move.to, lp.videos[0].rotation], [1, { x: 50, y: 0 }, { x: 450, y: 0 }, 0]);
const le = lin("linha_eletrica", { x: 450, y: 0 }).videos[0];
ok("linha termina no ponto (não passa dele): 4 quadrados", [Math.round(le.dpi), le.rotation], [300, 0]);
ok("linha não passa do comprimento da ficha (15 m = 10 quadrados)", Math.round(lin("linha_eletrica", { x: 5000, y: 0 }).videos[0].dpi), 120);
ok("prévia/área da linha = até o ponto", Math.round(shapeOf({ forma: "linha", area: 15 }, from, { point: { x: 450, y: 0 } }, cell, 1.5, 50).len), 400);
// vídeo próprio que aponta para cima
const LU = "https://exemplo.com/cone-cima.webm";
const up = { nome: "U", forma: "cone", area: 6, video: { url: LU, tipo: "cone", giro: 270 } };
setDims(keyOf(up), { w: 400, h: 800, dur: 2000 });
const uv = buildAbility({ ab: up, from, aim: { point: { x: 500, y: 0 } }, cell, selfHalf: 50 }, () => false).videos[0];
ok("vídeo próprio que aponta para cima: gira e começa embaixo", [uv.rotation, uv.offset, Math.round(uv.dpi)], [-270, { x: 200, y: 800 }, 200]);
ok("giro aceita só 0/90/180/270", [giroOf(-90), giroOf(450), giroOf("x")], [270, 90, 0]);
ok("dossiê: aponta \"cima\" vira giro 270", normalize({ habilidades: [{ nome: "X", forma: "cone", video: { url: LU, tipo: "cone", aponta: "cima" } }] }).dossie.habilidades[0].video.giro, 270);
// duração
ok("duração: texto e números", [parseDuracao("até encerrar"), parseDuracao("30 s"), parseDuracao("2 min"), parseDuracao("uma vez"), parseDuracao(0), parseDuracao(12)], ["fim", 30, 120, null, null, 12]);
ok("duração no dossiê e no texto", [normalize({ habilidades: [{ nome: "X", forma: "area", area: 3, duracao: "loop" }] }).dossie.habilidades[0].duracao, duracaoText("fim"), duracaoText(7.5)], ["fim", "até encerrar", "7,5 s"]);
const dz = setDuracao({ habilidades: [{ nome: "N", forma: "area", area: 3, visual: "nuvem_veneno" }] }, "N", 20);
const na = buildAbility({ ab: dz.habilidades[0], from, aim: { point: { x: 300, y: 0 } }, cell }, () => true);
ok("com duração: o vídeo principal fica (persist) e sai da animação", [na.videos.length, na.persist.length, na.persist[0].loop, na.persist[0].position], [0, 1, true, { x: 300, y: 0 }]);
ok("tirar a duração", "duracao" in setDuracao(dz, "N", null).habilidades[0], false);
const lf = buildAbility({ ab: { nome: "L", forma: "linha", area: 15, visual: "laminas", duracao: "fim" }, from, aim: { point: { x: 450, y: 0 } }, cell, selfHalf: 50 }, () => true);
ok("lançado com duração: faz o caminho e fica no ponto", [lf.videos.length, lf.videos[0].move.to, lf.persist[0].position, lf.persist[0].move], [1, { x: 450, y: 0 }, { x: 450, y: 0 }, undefined]);
// efeito do Gatilhos (sem origem): fica em cima de cada alvo
const fxg = buildAbility({ ab: { nome: "G", forma: "alvo", visual: "linha_fogo", tamanho: 2 }, semOrigem: true, from: { x: 300, y: 300 }, aim: { targets: [{ id: "a", at: { x: 300, y: 300 }, half: 50 }, { id: "b", at: { x: 600, y: 0 }, half: 50 }] }, cell }, () => true);
ok("efeito sem origem: um em cada alvo, no tamanho pedido", [fxg.videos.length, fxg.videos.map((v) => v.position), Math.round(fxg.videos[0].dpi)], [2, [{ x: 300, y: 300 }, { x: 600, y: 0 }], 600]);
const fxs = buildAbility({ ab: { nome: "G", forma: "alvo", visual: "linha_fogo" }, from: { x: 0, y: 0 }, aim: { targets: [{ id: "b", at: { x: 0, y: 600 }, half: 50 }] }, cell }, () => true).videos[0];
ok("linha num alvo: o efeito inteiro sai do NPC e chega no alvo", [fxs.rotation, Math.round(fxs.dpi)], [90, Math.round(1200 / 5.7)]);
