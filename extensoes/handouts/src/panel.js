import "./visibility.js";
// Painel: o mestre monta e mostra handouts e guarda a biblioteca; todos leem o diário do que já viram.
import OBR from "@owlbear-rodeo/sdk";
import { BIB, CH_MOSTRAR, uid, lerDiario, gravarDiario, applyTheme } from "./shared.js";
import { esc, limpa, vazio, normImagem, MAX_BIB } from "./core.js";

const $ = (id) => document.getElementById(id);
let role = "PLAYER", sala = "", lib = [], editId = "", players = [];

const lerForm = () => limpa({ id: editId, titulo: $("f-titulo").value, imagem: $("f-img").value, texto: $("f-texto").value });
const nota = (t, aviso) => { $("nota").textContent = t; $("nota").className = aviso ? "why" : ""; };
const enviar = (h, para, destino = "ALL") => OBR.broadcast.sendMessage(CH_MOSTRAR, { ...h, para }, { destination: destino });

function previa() {
  const u = normImagem($("f-img").value);
  const box = $("prevbox"), im = $("prev"), er = $("preverro");
  box.hidden = !u; er.hidden = true; im.hidden = false;
  if (!u) { if ($("f-img").value.trim()) { box.hidden = false; im.hidden = true; er.hidden = false; er.textContent = "O link precisa começar com http:// ou https://"; } return; }
  im.referrerPolicy = "no-referrer";
  im.onerror = () => { im.hidden = true; er.hidden = false; er.textContent = "Não consegui abrir essa imagem: o link precisa ser direto para o arquivo (.png, .jpg, .webp) e estar aberto a qualquer pessoa."; };
  im.onload = () => { er.hidden = true; im.hidden = false; };
  if (im.src !== u) im.src = u;
}

function marcados() { return [...document.querySelectorAll("[data-jog]:checked")].map((c) => c.dataset.jog); }
function desenhaJogadores() {
  $("jogadores").innerHTML = players.length
    ? players.map((p) => `<label class="check"><input type="checkbox" data-jog="${esc(p.id)}"> ${esc(p.name || "Jogador")}</label>`).join("")
    : '<small>Nenhum jogador na sala agora.</small>';
}

const linhaBib = (h) => `<div class="mrow">${h.imagem ? `<img class="thumb" loading="lazy" referrerpolicy="no-referrer" src="${esc(h.imagem)}" alt="">` : '<span class="thumb vazio">📄</span>'}
  <span class="mname" title="${esc(h.titulo)}">${esc(h.titulo || "(sem título)")}<small>${h.imagem ? "imagem" : "só texto"}${h.texto.trim() ? " · texto" : ""}</small></span>
  <button type="button" class="mini primary" data-bshow="${h.id}" title="Mostrar para todos">▶</button>
  <button type="button" class="mini" data-bedit="${h.id}" title="Carregar no formulário (para editar ou mostrar a alguns)">✎</button>
  <button type="button" class="mini danger" data-bdel="${h.id}" title="Apagar da biblioteca">✕</button></div>`;

function desenhaBib() {
  $("nbib").textContent = lib.length;
  $("bib").innerHTML = lib.length ? lib.map(linhaBib).join("") : "<small>Nada guardado ainda. Monte um handout acima e guarde para reusar.</small>";
  for (const b of $("bib").querySelectorAll("[data-bshow]")) b.addEventListener("click", () => { const h = lib.find((x) => x.id === b.dataset.bshow); if (h) enviar(h, "todos"); });
  for (const b of $("bib").querySelectorAll("[data-bedit]")) b.addEventListener("click", () => { const h = lib.find((x) => x.id === b.dataset.bedit); if (h) carrega(h); });
  for (const b of $("bib").querySelectorAll("[data-bdel]")) b.addEventListener("click", async () => { await salvaBib(lib.filter((x) => x.id !== b.dataset.bdel)); if (editId === b.dataset.bdel) novo(); });
}
function carrega(h) { editId = h.id; $("f-titulo").value = h.titulo; $("f-img").value = h.imagem; $("f-texto").value = h.texto; $("b-novo").hidden = false; nota(""); previa(); }
function novo() { editId = ""; $("f-titulo").value = ""; $("f-img").value = ""; $("f-texto").value = ""; $("b-novo").hidden = true; nota(""); previa(); }
async function salvaBib(next) { lib = next.slice(-MAX_BIB); await OBR.room.setMetadata({ [BIB]: lib }); desenhaBib(); }

