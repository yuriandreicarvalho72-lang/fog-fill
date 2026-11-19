// Constantes e utilidades dos Gatilhos.
export const ID = "gatilhos";
export const LIST = `${ID}/lista`;        // metadado da cena: [gatilho, ...]
export const CH_FIRE = `${ID}/disparar`;  // painel -> background do mestre: dispara à mão
export const CH_NOTE = `${ID}/aviso`;     // background do mestre -> todos: mensagem na tela
export const CH_LOG = `${ID}/log`;        // background do mestre -> painel: o que disparou
export const CH_INTERACT = `${ID}/interagir`; // jogador -> mestre: { itemId, userId } (clicou num objeto interagível)
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
    effects: [newEffect("show")],
  };
}
export function newEffect(action = "show") {
  return { id: uid(), action, targets: [], dest: null, text: "", audience: "all", color: "#ff2a2a", anim: "pulse", trigger: "", channel: "", group: "", to: "next", who: "actor", shooter: "", weapon: "", mode: "", hit: "hit", image: "next", power: "off", nodeState: "hackeado", carry: true, visionMode: "termica", visionOn: "on", delay: 0 };
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
