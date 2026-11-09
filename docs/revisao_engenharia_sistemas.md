# Revisão técnica de engenharia de sistemas

Revisão do modelo de demonstração (`src/data/demoArchitecture.json`), do template CubeSat 3U e da lógica de análise, feita em 18/10/2026 com base no NASA SP-2016-6105 Rev. 2, na série ECSS-E-ST-10, nas semânticas de relação da SysML 1.x e no SMAD. Os números citados vêm de uma execução do próprio motor sobre o demo. Pontos com cláusula de norma ainda não conferida estão marcados com "(conferir)".

## Corrigido em 18/10/2026

### Primeira rodada

| Nº | Problema | Correção |
|---|---|---|
| A1 | `receives_command_from` tinha como origem quem recebe o comando: a N² punha o telecomando na célula OBC→TT&C, e a seta do 2D apontava no mesmo sentido da telemetria. | O tipo passou a ser `sends_command_to` (origem = quem comanda), com as três relações de cada modelo invertidas. |
| A2 | Uma regra paramétrica que passa contava como requisito "verificado" na VCRM e como "verificação prevista" na auditoria. Regra é previsão de projeto, não evidência sobre o produto. | O estado da VCRM vem só das entradas de verificação; a regra aparece na coluna própria. A auditoria exige uma atividade de verificação planejada. O template ganhou a verificação do requisito de massa (análise do budget até a CDR, pesagem na aceitação). |
| B4 | As regras de descarte (IADC 25 anos, FCC 22-74 5 anos) eram contadas a partir do lançamento. | Passam a contar a partir do fim da missão (`postMissionYears`), com teste. |
| M1 | As margens de maturidade de 5/10/20 % mais 20 % de sistema eram atribuídas à ECSS-E-ST-10-02C, que trata de verificação. | Fonte corrigida para a filosofia de margens da ESA (SRE-PA/2011.097) no código, nos modelos e no README. |
| M6 | O budget de massa aparecia como "crítico" com 29,2 de 30 kg já com todas as margens; as faixas de alerta contavam a margem duas vezes. | O budget cumpre quando o total com margens cabe na alocação. |
| B5 | Risco "alto" a partir de P×I = 15 na matriz e "crítico aberto" a partir de 16 na auditoria. | A auditoria usa a mesma faixa da matriz. |
| B6 | O EPS não estava entre os elementos ativos dos modos Safe e Eclipse; o Safe do template não incluía o ADCS. | EPS em todos os modos; ADCS no Safe. |

### Segunda rodada: modelo fisicamente coerente

