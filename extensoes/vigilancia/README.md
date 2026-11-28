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

## Otimizador
Se o jogador escolher um perfil na extensão Otimizador, a Vigilância obedece só no computador dele:
o cone das câmeras que giram é redesenhado a cada 0,25 s (Equilibrado), 0,5 s (Leve) ou 1 s (Apresentação), e o
Apresentação desliga o filtro de cor da visão térmica/baixa luz. Quem a câmera vê continua sendo conferido no ritmo normal
pelo mestre. "Limpar sobras" apaga e redesenha cones, nós e filtros.

## Ruído (1.2)

- Painel → **Ruído**: a caixa **Ruído ligado** é a chave geral (desmarcada, ninguém ouve nada). Alcance em quadrados do tiro (15), do corpo a corpo (4), dos passos da Régua (0 = sem ruído de passos) e quanto do alcance sobra a cada parede no caminho (0,5 = metade).
- Quem ouve: câmeras/guardas com **Ouve ruídos** marcado (e ativas). Tiros do Arsenal fazem barulho sozinhos; "fazer no item selecionado" cria um barulho à mão.
- O mestre vê um círculo do alcance por alguns segundos e recebe o aviso "👂 Guarda ouviu…". O barulho de um andar não chega ao outro (Estados).
- Se o guarda está em ronda e "Vai investigar ruídos" está ligado, ele deixa a rota, anda até o local, espera e volta.

## Painel sem piscar (1.3.2)

O painel só se redesenha quando algo que ele mostra muda (câmeras, nós, rondas, nomes, seleção, jogadores). Mover ou girar itens (a ronda dos guardas, tokens) não o redesenha mais. Antes, cada movimento de qualquer item do mapa refazia o painel inteiro e ele piscava sem parar. Teste: `tools/emulador/exemplos/vigilancia-painel-sem-piscar.cjs`.

## Ronda de guardas (1.2)

- Selecione o guarda → **Criar ronda**. **＋ Ponto** põe um marcador de rota (o primeiro na posição do guarda, os outros no centro da tela); arraste os marcadores. Os pontos e a rota (linha laranja com números) só o mestre vê.
- Marque **Em ronda**: o mestre líder move o token pela rota (velocidade em quadrados/s, pausa em cada ponto, ciclo ou vai e volta). (1.2.1) A imagem do token **não gira**: o guarda só guarda para onde olha (metadado `vigilancia/olhar`, o cone segue isso) e a imagem é **espelhada** (esquerda/direita) quando ele olha para a esquerda; a arte deve estar virada para a direita. Deixe a direção da câmera em 0°. Sem "gira", o cone usa a rotação do token como antes.
- **Portas (1.3.1):** o guarda abre a porta (Smoke & Spectre, linha com Enable Door) ao chegar a 1 quadrado e, depois de passar (a mais de 1,6 quadrado), a **fecha** ou a **deixa aberta**, conforme a opção "Portas" da ronda (ou **ignora**). Ele faz uma pausa curta ao abrir. Porta trancada ele não abre; porta que já estava aberta ele não fecha. A névoa do próprio Owlbear ainda não é aberta pela ronda.
- **Para ao ver alguém** por alguns segundos (0 = não para) e **investiga ruídos**.
- Só um mestre move os guardas (o líder). Desmarcar "Em ronda" para o guarda onde está.

## Verdade por jogador (1.2)

- Selecione o item → **Ativar** em "Verdade por jogador". O original fica escondido para os jogadores (você continua vendo); cada jogador vê a **primeira versão que cita ele**, senão a de "todos os outros", senão nada.
- Cada versão pode trocar a imagem (link direto), o texto, ou esconder o item de quem cair nela. Serve para disfarce, ilusão, aura ou alucinação.
- A cópia é local, na tela de cada jogador, e acompanha o original (posição, giro, tamanho). **Desfazer a verdade** mostra o item de novo.

## Etiquetas de RA (1.3)

- Botão direito em qualquer item → **Etiqueta de RA (Vigilância)** (ou painel → "🏷 Etiqueta de RA"). Escreva um título e uma informação por linha
  (nome do aparelho, dono, nível de segurança...). A etiqueta aparece embaixo do item, na camada de texto, **só para quem tem RA**:
  você, os jogadores marcados no painel e os donos de tokens com commlink/cyberdeck. O jogador pode desligar a RA no painel dele.
