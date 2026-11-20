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
- **Efeito visual (Arsenal)**: vídeo da lista do Arsenal (sugestões no campo) ou link .webm próprio, em cima de cada item ou saindo de
  um token ("Sai de"); uma vez, por N segundos ou em loop até encerrar; **Encerrar efeito visual** pelo nome (vazio = todos).
- **Habilidade de NPC (Arsenal)**: usa uma habilidade do dossiê do NPC; os alvos dão a direção de cone, linha e área.
