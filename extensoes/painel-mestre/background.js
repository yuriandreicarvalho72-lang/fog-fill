import OBR from "@owlbear-rodeo/sdk";
OBR.onReady(() => OBR.tool.create({
  id:"fog-fill/painel-mestre", icons:[{icon:new URL("icon.svg",location.href).href,label:"Painel do mestre",filter:{roles:["GM"]}}],
  onClick:async (_ctx,element) => {
    if (await OBR.player.getRole() === "GM") await OBR.popover.open({id:"fog-fill/painel-mestre/config",
      url:new URL("index.html",location.href).href,width:390,height:590,anchorElementId:element});
    return false;
  }
}));
