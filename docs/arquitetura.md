# Arquitetura do código

O Trama é uma aplicação de página única em React 18 e TypeScript, empacotada pelo Vite. Não há back-end: o modelo entra como JSON, é validado e normalizado no navegador, e todas as vistas leem o mesmo objeto normalizado a partir de um store único. Este documento descreve as camadas na ordem em que o dado passa por elas.

## Fluxo de dados

```
JSON (arquivo, modelo de partida ou Construtor)
  -> validateArchitecture     esquema Zod + referências cruzadas, mensagens em português
  -> normalizeArchitecture    índices, códigos PBS, conjuntos de rastreabilidade
       -> evaluateModel       parâmetros, budgets, modos, térmico e regras de requisito
  -> store (zustand)          arquitetura normalizada, seleção, vista, histórico de edição
  -> vistas                   Projeto, grafo 2D, cena 3D, matrizes, painéis, Construtor
       -> analyzeMission      análise de missão, memorizada por instância do modelo
```

O JSON é a única fonte de verdade. O grafo 2D e a cena 3D não guardam estado próprio do modelo; quando algo muda, o documento de entrada é reconstruído, validado e normalizado de novo, e todas as vistas recebem a nova instância.

## Pastas

| Pasta | Conteúdo |
|---|---|
| `src/domain/model` | tipos TypeScript do documento de entrada e da arquitetura normalizada |
| `src/domain/schema` | esquema Zod do JSON (versões 1 e 2 do formato) |
| `src/domain/parser` | validação, normalização, cópia do documento de entrada, estilo visual das relações e parser de comandos do Construtor |
| `src/domain/engine` | linguagem de fórmulas e motor paramétrico |
| `src/domain/analysis` | análises sobre o grafo e ponte entre o modelo e a biblioteca de missão |
| `src/domain/mission` | biblioteca de análise de missão, independente do modelo de arquitetura |
| `src/domain/export` | CSV e relatório HTML |
| `src/state` | store único (`architectureStore.ts`) |
| `src/components` | vistas React, organizadas por área |
| `src/lib` | utilitários de formatação, rótulos, download, DOM e tour guiado |
| `src/data` | modelo DemoSat-TG (`demoArchitecture.json`) e modelos de partida (`templates/`) |
| `src/styles` | CSS por área e tokens de design (`visualTokens.css`) |

O código de `src/domain` não importa React nem o store, por isso roda igual nos testes, nos scripts de `scripts/` e no navegador.

## Validação e normalização

`validateArchitecture` (`domain/parser/validateArchitecture.ts`) faz duas passagens. A primeira aplica o esquema Zod de `domain/schema/architectureSchema.ts`: tipos, faixas (altitude de 100 a 100 000 km, inclinação de 0 a 180°, TRL de 1 a 9), formatos de id e de cor. A segunda confere as referências cruzadas: categoria, pai, origem e destino de cada relação, tipo de relação, ids duplicados, número (`index`) duplicado entre tipos de relação, entidades citadas por verificações, budgets, modos e riscos, e parâmetros citados por `mission.analysis`. Cada problema vira uma mensagem em português com o caminho no JSON.

`normalizeArchitecture` (`domain/parser/normalizeArchitecture.ts`) monta o que as vistas consomem:

- índices por id de entidades, categorias e tipos de relação, e as relações de entrada e saída de cada entidade;
- códigos de PBS: com segmentos, a missão é 0, os segmentos 1 a n e os subsistemas 1.1, 2.1; sem segmentos, a missão é 1 e os subsistemas 1.1, 1.2; componentes continuam o código do pai (1.1.1). Requisitos recebem R-001, funções e demais categorias um prefixo próprio, e um `code` declarado no JSON (REQ-001) tem precedência;
- conjuntos de rastreabilidade por entidade (`domain/analysis/trace.ts`), com todos os caminhos missão, objetivo, requisito, função, subsistema, componente e verificação, e não só o primeiro;
- o resultado do motor (`evaluation`).

`inputDocument.ts` faz o caminho de volta: `toInputDocument` recupera o documento de entrada de uma arquitetura normalizada e `cloneInputDocument` devolve uma cópia que pode ser alterada sem tocar no estado atual.

