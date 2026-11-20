# Emulador do Owlbear Rodeo (para testar as extensões sem sala real)

Uma página "hospedeira" que imita a API do Owlbear (SDK 3.1) e carrega a extensão em um iframe: cena com itens, metadados,
mensagens (broadcast), menu de contexto, notificações e janelas. Dá para simular mestre e jogadores e ver o que a extensão faz.
Não é o Owlbear de verdade: o que o SDK real faz diferente (ex.: `updateItems` manda a propriedade inteira alterada) está nos exemplos.

## Uso

```bash
tools/emulador/run.sh gatilhos            # compila e sobe (8001 = hospedeiro, 8002 = extensões); deixe rodando
NODE_PATH=$(npm root -g) node tools/emulador/exemplos/gatilhos-restrito-inventario.cjs   # em outro terminal
```

Precisa de Node, Python 3 e Playwright (`require('playwright')` já vem no ambiente do Claude Code).

## Como escrever um teste

Copie um exemplo. O padrão é: abrir `http://localhost:8001/index.html`, definir `window.items`, `window.meta` e os
`window.responders` (respostas às chamadas OBR_*), carregar a extensão com `window.load(url?obrref=...)` e disparar eventos com
`window.emit('OBR_...', dados)`. Mensagens enviadas pela extensão ficam em `window.sent`.
Para o painel, carregue `.../<ext>/index.html`; para o motor, `.../<ext>/background.html`.
