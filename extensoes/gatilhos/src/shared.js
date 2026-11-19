// Constantes e utilidades dos Gatilhos.
export const ID = "gatilhos";
export const LIST = `${ID}/lista`;        // metadado da cena: [gatilho, ...]
export const CH_FIRE = `${ID}/disparar`;  // painel -> background do mestre: dispara à mão
export const CH_NOTE = `${ID}/aviso`;     // background do mestre -> todos: mensagem na tela
export const CH_LOG = `${ID}/log`;        // background do mestre -> painel: o que disparou
export const CLIMA = "clima/camadas";
export const CLIMA_FLASH = "clima/relampago";
export const LUZ = "luz-colorida/cor";
export const ESTADOS = "estados/grupos";        // grupos da extensão Estados (metadado da cena)
export const ESTADOS_SET = "estados/mudar";     // { group, to } pede a troca de estado
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
  { id: "manual", label: "Só quando eu disparar" },
];

// need: quais campos o efeito usa
export const ACTIONS = [
  { id: "show", label: "Mostrar itens", need: ["targets"] },
  { id: "hide", label: "Esconder itens", need: ["targets"] },
  { id: "toggle", label: "Alternar visível/escondido", need: ["targets"] },
  { id: "notify", label: "Mensagem na tela", need: ["text", "audience"] },
  { id: "stop", label: "Barrar: o token para na entrada", need: [] },
  { id: "teleport", label: "Teleportar quem ativou para…", need: ["dest"] },
  { id: "moveTo", label: "Mover itens para…", need: ["targets", "dest"] },
  { id: "lock", label: "Travar itens", need: ["targets"] },
  { id: "unlock", label: "Destravar itens", need: ["targets"] },
  { id: "delete", label: "Apagar itens", need: ["targets"] },
  { id: "lightColor", label: "Cor da luz (Luz Colorida)", need: ["targets", "color", "anim"] },
  { id: "weatherOn", label: "Ligar clima (Clima)", need: ["targets"] },
  { id: "weatherOff", label: "Desligar clima (Clima)", need: ["targets"] },
  { id: "lightning", label: "Relâmpago (Clima)", need: [] },
  { id: "stateSet", label: "Mudar estado (Estados)", need: ["group"] },
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
    effects: [newEffect("show")],
  };
}
export function newEffect(action = "show") {
  return { id: uid(), action, targets: [], dest: null, text: "", audience: "all", color: "#ff2a2a", anim: "pulse", trigger: "", channel: "", group: "", to: "next", delay: 0 };
}

/** Pode disparar gatilho: tokens de personagem/montaria. */
export const isToken = (i) => i.type === "IMAGE" && (i.layer === "CHARACTER" || i.layer === "MOUNT");

export function applyTheme(theme) {
  const r = document.documentElement.style;
  document.documentElement.classList.toggle("light", theme.mode === "LIGHT");
  if (theme.text?.primary) r.setProperty("--fg", theme.text.primary);
  if (theme.text?.secondary) r.setProperty("--muted", theme.text.secondary);
  if (theme.primary?.main) r.setProperty("--accent", theme.primary.main);
}
