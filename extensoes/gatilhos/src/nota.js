import { controls } from "./visibility.js";
// Nota de acesso negado (restrito): aberta como janela só para o jogador que tentou usar o objeto.
import OBR from "@owlbear-rodeo/sdk";
import { ID, applyTheme } from "./shared.js";

const q = new URLSearchParams(window.location.search);
document.getElementById("t").textContent = q.get("t") || "Acesso negado";
document.getElementById("m").textContent = q.get("m") || "";
const close = () => controls.modal.close(`${ID}/nota`).catch(() => {});
document.getElementById("ok").addEventListener("click", close);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" || e.key === "Enter") close(); });
OBR.onReady(async () => { applyTheme(await OBR.theme.getTheme()); });