## Motor paramétrico

A linguagem de fórmulas (`domain/engine/expr.ts`) é um parser de Pratt sem dependências. Ela aceita aritmética, comparações, `and`/`or`/`not`, referências `entidade.parametro`, `self.parametro` e funções estruturais que devolvem listas (`children`, `descendants`, `leaves`, `total`), consumidas por `sum`, `max`, `min`, `avg`, `rss` e `count`. A sintaxe completa está em [modelo-json.md](modelo-json.md). Como a árvore sintática pode ser percorrida antes da avaliação, o motor conhece as dependências de cada fórmula sem executá-la.

`evaluateModel` (`domain/engine/evaluate.ts`) é determinístico e roda a cada carga ou edição, nesta ordem:

1. valores derivados da órbita e da primeira estação solo (`engine.orbit_*`, `engine.station_*`) e a vida da missão;
2. coleta dos parâmetros e análise das fórmulas; referência a parâmetro inexistente vira erro no parâmetro que a usa;
3. ordenação topológica (Kahn); ciclos são reportados e não avaliados;
4. avaliação das fórmulas, margens (maturidade `cots` 5 %, `modified` 10 %, `new` 20 %, ou margem explícita) e faixas `min`/`max`;
5. budgets: soma dos donos-folha do parâmetro, com as margens de item e a margem de sistema; o budget cumpre quando o total com margens cabe na alocação;
6. modos operacionais: carga de cada modo e potência média ponderada pelas frações, que podem ser expressões;
7. valores derivados de budgets e modos (`engine.budget_*`, `engine.mode_*`, `engine.orbit_average_power_w`) e temperaturas quente e fria do nó único (`engine.thermal_hot_c`, `engine.thermal_cold_c`);
8. regras de requisito, que podem ler qualquer parâmetro e qualquer valor `engine.*`.

Os parâmetros só enxergam os valores da etapa 1; budgets, modos e temperaturas existem depois da avaliação dos parâmetros e por isso só aparecem nas regras.

## Análises sobre o grafo

| Arquivo | Função |
|---|---|
| `focus.ts` | `computeFocusedNeighbors`: o que fica em destaque quando algo é selecionado ou focado; usado pelo 2D e pelo 3D. Também calcula o deslocamento de arestas paralelas |
| `trace.ts` | rastreabilidade em vários caminhos, a partir de `allocated_to`, `satisfies`, `verifies`, `derives_from` e da hierarquia `parentId` |
| `impact.ts` | o que é afetado por uma entidade, para a aba de impacto do inspetor |
| `audit.ts` | lacunas e alertas: requisito sem origem, sem função ou sem verificação, regra violada, função não alocada, elemento físico sem interface, ligação suspeita, budget estourado, risco sem mitigação, margem de enlace, bateria ou painel subdimensionados, vida orbital, faixa térmica e outros, mais as métricas de cobertura |
| `matrices.ts` | matriz N² (subsistema ou componente), VCRM com estado propagado e grade de riscos P×I |
| `suspect.ts` | ligações suspeitas: cada ligação de rastreabilidade guarda em `reviewed` a impressão digital das duas pontas; se uma ponta muda, a ligação fica suspeita até nova revisão |
| `ripple.ts` | `computeRipple`: distância de cada entidade até a mudança, percorrendo o grafo de dependências de parâmetros e depois as regras; alimenta a onda de impacto do grafo 2D |
| `sweep.ts` | varredura de projeto: reavalia cópias do modelo para cada valor de uma variável, sem aplicar nada |
| `operations.ts` | simulação de operações por eventos (modo, carga e estado de carga da bateria) usada pela cena física |
| `objectives.ts` | objetivos da missão, venham eles de entidades `objective` ou do texto em `mission.objectives` |
| `mission.ts` | ponte entre o modelo e a biblioteca de missão (ver abaixo) |

## Biblioteca de análise de missão

`src/domain/mission` reúne funções puras que recebem números e devolvem números. Cada resultado tem o tipo `Explained<T>`: os valores mais `formula`, `assumptions` e `source`, em português, que a interface mostra em "Mostrar a conta". A biblioteca não conhece o formato do JSON.

