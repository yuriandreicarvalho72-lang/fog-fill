// Constantes e utilidades dos Gatilhos.
export const ID = "gatilhos";
export const LIST = `${ID}/lista`;        // metadado da cena: [gatilho, ...]
export const CH_FIRE = `${ID}/disparar`;  // painel -> background do mestre: dispara à mão
export const CH_NOTE = `${ID}/aviso`;     // background do mestre -> todos: mensagem na tela
export const CH_LOG = `${ID}/log`;        // background do mestre -> painel: o que disparou
export const CH_INTERACT = `${ID}/interagir`; // jogador -> mestre: { itemId, userId } (clicou num objeto interagível)
export const CH_DENY = `${ID}/negado`;        // mestre -> todos: { to: userId, title, text, show: "aviso"|"nota" } (faltou o item do restrito)
export const CH_GIVE = `${ID}/dar`;           // jogador -> mestre: { itemId, toId } (passar um item para outro personagem)
export const META_ITEM = `${ID}/item`;        // metadado do item pego: { give: bool } (o jogador pode passar adiante)
export const FLAG = `${ID}/interagivel`;  // metadado do item: é interagível (para o menu de contexto)
export const CLIMA = "clima/camadas";
export const CLIMA_FLASH = "clima/relampago";
export const LUZ = "luz-colorida/cor";
export const ESTADOS = "estados/grupos";        // grupos da extensão Estados (metadado da cena)
export const ESTADOS_SET = "estados/mudar";     // { group, to } pede a troca de estado
export const ARSENAL_FIRE = "arsenal/atirar";   // { shooter, weapon?, mode?, targets: [{id}], hit } pede um disparo ao Arsenal
export const ARSENAL_WEAPONS = "arsenal/armas"; // metadado do token: repertório de armas do Arsenal
export const TROCADOR_SWAP = "trocador/trocar";  // { targets: [id], to: "next"|"prev"|nome } pede a troca de imagem ao Trocador
export const TROCADOR_IMAGES = "trocador/imagens"; // metadado do item: imagens guardadas pelo Trocador
// extensão Vigilância (câmeras e Matriz)
export const VIG_SEEN = "vigilancia/viu";       // Vigilância -> todos: { camera, tokens: [novos], all }
export const VIG_NODE = "vigilancia/no-mudou";  // Vigilância -> todos: { id, name, type, state, prev }
export const VIG_SET = "vigilancia/mudar";      // { targets: [id], state, from } pede a troca de estado à Vigilância
export const VIG_CAM = "vigilancia/camera";     // metadado do item: é câmera
export const VIG_NODE_META = "vigilancia/no";   // metadado do item: é nó da Matriz
export const VIG_VISION = "vigilancia/visao";   // { targets, mode: "termica"|"baixa"|"todos", on, from } liga/desliga visão especial
export const VISION_MODES = [["termica", "térmica"], ["baixa", "baixa luz"], ["todos", "todos os modos"]];
// extensão Arsenal: cenário destrutível e cargas plantadas
export const ARSENAL_DESTROYED = "arsenal/destruido"; // Arsenal -> todos: { id, name, at, by (token que atirou) }
export const ARSENAL_BLAST = "arsenal/explodiu";      // Arsenal -> todos: { id, at, radius, by, caught: [tokens] }
export const ARSENAL_DETONATE = "arsenal/detonar";    // { ids, op: "detonar"|"desarmar", from } pede ao Arsenal
export const ARSENAL_FX = "arsenal/efeito";           // { visual? | video: { url, tipo, giro }, from?, targets, dur, tamanho?, tag, origem } vídeo no mapa
export const ARSENAL_FX_END = "arsenal/efeito-fim";   // { tag ("" = todos), origem } encerra efeitos que ficaram
export const ARSENAL_HAB_USE = "arsenal/habilidade-usar"; // { token, nome, targets, origem } habilidade do dossiê de um NPC
export const ARSENAL_DOSSIE = "arsenal/dossie";       // metadado do token: dossiê de habilidades (Arsenal)
export const FX_TIPOS = [["alvo", "no alvo"], ["area", "área"], ["em-si", "em si"], ["projetil", "projétil"], ["linha", "linha"], ["cone", "cone"]];
export const FX_GIROS = [[0, "aponta → direita"], [90, "aponta ↓ baixo"], [180, "aponta ← esquerda"], [270, "aponta ↑ cima"]];
export const ARSENAL_CAUSES = ["destroyed", "chargeBlew"];
export const CHARGE_OPS = [["detonar", "detonar"], ["desarmar", "desarmar"]];

