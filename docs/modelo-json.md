# Como escrever um modelo

Um modelo do Trama é um arquivo JSON. Ele pode ser carregado pelo botão **Carregar JSON**, colado no editor do Construtor (**Ver JSON**) ou montado do zero por comandos ([comandos.md](comandos.md)). Ao carregar, o Trama valida o arquivo e lista cada problema com o caminho no JSON e uma explicação em português; um modelo inválido não substitui o que está aberto.

O arquivo [exemplo-minimo.json](exemplo-minimo.json) é um ponto de partida que carrega sem erros: uma missão, dois requisitos com regra, dois subsistemas, três componentes, um budget de massa e dois modos. Os modelos completos ficam em `src/data/demoArchitecture.json` (DemoSat-TG) e `src/data/templates/cubesat3u.json` (AmbSat-3U).

## Estrutura geral

| Bloco | Obrigatório | Conteúdo |
|---|---|---|
| `metadata` | sim | nome do projeto, versão, descrição e `schemaVersion` |
| `categories` | sim, ao menos uma | tipos de elemento, com cor e forma |
| `relationTypes` | sim, ao menos um | tipos de ligação, com número, cor e traço |
| `entities` | sim, ao menos uma | os elementos do sistema |
| `relations` | sim (pode ser vazio) | as ligações entre elementos |
| `mission` | não | órbita, estações solo, vida útil e entradas da análise de missão |
| `budgets` | não | budgets de massa, potência ou outro parâmetro |
| `modes` | não | modos operacionais e suas cargas |
| `verifications` | não | linhas da VCRM |
| `risks` | não | riscos para a matriz 5×5 |
| `views` | não | etapa inicial e número de etapas da linha do tempo |

Ids de entidades, categorias, tipos de relação, relações, budgets, modos, verificações, riscos e estações usam só letras, números, `_` e `-`, e não se repetem dentro do mesmo bloco. Cores são hexadecimais (`#rgb` ou `#rrggbb`).

## metadata

```json
"metadata": { "projectName": "MiniSat", "version": "0.1.0", "description": "...", "schemaVersion": 2 }
```

`schemaVersion: 2` indica o formato com parâmetros, regras, modos e órbita. Arquivos sem esse campo são lidos como formato 1, que é um subconjunto do 2.

## categories

```json
{ "id": "requirement", "label": "Requisito", "color": "#82b1ff", "shape2D": "document", "shape3D": "flatPanel" }
```

| Campo | Valores |
|---|---|
| `shape2D` | `hexagon`, `document`, `rounded`, `group`, `box`, `check`, `diamond` |
| `shape3D` | `sphere`, `flatPanel`, `capsule`, `box`, `smallBox`, `diamond`, `bar` |

Qualquer id de categoria é aceito, mas oito deles têm significado para as análises e convém usá-los quando o elemento for desse tipo:

| Id | Uso |
|---|---|
| `mission` | raiz da árvore de produto e da rastreabilidade |
| `objective` | objetivos da missão; requisitos derivam deles por `derives_from` |
| `requirement` | requisitos, numerados R-001 se não tiverem `code` |
| `function` | funções, alocadas a subsistemas ou componentes |
| `segment` | segmentos (espacial, solo, lançamento), nível 1 da árvore de produto |
| `subsystem` | subsistemas; entram na N² e no PBS |
| `component` | componentes; código PBS continua o do pai |
| `verification` | atividades de verificação, ligadas a requisitos por `verifies` |

Com segmentos, a missão recebe o código 0, os segmentos 1 a n e os subsistemas 1.1, 2.1 conforme o segmento-pai. Sem segmentos, a missão é 1 e os subsistemas 1.1, 1.2. Categorias de outros ids recebem um prefixo com as três primeiras letras do id.

## relationTypes

```json
{ "id": "provides_power_to", "index": 3, "label": "Fornece potência", "color": "#f2c14e",
  "lineStyle": "solid", "directed": true, "description": "A origem alimenta o destino." }
```

