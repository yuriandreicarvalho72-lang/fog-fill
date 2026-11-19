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

## Acompanha o token
Cada luz colorida é um efeito preso ao token (`attachedTo`): a cor anda junto na hora, ao arrastar, pela Régua,
no teleporte do Gatilhos e na troca de estado do Estados. Token escondido ou apagado: a cor some junto.
O efeito não gira nem cresce com o token (o raio vem da luz do Dynamic Fog).

## Limites
- Até 16 luzes coloridas ao mesmo tempo (dá para subir no painel, até 24).
- Enquanto o token é arrastado, a sombra das paredes acompanha; a direção de luzes em cone só se ajusta ao soltar.
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
node test/segue.mjs              # a luz acompanha o efeito preso ao token (sem novos uniforms)
```
