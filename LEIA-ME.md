# Extensões do Owlbear (Yuri)

| Extensão | Instalar (manifest) | Código |
|---|---|---|
| Balde de Fog | https://yuriandreicarvalho72-lang.github.io/fog-fill/manifest.json | `extensoes/balde-de-fog` |
| Luz Colorida | https://yuriandreicarvalho72-lang.github.io/fog-fill/luz-colorida/manifest.json | `extensoes/luz-colorida` |
| Régua | https://yuriandreicarvalho72-lang.github.io/fog-fill/regua/manifest.json | `extensoes/regua` |

O site é gerado pelo GitHub Actions (`.github/workflows/publicar.yml`) a cada mudança em `extensoes/`.
Os arquivos compilados antigos na raiz do repositório não são mais usados e podem ser apagados.

## Visibilidade por sala

Adicione `https://yuriandreicarvalho72-lang.github.io/fog-fill/painel-mestre/manifest.json` à sala e abra **Painel do mestre** na barra de ferramentas. Cada seletor controla uma extensão do repositório. **Todos** é o padrão. **Só o mestre** retira dos jogadores os comandos daquela extensão, inclusive os do menu de contexto. A configuração é própria da sala e passa a valer nas extensões atualizadas. A lista também inclui as extensões do repositório que ainda não foram habilitadas naquela sala.

Os painéis mantêm os ícones individuais na barra superior. A opção **Só o mestre** restringe os controles quando o jogador clica no ícone. Para desativar o gerenciamento e liberar os controles para todos, selecione **Todos** em cada extensão antes de desabilitar o Painel do mestre. A Régua e o Trocador mantêm suas entradas originais.