`index` é o número que aparece sobre a aresta no grafo e na legenda; não pode se repetir. `lineStyle` é `solid`, `dashed` ou `dotted`. `directed` diz se a aresta tem seta. `description` é obrigatória.

Seis ids são tratados como rastreabilidade: `allocated_to`, `satisfies`, `verifies`, `derives_from`, `refines` e `contains`. Os demais tipos, quando ligam subsistemas ou componentes, são interfaces: aparecem na matriz N² e na lente "Interfaces" do grafo 2D. O DemoSat-TG usa `provides_power_to`, `sends_data_to`, `sends_command_to` (origem é quem comanda), `mechanically_attached_to` e `thermally_coupled_to`.

## entities

```json
{ "id": "bateria", "name": "Bateria", "category": "component", "parentId": "eps", "step": 4,
  "parameters": [ { "id": "capacidade_wh", "name": "Capacidade", "unit": "Wh", "value": 40 } ] }
```

| Campo | Descrição |
|---|---|
| `id`, `name`, `category`, `step` | obrigatórios; `step` é a etapa da linha do tempo em que o elemento aparece |
| `parentId` | pai na hierarquia (componente dentro de subsistema, subsistema dentro de segmento ou missão) |
| `code` | código oficial exibido no lugar do gerado, como `REQ-001` |
| `short` | sigla ou nome curto, como `EPS` |
| `description` | texto livre |
| `parameters` | parâmetros de engenharia (ver abaixo) |
| `requirement` | campos de requisito (ver abaixo) |
| `status` | `planned`, `in_progress`, `passed`, `failed`, `verified` ou `waived` |
| `trl` | nível de maturidade tecnológica, de 1 a 9 |
| `budgets`, `metadata`, `position2D`, `position3D`, `subsystem` | campos do formato 1, ainda aceitos |

### Parâmetros

| Campo | Descrição |
|---|---|
| `id` | começa com letra ou `_` e usa só letras, números e `_` |
| `unit` | obrigatória; use `"-"` para grandeza adimensional |
| `value` ou `formula` | um dos dois é obrigatório; havendo fórmula, o valor é ignorado |
| `maturity` | `cots` (5 %), `modified` (10 %) ou `new` (20 %), a margem de maturidade da filosofia de margens da ESA |
| `margin` | margem explícita em fração (0,2 = 20 %); tem precedência sobre `maturity` |
| `min`, `max` | faixa aceitável; fora dela, o parâmetro gera um alerta |
| `name`, `source`, `notes`, `history` | descritivos; `source` é `estimated`, `computed`, `reference` ou `measured` |

Todo parâmetro com `value` aparece como campo editável no inspetor. Parâmetros com fórmula são recalculados a cada mudança.

### Requisitos

```json
"requirement": {
  "text": "A massa seca, com margens, deve ser de no máximo 6 kg.",
  "type": "constraint",
  "priority": "must",
  "rule": "engine.budget_massa_total <= 6",
  "verification": { "method": "Analysis", "level": "Sistema" }
}
```

`type` é `functional`, `performance`, `interface`, `environmental`, `operational` ou `constraint`; `priority` é `must`, `should` ou `could`. Também existem `rationale`, `acceptance` e `derivesFrom` (lista de ids de requisitos-pai). `verification.method` é `Test`, `Analysis`, `Inspection`, `Review of Design`, `Demonstration` ou `Rule`.

`rule` é uma expressão que precisa resultar em verdadeiro ou falso. O resultado aparece como "atende" ou "viola" no grafo, no inspetor, na tela Projeto e na auditoria. A regra é uma previsão de projeto: o estado da VCRM vem das entradas de `verifications`, não da regra.

## relations

```json
{ "id": "r2", "type": "provides_power_to", "source": "eps", "target": "obc", "step": 3,
  "label": "Barramento regulado", "criticality": "high" }
```

