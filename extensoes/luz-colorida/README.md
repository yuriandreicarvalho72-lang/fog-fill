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

## Obstrução do Smoke & Spectre (1.4.0)

A sombra da luz agora respeita também as **linhas de obstrução do Smoke & Spectre** (linhas e curvas com "vision line"), além das paredes do Dynamic Fog.
- **Porta do Smoke:** fechada bloqueia a luz; aberta (ou linha desativada) deixa passar. Abrir pelo Gatilhos ou pela ronda da Vigilância atualiza a luz sozinha.
- Vale para as luzes de token e para as **luzes pontuais** (habilidades do Arsenal, efeitos soltos), que antes não tinham sombra. Na luz pontual as paredes são as do momento em que ela acende.
- Painel: **Obstrução do Smoke & Spectre também bloqueia** (ligado por padrão); "As paredes bloqueiam a cor" desliga toda sombra.
- Entram no limite de trechos de parede (padrão 48; o Otimizador reduz).
- **Formas lidas (1.4.1):** linha, curva, caminho (PATH), retângulo e círculo. Abaixo da opção, o painel mostra o que achou (ex.: "3 ativas (2 LINE, 1 PATH); 7 trechos") e avisa se há obstrução de tipo que ele não consegue ler.

## Luzes pontuais (1.3.0)

Outras extensões (habilidades do Arsenal, efeitos soltos) pedem uma luz colorida num ponto do mapa, sem token: canal `luz-colorida/pontual` (`{ id, x, y, cor, raio (px), intens, anim, dur, fade }`) para luzes de até 8 s, ou a lista `luz-colorida/pontuais` no metadado da cena para as longas. Cada navegador desenha a sua, com a mesma camada e mistura dos ajustes, e apaga suavemente. Máximo de 10 ao mesmo tempo; o Otimizador (luz desligada) vale. Sombra de parede desde a 1.4.0 (ver acima).

## Limites
- Até 16 luzes coloridas ao mesmo tempo (dá para subir no painel, até 24).
- Enquanto o token é arrastado, a sombra das paredes acompanha; a direção de luzes em cone só se ajusta ao soltar.
- A sombra usa no máximo os trechos de parede mais próximos das luzes (48 por padrão).
- Cada jogador desenha a cor no próprio computador, como o Dynamic Fog faz com as luzes.

## Otimizador
Se o jogador escolher um perfil na extensão Otimizador, a Luz Colorida obedece só no computador dele:
- Equilibrado: até 10 luzes coloridas e 32 trechos de parede.
- Leve: até 6 luzes, 16 trechos, sem animação (tremular, pulsar).
- Apresentação: sem luz colorida (a luz branca do Dynamic Fog continua).
Com mais luzes do que o teto, ficam as mais perto do centro da tela. "Limpar sobras" apaga e redesenha os efeitos.

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
