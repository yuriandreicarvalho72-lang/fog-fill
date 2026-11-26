# Régua (extensão do Owlbear Rodeo)

Régua no estilo Roll20: mover token por pontos, medir distância e áreas de D&D.

- Instalar: https://yuriandreicarvalho72-lang.github.io/fog-fill/regua/manifest.json
- Build: `npm install && npm run build` (pasta `dist/` vai para `regua/` no repositório fog-fill)
- Testes: `node test/geom.mjs` e `node test/session.mjs`

## Mover: segurar e soltar (1.6.0)

Novo modo da barra (✋), ao lado do "Mover personagem", que continua igual.
- **Segure o token e arraste**: ele sobe (fica um pouco maior e deixa uma sombra no chão, como nos tokens do Ordem Paranormal). **Solte**: a posição fica marcada como um ponto do caminho, com a distância.
- **Segure de novo o token marcado** para mudar a última marca; **clique esquerdo em outro lugar** para acrescentar um ponto (mudar a rota). **Backspace** desfaz a última marca.
- **Botão direito** (ou Enter) confirma: o token anda ponto a ponto pelo caminho, como no modo original (Smoke & Spectre, Gatilhos e terreno difícil continuam valendo). **Esc** cancela e o token fica onde estava.
- A sombra e o "levantar" têm uma opção no painel ("Sombra e levantar o token enquanto segura"). "Confirmar com: duplo clique ou Enter" vale também aqui (sem a camada transparente, o botão direito não confirma).
- A lógica fica em `src/grab.js` (testada em `test/grab.mjs`); o desenho do token levantado está em `liftLook` (`src/geom.js`).

1.6.1: o modo segurar e soltar guarda o token do "down" (o evento de arrastar nem sempre traz o item) e avisa na tela se algo falhar.

1.6.2: corrigido o arrasto no modo segurar e soltar. No filtro preventDrag do Owlbear, "verdadeiro" libera o arrasto padrão (token andando sozinho); agora o padrão só vale fora dos tokens.

1.6.3: caixa "Mostrar avisos de diagnóstico ao segurar" no painel (avisa na tela o que o Owlbear mandou ao apertar e ao arrastar).

1.6.4: ao soltar, o rótulo mostra a distância até a marca (antes aparecia 0 depois que a camada do botão direito assumia) e a sombra ficou mais escura e maior.

1.6.5: no modo segurar e soltar, arrastar o chão (ou fora da marca) move o mapa. A régua faz isso sozinha porque o Owlbear não move a vista nesse modo.

1.6.6: cada marca ganha um anel tracejado do tamanho do token (visível mesmo com o token em cima). Com a camada do botão direito ativa, arrastar o chão move o mapa e só o clique sem arrastar acrescenta um ponto.
