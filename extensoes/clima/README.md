# Clima (extensão do Owlbear Rodeo)

Climas animados em mapas e em zonas (formas): chuva, tempestade com relâmpago, chuva ácida, debaixo d'água,
neve, nevasca, brasas, cinzas, calor, fumaça, neblina, gás tóxico, sombra de nuvens, areia, folhas, esporos,
interferência da Matrix, faíscas e pulso do chefe. Shaders próprios (SkSL).

- Instalar: https://yuriandreicarvalho72-lang.github.io/fog-fill/clima/manifest.json
- Testar os shaders: `npm i -D canvaskit-wasm && node test/render.mjs mapa.jpg saida.png`

## Otimizador
Se o jogador escolher um perfil na extensão Otimizador, o Clima obedece só no computador dele:
- Equilibrado: até 2 camadas por mapa/zona, 80% da densidade.
- Leve: 1 camada por mapa/zona (a primeira ligada), 60% da densidade.
- Apresentação: sem clima.
"Limpar sobras" apaga e redesenha os efeitos.
