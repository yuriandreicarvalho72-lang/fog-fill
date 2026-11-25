# Inventário de mesa para Owlbear Rodeo

A extensão é publicada em https://yuriandreicarvalho72-lang.github.io/fog-fill/inventario/manifest.json pelo fluxo do repositório. No perfil do Owlbear, abra Add Extension, cole a URL de manifest.json e habilite Inventário de mesa na sala.

Do dispositivo guarda arquivos no navegador imediatamente. Na primeira colocação, vincule a imagem à coleção do Owlbear para compartilhá-la na cena. Da minha coleção importa referências existentes. Da cena copia as peças selecionadas e mantém os originais no mapa. Atribua uma categoria pelo seletor da peça e use Categoria para filtrar. Colocar adiciona um Prop ao centro da sua visão. Para Anexar, selecione primeiro o objeto que deve receber o Attachment.

O inventário é pessoal, salvo no navegador por jogador e pela origem da extensão. Limpar os dados do site remove as classificações locais. A cena compartilhada recebe apenas as peças que você coloca. A extensão usa referências para peças hospedadas no Owlbear e armazena os arquivos do dispositivo separadamente no navegador e exibe até 30 entradas por página inicial.

Para desenvolver, use npm ci e npm run build. Para testes locais, sirva dist em localhost.

Use o menu ☰ para alternar entre Inventário, Manipular peças e Decorar em camadas. As ferramentas atuam sobre um Prop ou Attachment selecionado no mapa. Guardar adiciona a referência ao inventário pessoal e retira a peça da cena. Desfazer usa o histórico de cena do Owlbear. A ordem de desenho é ajustada dentro da camada atual de cada peça.
