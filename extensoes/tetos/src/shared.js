// Constantes e regras puras dos Tetos (testadas em test/engine.mjs).
export const ID = "tetos";
export const META = `${ID}/teto`;      // no item: { modo, aberto, antes }
export const ABRE = `${ID}/abre`;      // no token: true = este token revela tetos (para quem não foi criado pelo jogador)
export const LOCAL = `${ID}/copia`;    // marca a cópia local (cada navegador desenha a sua)
export const CH_ABRIR = `${ID}/abrir`; // broadcast: { ids?, nome?, op: "abrir" | "fechar" | "alternar" }

export const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;
export const cloneId = (roofId) => `${ID}-${roofId}`;

export const MODOS = [
  { id: "meu", label: "Some só para quem está dentro" },
  { id: "todos", label: "Some para todos quando alguém entra" },
  { id: "manual", label: "Só some quando o mestre abrir" },
];

export const newTeto = (visibleBefore = true) => ({ modo: "meu", aberto: false, antes: visibleBefore !== false });

/** Ponto dentro da caixa {min, max} (com folga em px, positiva = mais tolerante). */
export function inside(p, box, pad = 0) {
  return !!box && p.x >= box.min.x - pad && p.x <= box.max.x + pad && p.y >= box.min.y - pad && p.y <= box.max.y + pad;
}

/** O teto está aberto (sumido) para este navegador? */
export function revealed(teto, { insideOwn, insideAny, isGM }) {
  if (teto?.aberto) return true;
  switch (teto?.modo) {
    case "manual": return false;
    case "todos": return !!insideAny;
    default: return isGM ? !!insideAny : !!insideOwn; // "meu": o mestre vê o teto sumir quando há jogador dentro
  }
}

/** Quem revela tetos: tokens de jogadores (criados por quem não é mestre) ou marcados. */
export function opensRoofs(token, gmIds) {
  return !gmIds.has(token.createdUserId) || token.metadata?.[ABRE] === true;
}

/** Assinatura do que muda a posição do teto (para guardar a caixa em cache). */
export const sigOf = (it) => JSON.stringify([it.position, it.rotation, it.scale, it.image?.width, it.image?.height, it.grid?.dpi, it.grid?.offset]);

export function applyTheme(theme) {
  const r = document.documentElement.style;
  document.documentElement.classList.toggle("light", theme.mode === "LIGHT");
  if (theme.text?.primary) r.setProperty("--fg", theme.text.primary);
  if (theme.text?.secondary) r.setProperty("--muted", theme.text.secondary);
  if (theme.primary?.main) r.setProperty("--accent", theme.primary.main);
}

/** Aplica "abrir" / "fechar" / "alternar" ao teto (devolve o novo valor de aberto). */
export const nextAberto = (op, cur) => (op === "abrir" ? true : op === "fechar" ? false : !cur);
