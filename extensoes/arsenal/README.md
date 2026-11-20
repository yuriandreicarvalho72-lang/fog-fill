# Arsenal (extensão do Owlbear Rodeo)

Armas de fogo animadas para a campanha Sombras de Metrópole: cada token tem um repertório de armas montado a partir
do catálogo da planilha "Equipamentos de Metrópole" (aba 03_Armas_Fogo, 429 armas) ou de armas próprias.
Mire (ferramenta Arsenal ou botão direito → Atirar aqui) e atire: todos veem o disparo. Os efeitos são itens locais
(nada fica salvo na cena).

- Instalar: https://yuriandreicarvalho72-lang.github.io/fog-fill/arsenal/manifest.json
- Animações em vídeo do **JB2A** (projéteis, clarões, sangue, explosões, fumaça, raios...), como na extensão Embers.
  Cápsulas, mira laser, área de supressão, fios do taser e espuma continuam desenhados. Cada jogador pode desligar
  os vídeos no painel (Aparência) e ver só o efeito desenhado.
- Painel de mira: abre no canto da tela enquanto a ferramenta Arsenal está ativa (atirador, arma, munição, modo, alvos com
  distância e faixa de alcance). Na mira: clique = alvo · Shift+clique = atirador · Tab = próximo atirador · Enter = atirar ·
  R = recarregar · Esc = limpar.
- **Cobertura (d20)**: ao mirar, cada alvo mostra a cobertura vista do atirador (painel de mira, painel e rótulo no mapa):
  sem cobertura, meia (+2 de defesa), três quartos (+5) ou total (sem linha de tiro; a mira fica cinza).
  Paredes da névoa dinâmica do Owlbear (e linhas de visão do Smoke & Spectre) contam sozinhas: 5 linhas do atirador até o
  centro e os cantos do alvo; 1-2 bloqueadas = meia, 3-4 = três quartos, todas = total. Caixote, carro, mureta: botão direito →
  **Arsenal: é cobertura** (clique de novo para três quartos, total, nada). Os bônus são da mesa (o mestre muda no painel,
  em Aparência). Com cobertura total a bala bate no obstáculo (poeira na parede, faíscas no caixote) em vez de atravessar;
  errando ("Errou") um alvo com meia ou três quartos, a bala também bate na cobertura. Granadas jogadas passam por cima.
- **Cenário destrutível**: botão direito (mestre) → **Arsenal: tornar destrutível** (parede da névoa, porta, carro, caixa, painel).
  Padrão: aguenta 3 tiros pesados ou 1 explosão (tiros e explosões somam; 0 = esse dano não conta). Tiros pesados = metralhadora
  média/pesada, fuzil de precisão, gauss, plasma e canhão (marque "qualquer tiro conta" para valer qualquer arma); explosões =
  granada (raio 2), lança-granadas (2), foguete (3), canhão (1,5) e cargas. Ao quebrar: o item some, é apagado, troca a imagem
  (Trocador) ou fica; paredes ligadas a ele abrem (param de bloquear); pode mudar um grupo do Estados e disparar um gatilho.
  Todos veem poeira e destroços (JB2A). Só um mestre conta o dano; "Consertar" no painel volta tudo.
- **Cargas plantadas**: painel → Cargas (temporizador com contagem para todos ou só para quem plantou, ou detonação remota; raio)
  e **📍 Plantar no mapa** (modo da ferramenta Arsenal): clique no chão ou num objeto para colar a carga nele. A carga fica
  escondida (quem plantou vê uma cópia; o mestre vê a original). Detonar: no painel, no painel de mira ou no botão direito.
  A explosão (JB2A) danifica o cenário no raio, avisa o mestre de quem foi pego e explode outras cargas por perto.
  Desarmar: quem plantou e o mestre desarmam direto; outro jogador pede (botão direito, se o mestre mostrar a carga) e o mestre
  aprova ou nega no painel.
