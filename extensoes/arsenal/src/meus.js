// Efeitos próprios do mestre no navegador: carrega a lista da pasta meus-efeitos e lê tamanho/duração dos vídeos.
import { MEUS_LISTA, registerMeus, pendingKeys, fileOfKey, setDims } from "./abil.js";
import { url } from "./shared.js";

let loading = null;
/** Lê meus-efeitos/lista.json (gerada no build). Sem lista = nenhum efeito próprio. */
export function loadMeus() {
  if (!loading) loading = fetch(url(MEUS_LISTA), { cache: "no-cache" }).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((l) => { registerMeus(l); return l; });
  return loading;
}

const cache = new Map();
/** Tamanho e duração de um vídeo (só os metadados; não baixa o vídeo inteiro). */
export function probeVideo(src, timeout = 8000) {
  if (!cache.has(src)) {
    cache.set(src, new Promise((resolve, reject) => {
      const v = document.createElement("video");
      const done = (fn, x) => { clearTimeout(t); v.removeAttribute("src"); v.load(); fn(x); };
      const t = setTimeout(() => done(reject, new Error("o vídeo demorou demais para abrir")), timeout);
      v.preload = "metadata"; v.muted = true; v.crossOrigin = "anonymous";
      v.onloadedmetadata = () => done(resolve, { w: v.videoWidth, h: v.videoHeight, dur: Number.isFinite(v.duration) ? v.duration * 1000 : 3000 });
      v.onerror = () => done(reject, new Error("não deu para abrir o vídeo (o link precisa ser direto para um arquivo .webm)"));
      v.src = src;
    }).catch((e) => { cache.delete(src); throw e; }));
  }
  return cache.get(src);
}
/** Endereço completo de um arquivo de vídeo (relativo à pasta jb2a/ do site, ou link). */
export const videoSrc = (file) => new URL(encodeURI(file), url("jb2a/")).href;

/** Antes de tocar: lê tamanho e duração dos vídeos próprios usados pela habilidade. */
export async function prepareCustom(ab, subs) {
  await loadMeus();
  await Promise.all(pendingKeys(ab, subs).map(async (k) => {
    try { setDims(k, await probeVideo(videoSrc(fileOfKey(k)))); } catch (e) { console.warn("[arsenal] vídeo próprio:", e.message); }
  }));
}