// ---------- portas da névoa ----------
// Smoke & Spectre: a porta é uma linha de obstrução com isDoor; aberta = doorOpen + disabled (a linha deixa ver e passar).
// Névoa do próprio Owlbear: as portas ficam numa lista no item de névoa (cada uma com open).
export const SMOKE = "com.battle-system.smoke/";
export const OBR_FOG_DOORS = "rodeo.owlbear.dynamic-fog/doors";
export const DOOR_OPS = [["alternar", "abrir ou fechar (alterna)"], ["abrir", "abrir"], ["fechar", "fechar"], ["trancar", "trancar"], ["destrancar", "destrancar"]];
export const isSmokeDoor = (i) => i?.metadata?.[`${SMOKE}isDoor`] === true;
const obrDoors = (i) => (Array.isArray(i?.metadata?.[OBR_FOG_DOORS]) ? i.metadata[OBR_FOG_DOORS] : []);
export const isFogDoor = (i) => isSmokeDoor(i) || obrDoors(i).length > 0;
export const doorIsOpen = (i) => (isSmokeDoor(i) ? i.metadata[`${SMOKE}doorOpen`] === true : obrDoors(i).some((d) => d?.open === true));
export const doorIsLocked = (i) => isSmokeDoor(i) && i.metadata[`${SMOKE}isDoorLocked`] === true;
/** Muda a porta (rascunho do item). op: abrir | fechar | alternar | trancar | destrancar. Devolve o estado final (aberta?). */
export function setDoor(it, op) {
  const md = it.metadata;
  if (isSmokeDoor(it)) {
    if (op === "trancar") { md[`${SMOKE}isDoorLocked`] = true; return doorIsOpen(it); }
    if (op === "destrancar") { delete md[`${SMOKE}isDoorLocked`]; return doorIsOpen(it); }
    const open = op === "abrir" ? true : op === "fechar" ? false : !doorIsOpen(it);
    if (open) { md[`${SMOKE}doorOpen`] = true; md[`${SMOKE}disabled`] = true; } else { delete md[`${SMOKE}doorOpen`]; delete md[`${SMOKE}disabled`]; }
    return open;
  }
  if (op === "trancar" || op === "destrancar") return doorIsOpen(it); // a névoa do Owlbear não tem tranca
  const open = op === "abrir" ? true : op === "fechar" ? false : !doorIsOpen(it);
  md[OBR_FOG_DOORS] = obrDoors(it).map((d) => ({ ...d, open }));
  return open;
}
// ---------- restrito: só usa quem tem o item preso (attachment) ao personagem ----------
export const REQ_SHOW = [["aviso", "aviso na tela"], ["nota", "nota para o jogador ler"]];
export const REQ_DEFAULT = "Acesso negado: é preciso {item}.";
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const itemLabel = (i) => i?.text?.plainText?.trim() || i?.name || "";
/** Itens presos a um token (e os presos a eles, até 4 níveis). */
export function attachmentsOf(tokenId, items) {
  const out = [], seen = new Set();
  let frontier = new Set([tokenId]);
  for (let depth = 0; depth < 4 && frontier.size; depth++) {
    const next = new Set();
    for (const it of items) if (it.attachedTo && frontier.has(it.attachedTo) && !seen.has(it.id)) { seen.add(it.id); out.push(it); next.add(it.id); }
    frontier = next;
  }
  return out;
}
/** O item preso ao token cujo nome contém "req" (sem diferença de maiúsculas e acentos); vazio = nenhum. */
export function findRequired(tokenId, items, req) {
  const r = norm(req);
  if (!r) return null;
  return attachmentsOf(tokenId, items).find((i) => norm(itemLabel(i)).includes(r) || norm(i.name).includes(r)) || null;
}
/** O token tem preso um item cujo nome contém "req"? req vazio = sem restrição. */
export const hasRequired = (tokenId, items, req) => !norm(req) || !!findRequired(tokenId, items, req);
/** Algum dos nós da Matriz (Vigilância) escolhidos está hackeado? (libera o restrito sem o item: cartão clonado) */
export const nodeHacked = (items, ids) => (ids || []).some((id) => items.find((i) => i.id === id)?.metadata?.[VIG_NODE_META]?.state === "hackeado");
// ---------- inventário: itens presos nos personagens, que o jogador pode passar adiante ----------
export const isInvItem = (i) => i?.type === "IMAGE" && !!i.attachedTo && i.layer !== "CHARACTER" && i.layer !== "MOUNT" && i.visible !== false;
export const canGive = (i) => i?.metadata?.[META_ITEM]?.give !== false;
/** Itens (do inventário) presos a um token, inclusive os presos em itens presos. */
export const heldBy = (tokenId, items) => attachmentsOf(tokenId, items).filter(isInvItem);
/** O personagem (token) que carrega o item, subindo pela cadeia de "preso a". */
export function holderOf(item, items) {
  let cur = item;
  for (let d = 0; d < 5 && cur?.attachedTo; d++) {
    cur = items.find((i) => i.id === cur.attachedTo);
    if (cur && (cur.layer === "CHARACTER" || cur.layer === "MOUNT")) return cur;
  }
  return null;
}
/** Dois personagens estão lado a lado (até 1 quadrado de folga entre os centros)? */
export const nearby = (a, b, dpi) => Math.max(Math.abs(a.position.x - b.position.x), Math.abs(a.position.y - b.position.y)) <= dpi * 1.5 + 1;
/** Texto da mensagem de acesso negado ({item} e {quem}). */
export const denyText = (t, who) => (String(t.reqMsg || "").trim() || REQ_DEFAULT).replaceAll("{item}", String(t.reqItem || "").trim()).replaceAll("{quem}", who || "você");
// ---------- pegar item: prender (attachment) no token de quem ativou ----------
export const ATTACH_OPS = [["prender", "prender (o personagem pega)"], ["soltar", "soltar (larga onde está)"]];
export const ATTACH_PLACES = [["canto", "no canto do token"], ["centro", "no centro do token"], ["onde", "onde o item está"]];
export const ATTACH_WHO = [["actor", "quem ativou (o mais perto)"], ["selected", "o token que eu tiver selecionado"]];
/** Tamanho (meio lado, em pixels da cena) de um item de imagem; sem imagem, meio quadrado. */
const halfOf = (i, dpi) => (i?.image?.width && i?.grid?.dpi ? (i.image.width / i.grid.dpi) * dpi * Math.abs(i.scale?.x || 1) / 2 : dpi / 2);
/** Onde o item fica ao ser preso no token: canto de baixo à direita, centro ou onde já está. */
export function attachPos(item, token, place, dpi) {
  if (place === "onde") return { ...item.position };
  if (place === "centro") return { ...token.position };
  const k = Math.max(0, halfOf(token, dpi) - halfOf(item, dpi) * 0.6);
  return { x: token.position.x + k, y: token.position.y + k };
}
export const NODE_STATES = [["ativo", "ativo"], ["desativado", "desativado"], ["loop", "em loop"], ["hackeado", "hackeado"]];
// conversa com a Régua: ela avisa o caminho que o token vai fazer; o motor responde mandando parar
export const CH_PATH = "regua/caminho";   // Régua -> todos: { tokenId, points }
export const CH_HALT = "regua/parar";     // motor -> todos: { tokenId, at, upto } (anda até points[upto], vai para "at" e para)

