// Efeito "Mostrar handout": para quem vai a mensagem.
import { handoutPara, newEffect, ACTIONS } from "../src/shared.js";
let bad = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };
const a = [{ createdUserId: "u1" }, { createdUserId: "u2" }, { createdUserId: "u1" }];
ok("quem ativou: donos sem repetir", handoutPara("actor", a), { para: ["u1", "u2"] });
ok("token sem dono cai para o mestre", handoutPara("actor", [{}]), { para: "gm", semDono: true });
ok("ninguém ativou cai para o mestre", handoutPara("actor", []), { para: "gm", semDono: true });
ok("todos", handoutPara("all", a), { para: "todos" });
ok("só o mestre", handoutPara("gm", a), { para: "gm" });
ok("o efeito existe na lista", ACTIONS.some((x) => x.id === "handout" && x.need.includes("handout")), true);
ok("efeito novo traz os campos", (({ hoPara, hoNome, hoImg }) => [hoPara, hoNome, hoImg])(newEffect("handout")), ["actor", "", ""]);
if (bad) process.exit(1);