- `{estado}` no texto vira o estado do nó da Matriz do próprio item (ativo, em loop, hackeado...). Hackear o painel muda a etiqueta sozinho.
- **Só aparece a até N quadrados:** usa os tokens com commlink do jogador; quem foi só marcado pelo mestre, sem token, vê sempre. 0 = sempre.
- **Só para:** lista de jogadores; nenhum marcado = todos com RA.
- **Aparece mesmo com o item escondido:** aparelho que só existe na RA (escuta, antena, host). O mestre vê todas, também as de itens escondidos.
- Metadado do item: `vigilancia/etiqueta` = `{ on, titulo, linhas, cor, alcance, para: [ids], mesmoOculto }`. A etiqueta é local (cada navegador desenha a sua).

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
  `vigilancia/visao` { targets, mode: "termica" | "baixa" | "todos", on, from? } (jogador só mexe nos tokens dele) ·
  `vigilancia/ruido` { x, y, raio (quadrados), origem?, quem? } (um barulho; o líder calcula quem ouve) · `vigilancia/ouviu` { camera, name, x, y, origem, raio }.
  Ouve também `arsenal/disparo` e `regua/caminho` (passos, se ligados).
- Dados: `metadata["vigilancia/camera"]`, `metadata["vigilancia/no"]`, `metadata["vigilancia/commlink"]`,
  `metadata["vigilancia/visao"]` { modes, on } e `metadata["vigilancia/so-em"]` nos itens;
  `vigilancia/ronda` { on, speed, pausa, modo, girar, parar, investiga, espera }, `vigilancia/ponto` { g, n } (marcador de rota) e `vigilancia/verdade` { on, versoes: [{ para: [id] | "*", imagem?, texto?, esconder? }] } nos itens;
  `vigilancia/ruido` { on, tiro, corpo, passos, paredes } na cena; `vigilancia/acesso` e `vigilancia/pedidos` na cena. Cones e etiquetas da Matriz são itens locais (nada é salvo na cena).

Testes: `node test/core.mjs` e `node test/extra.mjs`

## Ignorar por lista e ícone do comlink (1.4.2)

- **Não vê (aliados):** agora há uma **lista para escolher** (e × para voltar a ver) no painel da câmera. Antes só dava com "usar seleção", que trocava a seleção e fechava o painel da câmera. "usar seleção" continua existindo.
- **Ícone do comlink** na barra lateral de ferramentas do Owlbear (só para jogadores): um toque abre o painel da Matriz (nós ao redor, hackear, ver pela câmera).

## Guardas não ativam a câmera (1.4.1)

- Antes, uma câmera que via um guarda (um token que também é câmera) disparava o aviso e os gatilhos "câmera vê alguém". Agora ela ignora guardas e outras câmeras.
- Para uma câmera específica ver guardas de novo (ex.: vigiar guardas inimigos), marque **Vê guardas e outras câmeras** no painel dela.
- Guarda que não foi transformado em câmera continua sendo visto; use "Não vê (aliados)" para ignorá-lo.

## Ver pela câmera e nós ao redor (1.4.0)

- **Painel Matriz (só quem tem commlink/cyberdeck):** o painel lateral lista os **nós ao redor**, ordenados pela distância (em quadrados) até o commlink mais perto do jogador. O campo **Alcance do seu commlink** (padrão 12; 0 = todos) esconde o que está longe e diz quantos ficaram de fora. Jogador liberado pelo mestre sem token com commlink vê todos, sem distância. Quem não tem acesso continua vendo só o aviso.
- **Ver pela câmera:** o botão **👁 Ver pela câmera** aparece só para câmeras **hackeadas** (o hack já passa pela aprovação do mestre). A tela do jogador é **enquadrada na câmera** e tudo fora do cone fica **escuro** (máscara local na camada Pointer, só nesta tela; o cone respeita as paredes e acompanha a varredura). **■ Parar de ver a câmera** devolve o enquadramento. Se o mestre desfaz o hack (ou a câmera some), a visão cai sozinha. O mestre pode ver por qualquer câmera, para testar.
- **Limite:** o Owlbear não deixa um jogador ver o mapa que o fog dele esconde. A máscara escurece o resto, mas dentro do cone continua valendo o fog do jogador: para ele ver a área, ela precisa estar revelada.
- Testes: `node test/core.mjs`; `tools/emulador/exemplos/vigilancia-ver-pela-camera.cjs`.
