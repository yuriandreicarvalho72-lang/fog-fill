import "./visibility.js";
import "./compact.js";
import {deleteButton, setupCompendium} from "./compendium.js";
import {reason} from "./errors.js";
import { setupEditing } from "./editing.js";
import OBR, { buildImage, buildImageUpload } from "@owlbear-rodeo/sdk";

const $ = selector => document.querySelector(selector);
const categories = {unset:"Sem categoria", weapon:"Equipamento (armas)", quest:"Item de quest", decor:"Elemento de cenário"};
const pageSize = 30;
let layer = "PROP", limit = pageSize, rows = [], database;
const INV_META = "fog-fill.inventario/itens"; // nomes do inventário, no metadado do jogador (o Gatilhos lê no Restrito)
const norm = text => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
let effectNames = [];
async function publish() {
  try { await OBR.player.setMetadata({[INV_META]: rows.map(row => String(row.name || "").slice(0, 60)).slice(0, 80)}); } catch { /* fora da sala */ }
}
const hasEffect = piece => effectNames.some(name => name && (name === norm(piece.name) || norm(piece.name).includes(name) || name.includes(norm(piece.name))));
const status = message => { $("#status").textContent = message; };

function options(select) {
  for (const [key, label] of Object.entries(categories)) select.add(new Option(label, key));
}
options($("#filter"));

