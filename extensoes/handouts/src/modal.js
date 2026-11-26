import { controls } from "./visibility.js";
// Janela que mostra um handout: título, imagem (clique alterna entre ajustar e tamanho real) e texto.
import OBR from "@owlbear-rodeo/sdk";
import { MODAL_ID, ATUAL, applyTheme } from "./shared.js";
import { fmt, limpa } from "./core.js";

const $ = (id) => document.getElementById(id);
let h = limpa({});
try { h = limpa(JSON.parse(localStorage.getItem(ATUAL) || "{}")); } catch { /* vazio */ }

$("t").textContent = h.titulo || "Documento";
$("txt").innerHTML = fmt(h.texto);
$("txt").hidden = !h.texto.trim();
if (h.imagem) {
  const f = $("foto");
  $("img").hidden = false;
  f.referrerPolicy = "no-referrer";
  f.onerror = () => { f.hidden = true; const er = $("erro"); er.hidden = false; er.textContent = "Não consegui abrir a imagem (o link quebrou, foi apagado ou não é direto para o arquivo)."; };
  f.onclick = () => $("img").classList.toggle("real");
  f.title = "Clique para alternar entre ajustar à janela e tamanho real";
  f.src = h.imagem;
}
const close = () => controls.modal.close(MODAL_ID).catch(() => OBR.modal.close(MODAL_ID).catch(() => {}));
$("ok").addEventListener("click", close);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
OBR.onReady(async () => { applyTheme(await OBR.theme.getTheme()); });
