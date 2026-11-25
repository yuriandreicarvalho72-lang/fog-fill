import {reason} from "./errors.js";
const direction = {left:[-1,0], right:[1,0], up:[0,-1], down:[0,1]};
const supported = item => item.type === "IMAGE" && ["PROP","ATTACHMENT"].includes(item.layer);

export async function editPiece(obr, command, fine, savePieces) {
  const {scene, player} = obr;
  if (!await scene.isReady()) throw Error("Abra uma cena para editar.");
  if (command === "undo") {
    if (!await scene.history.canUndo()) return "Nenhuma ação disponível para desfazer.";
    await scene.history.undo();
    return "Última ação da cena desfeita.";
  }
  const ids = await player.getSelection();
  if (ids?.length !== 1) throw Error("Selecione uma única peça no mapa.");
  const [item] = await scene.items.getItems(ids);
  if (!item || !supported(item)) throw Error("Selecione um Prop ou Attachment.");
  if (item.locked) throw Error("A peça está bloqueada.");
  const operation = command === "store" ? "DELETE" : command === "copy" ? "CREATE" : "UPDATE";
  if (await player.getRole() !== "GM" && !await player.hasPermission(item.layer + "_" + operation)) {
    throw Error("Você precisa da permissão do mestre para essa ação.");
  }
  if (command === "store") {
    if ((await scene.items.getItems(child => child.attachedTo === item.id)).length) throw Error("Separe os itens anexados antes de guardar a peça.");
    await savePieces([{...item, type:item.layer}]);
    await scene.items.deleteItems(ids);
    return item.name + " guardado no inventário.";
  }
  if (command === "copy") {
    const step = await scene.grid.getDpi();
    const copy = {...item, id:crypto.randomUUID(), createdUserId:await player.getId(),
      position:{x:item.position.x + step, y:item.position.y}};
    await scene.items.addItems([copy]);
    await player.select([copy.id], true);
    return "Cópia selecionada.";
  }
  let patch;
  if (command in direction) {
    const dpi = await scene.grid.getDpi();
    const distance = fine ? dpi / 10 : dpi;
    const [dx,dy] = direction[command];
    const next = {x:item.position.x + dx * distance, y:item.position.y + dy * distance};
    patch = {position:fine ? next : await scene.grid.snapPosition(next, 1, false, true)};
  } else if (command === "cw" || command === "ccw") {
    patch = {rotation:(item.rotation + (command === "cw" ? 15 : 345)) % 360};
  } else if (command === "back" || command === "front") {
    const peers = await scene.items.getItems(candidate => candidate.layer === item.layer && candidate.id !== item.id);
    if (!peers.length) return "Esta é a única peça nessa camada.";
    const front = command === "front";
    const edge = peers.reduce((z, p) => front ? Math.max(z,p.zIndex) : Math.min(z,p.zIndex), peers[0].zIndex);
    patch = {zIndex:edge + (front ? 1 : -1), disableAutoZIndex:true};
  } else throw Error("Ação desconhecida.");
  await scene.items.updateItems(ids, draft => { for (const target of draft) Object.assign(target, patch); });
  return item.name + " atualizado.";
}

export function setupEditing(obr, savePieces, status) {
  const buttons = [...document.querySelectorAll("[data-edit]")];
  for (const button of buttons) button.onclick = async () => {
    buttons.forEach(b => { b.disabled = true; });
    try { status(await editPiece(obr,button.dataset.edit,document.querySelector("#step").value === "fine",savePieces)); }
    catch (e) { status(reason(e)); }
    finally { buttons.forEach(b => { b.disabled = false; }); }
  };
}
