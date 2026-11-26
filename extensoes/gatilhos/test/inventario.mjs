// Restrito e condição "tem item" também leem o Inventário de mesa do jogador (nomes publicados no metadado dele).
import { hasRequired, invHas } from "../src/shared.js";
let bad = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };
const items = [{ id: "t1", createdUserId: "u1" }, { id: "t2", createdUserId: "u2" }, { id: "c1", attachedTo: "t2", name: "Cartão de acesso" }];
const inv = { u1: ["Pistola Colt", "Cartão de Acesso Nível 2"], u2: [] };
ok("nome sem acento/caixa", invHas(inv.u1, "cartao de acesso"), true);
ok("jogador 1 tem pelo inventário", hasRequired("t1", items, "cartão de acesso", inv), true);
ok("jogador 2 tem pelo attachment", hasRequired("t2", items, "Cartão de acesso", inv), true);
ok("jogador 2 sem o item de arma", hasRequired("t2", items, "Pistola", inv), false);
ok("sem inventário publicado", hasRequired("t1", items, "Cartão", {}), false);
ok("sem restrição", hasRequired("t1", items, "", inv), true);
if (bad) process.exit(1);