| Nº | Problema | Correção |
|---|---|---|
| A3 | O REQ-004 passava com temperaturas digitadas (32 °C e −5 °C) enquanto a análise dava +44/−29 °C. | O motor calcula a temperatura da órbita (`engine.thermal_hot_c`, `engine.thermal_cold_c`) com um nó único com capacidade térmica, e a regra do REQ-004 compara esse resultado com os limites do próprio requisito (−10 a +40 °C). O equilíbrio instantâneo, sem inércia, superestimava a oscilação: a constante de tempo do satélite é de quase 6 h, contra 35 min de eclipse. Com MLI (α efetivo 0,06) e radiador branco (ε 0,85) ocupando a face −Y (0,18 m²), a faixa é de 12 a 27 °C. |
| A4 | A geração (64 W) era digitada, no início de vida e incompatível com a área de 0,3 m². | A geração é uma fórmula do SMAD sobre o painel: A·S·η·I_d·cos β·(1 − D)^anos = 70,9 W no fim de vida. O dimensionamento lê os mesmos parâmetros e pede 0,25 m², dentro dos 0,3 m². |
| A5 | A vida orbital usava só a massa com margens (não conservador para a sobrevivência) e uma área de arrasto (0,25 m²) que não batia com o desenho. | A geometria do corpo é declarada no segmento espacial e gera a área de arrasto média (0,37 m², com as asas girando). A sobrevivência usa a massa nominal e o descarte, a massa com margens. A 550 km o satélite reentraria em 4,2 anos; a órbita passou para 600 km heliossíncrona (97,8°): 6,9 anos com a massa nominal e 9,3 anos com a massa com margens, o que cumpre as regras de 25 e 5 anos. A 600 km o GSD passou a ser calculado (passo do pixel × altitude / focal) e a focal subiu para 170 mm para manter 19,4 m. |
| M2 | O requisito de massa era satisfeito pela estrutura. | Massa e vida orbital são satisfeitas pelo satélite (segmento espacial). |
| M3 (parte) | Os objetivos eram texto e o elo Missão → Requisitos ficava implícito; o telecomando não tinha origem. | Objetivos são entidades (OBJ-1 a OBJ-3), e cada requisito deriva de um objetivo ou de uma restrição (a massa deriva do segmento de lançamento). A estação solo é um elemento do segmento solo e envia o telecomando ao TT&C. |
| M5 | Frações de modo inventadas (imageamento 15 %, downlink 10 %, eclipse 20 %). | As frações são expressões: eclipse segue a órbita (36,7 %), downlink segue o contato simulado com a estação (1,3 %), imageamento segue o ciclo de trabalho da câmera que o budget de dados também usa (0,3 %); o nominal é o restante. |
| B2 | A raiz da PBS era a missão. | Segmentos espacial, solo e de lançamento formam o primeiro nível (1, 2, 3); a missão é o nível 0. |
| Cena física | Antena desenhada como prato de 14 dBi (o enlace usa 6 dBi); radiador na face que recebe Sol; modos e bateria tocados em sequência fixa; corpo estimado pela massa. | Antena patch dimensionada pelo ganho; radiador na face ±Y que nunca vê o Sol, com a área declarada; modos pelos eventos da simulação (eclipse na sombra, downlink com a estação à vista) e bateria integrada ao vivo; corpo com as dimensões declaradas. |
| Rastreabilidade | Não havia como saber se uma ligação continuava válida depois de uma mudança. | Links suspeitos: cada ligação de rastreabilidade guarda a impressão digital das duas pontas na revisão; mudar uma ponta (ou algo que ela contém) deixa a ligação suspeita até nova revisão. |

### Terceira rodada (19/10/2026)

| Nº | Problema | Correção |
|---|---|---|
| A6 | A regra do REQ-003 comparava C·DoD com a energia do eclipse, enquanto o dimensionamento da aba Missão divide também pela eficiência de descarga (SMAD). Entre 59 e 64,5 Wh a auditoria acusava bateria subdimensionada e o requisito continuava atendido. | A bateria tem o parâmetro `efficiency` (0,9), lido pela regra e pelo dimensionamento (`mission.analysis.power.batteryEfficiency`), no demo e no template. |
| Interface | VCRM, inspetor e relatório mostravam os valores em inglês do JSON (performance, must, Test, Subsystem); a coluna de ensaio se chamava T. | Rótulos em português num módulo comum (`src/lib/labels.ts`); coluna E (ensaio). |
| Acessibilidade | Texto secundário com contraste de 3,4 a 4,5:1 e cores de estado do tema claro de 3,7 a 4,4:1. | Tokens ajustados para pelo menos 4,5:1 nas três superfícies, nos dois temas. |

## Pendente, por prioridade

### Média