export const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;
export const uid = () => Math.random().toString(36).slice(2, 9);

export const CAUSES = [
  { id: "enter", label: "Entrar ou passar por cima" },
  { id: "leave", label: "Sair da zona" },
  { id: "near", label: "Chegar perto (raio)" },
  { id: "standAll", label: "Tokens em TODAS as zonas ao mesmo tempo (placas)" },
  { id: "appear", label: "A zona aparece (fica visível)" },
  { id: "disappear", label: "A zona some (fica escondida)" },
  { id: "interact", label: "Interagir: o jogador clica no objeto (alavanca, porta, botão…)" },
  { id: "cameraSees", label: "Uma câmera vê alguém (Vigilância)" },
  { id: "nodeState", label: "Nó da Matriz muda de estado (Vigilância)" },
  { id: "destroyed", label: "Um objeto foi destruído (Arsenal)" },
  { id: "chargeBlew", label: "Uma carga explodiu (Arsenal)" },
  { id: "manual", label: "Só quando eu disparar" },
];

// need: quais campos o efeito usa
export const ACTIONS = [
  { id: "show", label: "Mostrar itens", need: ["targets"] },
  { id: "hide", label: "Esconder itens", need: ["targets"] },
  { id: "toggle", label: "Alternar visível/escondido", need: ["targets"] },
  { id: "notify", label: "Mensagem na tela", need: ["text", "audience"] },
  { id: "stop", label: "Barrar: o token para na entrada", need: ["moving"] },
  { id: "teleport", label: "Teleportar para…", need: ["who", "dest"] },
  { id: "moveTo", label: "Mover itens para…", need: ["targets", "dest"] },
  { id: "lock", label: "Travar itens", need: ["targets"] },
  { id: "unlock", label: "Destravar itens", need: ["targets"] },
  { id: "delete", label: "Apagar itens", need: ["targets"] },
  { id: "lightColor", label: "Cor da luz (Luz Colorida)", need: ["targets", "color", "anim"] },
  { id: "weatherOn", label: "Ligar clima (Clima)", need: ["targets"] },
  { id: "weatherOff", label: "Desligar clima (Clima)", need: ["targets"] },
  { id: "lightning", label: "Relâmpago (Clima)", need: [] },
  { id: "stateSet", label: "Mudar estado (Estados)", need: ["group"] },
  { id: "floor", label: "Mudar de andar (Estados: prédio)", need: ["floor"] },
  { id: "arsenal", label: "Disparo (Arsenal): um token atira", need: ["shooter", "targets", "weapon"] },
  { id: "swapImage", label: "Trocar imagem (Trocador)", need: ["targets", "image"] },
  { id: "camPower", label: "Ligar/desligar câmera (Vigilância)", need: ["targets", "power"] },
  { id: "nodeSet", label: "Mudar estado do nó da Matriz (Vigilância)", need: ["targets", "nodeState"] },
  { id: "vision", label: "Ligar/desligar modo de visão (Vigilância)", need: ["targets", "vision"] },
  { id: "charge", label: "Carga (Arsenal): detonar ou desarmar", need: ["targets", "chargeOp"] },
  { id: "door", label: "Porta da névoa: abrir / fechar (Smoke & Spectre)", need: ["targets", "doorOp"] },
  { id: "attach", label: "Pegar item: prender no token de quem ativou (cartão, chave…)", need: ["targets", "attach"] },
  { id: "fx", label: "Efeito visual (Arsenal): vídeo no mapa", need: ["shooter", "targets", "fx"] },
  { id: "fxEnd", label: "Encerrar efeito visual (Arsenal)", need: ["fxEnd"] },
  { id: "npcAbility", label: "Habilidade de NPC (Arsenal)", need: ["shooter", "targets", "ability"] },
  { id: "chain", label: "Disparar outro gatilho", need: ["trigger"] },
  { id: "rearm", label: "Rearmar um gatilho", need: ["trigger"] },
  { id: "broadcast", label: "Mensagem para outra extensão", need: ["channel", "text"] },
];

