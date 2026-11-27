// Núcleo do Anonimato (sem SDK, testado em Node).
// O item continua sendo o MESMO item (mesma posição, anexos, luz, visão, metadados de outras extensões): só o "rosto"
// dele (nome, texto do rótulo e, se quiser, a imagem) é trocado por um genérico. O rosto verdadeiro fica guardado em
// metadata.real e volta quando o anonimato é desligado.
export const ID = "anonimato";
export const ANON = `${ID}/dados`;   // metadado do item: { on, modo, nome, imagem, trava, real }
export const MODOS = [["nome", "Só esconder nome e texto"], ["imagem", "Nome e texto + imagem genérica"]];
export const DEFAULT_CFG = { on: true, modo: "nome", nome: "???", imagem: "", trava: true };

export const cfgOf = (it) => (it?.metadata?.[ANON] ? { ...DEFAULT_CFG, ...it.metadata[ANON] } : null);
export const isAnon = (it) => cfgOf(it)?.on === true;

export const richOf = (t) => [{ type: "paragraph", children: [{ text: t }] }];
/** O rosto atual do item. */
export const faceOf = (it) => ({ name: it?.name ?? "", text: it?.text?.plainText ?? null, url: it?.image?.url ?? null });

/** O rosto que o item deve mostrar agora, dado o rosto verdadeiro. generic = imagem genérica padrão. */
export function desiredFace(cfg, real, generic) {
  const nome = String(cfg.nome ?? "").trim() || "???";
  return {
    name: nome,
    text: real.text ? nome : real.text,                       // só troca o texto se o item tinha texto
    url: cfg.modo === "imagem" && real.url != null ? (String(cfg.imagem || "").trim() || generic) : real.url,
  };
}

function setText(t, text) { t.plainText = text; t.richText = richOf(text); }

/**
 * Aplica (ou desfaz) o anonimato no rascunho do item. Devolve true se mudou alguma coisa.
 * on: guarda o rosto verdadeiro (uma vez) e põe o rosto anônimo. off: devolve o rosto verdadeiro e apaga a cópia.
 */
export function applyTo(d, generic) {
  const raw = d.metadata?.[ANON];
  if (!raw) return false;
  const cfg = { ...DEFAULT_CFG, ...raw };
  let changed = false;
  if (cfg.on) {
    if (!raw.real) {
      raw.real = faceOf(d); changed = true;
      // trava preventiva: o item fica bloqueado (jogador não consegue arrastar); o mestre destrava à mão se precisar mover
      if (cfg.trava !== false) { raw.prevLocked = !!d.locked; d.locked = true; }
    }
    const want = desiredFace(cfg, raw.real, generic);
    if (d.name !== want.name) { d.name = want.name; changed = true; }
    if (want.text != null && d.text && d.text.plainText !== want.text) { setText(d.text, want.text); changed = true; }
    if (want.url != null && d.image && d.image.url !== want.url) { d.image.url = want.url; changed = true; }
  } else if (raw.real) {
    const r = raw.real;
    if (d.name !== r.name) { d.name = r.name; changed = true; }
    if (r.text != null && d.text && d.text.plainText !== r.text) { setText(d.text, r.text); changed = true; }
    if (r.url != null && d.image && d.image.url !== r.url) { d.image.url = r.url; changed = true; }
    if (raw.prevLocked !== undefined) { d.locked = !!raw.prevLocked; delete raw.prevLocked; }
    delete raw.real; changed = true;
  }
  return changed;
}
/** Este item precisa de ajuste? (testa numa cópia, sem escrever) */
export function needs(it, generic) {
  if (!it?.metadata?.[ANON]) return false;
  return applyTo(JSON.parse(JSON.stringify(it)), generic);
}

/** Texto do rótulo do mestre: quem é de verdade. */
export function realLabel(it) {
  const r = cfgOf(it)?.real;
  const nome = (r?.text || r?.name || "").trim();
  return nome ? `🕶 ${nome}` : "🕶";
}

// ---------------- trava para jogadores ----------------
/** O que um jogador não pode mudar num item anônimo travado. */
export function snapOf(it) {
  return {
    position: { x: it.position?.x ?? 0, y: it.position?.y ?? 0 }, rotation: it.rotation ?? 0,
    scale: { x: it.scale?.x ?? 1, y: it.scale?.y ?? 1 }, visible: it.visible !== false, layer: it.layer, locked: !!it.locked,
    name: it.name ?? "", text: it.text?.plainText ?? null, url: it.image?.url ?? null,
    anon: JSON.stringify(it.metadata?.[ANON] ?? null),
  };
}
export const sameSnap = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Devolve os valores guardados no rascunho do item (desfaz a mexida do jogador). */
export function revert(d, s) {
  d.position = { ...s.position }; d.rotation = s.rotation; d.scale = { ...s.scale }; d.visible = s.visible; d.layer = s.layer; d.locked = s.locked;
  d.name = s.name;
  if (s.text != null && d.text) setText(d.text, s.text);
  if (s.url != null && d.image) d.image.url = s.url;
  d.metadata[ANON] = JSON.parse(s.anon);
}
/** Quem mexeu foi um jogador (não um mestre)? */
export const byPlayer = (it, gmIds) => !!it.lastModifiedUserId && !gmIds.has(it.lastModifiedUserId);
