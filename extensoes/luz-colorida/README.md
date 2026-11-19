# Luz Colorida

Extensão do Owlbear Rodeo que dá cor às luzes do **Dynamic Fog**. Não substitui o Dynamic Fog: lê as luzes e paredes dele e pinta a cor por cima, com um shader que respeita as paredes.

## Uso
1. Num token que já tem luz do Dynamic Fog, clique com o botão direito → **Cor da luz**.
2. Escolha uma das cores prontas ou qualquer cor, e a intensidade. **Sem cor** volta à luz branca.
3. No painel da extensão (ícone da lâmpada no topo), ajuste:
   - **Mistura**: Brilho (padrão), Tingir, Luz suave, Somar ou Só a cor.
   - **Camada**: sob os tokens (só o chão recebe a cor) ou sobre os tokens.
   - **Paredes**: liga/desliga a sombra e o limite de trechos de parede.
   - **Ajuste da direção**: corrige luzes em cone que saírem viradas.

## Limites
- Até 8 luzes coloridas aparecem ao mesmo tempo.
- A sombra usa no máximo os trechos de parede mais próximos das luzes (48 por padrão).
- Cada jogador desenha a cor no próprio computador, como o Dynamic Fog faz com as luzes.

## Instalar
Publicada junto do Balde de Fog, na subpasta `luz-colorida/` do repositório `fog-fill`:
`https://yuriandreicarvalho72-lang.github.io/fog-fill/luz-colorida/manifest.json`

## Desenvolvimento
```
npm install
npm run build            # gera dist/ com base /fog-fill/luz-colorida/
node test/shader.mjs saida.png   # compila o shader com CanvasKit e renderiza um teste
```
