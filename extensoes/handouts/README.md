# Handouts

Mostra aos jogadores uma **imagem por link** e um texto, numa janela. A imagem vem do endereço, então não ocupa o armazenamento do Owlbear.

- **Instalar:** `https://yuriandreicarvalho72-lang.github.io/fog-fill/handouts/manifest.json`
- Painel: ícone **Handouts** na barra de cima.

## Mestre
- Monte o handout: título, link da imagem (com prévia) e texto (`**negrito**` e `_itálico_`).
- **Mostrar para todos**, **Ver (só eu)** para conferir, ou **Mostrar só para alguns jogadores** (marque quem).
- **Guardar na biblioteca** (até 60, fica na sala): ▶ mostra para todos, ✎ carrega no formulário, ✕ apaga. O título é o nome que o Gatilhos e outras extensões usam.
- O link é convertido quando possível: página do GitHub (`blob`) → arquivo direto, Dropbox `dl=0` → `raw=1`, Google Drive compartilhado → imagem direta.

## Jogadores
- A janela abre sozinha com a imagem e o texto. Clique na imagem para alternar entre ajustar à janela e tamanho real. Esc fecha.
- O **Diário** (no painel) guarda o que já apareceu para você (até 60, neste navegador); clique para ler de novo.

## Gatilhos
Efeito **Mostrar handout** (Gatilhos 1.19): o jogador usa um objeto interagível e só ele vê a imagem e a nota; ou todos veem. Veja o README do Gatilhos.

## Para outras extensões
Mensagem `handouts/mostrar` (broadcast ALL): `{ nome?, titulo?, imagem?, texto?, para: "todos" | "gm" | [userId], origem? }`. Com `nome`, completa pela biblioteca.

## Limites
- O link precisa ser **direto para o arquivo** e aberto a qualquer pessoa. GitHub Pages/raw e Imgur costumam funcionar; links do Discord expiram; se o arquivo sair do ar, a janela avisa que não abriu.
- Só o mestre cria e guarda handouts na biblioteca. O diário é do navegador de cada um.
- Testado no emulador local, ainda não numa sala real do Owlbear.
