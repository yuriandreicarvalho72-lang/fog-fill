import { controls } from "./visibility.js";
// Segundo plano de todos os jogadores: recebe "mostrar", guarda no diário e abre a janela com a imagem e o texto.
import OBR from "@owlbear-rodeo/sdk";
import { CH_MOSTRAR, BIB, MODAL_ID, ATUAL, url, lerDiario, gravarDiario } from "./shared.js";
import { resolve, vazio, deveMostrar, addDiario } from "./core.js";

let myId = "", role = "PLAYER", sala = "";

async function abrir(h) {
  try { localStorage.setItem(ATUAL, JSON.stringify(h)); } catch { /* sem armazenamento: usa o aviso abaixo */ }
  await controls.modal.close(MODAL_ID).catch(() => {}); // fecha a anterior para a nova recarregar
  try { await controls.modal.open({ id: MODAL_ID, url: url("modal.html"), width: 560, height: 640 }); }
  catch (e) { console.warn("[handouts] janela", e); OBR.notification.show(`Handout: ${h.titulo || "novo documento"}${h.texto ? ` — ${h.texto.slice(0, 120)}` : ""}`, "INFO"); }
}

OBR.onReady(async () => {
  myId = await OBR.player.getId().catch(() => "");
  role = await OBR.player.getRole().catch(() => "PLAYER");
  sala = OBR.room.id || "";
  OBR.player.onChange((p) => { role = p.role; });

  OBR.broadcast.onMessage(CH_MOSTRAR, async (e) => {
    const d = e.data || {};
    if (!deveMostrar(d.para, myId, role)) return;
    const lib = (await OBR.room.getMetadata().catch(() => ({})))[BIB];
    const h = resolve(d, Array.isArray(lib) ? lib : []);
    if (vazio(h)) {
      if (role === "GM" && d.origem) OBR.notification.show(`Handout (${d.origem}): não achei "${d.nome || ""}" na biblioteca e não há título, imagem nem texto.`, "WARNING");
      return;
    }
    if (!d.sem_diario) gravarDiario(sala, addDiario(lerDiario(sala), h, Date.now()));
    await abrir(h);
  });
});
