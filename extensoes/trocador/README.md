# Trocador (extensão do Owlbear Rodeo)

Troca a arte de tokens e objetos entre imagens guardadas neles: normal / ferido / disfarçado, porta aberta / fechada,
lâmpada acesa / apagada, forma humana / forma de espírito. A troca muda só a imagem (e o tamanho da grade dela):
posição, escala, rotação, nome e os dados de outras extensões ficam como estão.

- Instalar: https://yuriandreicarvalho72-lang.github.io/fog-fill/trocador/manifest.json
- **Botão direito → Trocar imagem**: miniaturas dentro do próprio menu; clique numa para trocar (◀ ▶ = anterior/próxima).
  O mestre também tem **+ imagens** (abre o seletor de imagens do Owlbear) e **guardar atual**.
- **Botão direito → Próxima imagem**: atalho que só aparece em itens que já têm imagens guardadas.
- **Painel** (botão **⚙** no menu Trocar imagem; não há ícone na barra de cima): lista do item selecionado com nome, ordem (▲ ▼) e remover (✕); copiar a lista para os
  outros itens selecionados (ex.: todos os guardas com as mesmas artes); opção de trocar o nome do item junto com a imagem.
- Vários itens selecionados: clicar numa imagem troca todos; cada um usa a sua imagem **de mesmo nome** (ou recebe a escolhida).
- Jogadores trocam a imagem dos itens que podem editar. Só o mestre adiciona imagens.

## Integração

- **Gatilhos** (1.6+): ação **Trocar imagem (Trocador)** — alvos + próxima / anterior / nome da imagem
  (ex.: ao pisar na placa, a porta vira "Aberta"; ao cair abaixo de metade, o token vira "Ferido").
- **Estados** (1.2+): o Estados guarda a imagem de cada estado do item; os membros mostram 🖼 com o nome da imagem do
  Trocador quando ela tem um. Os dois não brigam: o Trocador descobre qual imagem está em uso pela URL.
- Para outras extensões: mande para `trocador/trocar` (destino ALL) `{ targets: [id], to: "next" | "prev" | nome | id, from? }`.
  Só um mestre executa; se nenhum alvo tiver a imagem pedida, aparece um aviso. Depois de cada troca o canal
  `trocador/trocou` recebe `{ items: [{ id, name }] }`.
- Dados: lista de imagens em `metadata["trocador/imagens"]` (`{ id, name, url, mime, w, h, dpi, offset }`).

Inspirado na extensão [Changr](https://github.com/MissingLinkDev/changr) (MIT); código escrito do zero.

Testes: `node test/core.mjs`