`criticality` (`low`, `medium`, `high`, `critical`) engrossa a aresta e entra na contagem de interfaces críticas. `reviewed` guarda a impressão digital das duas pontas na última revisão de rastreabilidade; ele é escrito pelo próprio Trama (ação "Registrar a revisão das ligações de rastreabilidade" da busca Ctrl+K) e não precisa ser editado à mão. Quando uma ponta muda depois da revisão, a ligação fica suspeita.

## mission

```json
"mission": {
  "id": "missao", "name": "MiniSat",
  "orbit": { "altitudeKm": 550, "inclinationDeg": 97.6, "ltanHours": 10.5, "epoch": "2027-03-21T00:00:00Z" },
  "groundStations": [ { "id": "gs_sjc", "name": "Estação solo", "latDeg": -23.21, "lonDeg": -45.86, "minElevationDeg": 10 } ],
  "lifetimeYears": 3
}
```

A órbita aceita `altitudeKm` (100 a 100 000), `inclinationDeg` (0 a 180), `eccentricity` (padrão 0; as análises supõem órbita circular), `raanDeg` ou `ltanHours` (hora local do nodo ascendente, para órbitas heliossíncronas) e `epoch` (data ISO usada para a posição do Sol). Cada estação tem latitude, longitude, `altKm` e `minElevationDeg` (padrão 10°); os valores `engine.station_*` usam a primeira estação da lista. `objectives` pode listar os objetivos como texto, mas entidades da categoria `objective` permitem rastreá-los.

Só com a órbita e a estação o Trama já calcula período, eclipse, β, passes e contato diário. As demais análises pedem entradas em `mission.analysis`. Cada entrada aceita um número, uma referência `entidade.parametro` ou um valor `engine.*`; com referência, mudar o parâmetro muda a análise.

| Seção | Entradas obrigatórias | Entradas opcionais |
|---|---|---|
| `link` | `txPowerW`, `txGainDbi`, `frequencyGHz`, `dataRateMbps` | `rxGainDbi`, `systemNoiseTempK`, `rxGT_dBK`, `requiredEbN0Db`, perdas (`txLineLossDb`, `atmosphericLossDb`, `polarizationLossDb`, `pointingLossDb`, `implementationLossDb`), `distanceKm` (padrão: alcance na elevação mínima) |
| `power` | nenhuma | `generationW`, `batteryCapacityWh`, `depthOfDischarge`, `batteryEfficiency`, `solarArrayAreaM2`, `eclipseModeId`, `cellEfficiency`, `degradationPerYear`, `sunIncidenceDeg` |
| `data` | `sources` (lista de `entityId`, `rateMbps`, `dutyFraction`), `downlinkRateMbps` | `overheadFraction`, `compressionRatio`, `storageCapacityMB` |
| `decay` | `dragAreaM2`, `massKg` (caso de descarte, a maior massa) | `dragCoefficient`, `massMinKg` (caso de sobrevivência), `solarActivity` (`low`, `mean`, `high`) |
| `thermal` | `absorptivity`, `emissivity`, `sunlitAreaM2`, `radiatorAreaM2` | `earthFacingAreaM2`, `internalPowerW`, `internalPowerHotW`, `internalPowerColdW`, `heatCapacityJPerK`, `tMinC`, `tMaxC` |

Exemplo do DemoSat-TG:

```json
"link": {
  "txPowerW": "transceiver.tx_power_w",
  "txGainDbi": "antenna.gain_dbi",
  "frequencyGHz": "transceiver.frequency_ghz",
  "dataRateMbps": "transceiver.data_rate_mbps",
  "requiredEbN0Db": 4.4
}
```

## budgets

```json
{ "id": "massa", "label": "Massa seca", "unit": "kg", "kind": "mass",
  "parameter": "mass", "allocated": 6, "systemMargin": 0.2, "rootEntityId": "seg_space" }
```

