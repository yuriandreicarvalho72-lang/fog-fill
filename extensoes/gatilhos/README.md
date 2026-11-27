# Gatilhos (extensão do Owlbear Rodeo)

Causa e efeito entre itens: armadilhas escondidas, placas de pressão, fios, portas, teleportes.
O motor roda no navegador do mestre e reage a qualquer movimento (inclusive dos jogadores), checando o
trajeto inteiro: passar por cima de uma armadilha também dispara.

- Instalar: https://yuriandreicarvalho72-lang.github.io/fog-fill/gatilhos/manifest.json
- Testes do motor: `node test/engine.mjs`

Efeitos das outras extensões (cada uma precisa estar instalada; só um mestre executa):
- **Porta da névoa** (1.10): abrir, fechar, alternar, trancar ou destrancar portas do Smoke & Spectre (linha com Enable Door; aberta =
  `doorOpen` + `disabled`, como o próprio Smoke faz) e da névoa do Owlbear (`rodeo.owlbear.dynamic-fog/doors`). Botão direito na linha
  da porta → **Gatilhos: jogadores abrem e fecham esta porta** cria um gatilho "Interagir" na própria linha: o jogador com um personagem
  ao lado usa pelo painel Gatilhos (a linha é escondida, mas o brilho aparece). Porta trancada no Smoke não abre (aviso na tela).
- **Restrito** (1.11, em qualquer gatilho "Interagir"): só funciona se o personagem do jogador (ao alcance) tiver **preso** nele
  (attachment) um item cujo nome contenha o texto pedido (ex.: "Cartão de acesso"; vale também item preso a um item preso). Sem o item,
  só aquele jogador vê a mensagem, como **aviso na tela** ou como **nota para ler** (janela com Fechar); `{item}` e `{quem}` na mensagem.
  O mestre usa sem o item. No painel do jogador o objeto aparece com 🔒.
- **Pegar item** (1.12): efeito que prende (attachment) o item (cartão, chave…) no token de quem ativou, no canto do token, no centro
  ou onde está; pode mostrar o item escondido e travar. Ele anda com o token e passa a valer para o **Restrito**. "Soltar" larga o item.
  Atalho: botão direito no item → **Gatilhos: o personagem pega este item ao chegar perto** (causa "Chegar perto", raio 1, uma vez,
  com aviso "{quem} pegou …"); para pegar clicando, troque a causa para "Interagir".
- **Gasto e cartão clonado** (1.13, no Restrito): "gasta N uso(s)" desconta um uso a cada passagem e, no último, o item some (aviso
  "{quem}: … foi gasto"). "Cartão clonado": escolha um nó da Matriz (Vigilância); se ele estiver **hackeado**, o restrito libera sem o item.
- **Inventário** (1.13, painel do jogador): lista os itens presos nos personagens dele e deixa **passar** um item para um personagem ao lado
  (o mestre confere dono, distância e se o item pode ser passado; "Pegar item" tem a opção de marcar o item como fixo). Aviso para todos:
  "Rex passou Chave para Kai". Itens presos à mão também aparecem (só imagens visíveis).
- **Condições "Só se"** (1.14, em qualquer gatilho): o gatilho só dispara se as condições valerem (todas, ou basta uma). Tipos: **nível de
  alerta** (pelo menos / no máximo / exatamente), **nó da Matriz** (algum está hackeado, nenhum está ativo…), **porta da névoa** (aberta,
  fechada, trancada), **estado de um grupo** do Estados, **quantos tokens há na área** (opção de contar escondidos) e **quem ativou carrega
  um item**. Se não valer, o gatilho não dispara e **continua armado** (não gasta o "uma vez" nem o cartão do Restrito). Em "Interagir" há uma
  mensagem para o jogador quando nada acontece (padrão "Nada acontece."). Porta que muda de comportamento = dois gatilhos no mesmo objeto, com
  condições opostas. O ⚡ do painel ignora as condições (teste). Condição sem os itens/grupo escolhidos é ignorada (o painel avisa).
- **Alerta com nível** (1.14): nível de alerta da cena de 0 a 3, com botões 🚨 no topo do painel. Efeito **Alerta: mudar o nível** (subir até um
  teto, descer até um piso, ir para um nível, zerar) e causa **O nível de alerta mudou** (qualquer nível, ou só um; só ao subir ou ao descer),
  que liga os efeitos de cada nível (luz vermelha, portas, estados). `{nivel}` nas mensagens vira o nível. Atalho: botão direito numa câmera →
  **Gatilhos: esta câmera sobe o alerta** (a câmera viu alguém → +1, aviso ao mestre). Os gatilhos de nível só rodam no mestre líder.
- **Sequências com atraso** (1.14): cada efeito tem "depois de N s" e "Disparar outro gatilho" encadeia cenas (porta abre → 5 s sirene → 10 s
  reforços). O efeito novo **Cancelar sequência pendente** tira da espera o que ainda não rodou (de um gatilho ou de todos), por exemplo quando os
  jogadores hackeiam o alarme a tempo.
