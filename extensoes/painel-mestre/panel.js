import OBR from "@owlbear-rodeo/sdk";
import {extensions,keyFor,observe} from "./shared/visibility.mjs";
const list = document.querySelector("#list"), status = document.querySelector("#status");
const fields = new Map();
let current = {}, role;
for (const [id,[name]] of Object.entries(extensions)) {
  const label = document.createElement("label"), select = document.createElement("select");
  select.add(new Option("Todos","all")); select.add(new Option("Só o mestre","gm"));
  label.append(name,select); fields.set(id,{label,select});
  select.onchange = async () => {
    select.disabled = true;
    const hidden = select.value === "gm";
    try {
      if (role !== "GM" || await OBR.player.getRole() !== "GM") throw Error("Acesso exclusivo do mestre.");
      await OBR.room.setMetadata({[keyFor(id)]:hidden});
      status.textContent = name + (hidden ? " ocultado dos jogadores." : " visível para os jogadores.");
    } catch(e) { select.value = current[keyFor(id)] ? "gm" : "all"; status.textContent = String(e?.message || e); }
    finally { select.disabled = false; }
  };
}
OBR.onReady(() => observe(OBR,(r,m) => {
  role = r; current = m;
  if (r !== "GM") { list.replaceChildren(); status.textContent = "Acesso exclusivo do mestre."; return; }
  for (const [id,{label,select}] of fields) {
    if (!label.isConnected) list.append(label);
    select.value = m[keyFor(id)] === true ? "gm" : "all";
  }
}).catch(e => { status.textContent = String(e); }));