O budget soma o parâmetro `parameter` nos donos-folha (o elemento mais baixo da árvore que declara aquele parâmetro), aplica a margem de cada item e depois `systemMargin`. `rootEntityId` limita a soma aos descendentes de um elemento. O budget cumpre quando o total com margens cabe em `allocated`. `kind` é `mass`, `power`, `energy`, `data`, `link`, `cost` ou `other`. O formato 1, com uma lista explícita `items` de `entityId` e `value`, continua aceito.

## modes

```json
{ "id": "eclipse", "name": "Eclipse", "durationFraction": "engine.orbit_eclipse_max_fraction",
  "active": ["eps", "obc"],
  "loads": [ { "entityId": "placa_obc", "parameterRef": "placa_obc.power" }, { "entityId": "heater", "powerW": 3 } ] }
```

`durationFraction` é a fração da órbita no modo: um número de 0 a 1 ou uma expressão, como `1 - engine.orbit_eclipse_max_fraction - camera.duty_fraction`. As frações dos modos devem somar 1; se não somarem, o motor avisa. Cada carga tem `powerW` ou `parameterRef`. `active` lista os elementos ligados no modo, que o grafo destaca quando a simulação da cena física passa por ele. O id do modo usado como pior caso de energia vai em `mission.analysis.power.eclipseModeId`.

## verifications e risks

```json
"verifications": [
  { "id": "v1", "requirementId": "req_massa", "method": "Analysis", "level": "Sistema",
    "status": "planned", "itemId": "missao", "evidence": "Budget de massa na PDR" }
],
"risks": [
  { "id": "rk1", "title": "Atraso na entrega da bateria", "probability": 3, "impact": 4,
    "mitigation": "Segundo fornecedor qualificado", "status": "open", "entityIds": ["bateria"], "category": "schedule" }
]
```

Uma verificação pode citar o item verificado (`itemId`) e a entidade de verificação do grafo que ela documenta (`verifierId`). Riscos usam probabilidade e impacto de 1 a 5; P×I a partir de 15 é alto e a partir de 8 é médio. `status` do risco é `open`, `mitigated`, `accepted` ou `closed`.

## views

```json
"views": { "defaultStep": 4, "maxStep": 4, "layout2D": "layered", "layout3D": "radial-fan" }
```

`defaultStep` é a etapa em que a linha do tempo abre e `maxStep` o número de etapas.

## Fórmulas e regras

Fórmulas de parâmetros, regras de requisito e frações de modo usam a mesma linguagem.

| Elemento | Sintaxe |
|---|---|
| Números | `0.3`, `1e-3` (ponto como separador decimal) |
| Operadores | `+ - * / ^`, comparações `< <= > >= == !=`, lógicos `and or not` (ou `&& || !`) |
| Referências | `bateria.capacidade_wh`; `self.area_m2` ou só `area_m2` para um parâmetro da própria entidade; `param("req-1", "x")` para ids com hífen |
| Listas | `children("eps", "mass")` (filhos diretos), `descendants("eps", "mass")` (todos os descendentes), `leaves("eps", "mass")` (donos-folha abaixo de eps), `total("mass")` (donos-folha no modelo inteiro); com `"margin"` no fim, cada valor já vem com a própria margem |
| Agregação | `sum`, `max`, `min`, `avg`, `rss`, `count` |
| Matemática | `abs`, `sqrt`, `pow(x, y)`, `log10`, `ln`, `exp`, `floor`, `ceil`, `round(x, casas)`, `clamp(x, mín, máx)` |
| Engenharia | `db(x)` (10·log₁₀), `fromdb(x)`, `cosd`, `sind` (ângulos em graus), `withmargin(x, 0.2)`, `ecssmargin(x, "cots")` |
| Condição | `if(condição, valor_se_verdadeiro, valor_se_falso)` |

O motor avalia os parâmetros em ordem de dependência e aponta ciclos (`a` depende de `b`, que depende de `a`) sem avaliá-los. Uma referência a parâmetro inexistente vira erro no parâmetro ou na regra que a usa, com a mensagem no inspetor e na auditoria.