function openInventory(player) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("inventario-obr-" + player, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("pieces")) request.result.createObjectStore("pieces", {keyPath:"key"});
      request.result.createObjectStore("files");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transaction(mode, operation, stores = ["pieces"]) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(stores, mode);
    const request = operation(tx.objectStore(stores[0]), tx);
    tx.oncomplete = () => resolve(request?.result);
    tx.onabort = () => reject(tx.error);
  });
}
async function reload() {
  rows = await transaction("readonly", store => store.getAll());
  rows.sort((a,b) => a.name.localeCompare(b.name,"pt-BR"));
  render();
  publish();
}
function action(button, callback) {
  button.onclick = async () => {
    button.disabled = true;
    try { await callback(); }
    catch (e) { status("Não foi possível concluir. " + reason(e)); }
    finally { button.disabled = false; }
  };
}
async function place(piece) {
  if (piece.local) {
    const file = await transaction("readonly", files => files.get(piece.key), ["files"]);
    if (!file) throw Error("Arquivo local indisponível. Importe a imagem novamente.");
    status("Escolha a pasta do Owlbear e depois selecione a mesma imagem para vinculá-la à peça.");
    await OBR.assets.uploadImages([buildImageUpload(new File([await file.arrayBuffer()], file.name, {type:file.type})).build()], piece.type);
    const [asset] = await OBR.assets.downloadImages(false, undefined, piece.type);
    if (!asset) return status("A peça continua guardada. Você pode vinculá-la depois.");
    if (asset.type !== piece.type || !asset.image?.url) throw Error("Escolha uma imagem do mesmo tipo da peça.");
    const linked = {...piece, ...asset, local:false};
    await transaction("readwrite", (pieces, tx) => {
      pieces.put(linked);
      tx.objectStore("files").delete(piece.key);
    }, ["pieces","files"]);
    await reload();
    piece = linked;
  }
  if (!await OBR.scene.isReady()) return status("Abra uma cena para colocar a peça.");
  const [width,height] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  const position = await OBR.viewport.inverseTransformPoint({x:width/2, y:height/2});
  const builder = buildImage(piece.image,piece.grid).name(piece.name).layer(piece.type)
    .position(position).scale(piece.scale).rotation(piece.rotation);
  if (piece.campaignId) builder.metadata({"fog-fill.inventario/origem":piece.campaignId});
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
let view = "gallery", selectedKey = null;
const viewKey = "fog-fill.inventario/view";
try { if (localStorage.getItem(viewKey) === "list") view = "list"; } catch {}
const thumbnailUrls = new Set();

function thumbnail(piece) {
  const frame = document.createElement("span");
  frame.className = "thumbnail";
  const img = document.createElement("img");
  img.alt = "";
  img.loading = "lazy";
  function fallback() { frame.textContent = "Sem prévia"; }
  img.onerror = fallback;
  frame.append(img);
  if (piece.local) {
    transaction("readonly", files => files.get(piece.key), ["files"]).then(file => {
      if (!frame.isConnected) return;
      if (!file) return fallback();
      const url = URL.createObjectURL(file);
      thumbnailUrls.add(url);
      img.src = url;
    }).catch(fallback);
  } else if (piece.image?.url) img.src = piece.image.url;
  else fallback();
  return frame;
}

function render() {
  const category = $("#filter").value;
  const filtered = rows.filter(p => p.type === layer && (!category || p.category === category));
  const visible = filtered.slice(0,limit);
  const selected = visible.find(p => p.key === selectedKey);
  if (!selected) selectedKey = null;
  const list = $("#list"), detail = $("#detail");
  list.replaceChildren();
  detail.replaceChildren();
  for (const url of thumbnailUrls) URL.revokeObjectURL(url);
  thumbnailUrls.clear();
  list.dataset.view = view;
  list.hidden = Boolean(selected);
  detail.hidden = !selected;
  for (const button of document.querySelectorAll("button[data-view]"))
    button.setAttribute("aria-pressed",String(button.dataset.view === view));
  if (selected) {
    const back = document.createElement("button");
    back.textContent = "← Voltar às peças";
    back.onclick = () => {
      selectedKey = null;
      render();
      Array.from(list.querySelectorAll("button")).find(button => button.dataset.key === selected.key)?.focus();
    };
    const info = document.createElement("article"), title = document.createElement("strong");
    const piece = selected;
    title.textContent = piece.name;
    const select = document.createElement("select"); options(select); select.value = piece.category;
    select.setAttribute("aria-label","Categoria de " + piece.name);
    select.onchange = async () => {
      const category = select.value;
      try { await transaction("readwrite", store => store.put({...piece, category})); await reload(); }
      catch { select.value = piece.category; status("Não foi possível salvar a categoria."); }
    };
    const categoryLabel = document.createElement('label');
    categoryLabel.append('Categoria', select);
    const add = document.createElement("button"); add.textContent = piece.type === "PROP" ? "Colocar" : "Anexar";
    action(add, () => place(piece));
    if (piece.description) info.append(document.createTextNode(piece.description));
    if (piece.properties) info.append(document.createTextNode("Propriedades: "+piece.properties));
    if (piece.owner) info.append(document.createTextNode("Dono: "+piece.owner));
    if (!piece.local && !piece.image?.url) add.hidden = true;
    info.append(categoryLabel);
    info.append(deleteButton(piece.name+" do inventário", action, async () => {
      await transaction("readwrite",(pieces,tx) => {
        pieces.delete(piece.key);
        tx.objectStore("files").delete(piece.key);
      },["pieces","files"]);
      await reload(); status("Item excluído do inventário pessoal.");
    }));
    add.className = "place";
    const uses = [];
    if (piece.category === "weapon") {
      const arsenal = document.createElement("button"); arsenal.textContent = "Usar no Arsenal";
      action(arsenal, async () => { await OBR.broadcast.sendMessage("arsenal/inventario-arma", {nome:piece.name}, {destination:"LOCAL"}); status("Pedido enviado ao Arsenal."); });
      uses.push(arsenal);
    }
    if (hasEffect(piece)) {
      const skill = document.createElement("button"); skill.textContent = "Usar habilidade";
      action(skill, async () => { await OBR.broadcast.sendMessage("arsenal/inventario-efeito", {nome:piece.name}, {destination:"LOCAL"}); status("Pedido enviado ao Arsenal."); });
      uses.push(skill);
    }
    detail.append(back, title, thumbnail(piece), add, ...uses, info);
  } else for (const piece of visible) {
    const li = document.createElement("li"), card = document.createElement("button");
    const name = document.createElement("strong");
    name.textContent = piece.name;
    card.dataset.key = piece.key;
    card.append(thumbnail(piece), name);
    card.onclick = () => {
      selectedKey = piece.key;
      render();
      detail.querySelector("button").focus();
    };
    li.append(card);
    list.append(li);
  }
  $("#empty").textContent = filtered.length ? "" : category ? "Nenhuma peça nesta categoria." : "Adicione peças da sua coleção ou do dispositivo.";
  $("#more").hidden = Boolean(selected) || filtered.length <= limit;
}
for (const button of document.querySelectorAll("button[data-view]")) button.onclick = () => {
  view = button.dataset.view;
  selectedKey = null;
  try { localStorage.setItem(viewKey, view); } catch {}
  render();
};
for (const tab of document.querySelectorAll("[data-type]")) tab.onclick = () => {
  layer = tab.dataset.type;
  for (const other of document.querySelectorAll("[data-type]")) other.setAttribute("aria-pressed",String(other === tab));
  limit = pageSize; render();
};
$("#filter").onchange = () => { limit = pageSize; render(); };
$("#more").onclick = () => { limit += pageSize; render(); };
async function choosePieces(selectedLayer) {
  let assets;
  try {
    assets = await OBR.assets.downloadImages(true, undefined, selectedLayer);
  } catch (error) {
    return status("O seletor da coleção não abriu. " + reason(error) + " Você pode selecionar a peça no mapa e usar Da cena.");
  }
  if (!assets?.length) return status("Seleção encerrada. Use Da minha coleção para escolher peças.");
  const count = await savePieces(assets.map(asset => ({...asset,type:asset.type || selectedLayer})));
  if (count) {
    $("#filter").value = "";
    const first = assets.find(asset => !asset.type || ["PROP","ATTACHMENT"].includes(asset.type));
    document.querySelector('[data-type="' + (first?.type || selectedLayer) + '"]').click();
  }
  status(count ? "Seleção salva. Cada peça aparece na aba do seu tipo." : "Escolha Props ou Attachments.");
}
async function savePieces(assets) {
  const supported = assets.filter(asset => ["PROP","ATTACHMENT"].includes(asset.type));
  if (supported.some(asset => !asset.image?.url)) throw Error("A imagem selecionada não contém um endereço de arte.");
  let count = 0;
  await transaction("readwrite", store => {
    for (const asset of supported) {
      const {image, grid, scale, rotation, type} = asset;
      const name = asset.name || "Peça sem nome";
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
    const records = await Promise.all(files.map(async file => {
      const bytes = await file.arrayBuffer();
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2,"0")).join("");
      return {file:new File([bytes],file.name,{type:file.type}), key:JSON.stringify([type,file.name,digest])};
    }));
    await transaction("readwrite", (pieces, tx) => {
      for (const {file,key} of records) {
        const lookup = pieces.get(key);
        lookup.onsuccess = () => {
          if (lookup.result) return;
          pieces.put({key, name:file.name, type, category:"unset", local:true});
          tx.objectStore("files").put(file,key);
        };
      }
    }, ["pieces","files"]);
    $("#filter").value = "";
    await reload();
    status("Arquivos guardados no inventário deste navegador.");
  } catch (error) {
    status("Falha ao guardar o arquivo no navegador. " + reason(error));
  } finally {
    $("#upload").disabled = false;
    $("#import").disabled = false;
  }
};
action($("#scene-import"), async () => {
  const ids = await OBR.player.getSelection();
  if (!ids?.length) return status("Selecione no mapa os Props ou Attachments que deseja guardar.");
  const items = await OBR.scene.items.getItems(ids);
  const pieces = items.filter(i => i.type === "IMAGE" && ["PROP","ATTACHMENT"].includes(i.layer));
  if (!pieces.length) return status("A seleção precisa incluir um Prop ou Attachment.");
  await savePieces(pieces.map(item => ({...item,type:item.layer})));
  $("#filter").value = "";
  document.querySelector('[data-type="' + pieces[0].layer + '"]').click();
  // guardou no inventário: a peça sai da cena (menos as que têm outras peças presas nelas, para não soltar ninguém)
  const children = await OBR.scene.items.getItems(child => pieces.some(piece => child.attachedTo === piece.id && !pieces.some(other => other.id === child.id)));
  const holders = new Set(children.map(child => child.attachedTo));
  const leaving = pieces.filter(piece => !holders.has(piece.id) && !piece.locked);
  const skipped = pieces.length - leaving.length;
  let removed = 0;
  if (leaving.length) {
    try { await OBR.scene.items.deleteItems(leaving.map(piece => piece.id)); removed = leaving.length; }
    catch { status("Guardado, mas você não tem permissão para tirar a peça da cena."); return; }
  }
  status("Guardado no inventário" + (removed ? " e tirado da cena (" + removed + ")" : "") + "." + (skipped ? " " + skipped + " ficou no mapa (bloqueada ou com peças presas nela)." : ""));
});
OBR.onReady(async () => {
  try {
    setupEditing(OBR, savePieces, status);
    database = await openInventory(await OBR.player.getId());
    try { effectNames = ((await OBR.room.getMetadata())["arsenal/biblioteca"] || []).map(entry => norm(entry.nome)); render(); OBR.room.onMetadataChange(md => { effectNames = (md["arsenal/biblioteca"] || []).map(entry => norm(entry.nome)); render(); }); } catch { /* sem biblioteca */ }
    await reload(); $("#scene-import").disabled = false; $("#import").disabled = false; $("#upload").disabled = false; status("");
  } catch { status("O navegador não permitiu abrir o inventário local."); }
  try {
    await setupCompendium(OBR,{categories,action,status,inventory:()=>rows,take:async entry => {
      const {asset,id,...details}=entry;
      const key="campanha/"+OBR.room.id+"/"+id;
      await transaction("readwrite",store=>store.put({...details,...asset,key,campaignId:id}));
      await reload();
    }});
  } catch (error) { status("Falha ao carregar o compêndio. "+reason(error)); }
});