| Análise | Arquivo | Método | Fonte |
|---|---|---|---|
| Órbita | `orbit.ts` | período, velocidade, regressão nodal por J₂, inclinação heliossíncrona, RAAN a partir da LTAN | Wertz e Larson (SMAD), cap. 6; Vallado, §9.4 |
| Eclipse | `orbit.ts` | ângulo β com a posição do Sol de `astronomy-engine`, sombra cilíndrica, varredura anual | SMAD, cap. 5 |
| Passes | `groundStation.ts`, `frames.ts` | geometria de cobertura (ρ, η, λ, alcance) e propagação Kepler com J₂, GMST IAU-82 e WGS84 | SMAD, cap. 5; Vallado |
| Enlace | `link.ts` | EIRP, perda de espaço livre, G/T, C/N₀, Eb/N₀ e margem (mínimo de 3 dB) | SMAD, cap. 13 |
| Energia | `power.ts` | potência por modo, painel (X_d, X_e, degradação), bateria (DoD) e perfil de estado de carga por órbita | SMAD, cap. 11 |
| Dados | `data.ts` | geração contra capacidade de downlink e memória para o maior intervalo sem passe | SMAD, cap. 13 |
| ΔV | `propulsion.ts` | Hohmann, mudança de plano, compensação de arrasto, Tsiolkovsky | SMAD, cap. 6 e 17 |
| Decaimento | `decay.ts` | atmosfera exponencial (Vallado, tab. 8-4), integração diária, regras de 25 anos (IADC) e 5 anos (FCC 22-74) contadas a partir do fim da missão | Vallado, §8.6 |
| Térmico | `thermal.ts` | equilíbrio radiativo de nó único, casos quente e frio, com capacidade térmica opcional | SMAD, cap. 11 |
| Massa | `mass.ts` | margens de maturidade de 5/10/20 % mais 20 % de sistema | ESA, *Margin philosophy for science assessment studies* (SRE-PA/2011.097) |

`derived.ts` calcula os valores `engine.orbit_*` e `engine.station_*` que o motor expõe às fórmulas, e `constants.ts` guarda as constantes físicas.

`domain/analysis/mission.ts` faz a ponte. `analyzeMission(arch)` resolve as entradas de `mission.analysis` (números, referências `entidade.parametro` ou `engine.*`), chama a biblioteca e devolve um relatório por seção, com a lista do que falta para cada análise. `getMissionReport` memoriza o relatório por instância do modelo, de modo que a aba Missão, a tela Projeto e a auditoria compartilham o mesmo cálculo. A varredura de projeto chama `analyzeMission(arch, { fast: true })`, que pula a varredura anual de eclipse e usa passo de 60 s nos passes.

O SGP4 (`satellite.js`) entra só como dependência de desenvolvimento, para conferir a propagação e as conversões de referencial nos testes; o bundle do app não o carrega.

## Store e edição

`src/state/architectureStore.ts` é o único store (zustand). Ele guarda a arquitetura normalizada, a seleção, a vista atual (`home`, `2d`, `3d`, `split`, `matrices`, `tutorial`), a lente do grafo, os filtros de categoria e de tipo de relação, a etapa da linha do tempo, a aba do inspetor, o tema e o rascunho do Construtor.

Toda edição feita pela interface passa por `applyEdit(label, mutate, seeds)`:

1. copia o documento de entrada com `cloneInputDocument` e aplica `mutate` à cópia;
2. valida; se a cópia for inválida, nada muda e os problemas voltam para quem chamou;
3. normaliza, empilha o documento anterior no histórico (até 50 edições) e limpa a pilha de refazer;
4. se houver `seeds` (chaves de parâmetro ou `engine.orbit_*`), calcula `computeRipple` para a onda de impacto.

`undo` e `redo` trocam documentos entre as duas pilhas. A cena física publica `liveModeId`, o modo operacional do instante simulado, e o grafo 2D apaga as entidades que não estão no `active` desse modo.

Duas regras evitam renderizações em laço com o React Flow. Nenhum seletor do store devolve um array ou objeto novo a cada chamada; as listas filtradas são calculadas com `computeVisibleEntities` e `computeVisibleRelations` dentro de `useMemo`.

