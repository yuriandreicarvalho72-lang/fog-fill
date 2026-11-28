# Seleção total (extensão do Owlbear Rodeo)

Ferramenta de seleção só do mestre que pega **qualquer item**, inclusive os **trancados**, o **fog** e o **mapa**, que a seleção normal do Owlbear não alcança.

- Instalar: https://yuriandreicarvalho72-lang.github.io/fog-fill/selecao/manifest.json

## Como usar

1. Na barra de ferramentas (lado esquerdo) escolha **Seleção total** (atalho Shift+S).
2. **Clique** num ponto: seleciona o item mais específico ali (o menor). **Clique de novo no mesmo ponto**: passa para o próximo da pilha, e assim vai descendo até o fog e o mapa. Um aviso mostra o item, a camada e "2 de 5".
3. **Shift / Ctrl / Cmd + clique** soma ou tira o item da seleção atual.
4. **Arraste** para desenhar uma caixa: seleciona os itens que cabem **inteiros** dentro dela (o fog e o mapa, enormes, não entram). Com **Alt** ao soltar, pega **tudo que encosta** na caixa, inclusive fog e mapa.
5. Clicar num lugar sem item tira a seleção.
6. Com o item selecionado, o botão direito e os painéis das outras extensões funcionam nele normalmente (o Owlbear só não deixa mover o que está trancado).

## Limites

- A área de clique é a **caixa** do item (retângulo que o contém). Um fog ou caminho torto responde dentro da caixa, não só sobre o traço; por isso a pilha por clique repetido.
- Em cenas com milhares de itens o clique pode demorar um instante (a caixa de cada item é calculada no clique).
- Só o mestre vê a ferramenta. Aparece no Painel do Mestre como "Seleção total" (liga/desliga a visibilidade).
- Testado no emulador (clique, pilha até o fog e o mapa, soma com Shift, caixa e caixa com Alt). Ainda não numa sala real do Owlbear: em especial se a seleção por extensão de itens trancados fica ativa para o botão direito e para o fog do Dynamic Fog.
