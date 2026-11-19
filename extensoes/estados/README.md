# Estados (extensão do Owlbear Rodeo)

Estados da cena: junte itens num grupo e crie estados (Ponte: intacta → rachada → destruída; Sala: normal → alarme).
Cada estado guarda posição, rotação, tamanho, visibilidade, trava, imagem, luz (Luz Colorida) e clima (Clima) dos itens.
Em "Editando", o que você mexe no mapa é gravado no estado atual; em "Em jogo", nada é gravado.
Troque pelo painel, pelo menu do botão direito, por um botão no mapa ou pelo efeito "Mudar estado" do Gatilhos.

- Instalar: https://yuriandreicarvalho72-lang.github.io/fog-fill/estados/manifest.json
- Para outras extensões: canal `estados/mudar` com `{ group: id ou nome, to: "next" | "prev" | id ou nome do estado }`.
- Testes do motor: `node test/core.mjs`
