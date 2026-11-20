# Tetos

Extensão do Owlbear Rodeo: tetos (telhado, laje, andar de cima) que **somem só para quem entra**, sem colocar a imagem na camada de fog. A fog continua preta onde ninguém vê, e a visão dentro da casa continua sendo a das paredes do Smoke & Spectre.

Instalar: `https://yuriandreicarvalho72-lang.github.io/fog-fill/tetos/manifest.json`

## Como usar

1. Coloque a imagem do teto sobre a casa (camada Prop ou Mapa, tanto faz).
2. Botão direito (mestre) → **Tetos: marcar como teto**. O original fica escondido; cada navegador desenha uma cópia na camada Attachment, **abaixo da fog**.
3. No painel (ícone da casa) escolha o modo de cada teto:
   - **Some só para quem está dentro** (padrão): cada jogador vê o teto sumir quando o personagem *dele* entra. O mestre vê sumir quando há qualquer jogador dentro.
   - **Some para todos quando alguém entra**.
   - **Só some quando o mestre abrir** (botão *abrir* / *Abrir todos*).
4. Botão direito num token do mestre → **Tetos: este token revela tetos** (para o personagem de um jogador que o mestre criou). NPCs do mestre não revelam o teto.

## Regras

- "Dentro" = o ponto do token está na caixa da imagem do teto (retângulo; teto girado usa a caixa que o envolve).
- Quem revela: tokens criados por jogadores, ou marcados com "este token revela tetos".
- "Meu personagem" = token criado por aquele jogador.
- Outras extensões abrem e fecham tetos pelo canal `tetos/abrir`: `{ ids?: [...], nome?: "casa", op: "abrir" | "fechar" | "alternar" }` (só o mestre executa).

## Limites

- Não funciona sem a extensão no navegador do jogador (o original fica escondido). Em sala, a extensão da sala carrega para todos.
- O teto some inteiro, sem esmaecer (o Owlbear não tem opacidade de imagem).
- Teto em L: a imagem é um retângulo; recorte a arte com transparência, mas a área de "dentro" continua sendo o retângulo.
- Ainda não testado numa sala real do Owlbear (só no emulador).
