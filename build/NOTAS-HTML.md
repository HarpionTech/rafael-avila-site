# Decisões do index.html

Estas notas viviam como comentários dentro do `index.html`. Saíram de lá porque
o HTML é servido como está: todo comentário aparece para qualquer pessoa que abra
o código-fonte da página. CSS e JS não têm esse problema — o build os minifica, e
os comentários do fonte ficam pelo caminho.

O build recusa qualquer comentário novo no HTML que não seja marcador funcional
(`seo:inicio`, `seo:fim`). Para documentar algo daqui em diante, é neste arquivo.

### `<title>Rafael Ávila — Terapeuta comportamental | Terapia online</title>`

Nome primeiro porque o trafego do Instagram procura por ele; o servico logo depois porque quem chega pelo Google procura por "terapia online" e "terapeuta comportamental", nao pelo nome. 56 caracteres: acima de ~60 o Google corta no meio.

### `<link rel="icon" href="data:,">`

Sem ícone até a marca existir. `data:,` é um recurso vazio e válido: o navegador considera o favicon declarado e nem chega a pedir /favicon.ico, então a aba fica limpa E sem o 404 que a simples ausência da tag traria. Quando houver logotipo, build/favicon.py gera os arquivos de novo.

### `<link rel="preload" as="image" href="assets/preloader-1920.webp?v=dd53b8d5fd2b" imagesrcset="assets/preloader-1280.webp?`

O preload vai para a CORTINA, não para a hero: quem pinta primeiro e vira o "maior conteúdo" medido pelo Google é a imagem do preloader, que cobre a tela inteira antes de qualquer outra coisa. Priorizando a hero, o navegador gastava a banda mais cara com uma imagem que só aparece depois da cortina abrir — e o elemento que de fato define o LCP ficava na fila atrás dela. A hero mantém fetchpriority="high" na própria tag e chega a tempo, porque tem os segundos da animação de abertura para carregar.

### `<style>/* css-critico:inicio */:root{--header-height: 60px;--paper: #0b0b0c;--paper-light: #121214;--paper-deep: #17171a`

Escrito pelo build a partir do próprio style.css. Não editar à mão: o que estiver aqui é substituído no próximo `npm run build`.

### `<script>document.documentElement.dataset.cssAdiado = '';</script>`

Quem marca o adiamento é o próprio JavaScript, e essa inversão é a parte importante: sem JS, o atributo nunca aparece, a regra de ocultação nunca casa e o conteúdo fica visível desde o primeiro quadro — sem depender de `!important` no <noscript> para desfazer o que outra regra fez. O <noscript> abaixo cuida só de trazer a folha de volta como bloqueante.

### `<link rel="stylesheet" href="assets/build/site.min.css?v=6cea28b03e47" media="print" onload="this.media='all';document.d`

`media="print"` faz o navegador baixar sem bloquear a pintura, e o onload devolve para `all` assim que chega. Sem isso, a cortina — que é o primeiro quadro inteiro — esperava a folha completa mesmo com a imagem já em cache, e era daí que vinham 87% do LCP. O FOUC que a técnica normalmente cobra não aparece aqui: enquanto a folha não chega, a cortina cobre a tela, e o CSS dela já veio inline acima.

### `<script>`

A cortina é opt-in: sem JavaScript o estado base já é a página final. O watchdog é independente de main.js e sempre libera a viewport.

### `<div class="preloader" data-preloader role="status" aria-label="Carregando">`

A cortina é DUAS metades da mesma sala, encostadas na linha do meio. É o que permite a luz abrir a fresta ali e as metades se afastarem a partir dela. As duas <img> apontam para a mesma URL: uma requisição só.

### `<a class="brand" href="#inicio" aria-label="Rafael Ávila — início">`

Âncora, não URL. Apontando para /terapia o navegador recarregava a página inteira a cada clique — cortina, scripts e tudo —, quando a intenção é só voltar ao topo. O header fixo é compensado pelo scroll-padding-top que já existe no CSS.

### `<img src="assets/perfil-640.webp?v=9e66357487ba" srcset="assets/perfil-640.webp?v=9e66357487ba 640w, assets/perfil-1254.`

O CSS limita este retrato a 560px de largura, então a versão de 640 serve a maioria das telas e a de 1254 fica para as de alta densidade. `sizes` diz o espaço real, senão o navegador assume a viewport inteira e escolhe sempre a maior.

### `<p>Para tirar dúvidas e entender como funciona, chame no WhatsApp. Para acompanhar conteúdos e publicações, encontre Raf`

Acompanha o rótulo do card ("Detalhes") e a mensagem que o botão já escreve: quem chega aqui vem perguntar, não fechar.

### `<svg class="sticky-wa__icone" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.2A12.8 12.8 0 0 0 5.1 22.7L3.6 28.4l`

Só o ícone. Sem texto visível, o rótulo acessível tem de vir do aria-label: leitor de tela anunciaria "link" e nada mais.

### `<script defer src="assets/build/tracking.min.js?v=d9b8fda82e34"></script>`

Depois do main.js porque depende do módulo de consentimento que ele publica. Não carrega Google nem Meta por conta própria: pede permissão e espera — com os IDs vazios no config, fica inerte.

## Scripts inline

Estes comentarios viviam dentro das tags `<script>` do HTML. Comentario de
JavaScript inline vai para o ar igual ao comentario de HTML — o arquivo nao
passa por minificacao.

- Quem chega de anuncio nao ve a cortina. Ela custa de 6 a 9 segundos ate a primeira palavra sobre terapia (piso de 2,5 s + espera do livro 3D + 1,7 s de abertura). Para quem chega pelo link normal isso e a assinatura da pagina; para quem veio de clique pago e a diferenca entre ler a oferta e desistir antes dela. O anuncio direto para o WhatsApp abre a conversa em zero segundo — a pagina nao pode competir com isso cobrando nove. A marca do clique pago esta sempre na URL: gclid/gbraid/wbraid e gad_source no Google, fbclid no Meta, msclkid no Bing, alem dos utm_*.

- A cortina ainda nao foi lida pelo parser neste ponto, entao quem a remove e o script logo abaixo dela. Aqui so nao se liga o interruptor: sem .preloader-capable o CSS ja a mantem em display:none, e nao existe instante em que ela aparece.

- Precisa rodar DEPOIS da cortina existir e ANTES de main.js (que e defer, e so executa com o documento inteiro lido). A hero fica pausada enquanto [data-preloader] estiver no DOM — nao basta esconder, tem de sair.

