# Comandos do Construtor e de voz

O Trama aceita frases curtas em português que mudam o modelo. O parser (`src/domain/parser/commandParser.ts`) é baseado em regras e roda no próprio navegador; a internet só entra quando a frase é ditada, porque a transcrição da voz é feita pelo navegador (ver o README).

## Onde digitar ou falar

| Lugar | Como a mudança é aplicada |
|---|---|
| Barra de comandos do **Construtor** | muda o JSON do editor; nada chega ao modelo aberto até clicar em **Aplicar** (ou **Aplicar e ir 2D/3D**). Um comando que deixa o JSON inválido só mostra os problemas |
| Barra do **Grafo 2D** ("Diga ou digite...") | muda o modelo na hora, com validação; o grafo mostra o elemento novo e Ctrl+Z desfaz. Se o resultado for inválido, a mudança é recusada e a mensagem explica por quê |
| Busca **Ctrl+K** | quando o texto tem duas palavras ou mais e forma um comando, ele aparece como primeira opção da lista; Enter aplica, com desfazer |

O botão **Falar** (Construtor e grafo) grava uma frase em português, mostra a transcrição enquanto se fala e executa o comando quando a frase termina. Funciona no Chrome e no Edge, com permissão de microfone. No Construtor, a tecla `/` leva o cursor para a barra de comandos.

Maiúsculas e minúsculas não importam, e as palavras-chave aceitam acento ou não (`órbita` e `orbita`, `função` e `funcao`), com as exceções indicadas abaixo.

## Como os elementos são encontrados

Quando um comando cita um elemento existente, o Trama procura nesta ordem: id exato (`eps`), nome exato (`Bateria Li-ion`) e, por fim, o primeiro elemento cujo nome contém o texto (`bateria` encontra "Bateria Li-ion"). Códigos como `REQ-001` ou `1.1.2` não servem para encontrar elementos. Se dois elementos têm o mesmo nome, vale o primeiro do arquivo; no DemoSat-TG, "Transmitir dados" é tanto um requisito quanto uma função, e o id (`func_transmit`) desfaz a ambiguidade.

## Criar elementos

```text
adicione um subsistema chamado Bateria sob EPS
criar componente chamado Painel solar sob EPS
crie um componente chamado Magnetômetro sob adcs na etapa 7
crie um objetivo chamado Monitorar desmatamento
crie um requisito chamado Revisita de 3 dias
nova função chamada Armazenar dados
crie uma verificação chamada Teste de vibração
adicionar um segmento chamado Segmento de usuário
adicione a entidade Estação Natal tipo segmento sob Missão
```

A forma geral é `<verbo> [um|uma] <categoria> chamado|chamada <nome> [sob <pai>] [na etapa <n>]`, com os verbos `adicione`, `adicionar`, `crie`, `criar`, `novo`, `nova` ou `add` (a forma `adiciona` não é reconhecida). A outra forma é `<verbo> entidade <nome> [tipo <categoria>] [sob <pai>] [na etapa <n>]`.

| Parte | Regra |
|---|---|
| Categoria | id ou nome em português: missão, objetivo, segmento, requisito, função, subsistema, componente, verificação (também `sub`, `comp`, `req`, `func`, `verif`) |
| Pai | uma palavra só: o id (`eps`, `adcs`) ou uma palavra do nome (`Missão`); depois de `sob`, `dentro de` ou `em` |
| Etapa | opcional; sem ela, o elemento entra na mesma etapa dos outros da categoria |

Três cuidados:

- Para objetivos, use o artigo: `crie um objetivo chamado ...`. Sem o artigo (`novo objetivo chamado ...`, `adicione objetivo chamado ...`) o comando não reconhece a categoria.
- Como o pai é uma palavra, `sob Subsistema de potência` não funciona (o texto vira parte do nome); use `sob eps`.
- Um nome que termina em "em <palavra>" é lido como nome mais pai: em `crie um requisito chamado Operar em eclipse`, o Trama procura um pai chamado "eclipse". Nesses casos, crie com outro nome e renomeie depois.

## Ligar elementos

