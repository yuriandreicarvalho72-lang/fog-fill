# Arsenal (extensão do Owlbear Rodeo)

Armas de fogo animadas para a campanha Sombras de Metrópole: cada token tem um repertório de armas montado a partir
do catálogo da planilha "Equipamentos de Metrópole" (aba 03_Armas_Fogo, 429 armas) ou de armas próprias.
Mire (ferramenta Arsenal ou botão direito → Atirar aqui) e atire: todos veem traçantes, clarões, impactos,
explosões, fumaça, laser, tesla, railgun etc. Os efeitos são itens locais (nada fica salvo na cena).

- Instalar: https://yuriandreicarvalho72-lang.github.io/fog-fill/arsenal/manifest.json
- Inspirado no fluxo da extensão Embers (sem código nem animações dela: a Embers não tem licença e usa assets da JB2A, CC BY-NC-SA).
- Para outras extensões: o canal `arsenal/disparo` recebe { spec, shooter, shooterName, weapon, rounds, targets, hit } a cada tiro.
- Atualizar o catálogo: `python3 tools/catalogo.py <planilha.xlsx> src/catalog.json`
- Testes: `node test/fx.mjs` · contact sheet dos efeitos: `node test/sheet.mjs saida.png` (precisa do Playwright)
