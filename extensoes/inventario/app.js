import "./compact.js";
import { setupEditing } from "./editing.js";
import OBR, { buildImage, buildImageUpload } from "@owlbear-rodeo/sdk";

const $ = selector => document.querySelector(selector);
const categories = {unset:"Sem categoria", weapon:"Equipamento (armas)", quest:"Item de quest", decor:"Elemento de cenário"};
const pageSize = 30;
let layer = "PROP", limit = pageSize, rows = [], database;
const status = message => { $("#status").textContent = message; };

function options(select) {
  for (const [key, label] of Object.entries(categories)) select.add(new Option(label, key));
}
options($("#filter"));

function openInventory(player) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("inventario-obr-" + player, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("pieces", {keyPath:"key"});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transaction(mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction("pieces", mode);
    const request = operation(tx.objectStore("pieces"));
    tx.oncomplete = () => resolve(request?.result);
    tx.onabort = () => reject(tx.error);
  });
}
async function reload() {
  rows = await transaction("readonly", store => store.getAll());
  rows.sort((a,b) => a.name.localeCompare(b.name,"pt-BR"));
  render();
}
function action(button, callback) {
  button.onclick = async () => {
    button.disabled = true;
    try { await callback(); }
    catch (e) { status("Não foi possível concluir. " + (e.message || "Tente novamente.")); }
    finally { button.disabled = false; }
  };
}
async function place(piece) {
  if (!await OBR.scene.isReady()) return status("Abra uma cena para colocar a peça.");
  const [width,height] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  const position = await OBR.viewport.inverseTransformPoint({x:width/2, y:height/2});
  const builder = buildImage(piece.image,piece.grid).name(piece.name).layer(piece.type)
    .position(position).scale(piece.scale).rotation(piece.rotation);
  if (piece.type === "ATTACHMENT") {
    const selection = await OBR.player.getSelection();
    if (selection?.length !== 1) return status("Selecione um único objeto na cena para receber o Attachment.");
    const [parent] = await OBR.scene.items.getItems(selection);
    if (!parent) return status("Selecione um objeto disponível na cena.");
    builder.attachedTo(parent.id).position(parent.position);
  }
  await OBR.scene.items.addItems([builder.build()]);
  status(piece.name + " na cena.");
}
function render() {
  const category = $("#filter").value;
  const filtered = rows.filter(p => p.type === layer && (!category || p.category === category));
  const list = $("#list"); list.replaceChildren();
  for (const piece of filtered.slice(0,limit)) {
    const li = document.createElement("li");
    const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; img.src = piece.image.url;
    const info = document.createElement("article"), title = document.createElement("strong");
    title.textContent = piece.name;
    const select = document.createElement("select"); options(select); select.value = piece.category;
    select.setAttribute("aria-label","Categoria de " + piece.name);
    select.onchange = async () => {
      const category = select.value;
      try { await transaction("readwrite", store => store.put({...piece, category})); await reload(); }
      catch { select.value = piece.category; status("Não foi possível salvar a categoria."); }
    };
    info.append(title,select);
    const add = document.createElement("button"); add.textContent = piece.type === "PROP" ? "Colocar" : "Anexar";
    action(add, () => place(piece));
    li.append(img, info, add); list.append(li);
  }
  $("#empty").textContent = filtered.length ? "" : category ? "Nenhuma peça nesta categoria." : "Adicione peças da sua coleção ou do dispositivo.";
  $("#more").hidden = filtered.length <= limit;
}
for (const tab of document.querySelectorAll("[data-type]")) tab.onclick = () => {
  layer = tab.dataset.type;
  for (const other of document.querySelectorAll("[data-type]")) other.setAttribute("aria-pressed",String(other === tab));
  limit = pageSize; render();
};
$("#filter").onchange = () => { limit = pageSize; render(); };
$("#more").onclick = () => { limit += pageSize; render(); };
async function choosePieces(selectedLayer, search = "") {
  const assets = await OBR.assets.downloadImages(true, search, selectedLayer);
  if (!assets?.length) return status("Seleção encerrada. Use Da minha coleção para escolher peças.");
  const count = await savePieces(assets);
  status(count ? "Seleção salva. Cada peça aparece na aba do seu tipo." : "Escolha Props ou Attachments.");
}
async function savePieces(assets) {
  let count = 0;
  await transaction("readwrite", store => {
    for (const asset of assets) {
      if (!["PROP","ATTACHMENT"].includes(asset.type)) continue;
      const {image, grid, name, scale, rotation, type} = asset;
      const key = JSON.stringify([type,name,image.url]);
      const lookup = store.get(key);
      lookup.onsuccess = () => {
        store.put({key, image, grid, name, scale, rotation, type, category:lookup.result?.category || "unset"});
        count++;
      };
    }
  });
  await reload();
  return count;
}
action($("#import"), () => choosePieces(layer));

const filesInput = $("#files");
let uploadLayer;
$("#upload").onclick = () => {
  uploadLayer = layer;
  filesInput.click();
};
filesInput.onchange = async () => {
  const files = Array.from(filesInput.files);
  filesInput.value = "";
  if (!files.length) return;
  const type = uploadLayer;
  $("#upload").disabled = true;
  $("#import").disabled = true;
  try {
    status("Escolha a pasta de destino no Owlbear. Depois, selecione as peças para o inventário.");
    const uploads = [];
    for (const file of files) {
      const copy = new File([await file.arrayBuffer()], file.name, {type:file.type});
      uploads.push(buildImageUpload(copy).build());
    }
    await OBR.assets.uploadImages(uploads, type);
    status("Selecione as peças da sua coleção para concluir.");
    await choosePieces(type);
  } catch (error) {
    status("Importação interrompida. Se o arquivo já estiver no Owlbear, use Da minha coleção. " + (error.message || ""));
  } finally {
    $("#upload").disabled = false;
    $("#import").disabled = false;
  }
};
OBR.onReady(async () => {
  try {
    setupEditing(OBR, savePieces, status);
    database = await openInventory(await OBR.player.getId());
    await reload(); $("#import").disabled = false; $("#upload").disabled = false; status("");
  } catch { status("O navegador não permitiu abrir o inventário local."); }
});