```text
conectar EPS a OBC tipo potência
ligar Bateria ao PCDU tipo potência
conecte a Câmera ao OBC tipo dados
conectar Gerenciar energia a EPS tipo alocado
conecte Teste em vácuo térmico a Faixa térmica tipo verifica
conectar Capturar imagem a Imagear regiões de interesse tipo deriva
crie uma relação de Câmera para OBC tipo dados
```

A forma é `conectar|conecte|ligar|ligue|associar|associe <origem> a|ao|à|com|em|no|na <destino> [tipo <tipo>]`, ou `crie uma relação [de|entre] <origem> para|com <destino> [tipo <tipo>]`. A origem é quem fornece, envia, satisfaz ou verifica. Nomes que contêm "a" ou "em" funcionam, porque o parser tenta outra divisão da frase quando a primeira não encontra os elementos.

| Palavra depois de `tipo` | Tipo de relação |
|---|---|
| potência, fornece potência | `provides_power_to` |
| dados, envia dados | `sends_data_to` |
| comando, telecomando | `sends_command_to` |
| mecânica, fixação | `mechanically_attached_to` |
| térmico, térmica | `thermally_coupled_to` |
| satisfaz | `satisfies` |
| alocado | `allocated_to` |
| verifica | `verifies` |
| qualquer parte do nome ou do id de outro tipo, como `deriva` | o tipo correspondente |

Sem `tipo`, a relação usa o primeiro tipo da lista do modelo (no DemoSat-TG, "Satisfaz requisito").

## Órbita

```text
órbita 600 km
órbita 550 km inclinação 97,6 ltan 10:30
órbita inclinação 98
órbita ltan 13
altitude 500
mude a altitude para 650 km
defina a órbita para 700 km
```

A frase começa por `órbita`, `orbita`, `orbit` ou `altitude`, ou por um verbo (`defina`, `mude`, `altere`, `coloque`) seguido dessas palavras. Altitude em km, de 100 a 100 000; inclinação em graus, com vírgula ou ponto; LTAN em horas, com ou sem minutos. Só mudar a inclinação também pede a palavra órbita no começo: `inclinação 98` sozinho não é reconhecido.

## Renomear, remover e mudar cor

```text
renomear EPS para Subsistema elétrico
renomeie Painéis solares para Painel solar
remover Reaction wheels
apagar a entidade Bateria
exclua PCDU
mudar a cor de requisito para #ff8800
trocar a cor do componente para #22c55e
```

Quando a entidade renomeada tem o mesmo id de `mission.id`, como no esqueleto do Construtor, o nome da missão muda junto. Remover apaga o elemento e todas as relações dele. Se outra parte do modelo citar o elemento removido (um modo, um budget, uma verificação ou uma fórmula), o JSON fica inválido: no Construtor os problemas aparecem na lista, e na barra do grafo a remoção é recusada. No DemoSat-TG, por exemplo, `remover bateria` esbarra no modo Eclipse, que lista a bateria entre os elementos ativos.

Os verbos aceitos são `renomear`/`renomeie`; `remover`/`remova`, `apagar`/`apaga`, `excluir`/`exclua`, `deletar`; e `mudar a cor`, `muda a cor`, `trocar a cor` ou `troca a cor`. As formas `apague` e `mude a cor` não são reconhecidas.

## Categorias e tipos de relação

```text
criar categoria Interface cor #22c55e
crie uma categoria chamada Carga útil
crie um tipo de relacao chamado Fluxo óptico cor #38bdf8
```

Sem cor, o Trama escolhe uma da paleta. No comando de tipo de relação, escreva "relacao" sem cedilha: com "relação" o comando não é reconhecido. Por voz, a transcrição sempre traz a cedilha, então é mais simples usar o botão **+ Adicionar** da coluna "Tipos de relação" do Construtor e editar o nome depois.

## Outros comandos

| Comando | Efeito |
|---|---|
| `ajuda` ou `comandos` | lembra que os exemplos estão abaixo da barra do Construtor |
| `limpar`, `limpar tudo` ou `apagar tudo` | esvazia entidades e relações no editor do Construtor, para começar do zero; categorias e tipos de relação ficam. Na barra do grafo é recusado, porque o modelo precisa de ao menos uma entidade |

Para começar um projeto vazio, o botão **Esqueleto mínimo** do Construtor carrega uma missão e o vocabulário completo de categorias e tipos de relação, e os comandos acima funcionam a partir dele.
