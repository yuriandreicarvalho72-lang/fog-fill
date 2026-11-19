# Estados (extensão do Owlbear Rodeo)

Estados da cena: junte itens num grupo e crie estados (Ponte: intacta → rachada → destruída; Sala: normal → alarme).
Cada estado guarda posição, rotação, tamanho, visibilidade, trava, imagem, luz (Luz Colorida) e clima (Clima) dos itens.
Em "Editando", o que você mexe no mapa é gravado no estado atual; em "Em jogo", nada é gravado.
Troque pelo painel, pelo menu do botão direito, por um botão no mapa ou pelo efeito "Mudar estado" do Gatilhos.

## Prédios e andares

- "🏢 Novo prédio (andares)" cria um grupo especial: cada estado é um andar (Térreo, 1º andar...).
- Selecione itens (mapa do andar, tokens, móveis) e use "+ seleção no andar mostrado". Cada item fica visível só no andar dele;
  ▲ subir / ▼ descer troca o andar mostrado para todos.
- Botão direito (mestre): "Mostrar andar de cima/de baixo" e "Levar para o andar de cima/de baixo" (o token muda de andar).
- Escada: Gatilhos 1.8+ efeito "Mudar de andar (Estados: prédio)", com "levar quem ativou" — o token sobe junto.
- Vigilância 1.1+: câmeras só veem quem está no mesmo andar.
- Limite: o andar mostrado é o mesmo para a mesa toda (não há um andar por jogador).

- Instalar: https://yuriandreicarvalho72-lang.github.io/fog-fill/estados/manifest.json
- Para outras extensões: canal `estados/mudar` com `{ group: id ou nome, to: "next" | "prev" | id ou nome do estado, carry?: [ids] }`
  (carry: num prédio, esses itens vão para o andar de destino). Andar de um item: `metadata["estados/andar"]` { g, f }.
- Testes do motor: `node test/core.mjs`
