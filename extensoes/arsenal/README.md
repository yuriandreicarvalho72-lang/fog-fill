# Arsenal (extensão do Owlbear Rodeo)

Armas de fogo animadas para a campanha Sombras de Metrópole: cada token tem um repertório de armas montado a partir
do catálogo da planilha "Equipamentos de Metrópole" (aba 03_Armas_Fogo, 429 armas) ou de armas próprias.
Mire (ferramenta Arsenal ou botão direito → Atirar aqui) e atire: todos veem o disparo. Os efeitos são itens locais
(nada fica salvo na cena).

- Instalar: https://yuriandreicarvalho72-lang.github.io/fog-fill/arsenal/manifest.json
- Animações em vídeo do **JB2A** (projéteis, clarões, sangue, explosões, fumaça, raios...), como na extensão Embers.
  Cápsulas, mira laser, área de supressão, fios do taser e espuma continuam desenhados. Cada jogador pode desligar
  os vídeos no painel (Aparência) e ver só o efeito desenhado.
- Para outras extensões: o canal `arsenal/disparo` recebe { spec, shooter, shooterName, weapon, rounds, targets, hit } a cada tiro.
- Atualizar o catálogo: `python3 tools/catalogo.py <planilha.xlsx> src/catalog.json`
- Testes: `node test/fx.mjs` · fotos dos efeitos desenhados: `node test/sheet.mjs saida.png` ·
  fotos dos vídeos no lugar certo: `npm run jb2a && node test/jb2a-sheet.mjs saida.png` (precisam do Playwright)

## Créditos e licença das animações

Animações: **JB2A** — https://jb2a.com — pacote gratuito, licença
[Creative Commons Atribuição-NãoComercial-CompartilhaIgual 4.0 (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/).

Os vídeos não estão neste repositório: o build (`npm run build`) baixa os 94 arquivos usados, sem alteração, do
repositório oficial (https://github.com/Jules-Bens-Aa/JB2A_DnD5e, commit fixo em `src/jb2a.js`) para `public/jb2a/`,
e eles são publicados junto com a extensão. Uso não comercial; o crédito aparece no painel da extensão.
Se o download falhar, o build continua e o Arsenal usa os efeitos desenhados.
