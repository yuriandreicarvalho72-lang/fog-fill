# Otimizador (extensão do Owlbear Rodeo)

Um "Optifine" para as nossas extensões: cada jogador escolhe um perfil de desempenho **só para o computador dele**,
e o Arsenal, a Luz Colorida, o Clima e a Vigilância obedecem. Também mede o que pesa na cena e limpa sobras.

- Instalar: https://yuriandreicarvalho72-lang.github.io/fog-fill/otimizador/manifest.json

## Perfis
| | Arsenal | Luz Colorida | Clima | Vigilância |
|---|---|---|---|---|
| Sem perfil | como configurado | como configurado | como configurado | como configurado |
| Máximo | tudo | todas as luzes | todas as camadas | cones a cada 0,16 s |
| Equilibrado | tudo | até 10 luzes, 32 trechos de parede | até 2 camadas por mapa, 80% densidade | cones a cada 0,25 s |
| Leve | sem vídeos JB2A e cápsulas, intensidade 80% | até 6 luzes, 16 trechos, sem animação | 1 camada por mapa, 60% densidade | cones a cada 0,5 s |
| Apresentação | sem vídeos e cápsulas, intensidade 60% | desligada | desligado | cones a cada 1 s, sem filtro de cor |

**Ajuste fino**: mude qualquer valor e o perfil vira Personalizado. Com mais luzes coloridas do que o limite, ficam as mais
perto do centro da tela.

## Limpar sobras
Manda as extensões apagarem e redesenharem os itens locais (efeitos, miras, cones, filtros). O mestre também pode limpar
para todos os jogadores.

## Diagnóstico
Itens por camada, imagens pesadas (mais de 4096 px ou 16 megapixels; o mestre seleciona com um clique), tokens com imagem
maior que 1024 px, pontos de parede, luzes coloridas, camadas de clima e os itens locais deste computador por extensão
(quantos são shaders). As dicas aparecem no topo.

## Como funciona
O perfil fica no navegador (`localStorage`, chave `otimizador/perfil`). Todas as nossas extensões estão no mesmo site,
então leem o mesmo valor. Ao mudar, o painel avisa pelo canal local `otimizador/perfil`; "limpar" usa `otimizador/limpar`.
O arquivo `src/perf.js` é igual em todas as extensões que obedecem: mude em todas juntas.

## Limites
- Não muda o desenho do próprio Owlbear (mapas, névoa dinâmica, tokens) nem de extensões de outras pessoas.
- O perfil vale para o navegador: outro computador, ou janela anônima, começa sem perfil.
- Extensões antigas (antes de Arsenal 1.4.1, Luz Colorida 1.2.1, Clima 1.0.1, Vigilância 1.1.1) ignoram o perfil.

## Desenvolvimento
`npm install` · `npm run build` · `node test/diag.mjs`
