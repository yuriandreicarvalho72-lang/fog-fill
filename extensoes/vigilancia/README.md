# Vigilância (extensão do Owlbear Rodeo)

Câmeras, guardas e torretas com cone de visão, e a camada de Realidade Aumentada da Matriz, numa extensão só.

- Instalar: https://yuriandreicarvalho72-lang.github.io/fog-fill/vigilancia/manifest.json

## Câmeras

- Botão direito no item (câmera, guarda, torreta) → **Virar câmera (Vigilância)**. No painel: abertura, alcance (quadrados),
  direção, varredura (vai e volta, com o tempo de uma ida e volta), quem ela não vê (aliados), ver tokens escondidos.
- A direção gira junto com o item: girar o token gira o cone.
- O cone aparece só para o mestre; marque "Jogadores também veem o cone" se quiser mostrar.
- A visão para nas paredes da névoa dinâmica do Owlbear (itens WALL que bloqueiam) e nas linhas de visão do Smoke & Spectre.
- Quando um token entra no cone e a câmera vê o centro dele: o cone fica vermelho, o mestre recebe um aviso
  (os jogadores também, se marcado) e o evento vai para o Gatilhos.
- Toda câmera é também um nó da Matriz. Só câmera **ativa** vê: desativada, em loop ou hackeada não vê nem avisa.

## Matriz (RA)

- Botão direito → **Virar nó da Matriz** (porta, painel, arquivo...). Cada nó tem nome, tipo e estado
  (ativo, desativado, em loop, hackeado) e pode ficar oculto na Matriz.
- Quem vê a Matriz: o mestre, os jogadores marcados no painel e os donos de tokens com commlink/cyberdeck
  (botão direito no token → Dar commlink/cyberdeck; vale o criador do token ou o "jogador que usa este token" do Arsenal).
- O decker abre o painel (ou botão direito no nó → Hackear) e pede: hackear, pôr em loop, desativar ou reativar.
  O mestre recebe um popover para aprovar ou negar (ou liga "aprovar sozinho"); aprovado, o nó muda de estado.
- Porta: hackeada ou desativada fica destravada; ativa trava de novo.

## Visão especial (térmica / baixa luz)

- Mestre: selecione o token e marque no painel os modos que ele tem (cyberolhos, óculos, metatipo).
  Em itens: "Este item só aparece em: Térmica / Baixa luz" (rastro de calor, marca na parede, inimigo camuflado).
  O item fica escondido; quem está com o modo ligado vê uma cópia local só na tela dele (térmica ganha um brilho de calor).
- Jogador: no painel, liga e desliga os modos dos tokens dele (criador do token ou "jogador que usa este token" do Arsenal).
  Com um modo ligado, a tela dele ganha um filtro de cor (dá para desligar o filtro no painel).
- O mestre sempre vê os itens originais (escondidos, translúcidos), sem filtro.
- Andares (Estados 1.4+): a câmera só vê quem está no mesmo andar do prédio. Um token escondido só porque o andar dele
  não é o mostrado continua sendo visto pelas câmeras do andar dele.

## Integração

- **Gatilhos** (1.7+): causas "Uma câmera vê alguém" (quem ativou = quem foi visto) e "Nó da Matriz muda de estado"
  (qualquer estado ou um estado certo); efeitos "Ligar/desligar câmera", "Mudar estado do nó da Matriz" e (1.8+)
  "Ligar/desligar modo de visão" (granada de luz desliga a baixa luz de quem ativou, por exemplo).
- **Estados** (1.3+): propriedade "Câmera e nó da Matriz": cada estado guarda a câmera (direção, varredura...) e o estado do nó.
  (1.4+): propriedade "Visão especial": cada estado guarda os modos do token e o "só aparece em" do item.
- **Arsenal**: torreta = token com arma no Arsenal + câmera. Gatilho "Uma câmera vê alguém" (a torreta) →
  efeito "Disparo (Arsenal)" com atirador = torreta e alvo "+ quem ativou".
- Canais (destino ALL; só um mestre, o de menor connectionId, executa):
  `vigilancia/viu` { camera, name, tokens (novos), all } · `vigilancia/no-mudou` { id, name, type, state, prev } ·
  `vigilancia/mudar` { targets, state, from? } · `vigilancia/pedido` { node, action } ·
  `vigilancia/visao` { targets, mode: "termica" | "baixa" | "todos", on, from? } (jogador só mexe nos tokens dele).
- Dados: `metadata["vigilancia/camera"]`, `metadata["vigilancia/no"]`, `metadata["vigilancia/commlink"]`,
  `metadata["vigilancia/visao"]` { modes, on } e `metadata["vigilancia/so-em"]` nos itens;
  `vigilancia/acesso` e `vigilancia/pedidos` na cena. Cones e etiquetas da Matriz são itens locais (nada é salvo na cena).

Testes: `node test/core.mjs`
