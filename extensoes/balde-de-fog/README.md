# Balde de Fog

Extensão do Owlbear Rodeo: um balde de tinta de fog. Você ativa a ferramenta, clica numa área do mapa (a rocha preta entre as cavernas, por exemplo), e a extensão seleciona a região de cor parecida, contorna e cobre com fog. Opcionalmente cria também paredes (Wall) no contorno.

## Como usar

1. Na cena, como mestre, abra a ferramenta **Balde de Fog** na barra de ferramentas (ou aperte `Shift+F`).
2. Clique numa área do mapa. Ela vira um fog na camada de fog, com o mesmo formato.
3. Ajuste no painel da extensão (ícone do balde no topo):
   - **Tolerância**: se o fog vazar para o chão, diminua; se ficar furado ou pegar pouco, aumente.
   - **Suavizar borda**: arredonda o contorno e tapa a porosidade da textura.
   - **Expandir / recuar**: positivo cobre também a borda de pedra; negativo deixa uma folga.
   - **Simplificar contorno**: menos pontos, mais leve.
   - **Tapar buracos menores que**: some com as manchinhas soltas dentro da área.
   - **Só a área conectada ao clique**: desligado, pega toda cor parecida do mapa de uma vez.
4. **Contorno (visão)**: além do fog, o Balde pode criar no contorno da área:
   - **obstrução do Smoke & Spectre!**: veja a seção abaixo;
   - **linha comum**: uma linha da ferramenta de desenho, rosa, que você converte com botão direito → *Convert to Obstruction* do Smoke;
   - **parede nativa do Owlbear**, para quem usa a visão dinâmica oficial.
   O controle *Simplificar o contorno* reduz os pontos da linha, o que deixa a visão mais leve.
5. **Apagar o último** desfaz o último clique. **Apagar todos** remove tudo o que o balde criou (não mexe em fog feito à mão).

### Smoke & Spectre!

O Smoke não tem código aberto, então o Balde aprende o formato das obstruções direto da sua cena:

1. No painel do Balde, em *Contorno (visão)*, escolha **obstrução do Smoke & Spectre!**.
2. Com o Smoke, desenhe uma obstrução comum (uma linha, sem porta, sem janela), selecione-a e clique em **Aprender da seleção**.
3. O painel mostra o tipo do item e as chaves do Smoke que foram copiadas. A partir daí, cada clique do balde cria, no contorno da área, obstruções com esse mesmo formato.

Se o Smoke não reconhecer as linhas criadas, use a opção **linha comum** e converta com o botão direito: aí é o próprio Smoke que cria a obstrução.

### "Não consegui ler a imagem deste mapa"

A extensão tenta baixar a imagem do mapa direto do Owlbear. Se o navegador bloquear, abra o painel e, em **Imagem do mapa**, carregue o mesmo arquivo de imagem que você usou para criar o mapa. Ele fica salvo no seu navegador, então é preciso fazer só uma vez por mapa.

## Instalar

O Owlbear carrega extensões por um link para o `manifest.json`, então a extensão precisa estar hospedada num endereço público. Há dois caminhos.

### Opção A — Netlify Drop (sem GitHub, uns 2 minutos)

1. Descompacte `balde-de-fog-site.zip`.
2. Abra https://app.netlify.com/drop e arraste a pasta descompactada para a página.
3. O Netlify dá um endereço, por exemplo `https://nome-aleatorio.netlify.app`.
4. No Owlbear: Perfil → Extensões → **Add Custom Extension** → cole `https://nome-aleatorio.netlify.app/manifest.json`.
5. Ative a extensão dentro da sala.

Crie uma conta gratuita no Netlify para o site não expirar.

### Opção B — GitHub Pages (atualiza sozinho a cada mudança)

1. Crie um repositório público no GitHub chamado **fog-fill** e envie o conteúdo de `balde-de-fog-codigo.zip`.
2. O workflow `.github/workflows/deploy.yml` compila e publica no branch `gh-pages` a cada push no `main`.
3. Em Settings → Pages, escolha "Deploy from a branch", branch `gh-pages`, pasta `/ (root)`.
4. No Owlbear: **Add Custom Extension** → `https://SEU-USUARIO.github.io/fog-fill/manifest.json`.

Se usar outro nome de repositório, o workflow ajusta os caminhos sozinho.

## Desenvolvimento

```
npm install
npm run build          # para GitHub Pages em /fog-fill/
npm run build:root     # para hospedar na raiz (Netlify, domínio próprio)
node test/run.mjs mapa.png '[[x,y]]' '{"tolerance":22}' saida.svg   # testa o núcleo fora do Owlbear
```

- `src/core.js`: seleção por cor, limpeza, contorno com furos e simplificação (sem dependências).
- `src/background.js`: registra a ferramenta e trata o clique.
- `src/panel.js`: painel de ajustes.
- `src/shared.js`: padrões, IndexedDB e conversão cena ↔ pixel do mapa.