## Vistas

| Pasta | Conteúdo |
|---|---|
| `components/home` | tela Projeto: veredito, cadeia da missão à verificação, cena de órbita e tutorial em vídeo com capítulos |
| `components/graph2d` | grafo em React Flow: layout em camadas, arestas com número do tipo de relação, lentes, barra de comandos com voz e navegação por teclado |
| `components/scene3d` | cena em react-three-fiber: a rede em 3D com voo WASD e minimapa, e em `physical/` o satélite em órbita com Terra, Sol, estação e simulação de tempo |
| `components/matrices` | N², VCRM e matriz de riscos |
| `components/panels` | inspetor: parâmetros editáveis, análise (cobertura, auditoria, budgets, modos), missão e varredura de projeto |
| `components/layout` | barra superior, legenda, linha do tempo, busca (Ctrl+K), exportação, tour guiado, Construtor (`TutorialView.tsx`) e entrada de voz |
| `components/json` | carga de arquivo e painel de erros de validação |

Duas funções concentram regras visuais que o 2D e o 3D compartilham. `getRelationVisualStyle` (`domain/parser/relationStyle.ts`) decide cor, traço, seta, espessura e opacidade de cada relação a partir do tipo, da criticidade e de as pontas serem de categorias diferentes. `computeFocusedNeighbors` (`domain/analysis/focus.ts`) decide o que fica aceso e o que esmaece. Uma regra nova de estilo ou de destaque entra nessas funções, e não em cada vista.

O parser de comandos (`domain/parser/commandParser.ts`) é baseado em expressões regulares e roda localmente. Ele recebe uma frase e o documento atual e devolve uma descrição e uma mutação; o Construtor aplica a mutação ao texto do editor, enquanto a barra do grafo e a busca Ctrl+K a aplicam com `applyEdit`. Os comandos aceitos estão em [comandos.md](comandos.md).

## Regras visuais

Os tokens ficam em `src/styles/visualTokens.css`, com tema escuro por padrão e tema claro para projetor e impressão.

- A cor no canvas é sempre semântica: categoria, tipo de relação ou estado, vinda do JSON. O contorno da interface é neutro.
- O vermelho é reservado a estado (falha, violação). Os estados usam `--ok`, `--warn`, `--fail` e `--info`.
- Painéis de dados têm cantos retos e bordas de 1 px; sombra só em elementos flutuantes.
- Tipografia IBM Plex Sans para a interface e IBM Plex Mono só para ids, códigos e valores, ambas empacotadas com o app.
- Movimento só em resposta a uma ação, com no máximo 200 ms e curva `cubic-bezier(0.23, 1, 0.32, 1)`, sem animação em atalhos de teclado e respeitando `prefers-reduced-motion`. A tela Projeto é a exceção: tem abertura animada uma vez por carregamento e a cena de órbita.
- Foco visível, `aria-label` em botões de ícone e elementos clicáveis como `<button>`.

## Testes

Os testes ficam ao lado do código, em pastas `__tests__` ou arquivos `*.test.ts`, e rodam com `npm test` (Vitest, 16 arquivos e 122 testes). Eles cobrem o parser de fórmulas e o motor, a validação e a normalização, o parser de comandos, as matrizes, a rastreabilidade suspeita, a edição com desfazer, a varredura, a simulação de operações, os modelos de partida e a biblioteca de missão comparada com SMAD, Vallado e `satellite.js`. O `npm run check` junta ESLint, testes e build.

## Dependências externas em tempo de execução

O app não faz chamadas de rede próprias: não há `fetch`, telemetria nem análise de uso, e o `localStorage` guarda só o tema, o estado da legenda e se o tour já foi visto. Duas bibliotecas acessam a rede:

- o reconhecimento de voz do navegador (Web Speech API), que envia o áudio ao serviço de transcrição do Chrome ou do Edge;
- o componente `<Text>` do drei (troika-three-text), usado em `scene3d/TextBillboard.tsx` sem fonte definida, que baixa a fonte dos rótulos 3D de `cdn.jsdelivr.net`.

O `<Environment>` do drei aparece só com `Lightformer`s, sem `preset`, e por isso não acessa o CDN de ambientes do drei.