- **Habilidades dos NPCs** (ícone próprio na barra, só o mestre): o prompt de fichas gera um **dossiê** (bloco JSON) com cada ação do
  stat block. Botão direito no token do NPC → **Habilidades (dossiê)** → cole o dossiê. O painel lista Ações, Ações bônus, Reações,
  Lendárias, Covil e Passivas com os números da ficha (ataque, CD, dano, condição). 🎯 = mirar (clique no alvo ou no ponto; aparece a
  prévia do cone/linha/área) e **Usar** (ou Enter); ▶ = usa na hora (aura, em si, passiva). Todos veem a animação JB2A e o contorno da
  área; o resultado (quem ficou dentro e os números) fica no topo do painel, sem aviso na tela. **Não rola dados**: o mestre rola na mão. Contadores: recarga (marque "recarregou" quando o
  d6 da ficha sair), 1/descanso, ações lendárias por rodada (com custo), aviso de ação de covil repetida; botões Nova rodada e Descanso.
  Ataque Múltiplo encadeia os ataques de `faz`. **🎨** em cada habilidade troca o visual (vídeo JB2A), com prévia; a lista **Visuais disponíveis**
  no painel mostra todos, por grupo (clique = prévia; com o 🎨 aberto, o clique troca). Dados: `metadata["arsenal/dossie"]` e `metadata["arsenal/hab-uso"]` no token;
  canal `arsenal/habilidade` (todos tocam a animação). Os 120 visuais aceitos estão em `src/abil.js` (`VISUAIS`), iguais aos do prompt (borboletas, pétalas, sangue, corações, correntes, vórtice...;
  20 deles vêm do Boss Loot FX: flecha de sangue, lança, tornado de fogo, muro de fogo, engrenagens, sinalizador...).