- **Menu do botão direito** (1.16): botão direito num item que faz parte de algum gatilho mostra **Gatilhos deste item**, um submenu (como o
  "Colored Rings") com a lista desses gatilhos: **●/○** arma e rearma, **⚡** ativa na hora (ignora as condições; o personagem selecionado
  conta como "quem ativou"), e **Armar todos / Desarmar todos**. Vale para zona, alvo de efeito, destino, atirador, nó, item de condição e token da
  lista. A lista segue a seleção e as edições do painel. Só o mestre vê. (Na 1.15 eram uma linha por gatilho no menu; a 1.16 troca por este submenu. A 1.16.1 corrige o filtro: com mais de um item em gatilhos o submenu não aparecia.)
- **Porta com imagem** (1.21): o mesmo efeito da porta animada, **sem vídeo**. Escolha a linha da porta e/ou a imagem (Trocador); ao ativar, troca a imagem na hora (próxima ao abrir, anterior ao fechar, ou as artes que você escolher) e abre/fecha a linha da porta, alternando pelo estado. Porta trancada no Smoke não abre. Efeito "Porta com imagem" na lista de efeitos; para o jogador usar, causa "Interagir" na imagem. Teste: `tools/emulador/exemplos/gatilhos-porta-imagem.cjs`.
- **Porta animada** (1.17): efeito único que junta tudo: toca um **vídeo (VFX) por link .webm** em cima da imagem da porta (o mesmo motor de
  efeitos do Arsenal), espera "a porta muda N s depois" (a duração da animação), **troca a imagem** da porta no Trocador (fechada → aberta) e
  **abre ou fecha a linha** da porta do Smoke & Spectre (Enable Door) ou da névoa do Owlbear. **Alterna** conforme o estado: aberta usa o
  vídeo de fechar (opcional) e a imagem anterior. Sem linha, o estado fica guardado na própria imagem. "Abrir" numa porta já aberta não
  faz nada; porta trancada no Smoke avisa e não abre. Atalho: selecione a linha da porta e a imagem dela → botão direito →
  **Gatilhos: criar porta animada** (gatilho "Interagir" pronto; o jogador usa pelo painel ou clicando).
- **Efeito visual (Arsenal)**: vídeo da lista do Arsenal (sugestões no campo) ou link .webm próprio, em cima de cada item ou saindo de
  um token ("Sai de"); uma vez, por N segundos ou em loop até encerrar; **Encerrar efeito visual** pelo nome (vazio = todos).
- **Habilidade de NPC (Arsenal)**: usa uma habilidade do dossiê do NPC; os alvos dão a direção de cone, linha e área.

## Restrito e inventário (1.18.0)

O Restrito (e a condição "tem item") vale também para o item guardado no **Inventário de mesa** do jogador que controla o token (a extensão Inventário publica os nomes no metadado do jogador). Continua valendo o item preso (attachment) no token. Item de inventário não é gasto pelos "usos" do Restrito (só o preso no token).

## Mostrar handout (1.19.0)

Efeito **Mostrar handout (Handouts)**: abre a janela da extensão **Handouts** (imagem por link + texto) para quem você escolher: **só quem ativou** (o jogador dono do token que usou o objeto), **todos** ou **só o mestre**. Dá para usar um handout da biblioteca pelo nome (o painel sugere os nomes) ou escrever título, link da imagem e texto no próprio efeito; o que for escrito vence a biblioteca. `{quem}` vira o nome de quem ativou. Se quem ativou não tem jogador dono (token do mestre), vai só para o mestre, com aviso. Exemplo: objeto interagível "Quadro de avisos" + efeito Mostrar handout "Cartaz de procurado" para quem ativou. Canal para outras extensões: `handouts/mostrar` `{ nome?, titulo?, imagem?, texto?, para: "todos"|"gm"|[userId] }`.

## Mapa lógico (1.20.0)

Botão **🗺 Mapa lógico** no topo do painel: abre uma janela grande com o diagrama de quem dispara quem.
- Cada gatilho é uma caixa (borda verde = armado, tracejada = desarmado). As setas: **dispara** (corrente, azul), **rearma** (verde tracejada), **cancela** (vermelha), **alerta** (laranja: quem mexe no alerta → gatilhos "o nível de alerta mudou"), **nó da Matriz** (roxa) e **ruído** (amarela). O atraso aparece na seta (+2s).
- **Problemas** (lista à direita, clique para ir ao gatilho): causa sem zona, efeito sem alvo, corrente para gatilho apagado (erro), item apagado do mapa, gatilho desarmado que nada rearma, ciclos (laço sem parar = erro; com atraso = aviso; só "uma vez" = info), conflitos (mostrar × esconder o mesmo item na mesma causa), gatilho que só dispara à mão.
- **E se?**: clique num gatilho → "▶ E se este disparar agora?" mostra a linha do tempo (com atrasos, correntes, mudança de alerta e cancelamentos) **sem executar nada**. Escolha o nível de alerta de partida. As condições ("Só se") são supostas cumpridas. "Disparar de verdade" pede confirmação.
- A lógica está em `src/mapa.js` (testada em `test/mapa.mjs`).

## Ruído (1.20.0, com a Vigilância 1.2)

- Causa **Um guarda/câmera ouve um ruído**: escolha os guardas (vazio = qualquer um); quem ativou = o guarda que ouviu.
- Efeito **Fazer barulho**: sai do lugar de cada item escolhido, com o alcance em quadrados; a Vigilância calcula quem ouve (paredes abafam). Se o ruído estiver desligado na Vigilância, ninguém ouve.
- Canais: `vigilancia/ruido` { x, y, raio, origem, quem } e `vigilancia/ouviu` { camera, name, x, y, origem, raio }.
