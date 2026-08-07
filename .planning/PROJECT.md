# Página de Vendas — Rafael Ávila

## What This Is

Landing page de vendas, página única, para Rafael Ávila (@rafa.aviila — 16,2 mil seguidores, perfil verificado). Ele atende online, vende dois e-books na Hotmart e tem um livro publicado pela Âncora Editora. A página recebe tráfego pago do Instagram e mistura topo e fundo de funil na mesma rolagem: fisga quem chegou frio, constrói autoridade e fecha em dois destinos — WhatsApp (acompanhamento, ticket alto) e Hotmart (e-books, R$ 19,90).

Não é página institucional de apresentação. É página de conversão.

## Core Value

**Fazer quem veio do anúncio clicar no WhatsApp.** Todo o resto — e-books, livro, credenciais, prova social — existe para sustentar esse clique. Se a página ficar linda e ninguém clicar, ela falhou.

## Requirements

### Validated

(Nada ainda — projeto novo)

### Active

- [ ] Hero que prende em 3 segundos: foto real do Rafael + a promessa "Preparo mentes para o mundo real"
- [ ] Seção espelho de identificação, aproveitando os 6 ícones de conceito já existentes
- [ ] Bloco de mecanismo: o que muda e por quê (a ponte entre a dor e a oferta)
- [ ] Bloco de autoridade: 7 credenciais acadêmicas + selo Âncora Editora + perfil verificado + 16,2 mil seguidores
- [ ] Vitrine de produtos: 2 e-books a R$ 19,90 com link direto pra Hotmart + livro físico como lista de espera
- [ ] Prova social: prints dos destaques de feedback + avaliações Hotmart
- [ ] Seção de acompanhamento online → CTA WhatsApp, sem preço exibido
- [ ] FAQ / quebra de objeções
- [ ] CTA final de fechamento
- [ ] Botão WhatsApp fixo (sticky) visível durante toda a rolagem no mobile
- [ ] Meta Pixel com evento de conversão disparado em cada CTA (WhatsApp e Hotmart), com UTM
- [ ] Banner de consentimento LGPD
- [ ] Todo o conteúdo textual, preços, links e termos regulados centralizados em `config.js`
- [ ] Responsivo mobile-first — o tráfego vem do Instagram
- [ ] LCP abaixo de 2,5s

### Out of Scope

- **Backend, banco de dados, formulário de contato** — a conversão acontece no WhatsApp e na Hotmart; servidor só adicionaria superfície de ataque e custo
- **Checkout próprio** — a Hotmart já processa pagamento, entrega e reembolso dos e-books
- **Blog, múltiplas rotas, área de membros** — página única; escopo maior é outro projeto
- **Agendamento online integrado** — o WhatsApp é o canal de agendamento e ele já usa
- **Qualquer imagem de rosto gerada por IA** — destrói a credibilidade que é justamente o ativo de conversão de um profissional; as fotos reais de estúdio já existem
- **E-commerce do livro físico** — o livro ainda não saiu; entra como lista de espera

## Context

**Marca já existente.** Rafael tem posicionamento consolidado e coerente no Instagram e nas capas: preto carvão, dourado, tipografia condensada pesada, textura de concreto, luz dura. O tom é de ruptura e performance — "Menos conversa. Mais resultado.", "Pare de se sabotar. Comece a se superar.", "Preparo mentes para o mundo real." A página herda essa identidade em vez de inventar uma nova.

A referência inicial trazida pelo Victor era o arquétipo oposto (bege, verde-sálvia, serif suave, tom acolhedor) e foi descartada — atrairia o público errado e jogaria fora a marca que ele já construiu. O que se aproveita daquela referência é só o esqueleto de qualidade: respiro, hierarquia e ritmo entre seções.

**A tagline amarra tudo.** "Preparo mentes para o mundo real" (bio do Instagram) conecta diretamente com o livro "Bem-vindo ao Mundo Real". Essa é a espinha narrativa da página.

**Assets já prontos** em `assets/`: três fotos reais de estúdio (uma com fundo cinza recortável), capas frente e verso do livro físico, mockups 3D dos dois e-books, e nove ícones de conceito (mente forte, foco e disciplina, autoperformance, inteligência emocional, guia, e-book, carrinho, Instagram, escudo). Praticamente nada precisa ser gerado.

**Produtos e links** estão em `contato.md` na raiz do projeto: WhatsApp, as duas URLs da Hotmart e o Instagram.

## Constraints

- **Tech stack**: HTML/CSS/JS vanilla + GSAP + Lenis, sem build step — LP estática de conversão; velocidade de carregamento é taxa de conversão, e framework aqui só adiciona peso
- **Conteúdo**: tudo em `config.js` — o Victor precisa ajustar texto e preço sem mexer em markup, e o Rafael vai pedir alterações
- **Tipografia**: Playfair Display para display — Cormorant quebra acentuação pt-br (aprendido no projeto Essencial Click)
- **Mobile-first**: o tráfego vem de anúncio no Instagram; a maioria vai chegar pelo celular
- **Imagens**: nenhum rosto gerado por IA
- **Publicação**: só sobe no ar com autorização do Rafael

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Identidade preto + dourado, não o bege acolhedor da referência inicial | Coerência com a marca que o Rafael já construiu em 473 posts, nas capas e na editora; a referência bege atrairia o público errado | — Pending |
| CTA primário WhatsApp; e-books como vitrine com link direto pra Hotmart | Página com duas metas de peso igual converte menos; acompanhamento é o ticket alto e o WhatsApp é onde ele já fecha | — Pending |
| Vanilla + GSAP + Lenis em vez de Next.js | Uma página só, zero rotas, zero backend; build step seria custo sem retorno | — Pending |
| Termos regulados ("terapia" etc.) mantidos como o Rafael já usa, mas isolados em variáveis no `config.js` | Claude levantou que são termos regulados (Lei 4.119/62) e que ele é graduando sem CRP; Victor decidiu prosseguir — a exposição já existe em escala pública e o Rafael revisa antes de publicar. Isolar em config torna a troca uma linha, não uma reescrita | — Pending |
| Meta Pixel com evento por CTA desde o v1 | Tráfego pago confirmado; sem evento de conversão não há como otimizar campanha, e retrofitar depois perde o histórico | — Pending |
| Sem backend, sem formulário | Conversão é WhatsApp e Hotmart; servidor só adicionaria custo e superfície de ataque | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-07 after initialization*