- **Efeitos próprios** (1.6): (1) arquivos .webm no GitHub em `extensoes/arsenal/public/meus-efeitos/<tipo>/` (tipos: `alvo`, `area`,
  `em-si`, `projetil`, `linha`, `cone`; arquivo solto = `area`). O build gera `meus-efeitos/lista.json` e cada arquivo vira o visual
  `meu_<nome do arquivo>` (grupo "Meus efeitos" no 🎨 e na lista). (2) Link direto para um .webm no 🎨 da habilidade ("Usar um vídeo
  próprio"), com o tipo; fica em `video: { url, tipo }` na habilidade e vence o visual. Largura, altura e duração são lidas do próprio vídeo
  no navegador antes de tocar (`src/meus.js`). Projétil, linha e cone próprios: o vídeo inteiro vai do NPC até o alvo/fim da área,
  começando na borda de onde ele "sai"; "O vídeo aponta para" (→ ↓ ← ↑, campo `video.giro` 0/90/180/270) diz para onde o efeito vai dentro
  do vídeo. Ver `public/meus-efeitos/LEIA-ME.txt`.
- **Direção e linha** (1.7): cone e linha giram para onde o NPC aponta com qualquer visual (visual de ponto num cone fica um só, no meio do
  cone, virado; numa linha é **lançado** do NPC até o ponto). A linha vai até o ponto clicado (no máximo o comprimento da ficha) e quem
  ficou dentro é contado nesse trecho. Visual de linha/cone numa habilidade de alvo sai do NPC e chega no alvo.
- **Duração** (1.7): no 🎨 de cada habilidade, **uma vez**, **por N segundos** (em loop) ou **em loop até eu encerrar** (campo
  `duracao` no dossiê: número de segundos ou `"fim"`). O vídeo principal fica no mapa para todos (inclusive quem entra depois); a lista
  **Efeitos no mapa** no topo do painel mostra o tempo que falta, ✕ em cada um e **Encerrar todos**. Fica no metadado da cena
  `arsenal/efeitos-ativos` (máximo 12; os mais antigos saem); cada navegador desenha com itens locais; o mestre líder tira os vencidos.
  O "Limpar" do Arsenal não apaga esses efeitos.
- **Pedidos do Gatilhos** (1.7; destino ALL, só o mestre líder executa): `arsenal/efeito` { visual? | video: { url, tipo, giro? }, from?
  (token de onde sai), targets: [ids], dur (0 | segundos | "fim"), tamanho? (quadrados), tag (nome para encerrar), origem } ·
  `arsenal/efeito-fim` { tag ("" = todos) } · `arsenal/habilidade-usar` { token (NPC com dossiê), nome, targets } (os alvos dão a direção
  de cone/linha/área; usa os contadores). O build gera `visuais.json` (todos os visuais por grupo), que o painel do Gatilhos usa para sugerir nomes.
- **Otimizador**: se o jogador escolher um perfil na extensão Otimizador, o Arsenal obedece neste navegador (Leve e Apresentação
  desligam os vídeos JB2A e as cápsulas e baixam a intensidade do efeito desenhado). "Limpar sobras" apaga efeitos e miras que ficaram.
- Jogadores: o mestre dá armas ao token e escolhe "Jogador que usa este token". O jogador vê só os tokens dele.
  Se o jogador não puder editar o token, a munição é descontada pelo mestre (precisa de um mestre na sala).
- Para outras extensões: o canal `arsenal/disparo` recebe { spec, shooter, shooterName, weapon, rounds, targets, hit } a cada tiro.
- Disparo pedido por outra extensão (ex.: Gatilhos): mande para `arsenal/atirar` (destino ALL)
  { shooter, weapon?, mode?, targets: [{ id } | { at }], hit?, impact? }. Só um mestre executa.
- Cenário e cargas para outras extensões (destino ALL; só o mestre líder executa): `arsenal/destruido` { id, name, at, by } ·
  `arsenal/explodiu` { id, at, radius, by, caught } · `arsenal/detonar` { ids (cargas ou itens com cargas coladas), op: "detonar" | "desarmar" }.
  Gatilhos 1.9: causas "Um objeto foi destruído" e "Uma carga explodiu"; efeito "Carga (Arsenal): detonar ou desarmar".
  Dados: `metadata["arsenal/destrutivel"]` e `metadata["arsenal/carga"]` nos itens.
- Atualizar o catálogo: `python3 tools/catalogo.py <planilha.xlsx> src/catalog.json`
- Testes: `node test/fx.mjs` · `node test/cover.mjs` · `node test/destroy.mjs` · `node test/abil.mjs` · fotos dos efeitos desenhados: `node test/sheet.mjs saida.png` ·
  fotos dos vídeos no lugar certo: `npm run jb2a && node test/jb2a-sheet.mjs saida.png` (precisam do Playwright)

## Créditos e licença das animações

Animações: **JB2A** — https://jb2a.com — pacote gratuito, licença
[Creative Commons Atribuição-NãoComercial-CompartilhaIgual 4.0 (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/).

Animações das habilidades com o prefixo `BLFX/`: **Boss Loot FX Assets** (Boss Loot Team) — pacote gratuito
https://github.com/boss-loot/boss-loot-assets-free — [licença](https://github.com/boss-loot/boss-loot-assets-free/blob/ce4f413b4ee62e019433005b29bd860c7e77a678/LICENSE)
(uso, cópia e distribuição com crédito). Os vídeos não foram alterados.

Os vídeos não estão neste repositório: o build (`npm run build`) baixa os 241 arquivos usados (armas e habilidades), sem alteração, dos
repositórios oficiais (JB2A: https://github.com/Jules-Bens-Aa/JB2A_DnD5e, commit fixo em `src/jb2a.js`; Boss Loot FX: commit fixo em `src/abil.js`)
para `public/jb2a/`,
e eles são publicados junto com a extensão. Uso não comercial; o crédito aparece no painel da extensão.
Se o download falhar, o build continua e o Arsenal usa os efeitos desenhados.