Exemplos tirados do DemoSat-TG:

| Onde | Expressão |
|---|---|
| massa do EPS | `sum(children("eps", "mass"))` |
| massa seca com margens | `sum(total("mass", "margin")) * 1.2` |
| GSD da câmera | `pixel_pitch_um * 1e-6 * engine.orbit_altitude_km * 1000 / (focal_length_mm * 1e-3)` |
| geração no fim de vida | `solar_array.area_m2 * 1361 * solar_array.cell_efficiency * solar_array.inherent_degradation * cosd(engine.orbit_beta_deg) * (1 - solar_array.degradation_per_year) ^ engine.mission_lifetime_years` |
| regra de autonomia em eclipse | `battery.capacity_wh * battery.dod_max * battery.efficiency >= engine.mode_eclipse_w * engine.orbit_eclipse_max_min / 60` |
| regra térmica | `engine.thermal_cold_c >= t_min_c and engine.thermal_hot_c <= t_max_c` |
| fração do modo Nominal | `1 - engine.orbit_eclipse_max_fraction - engine.station_contact_fraction - camera.duty_fraction` |

## Valores calculados pelo motor (`engine.*`)

| Valor | Unidade | Onde pode ser usado |
|---|---|---|
| `engine.orbit_altitude_km` | km | fórmulas, regras e frações |
| `engine.orbit_period_min` | min | fórmulas, regras e frações |
| `engine.orbit_velocity_km_s` | km/s | fórmulas, regras e frações |
| `engine.orbit_orbits_per_day` | - | fórmulas, regras e frações |
| `engine.orbit_eclipse_max_fraction`, `engine.orbit_eclipse_max_min` | -, min | pior eclipse geométrico (β = 0); fórmulas, regras e frações |
| `engine.orbit_beta_deg`, `engine.orbit_eclipse_fraction`, `engine.orbit_eclipse_min` | °, -, min | β e eclipse na época; exigem `epoch` e um de `ltanHours` ou `raanDeg`; fórmulas, regras e frações |
| `engine.station_contact_min_per_day`, `engine.station_contact_fraction`, `engine.station_passes_per_day` | min, -, - | contato com a primeira estação em 24 h; fórmulas, regras e frações |
| `engine.mission_lifetime_years` | anos | vem de `mission.lifetimeYears`; fórmulas, regras e frações |
| `engine.budget_<id>_nominal`, `engine.budget_<id>_total`, `engine.budget_<id>_margin` | unidade do budget, fração | soma sem margens, total com margens e margem restante em relação à alocação; só em regras e `mission.analysis` |
| `engine.mode_<id>_w` | W | potência total do modo; só em regras e `mission.analysis` |
| `engine.orbit_average_power_w` | W | potência média ponderada pelas frações dos modos; só em regras e `mission.analysis` |
| `engine.thermal_hot_c`, `engine.thermal_cold_c` | °C | temperaturas do nó único nos casos quente e frio, quando `mission.analysis.thermal` tem as quatro entradas obrigatórias e `heatCapacityJPerK`; só em regras |

Os valores de órbita e estação existem antes dos parâmetros e por isso podem entrar em fórmulas. Budgets, modos e temperaturas dependem dos parâmetros já avaliados e ficam disponíveis só depois.

## Erros comuns

- **"usa categoria ... que não está definida"**: o `category` da entidade precisa existir em `categories`.
- **"O número (index) ... está duplicado"**: cada tipo de relação precisa de um `index` próprio.
- **"parâmetro precisa de value ou formula"**: todo parâmetro declara um dos dois.
- **"Valor derivado engine.... não está disponível"**: o budget ou o modo citado não existe, ou um item dele não tem valor.
- **"As frações de duração dos modos somam ... em vez de 1"**: revise as frações; elas podem ser expressões que se completam, como no exemplo mínimo.
- **"A regra precisa resultar em verdadeiro/falso"**: a regra precisa de uma comparação (`<=`, `>=`, `==`).
