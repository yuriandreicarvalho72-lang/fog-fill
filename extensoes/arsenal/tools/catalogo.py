# Gera src/catalog.json a partir da aba 03_Armas_Fogo da planilha "Equipamentos de Metropole Sistema d20.xlsx".
# Uso: python3 tools/catalogo.py <planilha.xlsx> src/catalog.json
import sys, re, json, collections, unicodedata
import openpyxl

def norm(s):
    return unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()

def fx_of(cat, sub, name, ammo, modes):
    t = " ".join(norm(x) for x in (sub, name, ammo))
    if "tesla" in t: return "tesla"
    if re.search(r"\bion\b|\bions\b", t): return "ion"
    if "plasma" in t: return "plasma"
    if re.search(r"liga magnetica|ferromagnet|gauss|\brail|railgun|coil", t): return "rail"
    if re.search(r"choque|dardos eletricos|taser", t): return "taser"
    if re.search(r"beanbag|borracha|stinger", t) and cat != "Armas Pesadas": return "beanbag"  # (o míssil Stinger não é bala de borracha)
    if "espuma" in t: return "foam"
    if re.search(r"bateria|celula|gerador de energia|cristais de energia|laser|photon|energia", t) and cat != "Armas Químicas": return "laser"
    c = norm(cat); s = norm(sub)
    if c == "armas quimicas":
        if "chamas" in s: return "flame"
        if "acido" in s or "pulverizador" in s: return "acid"
        if "criogen" in s: return "cryo"
        if "nanite" in s: return "nanite"
        return "gas"
    if c == "armas pesadas":
        if "granada" in s: return "grenade"
        if "foguete" in s or "missil" in s or "misseis" in s: return "rocket"
        return "cannon"
    return {
        "pistolas": "pistol", "revolveres": "revolver", "submetralhadoras": "smg", "carabinas": "rifle",
        "rifles de assalto": "rifle", "rifles de precisao": "sniper", "escopetas": "shotgun",
        "metralhadoras": "mg", "metralhadoras medias": "mgm", "metralhadoras pesadas": "hmg", "arcos": "bow",
    }.get(c, "rifle")

def modes_of(raw, fx):
    t = norm(raw)
    m = []
    if re.search(r"jato|cone", t) or fx in ("flame", "acid", "cryo"): m.append("spray")
    if re.search(r"semi|single|double|bolt|pump|unico|capsula|cartucho|disparo|tiro|action|autonomo|carga", t) and "spray" not in m: m.append("single")
    if "rajada" in t: m.append("burst")
    if re.search(r"(?<!semi)automatico", t) and "autonomo" not in t: m.append("auto")  # "semiautomático" não é automático
    return m or ["single"]

def nums(s):
    return [float(x.replace(",", ".")) for x in re.findall(r"\d+(?:,\d+)?", str(s or ""))]

def range_of(raw):
    t = norm(raw)
    if "sem limite" in t: return [None, None]
    n = nums(raw)
    if not n: return [None, None]
    if "/" in str(raw) and len(n) >= 2: return [n[0], n[1]]
    if "+" in str(raw): return [n[0], None]
    return [n[0], n[0]]

def mag_of(raw):
    n = re.match(r"\s*(\d+)", str(raw or ""))
    return int(n.group(1)) if n else None

wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
rows = [r for r in list(wb["03_Armas_Fogo"].iter_rows(values_only=True))[1:] if r[2]]
out = []
for r in rows:
    cat, sub, name, rua, fab, cls, _c, _m, alc, _req, dano, tdano, modos, mun, usos = r[:15]
    fx = fx_of(cat, sub, name, mun, modos)
    out.append({
        "n": str(name).strip(), "c": cat, "s": sub or "", "rua": rua if rua and rua != "—" else "",
        "fab": fab or "", "r": range_of(alc), "rt": str(alc or ""),
        "m": modes_of(modos, fx), "mag": mag_of(usos), "dmg": f"{dano} {tdano}".strip() if dano else "", "fx": fx,
    })
# formato compacto: listas de categorias/efeitos e uma linha por arma
# [nome, categoria#, alcance normal (m), alcance longo (m), modos ("s"=único,"b"=rajada,"a"=auto,"j"=jato), pente, efeito#]
# (dano, fabricante e apelido ficam na planilha/fichas; aqui só o que a animação e a munição usam)
cats = sorted({x["c"] for x in out}); fxs = sorted({x["fx"] for x in out})
code = {"single": "s", "burst": "b", "auto": "a", "spray": "j"}
num = lambda v: (int(v) if v is not None and float(v).is_integer() else v)
compact = {"c": cats, "x": fxs, "w": [[x["n"], cats.index(x["c"]), num(x["r"][0]), num(x["r"][1]),
            "".join(code[m] for m in x["m"]), x["mag"], fxs.index(x["fx"])] for x in out]}
json.dump(compact, open(sys.argv[2], "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "armas;", collections.Counter(x["fx"] for x in out))
print("modos:", collections.Counter(tuple(x["m"]) for x in out))
