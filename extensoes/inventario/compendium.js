const prefix = "fog-fill.inventario/item/";
const $ = id => document.getElementById(id);
export function deleteButton(label, action, remove) {
  const box = document.createElement("span"), open = document.createElement("button");
  open.textContent = "Excluir";
  open.setAttribute("aria-label", "Excluir " + label);
  open.onclick = () => {
    const confirm = document.createElement("button"), cancel = document.createElement("button");
    confirm.textContent = "Confirmar exclusão"; cancel.textContent = "Cancelar";
    cancel.onclick = () => { box.replaceChildren(open); open.focus(); };
    action(confirm, remove);
    box.replaceChildren(confirm,cancel); cancel.focus();
  };
  box.append(open); return box;
}

export async function setupCompendium(obr, {categories, action, status, inventory, take}) {
  const form = $("entry-form"), fields = form.elements;
  let entries = [], draft, gm = false, roleEvent = false, metadataEvent = false;
  for (const [value,label] of Object.entries(categories)) fields.category.add(new Option(label,value));
  const text = (tag, value) => Object.assign(document.createElement(tag), {textContent:value});
  function edit(entry) {
    draft = entry;
    form.reset();
    for (const field of ["name","description","properties","owner","type","category"]) {
      if (entry?.[field]) fields[field].value = entry[field];
    }
    fields.art.replaceChildren(new Option(entry?.asset ? "Manter arte atual" : "Sem arte", ""));
    for (const piece of inventory().filter(p => !p.local && p.image?.url)) fields.art.add(new Option(piece.name,piece.key));
    form.hidden = false;
    fields.name.focus();
  }
  fields.art.onchange = () => {
    const piece = inventory().find(p => p.key === fields.art.value);
    if (piece) {
      if (!fields.name.value.trim()) fields.name.value = piece.name;
      fields.type.value = piece.type; fields.category.value = piece.category;
    }
  };
  $("entry-new").onclick = () => edit(null);
  $("entry-cancel").onclick = () => { form.hidden = true; draft = null; };
  async function write(id, value) {
    if (await obr.player.getRole() !== "GM") throw Error("A edição do compêndio é exclusiva do mestre.");
    await obr.room.setMetadata({[prefix+id]:value});
  }
  action($("entry-save"), async () => {
    if (!form.reportValidity()) return;
    const name = fields.name.value.trim();
    if (!name) throw Error("Informe o nome do item.");
    const piece = inventory().find(p => p.key === fields.art.value);
    const asset = piece ? {image:piece.image,grid:piece.grid,scale:piece.scale,rotation:piece.rotation} : draft?.asset || null;
    const id = draft?.id || crypto.randomUUID();
    const entry = {id,name,type:fields.type.value,category:fields.category.value,
      description:fields.description.value.trim(),properties:fields.properties.value.trim(),owner:fields.owner.value.trim(),asset};
    await write(id,entry); form.hidden = true; draft = null; status("Item salvo no compêndio da sala.");
  });
  form.onsubmit = event => { event.preventDefault(); $("entry-save").click(); };
  function render() {
    const list = $("entries"), query = $("entry-query").value.trim().toLocaleLowerCase("pt-BR");
    list.replaceChildren(); $("entry-new").hidden = !gm;
    if (!gm) form.hidden = true;
    for (const entry of entries.filter(e => [e.name,e.owner,categories[e.category]].join(" ").toLocaleLowerCase("pt-BR").includes(query))) {
      const li = document.createElement("li"), card = document.createElement("article");
      if (entry.asset?.image?.url) {
        const img = document.createElement("img"); img.alt=""; img.loading="lazy"; img.src=entry.asset.image.url; li.append(img);
      }
      card.append(text("strong",entry.name),text("small",[categories[entry.category],entry.owner].filter(Boolean).join(" · ")));
      if (entry.description) card.append(text("p",entry.description));
      if (entry.properties) card.append(text("p","Propriedades: "+entry.properties));
      const copy = text("button","Adicionar ao meu inventário");
      action(copy,async () => { await take(entry); status(entry.name+" guardado no inventário pessoal."); });
      card.append(copy);
      if (gm) {
        const editButton = text("button","Editar"); editButton.onclick = () => edit(entry); card.append(editButton);
        card.append(deleteButton(entry.name+" do compêndio",action,async () => {
          await write(entry.id,undefined); if (draft?.id===entry.id) form.hidden=true; status("Entrada excluída do compêndio.");
        }));
      }
      li.append(card); list.append(li);
    }
    $("entry-empty").textContent = list.children.length ? "" : query ? "Nenhum resultado." : "O compêndio desta sala está vazio.";
  }
  function apply(meta) {
    entries = Object.entries(meta).filter(([key,e]) => key.startsWith(prefix) && e?.id && prefix+e.id===key && typeof e.name==="string")
      .map(([,e]) => e).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
    render();
  }
  $("entry-query").oninput=render;
  obr.room.onMetadataChange(m=>{metadataEvent=true;apply(m);});
  obr.player.onChange(p=>{roleEvent=true;gm=p.role==="GM";render();});
  const [role,meta]=await Promise.all([obr.player.getRole(),obr.room.getMetadata()]);
  if (!roleEvent) gm=role==="GM";
  if (!metadataEvent) apply(meta); else render();
}