function desenhaDiario() {
  const d = lerDiario(sala);
  $("ndia").textContent = d.length;
  $("dia").innerHTML = d.length ? d.map((h) => `<div class="mrow">${h.imagem ? `<img class="thumb" loading="lazy" referrerpolicy="no-referrer" src="${esc(h.imagem)}" alt="">` : '<span class="thumb vazio">📄</span>'}
    <button type="button" class="mname lnk" data-dler="${esc(h.k)}" title="Ler de novo">${esc(h.titulo || "(sem título)")}<small>${new Date(h.quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></button>
    <button type="button" class="mini danger" data-ddel="${esc(h.k)}" title="Tirar do diário">✕</button></div>`).join("") : "<small>Nada ainda.</small>";
  for (const b of $("dia").querySelectorAll("[data-dler]")) b.addEventListener("click", () => { const h = lerDiario(sala).find((x) => x.k === b.dataset.dler); if (h) OBR.broadcast.sendMessage(CH_MOSTRAR, { ...h, para: "todos", sem_diario: true }, { destination: "LOCAL" }); });
  for (const b of $("dia").querySelectorAll("[data-ddel]")) b.addEventListener("click", () => { gravarDiario(sala, lerDiario(sala).filter((x) => x.k !== b.dataset.ddel)); desenhaDiario(); });
}

function ligaGM() {
  $("gm").hidden = false;
  for (const id of ["f-img"]) $(id).addEventListener("input", previa);
  $("b-todos").addEventListener("click", () => { const h = lerForm(); if (vazio(h)) return nota("Escreva um título, um texto ou ponha um link de imagem.", true); enviar(h, "todos"); nota("Mostrado para todos."); });
  $("b-eu").addEventListener("click", () => { const h = lerForm(); if (vazio(h)) return nota("Escreva um título, um texto ou ponha um link de imagem.", true); OBR.broadcast.sendMessage(CH_MOSTRAR, { ...h, para: "todos", sem_diario: true }, { destination: "LOCAL" }); });
  $("b-sel").addEventListener("click", () => {
    const h = lerForm(), ids = marcados();
    if (vazio(h)) return nota("Escreva um título, um texto ou ponha um link de imagem.", true);
    if (!ids.length) return nota("Marque ao menos um jogador.", true);
    enviar(h, ids); nota(`Mostrado para ${ids.length} jogador${ids.length > 1 ? "es" : ""}.`);
  });
  $("b-guardar").addEventListener("click", async () => {
    const h = lerForm();
    if (vazio(h)) return nota("Nada para guardar.", true);
    if (!h.titulo) return nota("Dê um título: é o nome que o Gatilhos e o Inventário usam para achar este handout.", true);
    const e = { ...h, id: editId || uid() };
    editId = e.id; $("b-novo").hidden = false;
    await salvaBib(lib.some((x) => x.id === e.id) ? lib.map((x) => (x.id === e.id ? e : x)) : [...lib, e]);
    nota("Guardado na biblioteca.");
  });
  $("b-novo").addEventListener("click", novo);
  $("quem").addEventListener("toggle", async () => { if ($("quem").open) { players = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role !== "GM"); desenhaJogadores(); } });
  desenhaJogadores(); desenhaBib();
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  OBR.theme.onChange(applyTheme);
  role = await OBR.player.getRole();
  sala = OBR.room.id || "";
  const md = await OBR.room.getMetadata();
  lib = Array.isArray(md[BIB]) ? md[BIB] : [];
  OBR.room.onMetadataChange((m) => { lib = Array.isArray(m[BIB]) ? m[BIB] : []; if (role === "GM") desenhaBib(); });
  if (role === "GM") ligaGM(); else $("diahint").textContent = "Tudo o que o mestre mostrou para você fica aqui; clique para ler de novo.";
  desenhaDiario();
  window.addEventListener("storage", desenhaDiario);
  setInterval(desenhaDiario, 4000); // o segundo plano grava em outro documento; o evento "storage" cobre a maioria dos casos
});