export const ANIMS = [
  ["none", "Fixa"], ["flicker", "Tocha"], ["pulse", "Alarme"], ["strobe", "Estrobo"],
  ["beacon", "Giroflex"], ["faulty", "Com defeito"], ["breathe", "Respirando"],
];

export function newTrigger(zones = [], name = "Gatilho") {
  return {
    id: uid(), name, armed: true, once: true, delay: 0,
    zones, cause: "enter", radius: 2,
    who: "chars", tokens: [], ignoreHidden: true, halt: false,
    reach: 1, canUse: "all", glow: true, glowColor: "#ffd34d", nodeTo: "",
    reqItem: "", reqMsg: "", reqShow: "aviso", reqUses: 0, reqNodes: [],
    effects: [newEffect("show")],
  };
}
export function newEffect(action = "show") {
  return { id: uid(), action, targets: [], dest: null, text: "", audience: "all", color: "#ff2a2a", anim: "pulse", trigger: "", channel: "", group: "", to: "next", who: "actor", shooter: "", weapon: "", mode: "", hit: "hit", image: "next", power: "off", nodeState: "hackeado", carry: true, visionMode: "termica", visionOn: "on", chargeOp: "detonar", delay: 0,
    fxSrc: "lista", fxVis: "", fxUrl: "", fxTipo: "area", fxGiro: 0, fxDur: "once", fxSecs: 10, fxTag: "", fxSize: 0, ability: "", doorOp: "alternar",
    attachOp: "prender", attachPlace: "canto", attachWho: "actor", attachShow: true, attachLock: true, attachGive: true };
}

// quem o teleporte leva
export const WHO = [
  ["actor", "quem ativou"],
  ["zone", "todos em cima da zona"],
  ["selected", "os tokens que eu tiver selecionado"],
];
export const ARSENAL_MODES = { single: "tiro único", burst: "rajada", auto: "automático", supp: "supressão", spray: "jato" };
export const ACTOR = "@quem"; // item especial nas listas de itens: quem ativou
export const MOVING = ["enter", "leave", "near"]; // causas com movimento (dá para barrar)
export const VIG_CAUSES = ["cameraSees", "nodeState"]; // causas que chegam da Vigilância
// quem pode usar um objeto interagível
export const CAN_USE = [["all", "jogadores e mestre"], ["players", "só jogadores"], ["gm", "só o mestre"]];

/** Gatilho de interação ativo (armado). */
export const isInteract = (t) => t.cause === "interact" && t.armed;

/** Pode disparar gatilho: tokens de personagem/montaria. */
export const isToken = (i) => i.type === "IMAGE" && (i.layer === "CHARACTER" || i.layer === "MOUNT");

export function applyTheme(theme) {
  const r = document.documentElement.style;
  document.documentElement.classList.toggle("light", theme.mode === "LIGHT");
  if (theme.text?.primary) r.setProperty("--fg", theme.text.primary);
  if (theme.text?.secondary) r.setProperty("--muted", theme.text.secondary);
  if (theme.primary?.main) r.setProperty("--accent", theme.primary.main);
}
