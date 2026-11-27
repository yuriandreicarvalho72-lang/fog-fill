# Anonimato 1.2.0

Deixa **qualquer item do mapa** (token, objeto, forma, texto…) anônimo para os jogadores, **sem trocar o item**: luz, visão, anexos, névoa e as outras extensões continuam funcionando, porque o item é o mesmo.

## Como usar
- Botão direito no item (mestre) → **Anonimato: tornar anônimo** / **revelar**; ou abra o painel da extensão.
- Por item: *só nome/texto* ou *nome + imagem genérica* (silhueta padrão ou um link seu).
- **Trava para jogadores**: o item vai para a **camada de mapa** e ganha cadeado ao anonimizar (revelar devolve a camada e o cadeado); para mover, o mestre seleciona pela camada de mapa e destrava. Se um jogador se um jogador mover, girar, renomear ou desligar o anonimato ainda assim mexer, o mestre desfaz na hora (precisa do mestre online com a extensão ativa).
- O mestre vê um rótulo `🕶 nome verdadeiro` em cima do item (local, os jogadores não veem).

## Como funciona
O rosto verdadeiro (nome, texto, imagem) fica guardado em `metadata["anonimato/dados"].real`; o item mostra o rosto falso. Ao revelar, tudo volta e a cópia é apagada. Só o mestre líder (menor connectionId) escreve.

## Limites
- O rosto verdadeiro fica nos metadados do item (jogador técnico poderia ler).
- Apagar um item anônimo não dá para impedir nem desfazer.
- Extensões que filtram por nome (Gatilhos/Restrito) veem o nome falso.
- Imagem genérica pode distorcer tokens não quadrados.
- Não testado numa sala real do Owlbear (só no emulador).