- **M2 (resto).** O método "Rule" não existe em norma: a regra é uma análise automática de previsão e deveria aparecer como tal na VCRM.
- **M3 (resto).** O REQ-002 (taxa de descida) está alocado à função "Receber telecomando"; não há requisito de telecomando. O ADCS do demo não tem função nem requisito. Faltam requisitos de cargas de lançamento e de frequência fundamental.
- **M4.** A auditoria não acusa elemento sem requisito pai (*gold plating*) nem valida as categorias nas pontas das relações (`satisfies` deve terminar em requisito, `verifies` deve sair de uma verificação).
- **M7.** O budget de potência não tem margem de sistema; no template, a alocação (15 W) passa da geração (14 W).
- **M8.** Requisito com *waiver* conta como fechado. Waiver é aceitação formal de não conformidade e merece estado próprio.
- **M9.** A varredura de LTAN não muda eclipse nem energia, porque o modo rápido usa sempre β = 0. A varredura de altitude mantém a inclinação fixa, e a órbita deixa de ser heliossíncrona.
- **M10.** A profundidade de descarga recomendada vem de uma curva provavelmente de NiCd/NiH2 (conferir no SMAD), e não há alerta quando a DoD declarada passa da recomendada.
- **M11.** Os budgets por entidade (campo `budgets` legado) são estáticos e não batem com os parâmetros.
- **M12.** O risco de janela de downlink está "mitigado", mas a compressão citada não está modelada.
- **M13.** Redação de requisitos: bandas não definidas, mistura de solução e desempenho, DoD não quantificada, falta de justificativa em vários requisitos.
- **Template 3U.** Recebeu objetivos, segmentos, estação solo e links revisados, mas ainda usa o térmico em equilíbrio e a vida orbital com uma única massa.

### Baixa

- **B1.** Perda de apontamento padrão de 0,5 dB no enlace. A 10° de elevação, uma antena patch apontada para o nadir está a uns 65° do eixo, e a margem real fica provavelmente entre 5 e 8 dB.
- **B3.** Relações não dirigidas são tratadas como dirigidas no impacto, e há interfaces duplicadas na N².
- **B7.** A topologia de potência painel → bateria → PCDU contradiz o rótulo "barramento regulado".
- **B8.** A bateria 2S2P de células 18650 do template teria 37 a 40 Wh, não 20 Wh.
- **B9.** Pontos menores:
  - LTAN contra LTDN;
  - método "Test" inventado quando falta método;
  - falta o estágio de verificação (qualificação, aceitação, em órbita);
  - escala de criticidade de interface não definida.

## Métodos de verificação

A ECSS-E-ST-10-02C define quatro métodos: ensaio (incluindo demonstração), análise (incluindo similaridade), revisão de projeto e inspeção. O NASA SP-2016-6105 usa análise, demonstração, inspeção e ensaio. O software usa a união dos dois, o que é aceitável desde que declarado.

## O que está correto e pode ser defendido

- **Direções das relações:** `satisfies` vai do elemento ao requisito, `verifies` da verificação ao requisito, `allocated_to` da função ao bloco e `derives_from` do requisito à sua origem, como na SysML. A alocação de requisito a função segue a decomposição da NASA (em SysML puro seria «refine» ou «trace»).
- **Órbita:** inclinação heliossíncrona de 97,8° a 600 km, período de 96,7 min, RAAN a partir do LTAN, ângulo β com efeméride e varredura anual de eclipse.
- **Enlace:** constante da perda no espaço livre, k = −228,6 dBW/K/Hz, Eb/N₀ requerido de 4,4 dB para o código convolucional r = 1/2 e critério de 3 dB; o ganho e a temperatura de ruído da estação vêm do elemento do segmento solo.
- **Energia:** geração no fim de vida e dimensionamento de painel e bateria pelo SMAD, com os mesmos parâmetros.
- **Decaimento:** integração com a atmosfera exponencial do Vallado, com os dois casos de massa.
- **Térmico:** nó único com capacidade térmica, casos quente (periélio, menor eclipse) e frio (afélio, maior eclipse, modo seguro).
- **Massa:** margens de maturidade e de sistema aplicadas na ordem certa.
- **Transparência:** cada resultado mostra fórmula, hipóteses e fonte.
- **Matrizes e auditoria:** a VCRM une entradas explícitas e entidades ligadas, a N² tem visão por subsistema, e as métricas da auditoria seguem um checklist de PDR.
- **Plausibilidade:** os valores do microssatélite de 30 kg e do CubeSat 3U são plausíveis, e as coordenadas das estações de São José dos Campos e Santa Maria estão corretas.
