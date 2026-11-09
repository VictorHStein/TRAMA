# Análise comparativa com ferramentas do mercado: dados de apoio

Levantamento de 18/10/2026 para o capítulo de análise comparativa do TG. A ferramenta avaliada é o TRAMA. Os números das seções 4 e 5 vêm da execução do código sobre o modelo de demonstração DemoSat-TG (`src/data/demoArchitecture.json`), já com as correções de engenharia de 18/10/2026 (sentido do comando, fechamento da verificação, regras de descarte e margens). O ponto de partida foi um benchmark preliminar de 23/09/2026; cada afirmação dele foi reconferida em documentação oficial, e as correções estão na seção 6.

O documento é um retrato dessa data. Depois dele, o modelo de demonstração passou para 600 km e 97,8° e ganhou geração de fim de vida, térmico com capacidade térmica e GSD calculado (ver `revisao_engenharia_sistemas.md`, segunda rodada), de modo que os números da tabela da seção 4.1 já não são os do app. Logo depois dessa tabela há um resumo com os valores atuais, que saem de `npx vite-node scripts/tarefas_pdr.ts`.

**Como ler as marcas**

- Notas: **2** = nativo; **1** = parcial, por plugin, módulo pago à parte ou integração com outro produto; **0** = não tem. A regra de cada critério está na seção 2.1.
- `(n.v.)` = não verificado: a nota é inferência, não está em documentação. Não sobrou nenhuma nota sem fonte ou sem essa marca.
- `[n]` = fonte numerada na seção 8. `[B]` = benchmark preliminar de 23/09/2026.
- `n.m.` = não medido.

---

## 1. Ferramentas e versões consideradas

| Ferramenta (versão vigente) | Família | Fabricante e licença | Plataforma | Custo de referência |
|---|---|---|---|---|
| Cameo Systems Modeler / CATIA Magic (2026x Refresh1) | Modelagem (SysML v1; SysML v2 em alguns pacotes da 2026x) [2] | Dassault Systèmes, comercial | Desktop; colaboração pelo Teamwork Cloud | A partir de US$ 1.266 por licença anual, + Simulation Toolkit US$ 1.077 + Teamwork Cloud US$ 3.166 (preço de revendedor, sem data) [1]; alta de cerca de 20 % anunciada para 2026 nos pacotes com SysML v2 [2] |
| Capella (7.1.0) | Modelagem (método Arcadia) [23] | Eclipse, EPL (aberta) | Desktop Eclipse | Gratuito [22]. Team for Capella sob consulta; o Capterra indica "a partir de € 6.000 por usuário", sem dizer o período [42] |
| SysON (2026.9) | Modelagem (SysML v2) [44] | Eclipse/Obeo, EPL v2 (aberta) | Web, com servidor próprio (Docker + PostgreSQL) [51] | Gratuito; Obeo Enterprise for SysON sob consulta [44]. Em desenvolvimento ativo: só as versões ANO.MÊS.0 são estáveis [51] |
| Valispace, hoje "Requirements & Systems Portal (Legacy)" e "Requirements Portal" no Altium 365 | Paramétrica / engenharia concorrente | Altium (comprou a Valispace em fev/2024), comercial | SaaS; on-prem só no plano Enterprise [57] | US$ 999/usuário/ano, mínimo de 3 usuários [57]. A oferta educacional de € 1.000/ano só aparece na página antiga de 2024 [81] |
| CDP4-COMET Community Edition (IME 11.1.0, Web 9.0.x, WebServices 10.0.1) | Paramétrica / engenharia concorrente (ECSS-E-TM-10-25) [84] | Starion Group; AGPL-3.0 (IME, WebServices, Web), Apache-2.0 e LGPL-3.0 em bibliotecas [85][86][87] | Servidor (Docker) + IME (Windows/Excel) ou Web | Gratuito; Enterprise Edition comercial [95] |
| Ansys STK (v2026 R1, STK 13.1.0) | Análise de missão | Ansys, hoje parte da Synopsys; comercial, edições Pro, Premium (Air/Space) e Enterprise [101][103] | Desktop Windows; o STK Cloud foi descontinuado em 31/12/2025 [117][120] | Contrato anual de licenças STK da UK Space Agency: £ 17.760 sem VAT, sem informar quantas licenças [124]. A documentação atual oferece só avaliação de 14 dias [121] |
| NASA GMAT (R2026a) | Análise de missão | NASA, Apache 2.0 [132] | Desktop (Windows, macOS, Linux) | Gratuito [133] |
| IBM DOORS Next (7.2.0) | Requisitos | IBM, comercial [145] | Web, com servidor Jazz próprio ou SaaS da IBM | A partir de US$ 164/usuário/mês no plano Professional SaaS (G2, dado de 2024) [156]; G-Cloud 14: £ 186 a £ 511/usuário/mês [157]. A IBM não publica preço |
| Jama Connect | Requisitos | Jama Software, comercial | Web SaaS ou self-hosted [173] | Sob cotação; quatro tipos de licença (Creator, Stakeholder, Reviewer, Test Runner) [171][176] |
| Doorstop (v3.2) | Requisitos | Código aberto, LGPLv3 [184] | CLI/GUI em Python; requisitos em YAML ou Markdown no git | Gratuito |
| NASA Open MCT (v4.3.1) | Operações | NASA, Apache 2.0 [196] | Aplicação web servida por Node [195] | Gratuito |
| **TRAMA** | Integrada, fase 0/A | Victor Stein (TG, ITA); código público no GitHub, **sem arquivo LICENSE** [209] | Página estática no navegador, sem backend, offline | Gratuito |

---

## 2. Matriz de capacidades

### 2.1 Critérios e regra de pontuação

| Código | Critério | 2 | 1 | 0 |
|---|---|---|---|---|
| M1 | Linguagem ou metamodelo | Padrão de engenharia de sistemas (SysML, Arcadia, ECSS-E-TM-10-25) | Metamodelo próprio ou configurável, ou padrão só via outro produto | Sem metamodelo de arquitetura |
| M2 | Diagramas de modelagem editáveis | Editor de diagramas ligado ao modelo | Diagramas parciais, desenho sem semântica, edição fora do diagrama, ou via outro produto | Nenhum |
| M3 | Rastreabilidade requisito ↔ arquitetura | Nativa | Por add-on, outro produto, ou arquitetura só como texto | Nenhuma |
| M4 | Modos e estados operacionais | Nativos | Parciais ou via outro produto | Não |
| A1 | Parâmetros com unidade e fórmula que se propagam | Nativos | Sem unidade, cálculo fora da ferramenta, só via plugin, ou só para telemetria | Não |
| A2 | Budgets com margem | Agregação com margens | Soma sem margem, ou margem via add-on ou planilha | Não |
| A3 | Verificação automática de requisito por regra | Nativa | Via add-on ou outro produto, ou regras sobre métricas que não são requisitos | Não |
| A4 | Análise de missão (órbita, eclipse, passes, enlace, vida orbital) | Cobre o conjunto, com propagação | Cobre parte, é analítica ou vem de integração | Não calcula |
| A5 | Análise de missão ligada a requisitos e budgets | Nativa | Via integração | Não |
| A6 | Varredura ou estudo de trade | Nativa | Via add-on, script ou alternativas discretas | Não |
| V1 | VCRM e métodos de verificação | Nativa | Via outro produto ou parcial | Não |
| V2 | Baselines e diff | Nativos | Via outro produto ou git | Não |
| V3 | Links suspeitos e análise de impacto | Links suspeitos nativos | Só impacto, notificações ou propagação | Não |
| V4 | Auditoria de lacunas e cobertura | Métricas ou regras de completude nativas | Filtros, avisos ou validação limitada | Não |
| V5 | Colaboração multiusuário | Nativa | Via servidor ou produto à parte, ou via git | Não |
| Z1 | Grafo ou diagrama 2D de elementos e relações | Nativo | Limitado ou agregado | Não (mapas e gráficos não contam) |
| Z2 | Cena 3D | Nativa | Só visualizador de anexos | Não |
| Z3 | Matriz N² ou DSM | Matriz de dependência dedicada | Matriz de rastreabilidade, matriz genérica ou add-on | Não |
| Z4 | Simulação no tempo ou linha do tempo | Nativa | Parcial, via add-on ou só animação | Não |
| X1 | Roda no navegador sem instalar nada | Sim, inclusive SaaS | Web com servidor próprio, ou só parte da ferramenta na web | Desktop |
| X2 | Funciona offline | Sem rede e sem servidor | Sem internet, mas com servidor local ou on-prem | Exige serviço online |
| X3 | Formato aberto e versionável em git | Texto aberto como armazenamento nativo | Exportação aberta, ou texto proprietário ou difícil de mesclar | Fechado |
| X4 | Licença e custo | Gratuito e aberto | Gratuito com restrição | Pago |
| X5 | Curva de aprendizado | Baixa | Média | Alta |

### 2.2 Matriz

Colunas: Cam = Cameo; Cap = Capella; SyO = SysON; Val = Valispace (RSP); COM = CDP4-COMET; STK; GMAT; DNx = DOORS Next; Jam = Jama Connect; Dst = Doorstop; MCT = Open MCT; **TR = TRAMA**.

| Família | Critério | Cam | Cap | SyO | Val | COM | STK | GMAT | DNx | Jam | Dst | MCT | **TR** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Modelagem | M1 Linguagem ou metamodelo | 2 | 2 | 2 | 1 | 2 | 1 | 0 | 1 | 1 | 1 | 0 | **1** |
| | M2 Diagramas editáveis | 2 | 2 | 1 | 1 | 2 | 1 | 0 | 1 | 1 | 1 | 1 | **1** |
| | M3 Rastreabilidade requisito ↔ arquitetura | 2 | 1 | 1 | 2 | 2 | 1 | 0 | 2 | 2 | 1 | 0 | **2** |
| | M4 Modos e estados | 2 | 2 | 1 | 2 | 2 | 1 | 0 | 0 (n.v.) | 0 (n.v.) | 0 | 0 | **2** |
| Análise | A1 Parâmetros com unidade e fórmula | 1 | 1 | 1 | 2 | 1 | 2 | 1 | 0 | 1 | 0 | 1 | **2** |
| | A2 Budgets com margem | 1 | 1 | 0 | 2 | 2 | 1 | 1 | 0 (n.v.) | 1 | 0 | 0 | **2** |
| | A3 Verificação automática por regra | 1 | 1 | 0 | 2 | 2 | 1 | 0 | 0 | 0 | 0 | 1 | **2** |
| | A4 Análise de missão | 1 | 1 | 0 | 1 | 1 | 2 | 1 | 0 | 0 | 0 | 0 | **1** |
| | A5 Missão ligada a requisitos e budgets | 1 | 1 | 0 | 1 (n.v.) | 1 | 1 | 0 | 0 | 0 | 0 | 0 | **2** |
| | A6 Varredura ou trade | 1 | 1 | 0 | 2 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | **2** |
| Verificação e configuração | V1 VCRM | 2 | 1 | 1 (n.v.) | 2 | 1 | 0 | 0 | 1 | 2 | 1 | 0 | **2** |
| | V2 Baselines e diff | 1 | 1 | 1 | 2 | 2 | 1 | 0 | 2 | 2 | 1 | 0 | **0** |
| | V3 Links suspeitos e impacto | 2 | 1 | 0 | 1 | 1 | 0 | 0 | 2 | 2 | 2 | 0 | **2** |
| | V4 Auditoria de lacunas | 2 | 2 | 1 | 1 | 2 | 0 | 0 | 1 | 2 | 1 | 0 | **2** |
| | V5 Multiusuário | 1 | 1 | 2 | 2 | 2 | 1 | 0 | 2 | 2 | 1 | 1 | **0** |
| Visualização | Z1 Grafo ou diagrama 2D | 2 | 2 | 2 | 2 | 2 | 0 | 0 | 2 | 1 | 0 | 0 | **2** |
| | Z2 Cena 3D | 0 | 0 | 0 | 1 | 2 | 2 | 2 | 0 | 0 | 0 | 0 | **2** |
| | Z3 Matriz N² ou DSM | 2 | 1 | 0 | 0 (n.v.) | 1 | 0 | 0 | 1 | 1 | 1 | 0 | **2** |
| | Z4 Simulação no tempo | 1 | 1 | 0 | 1 | 0 | 2 | 1 | 0 | 0 | 0 | 2 | **1** |
| Acesso | X1 Navegador sem instalação | 1 | 1 | 1 | 2 | 1 | 0 | 0 | 2 | 2 | 1 | 1 | **2†** |
| | X2 Offline | 2 | 2 | 1 (n.v.) | 1 | 1 | 2 | 2 | 1 | 1 | 2 | 2 | **2** |
| | X3 Formato aberto e versionável | 1 | 2 | 1 | 1 | 2 | 1 | 2 | 1 | 1 | 2 | 1 | **2** |
| | X4 Licença e custo | 0 | 2 | 2 | 0 | 2 | 0 | 2 | 0 | 0 | 2 | 2 | **2†** |
| | X5 Curva de aprendizado | 0 | 1 | 1 (n.v.) | 1 | 0 | 0 | 0 | 0 | 1 | 1 (n.v.) | 1 | **n.m.** |

† **X1:** o TRAMA é uma página estática, mas ainda não está hospedada; hoje é preciso gerar e servir a pasta `dist/`. **X4:** o código é gratuito e público, mas sem arquivo `LICENSE` não é formalmente aberto [209].

**Notas que mudam conforme a edição.** A coluna Valispace usa o "Requirements & Systems Portal (Legacy)", o Valispace completo [58]. No "Requirements Portal" atual [60], deduzido pela navegação da documentação, caem para 0: M2, M4, A4, A6, Z2, Z4 e X2; e para 1: V2 e Z1. No STK, várias notas 1 só valem com outro produto Ansys (SAM, ModelCenter, Minerva) [105][106][115].

**Ajustes de nota para manter a mesma regra em todas as colunas:**

- DOORS Next e Jama: M1 = 1, porque o metamodelo é configurável mas não é padrão de engenharia de sistemas.
- Open MCT: M1 = 0 (ontologia de telemetria); Z1 = 0 (gráficos, não grafo de relações); A4 = 0 (só exibe dados, não calcula).
- DOORS Next e Jama: X1 = 2, porque há SaaS; X2 = 1, porque o on-prem funciona em rede isolada.
- COMET: X2 = 1, porque precisa de servidor local; sem servidor, o IME só abre o arquivo de troca em modo somente leitura.
- STK: X2 = 2, porque funciona com dongle USB; terreno e imagens on-line exigem internet.
- Doorstop: X1 = 1, porque só o HTML publicado abre no navegador.

### 2.3 Subtotais por família

São indicativos: soma de notas ordinais não é ranking. **De propósito, não há total geral.** Os critérios foram escolhidos em torno do escopo do TRAMA (integração ampla de fase 0/A), não pesam profundidade nem fidelidade, e um total favoreceria a ferramenta avaliada por construção.

| Família (máx.) | Cam | Cap | SyO | Val | COM | STK | GMAT | DNx | Jam | Dst | MCT | **TR** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Modelagem (8) | 8 | 7 | 5 | 6 | 8 | 4 | 0 | 4 | 4 | 3 | 1 | **6** |
| Análise (12) | 6 | 6 | 1 | 10 | 8 | 8 | 4 | 0 | 2 | 0 | 2 | **11** |
| Verificação e configuração (10) | 8 | 6 | 5 | 8 | 8 | 2 | 0 | 8 | 10 | 6 | 1 | **6** |
| Visualização (8) | 5 | 4 | 2 | 4 | 5 | 4 | 3 | 3 | 2 | 1 | 2 | **7** |
| Acesso (10; TRAMA sobre 8) | 4 | 8 | 6 | 5 | 6 | 3 | 6 | 4 | 5 | 8 | 7 | **8/8** |

**Leitura.**

- Cada ferramenta de mercado é forte numa família: Cameo, COMET e Capella em modelagem; Valispace, COMET e STK em análise (cada uma na sua metade); Jama, DOORS Next, Cameo, Valispace e COMET em configuração.
- O TRAMA é largo e raso. Pontua alto em análise e visualização porque liga modelo, budgets, regras e análise de missão num só arquivo. Perde onde estão as ferramentas maduras: baselines, multiusuário, linguagem padrão e fidelidade da análise de missão. (Com os links suspeitos, a família de verificação e configuração subiu de 5 para 6 de 10.)
- COMET e Valispace são os concorrentes mais próximos em análise paramétrica. Nenhum dos dois propaga órbita sozinho [84][79].

### 2.4 Evidências por ferramenta

Cada linha resume a evidência; os detalhes estão nas fontes.

**Cameo Systems Modeler / CATIA Magic**

| Crit. | Nota | Evidência | Fonte |
|---|---|---|---|
| M1, M2 | 2, 2 | SysML v1 com todos os diagramas (BDD, IBD, paramétrico, requisitos, atividade, estados, sequência). SysML v2 só nos pacotes Enterprise e superiores da 2026x | [3][2] |
| M3, V1 | 2, 2 | Relações satisfy, verify, derive e refine; «testCase» e "Verify Requirement Matrix" nativos | [10][4] |
| M4 | 2 | Diagrama de máquina de estados nativo; executar e animar exige o Simulation Toolkit (CST) | [5] |
| A1 | 1 | Constraint blocks e unidades (QUDV) são nativos; resolver e propagar valores exige o "Parametric evaluator" do CST, um add-on | [6] |
| A2 | 1 | "Rollup Pattern Wizard" (massa, potência, custo) calculado pelo CST; sem margem por maturidade pronta | [7] |
| A3 | 1 | Com o CST, as células ficam verdes ou vermelhas e o «VerificationStatus» guarda status e margem | [8] |
| A4, A5 | 1, 1 | Sem análise orbital nativa; a rota é Ansys ModelCenter + plugin STK | [20] |
| A6 | 1 | "Trade study" e "Parameter sweep" do CST | [9] |
| V2 | 1 | "Compare Projects" e "Difference Viewer" locais; versões e branches no Teamwork Cloud, produto separado | [16][1] |
| V3 | 2 | "Suspect Links" nativos: impressão digital «track» nas relações satisfy, verify, refine e deriveReq | [11] |
| V4 | 2 | "Active validation suites" com soluções sugeridas | [12] |
| V5 | 1 | Exige o Teamwork Cloud | [1] |
| Z1, Z3 | 2, 2 | "Predefined Relation Maps"; "Dependency Matrix" configurável como N² | [13][4] |
| Z2 | 0 | Nenhum recurso 3D encontrado | [3] |
| Z4 | 1 | "Timeline chart" e animação, via CST | [14] |
| X1 | 1 | Só o "Cameo Collaborator" (revisão) roda na web, e exige servidor | [15] |
| X2 | 2 | Desktop; licença flutuante com empréstimo ("borrowing") para uso offline | [18] |
| X3 | 1 | `.mdzip` é zip de XMI com binários; `.mdxml` é XMI plano, enorme para diff | [17] |
| X4, X5 | 0, 0 | Comercial [1]; "steep learning curve" segundo comparação de concorrente (fonte enviesada) | [19] |

**Capella**

| Crit. | Nota | Evidência | Fonte |
|---|---|---|---|
| M1, M2, M4 | 2, 2, 2 | Metamodelo Arcadia; diagramas de arquitetura, dataflow, cadeias funcionais, sequência e "Modes and States" em todas as camadas | [21][23] |
| M3 | 1 | Rastreabilidade entre camadas nativa; requisitos ligados à arquitetura pelo add-on gratuito "Requirements Viewpoint" | [24][22] |
| A1 | 1 | Property Values sem unidade nem fórmula; PVMT e Python4Capella como extensões | [27][26] |
| A2 | 1 | "Basic Mass Viewpoint" (add-on): massa e massa máxima com total recursivo, sem margem nem maturidade | [25][43] |
| A3 | 1 | Só limites com cores nos Basic Viewpoints, ou o conector comercial ModelCenter | [22] |
| A4, A5 | 1, 1 | Nada nativo. No caso do INPE (NanosatC-BR2) o modelo gerou a configuração de um simulador para budgets de potência e dados | [38] |
| A6 | 1 | Visão "Multi-Viewpoint" de comparação de arquiteturas candidatas; sem varredura paramétrica | [21] |
| V1 | 1 | Arcadia não tem test case; a VCRM vem por integração (Publication for Capella, Reqtify) | [30] |
| V2 | 1 | Diff/merge nativo; baselines via git ou Team for Capella | [31][29] |
| V3 | 1 | Sem links suspeitos; "Semantic Delete with Preview" mostra o impacto de uma exclusão | [21] |
| V4 | 2 | "Model Validation" com categorias (integridade, design, completude, rastreabilidade) e quick fixes | [21] |
| V5 | 1 | Team for Capella (comercial) ou git | [29] |
| Z1 | 2 | Diagramas e "Semantic Browser" | [21] |
| Z2 | 0 | Sem 3D | [21] |
| Z3 | 1 | Sem N² nativo; o add-on aberto "DSM4Capella" gera N²/DSM | [28] |
| Z4 | 1 | Via add-ons: DESS (comercial) ou conector com Simulink | [36][37] |
| X1 | 1 | Desktop; no navegador só via Obeo Cloud (comercial) ou Capella Collaboration Manager (self-hosted) | [32][33] |
| X2, X3, X4 | 2, 2, 2 | Desktop offline; `.capella` e `.aird` em XML versionável (os conflitos do `.aird` exigem cuidado); EPL | [31][22] |
| X5 | 1 | Apresentação na ESA: curva "mais fácil" que SysML; outra comparação diz que sem treino em Arcadia não se começa | [34][35] |

**SysON**

| Crit. | Nota | Evidência | Fonte |
|---|---|---|---|
| M1 | 2 | SysML v2/KerML com bibliotecas padrão; a OMG aprovou a adoção final do SysML v2 (anúncio de 21/07/2025) | [44][56] |
| M2, M4 | 1, 1 | Vistas General, Interconnection, Action Flow e State Transition, todas marcadas "Partial" pela Obeo | [45][47] |
| M3 | 1 | Satisfy desde a 2025.4 e derive desde a 2026.9; sem matriz nem cobertura | [46][55] |
| A1 | 1 | Expressões com validação, sem avaliação nem propagação de valores | [52] |
| A2–A6, V3, Z2–Z4 | 0 | Sem roll-up, sem verificação de requisito, sem simulação ("exportar para MATLAB"), sem suspect links; as vistas Geometry e Grid ainda estão planejadas | [53][47][49] |
| V1 | 1 (n.v.) | A linguagem tem verification cases; não há VCRM | [47] |
| V2 | 1 | "Doesn't include built-in version control"; changesets só na edição Enterprise, experimental | [48] |
| V4 | 1 | Validation view (experimental), só com as regras da linguagem | [49] |
| V5, Z1 | 2, 2 | Autoria concorrente e vista General/Related Elements | [45][54] |
| X1 | 1 | Web, com servidor próprio; sem demo pública | [51] |
| X2 | 1 (n.v.) | Roda em localhost via Docker; offline é inferência | [51] |
| X3 | 1 | Modelo no PostgreSQL; importa e exporta texto SysML v2, ainda parcial | [50] |
| X4 | 2 | EPL v2 | [44] |
| X5 | 1 (n.v.) | Sem avaliações nem artigos | — |

**Valispace (Requirements & Systems Portal)**

| Crit. | Nota | Evidência | Fonte |
|---|---|---|---|
| M1 | 1 | Metamodelo proprietário (blocos, Valis, requisitos, atividades de V&V) | [62] |
| M2 | 1 | Sem editor livre de diagramas; "Component Connections" em grafo ou tabela | [78] |
| M3 | 2 | Requisitos ligados a blocos e a Valis embutidos no texto ("Valify", hoje "Parametrize") | [73] |
| M4 | 2 | "Modelists": Valis matriciais por modo, somadas com `soc()` | [67] |
| A1 | 2 | Vali = valor + unidade + fórmula com `$bloco.vali`, conversão automática de unidades e propagação | [63] |
| A2 | 2 | "Margin Plus/Minus", margem total e pior caso; "Budget table and chart" automático | [64][65] |
| A3 | 2 | Método "Rules": expressão booleana entre Valis, atualizada automaticamente. Uma nota de 14/04/2026 diz que as regras deixaram de afetar o status; efeito prático não verificado | [66] |
| A4, A5 | 1, 1 (n.v.) | Sem análise orbital nativa; houve plugin para o STK (2019) e há o módulo Scripting (Python/Octave). Não sei se o plugin ainda funciona | [79] |
| A6 | 2 | "Sensitivity Analysis": mínimo, máximo e passo, com "impact graph" | [68] |
| V1 | 2 | Módulo V&V com métodos Analysis, Inspection, Review, Rules e Tests e matriz de verificação | [69] |
| V2 | 2 | "Time Machine" e "Baselines" nomeadas (ex.: PDR/CDR) no RSP. O Requirements Portal ainda não tem baselines | [70][61][80] |
| V3 | 1 | Sem suspect links; propagação "Master-Follower" com estado pendente e notificações | [71] |
| V4 | 1 | "Insights": gráficos por estado e verificação; sem auditoria de lacunas do modelo | [72] |
| V5, X1 | 2, 2 | SaaS multiusuário no Altium 365 | [82][57] |
| Z1 | 2 | "Connections Graph" com cor de status | [73][74] |
| Z2 | 1 | "CAD viewer" só pré-visualiza STL/STEP anexados, sem ligação com o modelo | [75] |
| Z3 | 0 (n.v.) | Nenhuma N²/DSM encontrada; a "Status matrix" cruza requisito × bloco | [73] |
| Z4 | 1 | "Time Sequences" (modos ao longo do tempo), marcada para descontinuação | [76] |
| X2 | 1 | On-prem só no plano Enterprise | [57] |
| X3 | 1 | Formato proprietário; XLSX/CSV, .docx e JSON via API REST/Python | [77] |
| X4 | 0 | US$ 999/usuário/ano | [57] |
| X5 | 1 | Avaliações divergentes ("very easy to learn" e "not instinctive") | [83] |

**CDP4-COMET**

| Crit. | Nota | Evidência | Fonte |
|---|---|---|---|
| M1 | 2 | Implementa o ECSS-E-TM-10-25A (anexos A, B e C) | [84][93] |
| M2 | 2 | "Relationships Editor" no IME (só Windows) | [84][85] |
| M3 | 2 | Regras de relação binária (ex.: rastros de satisfação de requisito) e "Parametric Constraint" ligada a parâmetro | [84] |
| M4 | 2 | Listas de estados finitos possíveis e reais; parâmetros dependentes de estado | [84] |
| A1 | 1 | Parâmetros com grandeza e unidade, mas o manual diz que não dá para definir valor como função de outros parâmetros no app: o cálculo vai para o add-in de Excel | [84] |
| A2 | 2 | Plugin Budget do IME: massa seca, massa seca com margem de sistema, massa úmida, potência. No Web ainda está "em desenvolvimento" | [88] |
| A3 | 2 | "Parametric Constraints" + "Check Requirements" com verde, vermelho e amarelo; disparo manual | [84] |
| A4, A5 | 1, 1 | Nada nativo; integração com ASTOS (comercial) e Matlab | [84] |
| A6 | 1 | "Options": alternativas discretas com árvore de produto própria; sem varredura | [84] |
| V1 | 1 | O método de verificação é só um atributo do requisito; sem VCRM | [84] |
| V2 | 2 | Iterações congeladas para referência e comparação; "Publication Browser" com valor antigo, valor novo e % de mudança | [84] |
| V3 | 1 | Sem suspect links; assinaturas de parâmetro mostram dependências | [84] |
| V4 | 2 | "Parametrized Category Rule" (ex.: todo equipamento precisa ter massa) e lista de verificação de regras | [84] |
| V5 | 2 | Engenharia concorrente com dono por domínio e ciclo de publicação | [84] |
| Z1 | 2 | "Grapher" da árvore de produto, Relationships Editor e "System Representation" no Web | [90] |
| Z2 | 2 | "3D Viewer" no Web com primitivas paramétricas filtradas por estado ("simplified 3D geometry") | [89] |
| Z3 | 1 | "Relationship Matrix" genérica, sem N² de interfaces dedicada | [84] |
| Z4 | 0 | Sem simulação temporal | [84] |
| X1 | 1 | Web App depende de servidor COMET, em geral self-hosted | [86] |
| X2 | 1 | Servidor local via Docker; sem servidor, o IME abre o arquivo de troca só para leitura | [87][84] |
| X3 | 2 | Arquivo de troca Annex C3 em JSON; a Starion versiona modelos abertos no git | [91][92] |
| X4 | 2 | Community Edition gratuita e aberta | [85] |
| X5 | 0 | Exige domínio de RDL, categorias, regras, opções e estados; montar template de budget "requires some programming skills" | [84] |

**Ansys STK**

| Crit. | Nota | Evidência | Fonte |
|---|---|---|---|
| M1, M2, M3 | 1, 1, 1 | A árvore de objetos do cenário não é metamodelo de arquitetura. SysML, diagramas e requisitos vêm do Ansys SAM e do ModelCenter, produtos separados | [104][105][106] |
| M4 | 1 | Perfis de atitude por intervalo e segmentos do Astrogator; não há modo operacional com cargas | [107] |
| A1 | 2 | Analysis Workbench: escalares, condições e scripts inline recalculados no tempo, já no STK Pro | [108] |
| A2 | 1 | Geração solar pelo Solar Panel Tool (Premium Space). No tutorial oficial "SMAD: Solar and Power Design", margem e DoD são feitos à mão numa planilha Excel | [109] |
| A3 | 1 | Restrições de acesso, margem de enlace e satisfação de Figure of Merit; a verificação de requisito em si fica no ModelCenter ou no SAM | [110][111][106] |
| A4 | 2 | Pro: propagadores TwoBody/J2/J4/SGP4, Access com elevação mínima, Lighting Times, Communications. Premium Space: HPOP, Lifetime, Solar Panel, Astrogator. SEET: temperatura de equilíbrio (edição não verificada) | [107][112][113][128] |
| A5 | 1 | Via SAM ou ModelCenter | [105][106] |
| A6 | 1 | O Analyzer foi descontinuado no STK 13.0; os estudos paramétricos passaram para o plugin STK do ModelCenter | [114] |
| V1, V3, V4 | 0 | Nada encontrado | — |
| V2, V5 | 1, 1 | Versionamento e compartilhamento pelo Ansys Minerva; o STK Data Federate saiu de suporte | [115][116] |
| Z1, Z3 | 0, 0 | A janela 2D é um mapa, não um grafo de arquitetura | [104] |
| Z2, Z4 | 2, 2 | Globo 3D; animação com multiplicador "X Real-Time" e Timeline View | [102][118][119] |
| X1 | 0 | Desktop só Windows; STK Cloud descontinuado em 31/12/2025 | [120][117] |
| X2 | 2 | Licença por servidor local ou dongle USB; terreno e imagens on-line exigem internet | [116][121] |
| X3 | 1 | `.sc` e `.sa` em ASCII, mas formato proprietário, multiarquivo e sem documentação | [122][123] |
| X4 | 0 | Comercial | [124][121] |
| X5 | 0 | Trilha de certificação em níveis; artigo de 2026 diz que o custo de licença "can be prohibitive" | [127] |

**NASA GMAT**

| Crit. | Nota | Evidência | Fonte |
|---|---|---|---|
| M1–M4, A3, V1–V5, Z1, Z3 | 0 | Linguagem de script de recursos e comandos; nada de requisitos, funções, interfaces, VCRM ou colaboração. A sequência de missão é cronológica, não são modos | [134][135] |
| A1 | 1 | Variáveis e equações na sequência; as variáveis não têm unidade | [136] |
| A2 | 1 | Massa total = seca + combustível; potência solar para propulsão elétrica; sem budget nem margem | [137][138] |
| A4 | 1 | Propagação de alta fidelidade, `EclipseLocator`, `ContactLocator` com elevação mínima, ΔV e otimização. Sem orçamento de enlace (Transmitter e Antenna só simulam medidas de determinação de órbita), sem ferramenta de vida orbital, sem térmico | [139][140][141] |
| A6 | 1 | Laços `For` e `While`, `Optimize`, API Python | [142] |
| Z2, Z4 | 2, 1 | OrbitView 3D; animação depois da execução, sem linha do tempo de eventos | [132] |
| X1, X2, X3, X4 | 0, 2, 2, 2 | Desktop; offline e sem licença; `.script` em texto puro; Apache 2.0 | [133][143][132] |
| X5 | 0 | "Steep learning curves", linguagem própria e documentação limitada (artigo de 2026); interface "dated" (blog) | [127][144] |

**IBM DOORS Next**

| Crit. | Nota | Evidência | Fonte |
|---|---|---|---|
| M1 | 1 | Tipos de artefato, atributos e tipos de link configuráveis | [146] |
| M2 | 1 | Editor de diagramas (processo, casos de uso, wireframe), não SysML | [147] |
| M3 | 2 | Links tipados entre quaisquer artefatos; modelos Rhapsody ou Cameo via OSLC | [148] |
| M4, A1–A6 | 0 | Sem modos, fórmulas, budgets ou regras (conclusão por ausência) | — |
| V1 | 1 | Gestão de testes no ETM, produto separado | [149] |
| V2 | 2 | Baselines, streams, Global Configurations e relatório de comparação | [150][151] |
| V3 | 2 | "Link validity": o link vira suspeito quando muda um atributo marcado | [152] |
| V4 | 1 | Filtros, vistas e Report Builder; sem métrica de cobertura nativa | [153] |
| V5 | 2 | Multiusuário com revisões formais | [154] |
| Z1 | 2 | "Links explorer": grafo expansível centrado num artefato | [148] |
| Z3 | 1 | Matriz de rastreabilidade, não N² | [159] |
| Z2, Z4 | 0 | — | — |
| X1, X2 | 2, 1 | Cliente web com SaaS da IBM ou servidor on-prem | [157] |
| X3 | 1 | Exporta ReqIF e CSV; repositório proprietário | [155] |
| X4, X5 | 0, 0 | US$ 164/usuário/mês (G2); PeerSpot 3,8/5 com "you feel lost" | [156][158] |

**Jama Connect**

| Crit. | Nota | Evidência | Fonte |
|---|---|---|---|
| M1 | 1 | Tipos de item e "relationship rules" configuráveis | [160] |
| M2 | 1 | "Graph Editor" dentro do texto rico, sem semântica de modelo | [161] |
| M3 | 2 | Relações upstream e downstream governadas pelas regras | [162] |
| M4 | 0 (n.v.) | Sem semântica de modo (por ausência) | — |
| A1, A2 | 1, 1 | "Calculated field": soma, multiplicação e média sobre inteiros e listas; sem unidade, sem margem, recalcula só quando o item é editado | [163] |
| A3 | 0 | O status de teste vem de execução manual; consolidar exige a extensão para Excel (JCI) | [178] |
| V1 | 2 | Gestão de testes nativa (planos, casos, ciclos, execuções) | [164] |
| V2 | 2 | Baselines com comparação e relatório de diferenças | [165] |
| V3 | 2 | Links suspeitos e "Impact Analysis" com grau de separação | [166][167] |
| V4 | 2 | "Trace Score" (0–100 % das relações esperadas pelas regras), Live Trace Explorer e relatório de cobertura | [168][169][172] |
| V5 | 2 | Multiusuário com revisões e assinatura | [171] |
| Z1 | 1 | Live Trace Explorer agrega por tipo; o "Trace View Canvas" está em beta | [169] |
| Z3 | 1 | Matriz de cobertura e rastreabilidade, não N² | [172] |
| X1, X2 | 2, 1 | SaaS ou self-hosted, inclusive em rede isolada | [173] |
| X3 | 1 | ReqIF pelo "Jama Connect Interchange for ReqIF"; banco proprietário | [174] |
| X4, X5 | 0, 1 | Sob cotação [175][176]; Capterra 4,1/5 em facilidade de uso [177] | |

**Doorstop**

| Crit. | Nota | Evidência | Fonte |
|---|---|---|---|
| M1, M3 | 1, 1 | Itens em YAML/Markdown com atributos fixos, numa árvore de documentos; só link para o pai, sem tipo | [179][180] |
| M2 | 1 | Só PlantUML em texto dentro do Markdown | [187] |
| M4, A1–A6, Z2, Z4 | 0 | Nada nativo | [179] |
| V1 | 1 | Testes como documento-filho; `--strict-child-check` acusa requisito sem teste; sem status de execução | [181] |
| V2, V5 | 1, 1 | Via git (diff linha a linha, PRs) | [181][186] |
| V3 | 2 | Impressão digital SHA-256 por item; o link guarda a do pai e vira "suspect link" quando o pai muda; `doorstop review` e `clear` | [181][179] |
| V4 | 1 | Avisos de validação (item normativo sem link, ciclo, mudança não revisada), sem percentuais | [181] |
| Z1 | 0 | Só a árvore em ASCII | [181] |
| Z3 | 1 | O `publish` gera uma matriz de rastreabilidade em HTML e CSV | [182] |
| X1 | 1 | Editar exige Python; só o HTML publicado, de leitura, abre no navegador | [185][182] |
| X2, X3, X4 | 2, 2, 2 | Local; YAML/Markdown no git é o armazenamento nativo; LGPLv3 | [183][184] |
| X5 | 1 (n.v.) | CLI simples, mas exige Python, YAML e git; não há avaliações publicadas | — |

**NASA Open MCT**

| Crit. | Nota | Evidência | Fonte |
|---|---|---|---|
| M1 | 0 | "Domain objects" em JSON formam uma ontologia de telemetria e telas, não de engenharia de sistemas | [188] |
| M2 | 1 | "Display Layout": canvas 2D com formas e telemetria (sinópticos), sem semântica de arquitetura | [189] |
| M3, M4, A2, A4–A6, V1–V4, Z1–Z3 | 0 | Não modela arquitetura, requisitos nem modos. Exibe dados de simulador ou fonte externa, mas não calcula órbita nem enlace. Os gráficos 2D não são grafo de relações | [189][194] |
| A1 | 1 | Unidade no metadata e plugin "Derived Telemetry", só para telemetria | [190][191] |
| A3 | 1 | "Condition Sets" e limites sobre telemetria em tempo real, não sobre requisitos | [198] |
| V5 | 1 | Persistência compartilhada via CouchDB; bloqueio só como aviso | [193] |
| Z4 | 2 | "Time Conductor" (modo de janela fixa e tempo real, relógios plugáveis), Time Strip, Plan, Gantt | [192][200] |
| X1, X2 | 1, 2 | Web, mas precisa de build Node e de servidor (pode ser localhost) | [195] |
| X3 | 1 | Exportar e importar JSON; a persistência nativa é CouchDB ou LocalStorage | [189] |
| X4, X5 | 2, 1 | Apache 2.0 [196]; uso de arrastar e soltar, mas integrar telemetria exige programar em JS [197] | |

**TRAMA (conferido no código e no modelo de demonstração)**

| Crit. | Nota | Evidência no repositório |
|---|---|---|
| M1 | 1 | Metamodelo próprio (schema JSON v2 validado com Zod, `src/domain/schema`). Não implementa SysML nem Arcadia; o mapeamento para Arcadia, ECSS-E-TM-10-25 e SysML v2 é trabalho futuro |
| M2 | 1 | O grafo tem layout automático (`nodesDraggable=false`, `nodesConnectable=false`). A edição é pelo Construtor (comandos em português e voz), por um editor de JSON com validação e pelos campos numéricos do inspetor |
| M3 | 2 | Relações tipadas (`allocated_to`, `satisfies`, `verifies`, `derives_from`, `refines`) e rastreabilidade multicaminho (`domain/analysis/trace.ts`) |
| M4 | 2 | `modes[]` com entidades ativas, cargas e fração da órbita; potência por modo; o "modo ao vivo" apaga no grafo o que está desligado |
| A1 | 2 | Valor ou fórmula por parâmetro, unidade obrigatória, avaliação topológica, detecção de ciclos. A unidade é rótulo: sem análise dimensional nem conversão |
| A2 | 2 | Maturidade cots/modified/new = 5/10/20 % + margem de sistema por budget; o budget cumpre quando o total com margens cabe na alocação (status ok ou estourado) |
| A3 | 2 | `requirement.rule` → "atende"/"viola", reavaliado a cada edição; alimenta a VCRM, a auditoria e a tela "Projeto" |
| A4 | 1 | Analítica de fase 0/A: Kepler + J₂ secular, β e eclipse ao longo do ano (sombra cilíndrica), passes por propagação Kepler + J₂, enlace, energia, dados, ΔV, decaimento (atmosfera exponencial), térmico de nó único |
| A5 | 2 | Valores `engine.orbit_*` entram nas regras; o bloco `mission.analysis` liga entradas das análises a parâmetros do modelo |
| A6 | 2 | Varredura de projeto: uma variável, 2 a 25 pontos, reavalia o modelo inteiro, "Aplicar" (`domain/analysis/sweep.ts`) |
| V1 | 2 | `verifications[]` com método (T/A/I/RoD/D e Regra), nível, status e evidência; status propagado; Matrizes → VCRM; CSV |
| V2 | 0 | Desfazer/refazer em memória (50 edições). Sem baselines nem diff (planejados como trabalho futuro) |
| V3 | 2 | Links suspeitos nativos desde 18/10/2026: cada ligação de rastreabilidade guarda a impressão digital das duas pontas na revisão, como no Doorstop, e fica suspeita quando uma ponta (ou algo que ela contém) muda. Análise de impacto e "onda de impacto" animada |
| V4 | 2 | Auditoria com 23 tipos de lacuna e 7 métricas de cobertura (`audit.ts`). A tela "Projeto" resume regras, budgets, energia, bateria, enlace, dados, vida orbital, térmico e auditoria |
| V5 | 0 | Monousuário; trabalho em equipe só por arquivo ou git |
| Z1 | 2 | Grafo 2D em camadas com três lentes: "Tudo"; "Rastreabilidade" (relações que tocam missão, requisito, função ou verificação); "Interfaces" (relações entre subsistemas e componentes, em diagrama de arcos) |
| Z2 | 2 | Cena 3D da rede e cena do satélite físico em órbita |
| Z3 | 2 | Matrizes N² (subsistema e componente), VCRM e riscos 5×5 |
| Z4 | 1 | Relógio da cena física (×1 a ×600, pausar, reiniciar) com telemetria de modo e estado de carga; sem *scrubber* nem linha do tempo de eventos |
| X1–X4 | 2†, 2, 2, 2† | Página estática sem backend nem chamadas de rede; modelo em JSON de texto; gratuito. Ver as ressalvas † acima |
| X5 | n.m. | O experimento com usuários (SUS, NASA-TLX) é trabalho futuro; não foi feito |

---

## 3. Ideia da indústria → como aparece no TRAMA → o que muda

Só entram ideias que o TRAMA implementava na data do levantamento ou que estavam planejadas (marcadas como **planejado**).

| # | Ideia da indústria (nome usado pelo fornecedor) | Como aparece no TRAMA | O que muda |
|---|---|---|---|
| 1 | "Vali" com funções de agregação `soc()`, `rssoc()`, `maxoc()` (Valispace) [63] | Parâmetro com `value` ou `formula`, unidade obrigatória, funções `sum`, `rss`, `max`, `children`, `total`, `ecssmargin` | Roda num arquivo local, sem servidor, e as fórmulas enxergam a órbita (`engine.orbit_*`). Mas o TRAMA não converte unidades; o Valispace converte |
| 2 | Método "Rules" (Valispace) [66]; "Parametric Constraints" + "Check Requirements" (COMET) [84] | `requirement.rule` com status "atende"/"viola" | A regra pode usar resultados da análise de missão (eclipse, potência do modo) e é reavaliada a cada edição; no COMET a checagem é disparada à mão |
| 3 | Filosofia de margens da ESA (5/10/20 % por herança + 20 % de sistema) [96]; plugin Budget do COMET [88] | `maturity` cots/modified/new e `systemMargin` por budget; total com margens vira `engine.budget_<id>_total` | A política vem pronta, e o total entra direto nas regras de requisito |
| 4 | Estados finitos (COMET) [84], "Modes and States" (Capella) [21], "Modelists" (Valispace) [67] | `modes[]` com entidades ativas e cargas; média por órbita; "modo ao vivo" no grafo | O modo de eclipse alimenta o dimensionamento da bateria e a regra de autonomia |
| 5 | "Dependency Matrix" (Cameo) [4]; "DSM4Capella" [28] | Aba Matrizes: N² de interfaces (linha fornece à coluna), VCRM e riscos 5×5; CSV | Somente leitura e gerada do mesmo JSON; não se edita pela célula como no Cameo |
| 6 | "Trace Score" e Live Trace Explorer (Jama) [168]; "Parametrized Category Rule" (COMET) [84]; níveis de validação do Doorstop [181] | Auditoria (7 métricas de cobertura, 23 tipos de lacuna clicáveis) e checklist "O projeto fecha?" na tela "Projeto" | Além de ligações faltantes, aponta lacunas de engenharia: enlace abaixo de 3 dB, bateria subdimensionada, vida orbital menor que a missão |
| 7 | "Link validity" (DOORS Next) [152], links suspeitos (Jama, Cameo) [166][11], impressão digital do pai no link (Doorstop) [179]; baselines (DOORS, Jama, "Time Machine" do Valispace) [151][165][70] | Links suspeitos implementados em 18/10/2026: cada ligação de rastreabilidade guarda a impressão digital das duas pontas na revisão; a auditoria lista as suspeitas e o inspetor da relação permite marcá-las como revisadas. Baselines continuam **planejadas** | O mecanismo é o do Doorstop, estendido: a impressão digital de um elemento inclui o que ele contém, então uma nova capacidade de bateria deixa suspeita a ligação "EPS satisfaz REQ-003" |
| 8 | Access com elevação mínima e Timeline View (STK) [129][119]; `ContactLocator` (GMAT) [140] | Cartão "Cobertura e passes": passes em 24 h por propagação Kepler + J₂ com GMST e WGS84, contato por dia, maior intervalo, alcance na elevação mínima | Analítico e instantâneo; o contato por dia alimenta o budget de dados |
| 9 | Lighting Times e Eclipse Summary (STK) [130]; `EclipseLocator` (GMAT) [139] | Cartão "Eclipse": β e duração do eclipse ao longo do ano; o máximo anual vira `engine.orbit_eclipse_max_min` | O pior eclipse entra direto na regra do requisito de autonomia (REQ-003) |
| 10 | Relatório "Link Budget - Detailed" e margem por "Link Information" (STK Communications) [112][111]; planilha AMSAT/IARU [207] | Cartão "Enlace de dados" linha a linha (EIRP, FSPL, G/T, C/N₀, Eb/N₀, margem ≥ 3 dB) e item "Enlace de descida" na tela "Projeto" | O relatório detalhado do STK não tem coluna de margem; no TRAMA margem e limiar estão na mesma tabela, e as entradas vêm dos parâmetros dos componentes |
| 11 | Ferramenta Lifetime (STK, Premium Space) [113]; NASA DAS [205] | Cartão "Decaimento orbital" com as regras de 25 anos (IADC) e 5 anos (FCC); item "Vida orbital" na tela "Projeto" | A documentação do Lifetime não cita a regra de 25 anos [113]; o TRAMA compara direto, com a ressalva da limitação 4 |
| 12 | "Time Conductor", tabelas LAD e "Condition Sets" (Open MCT) [192][199][198]; animação "X Real-Time" (STK) [118] | Relógio da cena física (×1 a ×600) com telemetria de modo e estado de carga. **Planejado**: Time Conductor com *scrubber* e widgets LAD (trabalho futuro) | O tempo é simulado a partir do modelo, não de telemetria real |
| 13 | "Sensitivity Analysis" (Valispace) [68]; "Parameter sweep" do CST (Cameo) [9]; "Options" (COMET) [84] | Varredura de projeto: eclipse, contato, enlace, energia, bateria, vida orbital, massa e regras atendidas para cada valor; "Aplicar" | Uma variável por vez, mas cada ponto reavalia o modelo inteiro, inclusive o status dos requisitos |
| 14 | Viewpoints e camadas do Arcadia, "Semantic Browser" (Capella) [21][23] | Lentes do grafo 2D: "Tudo", "Rastreabilidade" e "Interfaces" (diagrama de arcos), somadas aos filtros da legenda, à linha do tempo de 10 etapas e ao modo de foco. **Planejado**: mapeamento formal para Arcadia (trabalho futuro) | A lente é decidida pelas categorias das pontas de cada relação, então funciona em qualquer modelo sem configurar. São vistas de um único modelo; não há camadas OA/SA/LA/PA separadas |

---

## 4. Estudo analítico de tarefas (baseado em documentação, sem uso cronometrado)

**Abordagens comparadas**

- (a) planilhas + documentos (planilha de budgets, planilha AMSAT/IARU de enlace, VCRM em planilha, ICD em documento);
- (b) ferramentas abertas combinadas: Capella + GMAT + planilha;
- (c) ferramentas comerciais combinadas: Cameo + STK + DOORS Next ou Jama, ou Valispace no papel paramétrico;
- (d) TRAMA.

**Legenda:** **N** = responde de forma nativa; **P** = responde em parte (exige trabalho manual ou complemento); **F** = precisa de outra ferramenta. Entre parênteses, o número de ferramentas ou arquivos distintos que a equipe precisa consultar.

| # | Pergunta de PDR | (a) Planilhas + documentos | (b) Capella + GMAT + planilha | (c) Cameo + STK + DOORS/Jama ou Valispace | (d) TRAMA |
|---|---|---|---|---|---|
| Q1 | Margem de massa do sistema com margens de maturidade | N, manual (1) | P: o "Basic Mass Viewpoint" soma massa sem margem [25]; as margens vão para a planilha (2) | N no Valispace: margens e tabela de budget [64][65], com a margem de cada item informada à mão (1). P no Cameo: roll-up com o CST, sem maturidade [7] (1) | N (1) |
| Q2 | O balanço de energia fecha no pior eclipse (bateria e DoD)? | P: eclipse calculado à mão (SMAD) ou trazido de outra ferramenta (2) | P: `EclipseLocator` do GMAT [139] + dimensionamento na planilha; "Modes and States" no Capella sem números (3) | P: Lighting Times e Solar Panel no STK [130][107]; o tutorial oficial faz margem e DoD em Excel [109]; consumo por modo nos "Modelists" do Valispace [67] (2–3) | N (1) |
| Q3 | O enlace fecha com margem ≥ 3 dB? | N com a planilha AMSAT/IARU [207] (1) | F: o GMAT não faz orçamento de enlace [141], que vai para a planilha (2) | N com STK Communications (edição Pro): relatório de enlace e margem por limiar [112][111] (1) | N (1) |
| Q4 | Quais requisitos ficam violados se a bateria cair de 84 para 20 Wh? | P: recalcular e reler cada requisito à mão (2–3) | P: o Requirements Viewpoint mostra o que está ligado [24], a planilha recalcula, sem status automático (2–3) | N no Valispace com o método "Rules" [66], se o eclipse tiver sido importado (1–2); N no Cameo com o CST [8]; DOORS e Jama só marcam links suspeitos, sem avaliar [152][166] (2–3) | N (1) |
| Q5 | O que muda (eclipse, passes, vida orbital, enlace) se a órbita subir de 500 para 700 km? | F: precisa de ferramenta de órbita e de vida orbital (3–4) | P: dois cenários no GMAT (eclipse, contato, propagação com arrasto até condição de parada, sem ferramenta de vida orbital) + planilhas de enlace e energia [139][140] (3) | P: o STK refaz Access, Lighting, Lifetime e enlace [107]; o Analyzer foi descontinuado e a varredura passa ao ModelCenter [114]; o efeito nos requisitos é levado à mão ou via SAM/ModelCenter [105][106] (2–3) | N (1) |
| Q6 | Quais verificações cobrem o requisito de autonomia em eclipse e em que estado estão? | N, VCRM em planilha mantida à mão (1) | F: Arcadia não tem test case [30]; a VCRM vai para a planilha (2) | N: gestão de testes do Jama [164], DOORS Next + ETM [149], "Verify Requirement Matrix" do Cameo [10] ou V&V do Valispace [69] (1) | N (1) |
| Q7 | Quais interfaces o EPS fornece e quais são críticas? | P: ICD ou N² em documento (1–2) | P: ligações físicas nos diagramas do Capella [21]; N² só com o DSM4Capella [28]; criticidade como propriedade customizada (n.v.) (1) | N: IBD e "Dependency Matrix" no Cameo [4]; criticidade por estereótipo (n.v.) (1) | N (1) |
| Q8 | A vida orbital atende à regra de 25 anos (IADC) ou de 5 anos (FCC)? | F: NASA DAS (exige acordo de uso) [205] ou similar (2) | P: propagação com arrasto até a reentrada no GMAT, sem ferramenta dedicada [139] (1–2) | N: Lifetime do STK (Premium Space) [113]; a comparação com a regra fica com o engenheiro (1) | N (1) |
| | **Ferramentas ou arquivos para responder às 8** | 5–7 arquivos + 1–2 ferramentas externas (órbita, vida orbital) | 3 ferramentas + 3–4 planilhas | 3–4 ferramentas, edições pagas acima da base (CST, STK Premium Space) e integração manual ou via ModelCenter/SAM | **1 ferramenta, 1 arquivo JSON** |

### 4.1 Onde o TRAMA responde e o que responde (DemoSat-TG)

Valores obtidos rodando as funções do repositório (`validateArchitecture` → `normalizeArchitecture` → `analyzeMission` / `auditArchitecture` / `computeVcrm` / `runSweep`) sobre `src/data/demoArchitecture.json`: satélite de 30 kg, órbita heliossíncrona de 550 km (97,6°, LTAN 10h30), estação do ITA em São José dos Campos com elevação mínima de 10° e missão de 5 anos. A tela "Projeto" e as lentes não mudam esses números, só onde eles aparecem.

| # | Onde na interface | Resposta do TRAMA no modelo de demonstração |
|---|---|---|
| Q1 | Tela "Projeto" → "O projeto fecha?" (item "Massa seca") e elo "Budgets" da cadeia de rastreabilidade; detalhe em Inspetor → aba Análise → Budgets; Exportar → Budgets (CSV) | Massa nominal 21,7 kg; com margens de maturidade, 24,3 kg; com +20 % de sistema, 29,18 kg contra 30 kg alocados. Restam 2,7 % de folga: o budget cumpre. REQ-005 (massa ≤ 30 kg) atende |
| Q2 | Tela "Projeto" → itens "Energia média por órbita" e "Bateria no pior eclipse" (declarada × necessária); detalhe em aba Missão → Eclipse e Energia ("Mostrar a conta"), aba Análise → Modos operacionais e inspetor de REQ-003 | Eclipse de projeto de 35,0 min (máximo anual; pior caso geométrico 35,6 min). Consumo médio de 32 W contra geração média de 40,6 W: margem de 21 %. O modo Eclipse, com 30 W, pede 64,8 Wh de bateria com DoD de 30 %; a declarada tem 84 Wh, então fecha. Estado de carga mínimo de 79 % por órbita. Regra de REQ-003: 84 × 0,3 = 25,2 Wh ≥ 30 × 35,0/60 = 17,5 Wh, atende. A conta mostra também o DoD recomendado de 15 % para 27 475 ciclos |
| Q3 | Tela "Projeto" → item "Enlace de descida" (margem em dB); detalhe em aba Missão → Enlace de dados → "Linha a linha" | Banda S, 2,2 GHz, 2 W, 6 dBi, 2,4 Mbps. A 10° de elevação, alcance de 1 816 km e FSPL de 164,5 dB; EIRP 8,0 dBW; G/T 10,2 dB/K; C/N₀ 80,9 dB·Hz; Eb/N₀ 17,05 dB contra 4,4 dB requeridos e 1 dB de perda de implementação: margem de 11,65 dB (11,6 dB na interface), fecha |
| Q4 | Inspetor da bateria (campo "Capacidade") → onda de impacto no grafo; aba Análise → Auditoria; checklist da tela "Projeto"; Ctrl+Z desfaz | Só REQ-003 passa a "viola regra"; os outros quatro continuam atendidos. A auditoria acrescenta "bateria de 20 Wh abaixo dos 64,8 Wh necessários para 35,0 min de eclipse a 30 W" e "capacidade fora da faixa (mín. 50 Wh)" |
| Q5 | Aba Missão → Varredura de projeto (altitude) ou cartão Órbita; Construtor: "órbita 700 km" | **500 km**: eclipse 35,2 min; 3 passes em 24 h e 15,3 min de contato por dia; margem de enlace 12,2 dB; vida orbital de 2,7 anos, **menor que a missão de 5 anos**; downlink 4 % abaixo do gerado. **700 km**: eclipse 34,6 min; 4 passes e 28,7 min por dia; margem de enlace 10,2 dB; vida orbital acima de 30 anos, **não cumpre os 25 anos** e pede meio de desorbitação; dados com 44 % de folga. As cinco regras de requisito atendem nos dois casos |
| Q6 | Matrizes → VCRM; inspetor de REQ-003 → Verificações; elo "Verificação" da tela "Projeto"; Exportar → Requisitos e VCRM (CSV) | REQ-003 tem uma entrada: Teste, nível subsistema, item bateria, verificador "ver_power" ("Ciclagem Sol/eclipse em vácuo térmico"), status "planejado". O status da linha vem só das verificações e fica "planejado"; a regra paramétrica atendida aparece na coluna própria, como previsão de projeto |
| Q7 | Grafo 2D → lente "Interfaces" (só subsistemas e componentes, em diagrama de arcos com os números das relações); Matrizes → N² (linha EPS); inspetor do EPS → Relações de saída | O EPS fornece potência a OBC, payload e TT&C (criticidade alta) e a ADCS e controle térmico (média), e é fixado à estrutura. Dentro do EPS: painel → bateria e bateria → PCDU (alta) e acoplamento térmico bateria → controle térmico (alta). A lente "Interfaces" e a N² mostram as ligações; a criticidade aparece no inspetor e no destaque das arestas críticas |
| Q8 | Tela "Projeto" → item "Vida orbital" (anos em órbita e regra dos 25 anos); detalhe em aba Missão → Decaimento orbital, que mostra também a regra dos 5 anos; Relatório HTML | Vida orbital de 6,2 anos a 550 km, cerca de 1,2 ano depois do fim da missão de 5 anos: cumpre a regra dos 25 anos (IADC) e a de 5 anos (FCC), ambas contadas do fim da missão (ver limitação 4) |

**Valores no modelo atual.** A tabela acima é a de 18/10/2026, com o satélite a 550 km. No DemoSat-TG de hoje (600 km, 97,8°, geração calculada para o fim de vida), `scripts/tarefas_pdr.ts` e a mesma conta a 500 e 700 km dão os números abaixo. Q1, Q6 e Q7 não mudaram.

| # | Resposta no modelo atual |
|---|---|
| Q2 | Eclipse de projeto de 34,9 min. Consumo médio de 28,9 W contra geração média de 45,3 W (70,9 W ao Sol, no fim de vida): margem de 36 %. A bateria necessária é de 64,5 Wh, a declarada tem 84 Wh e o estado de carga mínimo por órbita é de 79 %. REQ-003 atende |
| Q3 | Margem de enlace de 11,1 dB, fecha |
| Q4 | Só REQ-003 passa a "viola regra". A auditoria aponta a bateria subdimensionada e a capacidade fora da faixa e marca como suspeitas três ligações de rastreabilidade: F-004 → 1.2, 1.2 → REQ-003 e 1 → REQ-005 |
| Q5 | **500 km**: eclipse de 35,2 min; 2,6 passes e 15,3 min de contato por dia; margem de enlace de 12,2 dB; vida orbital de 1,4 a 1,8 ano, menor que a missão de 5 anos. **700 km**: eclipse de 34,6 min; 3,1 passes e 28,7 min por dia; margem de 10,2 dB; vida orbital acima de 30 anos, que não cumpre os 25 anos. Como o GSD agora é calculado e chega a 22,6 m a 700 km, REQ-001 (GSD ≤ 20 m) passa a violar; na data do levantamento, as cinco regras atendiam nos dois casos |
| Q8 | Vida orbital de 6,9 anos no caso de sobrevivência (massa nominal) e de 9,3 anos no caso de descarte, 4,3 anos depois do fim da missão: cumpre a regra dos 25 anos (IADC) e a dos 5 anos (FCC) |

Para a comparação ser justa: o TRAMA responde as oito perguntas num lugar só porque o modelo de demonstração foi escrito com as ligações certas (regras, `mission.analysis`, modos). Num modelo novo, alguém precisa escrever essas regras e ligações no JSON. A vantagem está em manter a resposta consistente quando algo muda, não em dispensar a modelagem.

---

## 5. Limitações do TRAMA em relação ao mercado

1. **Sem linguagem padrão nem interoperabilidade.** Não há SysML (v1 ou v2), Arcadia, XMI, ReqIF nem o arquivo de troca do ECSS-E-TM-10-25 (Annex C3), que COMET, DOORS Next e Jama oferecem [91][155][174]. As exportações são JSON, CSV e um relatório HTML.
2. **Gestão de configuração parcial.** É monousuário. Tem links suspeitos desde 18/10/2026, mas não tem baselines, diff, controle de acesso nem fluxo de revisão, que Cameo, DOORS Next e Jama oferecem [11][152][166]. O desfazer/refazer vive em memória (50 edições) e não se salva entre sessões.
3. **Análise de missão só de fase 0/A.** Órbita circular, Kepler + J₂ secular, sombra cilíndrica sem penumbra, atmosfera exponencial com atividade solar média e térmico de nó único. Não há propagação numérica (HPOP no STK, propagadores do GMAT [107][132]), atitude, cobertura em grade nem otimização de manobras. Não substitui STK, GMAT ou NASA DAS numa CDR.
4. **Regra de vida orbital (corrigida em 18/10/2026).** Na conferência, `decay.ts` comparava a vida orbital *total* com 25 e 5 anos. A FCC 22-74 fala em descarte "no more than five years following the completion of the mission" [201][202], e a diretriz do IADC fala em vida orbital *residual* de no máximo 25 anos [203]. As duas regras passaram a ser contadas a partir do fim da missão (`postMissionYears`), com teste. Fica em aberto a escolha do caso de massa e de atividade solar (ver `docs/revisao_engenharia_sistemas.md`, item A5).
5. **Unidades sem análise dimensional.** A unidade é obrigatória, mas é só um rótulo; o Valispace converte unidades automaticamente [63].
6. **Edição limitada pela interface.** O diagrama tem layout automático (não se desenha nem se arrasta). Fórmulas, regras, budgets, modos e VCRM são escritos no editor de JSON, que valida mas não tem formulários.
7. **Análise de impacto estrutural ampla demais.** O alcance por relações marca 24 das 29 entidades como afetadas por uma mudança na bateria. A resposta precisa ("só REQ-003 muda de status") vem da reavaliação das regras.
8. **Escala não testada.** Os modelos de referência têm cerca de 30 entidades. O desempenho com centenas ou milhares de itens não foi medido.
9. **Varredura simples.** Uma variável por vez, até 25 pontos. Não há varredura multivariável, otimização nem Monte Carlo.
10. **3D e simulação ilustrativos.** O satélite físico é paramétrico e ampliado 300 vezes, sem CAD. O relógio de simulação não tem *scrubber* nem linha do tempo de eventos (o Open MCT e o STK têm [192][119]).
11. **Falta validação externa.** Não houve estudo com usuários (SUS, tempo de tarefa) nem estudo de caso de missão real. A curva de aprendizado não foi medida. Capella já tem casos publicados em satélites (3ColStar, Pixxel, NanosatC-BR2 e NANOSATC-BR3) [40][41][38][39].
12. **Distribuição.** O repositório é público, mas não declara licença, e não há página hospedada.
13. **Citação das margens (corrigida em 18/10/2026).** O README atribuía as margens de 5/10/20 % + 20 % só à ECSS-E-ST-10-02C. Essa norma trata de *verificação*; dela vêm as categorias de herança A a D (tabela 5-1) [97]. Os valores das margens estão no documento de filosofia de margens da ESA (SRE-PA/2011.097) [96], hoje a fonte citada no código e no README; o DRD de budget técnico e política de margens está no anexo I da ECSS-E-ST-10C Rev.1 [99].

---

## 6. Correções em relação ao benchmark preliminar (23/09/2026)

| Afirmação de 23/09/2026 | Situação em 18/10/2026 | Fonte |
|---|---|---|
| Cameo US$ 1.266/ano + CST US$ 1.077 + TWC US$ 3.166 | Confirmada como preço inicial de revendedor ("starts at"), sem data na página; alta de cerca de 20 % anunciada para 2026 nos pacotes com SysML v2 | [1][2] |
| Team for Capella ≈ € 6.000/usuário/ano | Não confirmada: a Obeo não publica preço; o Capterra indica "a partir de € 6.000 por usuário", sem período | [42] |
| SysML v2 adotado pela OMG em julho de 2025 | Confirmada: a OMG aprovou a adoção final em 21/07/2025 | [56] |
| Capella usado em satélites (3ColStar, Pixxel, INPE) | Confirmada. No INPE são estudos de concepção (NanosatC-BR2 e NANOSATC-BR3), não adoção institucional | [40][41][38][39] |
| Valispace US$ 999/usuário/ano (mín. 3) ou US$ 1.000/ano educacional | US$ 999 confirmado. A oferta educacional era **€ 1.000/ano** e só aparece na página antiga de 2024 | [57][81] |
| Valispace perdeu baselines e API após a aquisição, retorno prometido para 2026 | Vale para o "Requirements Portal". O RSP (Legacy) mantém Time Machine, baselines e API. A API REST voltou ao Requirements Portal em 06/08/2026; as baselines não voltaram até 15/10/2026 | [80][70][61] |
| COMET: cálculo fora do app (Excel) | Confirmada pelo manual | [84] |
| COMET sem 3D | **Errada**: o COMET Web tem um "3D Viewer" simplificado | [89] |
| STK ≈ £ 17.760/ano por licença | O contrato da UKSA é de £ 17.760 sem VAT, mas não informa quantas licenças; "por licença" não se sustenta | [124] |
| Versão gratuita do STK descontinuada; fora do Ansys Student | A licença gratuita não consta mais da documentação de licenciamento (só avaliação de 14 dias) [121][125]. Não há STK no Ansys Student; existem pacotes acadêmicos "STK Teaching" [126]. STK Cloud descontinuado em 31/12/2025 [117] | |
| GMAT gratuito | Confirmado: Apache 2.0; sem orçamento de enlace e sem ferramenta de vida orbital | [132][141] |
| DOORS Next US$ 164/usuário/mês | Valor do G2 (plano Professional SaaS, dado de 2024); a IBM não publica preço | [156][157] |
| Jama ~US$ 165/mês | **Sem fonte**: retirar. O Jama não publica preço | [175][176] |
| Margens ECSS no README (ECSS-E-ST-10-02C) | Corrigida em 18/10/2026 (ver limitação 13) | [96][97][99] |

---

## 7. Itens ainda não verificados

- **Matriz:** as notas marcadas `(n.v.)`:
  - DOORS Next e Jama M4 e DOORS Next A2: conclusão por ausência;
  - Valispace A5 (se o plugin do STK de 2019 ainda funciona) e Z3 (por ausência);
  - SysON V1, X2 e X5;
  - Doorstop X5 (não há avaliações publicadas).
- **Estudo de tarefas (Q7):** a criticidade como propriedade customizada no Capella (PVMT) e como estereótipo no Cameo é possível em princípio; não achei documentação de um caso concreto.
- **Valispace:**
  - o efeito da mudança de 14/04/2026 no método "Rules";
  - as ausências no "Requirements Portal", deduzidas pela navegação da documentação;
  - ReqIF;
  - o preço atual do Altium Develop.
- **STK:**
  - quantas licenças cobre o contrato da UKSA;
  - a data formal do fim da licença gratuita;
  - em que edição está o SEET;
  - se Eb/N₀ é um tipo de margem de enlace disponível.
- **GMAT:** controles de velocidade de animação; SGP4 nativo.
- **Cameo:**
  - se o CST vem incluído no CSM Enterprise (revendedores divergem);
  - algumas páginas `docs.nomagic.com/x/...` citadas [7][10][17] não foram conferidas na página original.
- **Jama:**
  - as notas do Capterra e do GetApp, cujas páginas não abriram quando consultadas;
  - algumas URLs da ajuda não conferidas: [160], [166], [167] e [168].
- **COMET:** as páginas de `comet.io.esa.int` não abriram quando consultadas; usei o manual da Starion.
- **Capella:** se o Requirements Viewpoint vem instalado por padrão na 7.x.

---

## 8. Fontes

Consultadas em outubro de 2026.

**Cameo / CATIA Magic**

1. GoEngineer, guia de compra do Cameo (preços). https://www.goengineer.com/defense-industry-guide-to-buying-cameo-mbse
2. GoEngineer, SysML v2 no Cameo e CATIA Magic 2026x. https://www.goengineer.com/en-us/blog/advantages-of-sysml-v2-now-available-in-no-magic-cameo-and-catia-magic-2026
3. No Magic docs, modelagem SysML v1. https://docs.nomagic.com/MT/latest/magic-cyber-systems-engineer---cameo-systems-modeler/sysml-v1-modeling-303989657.html
4. No Magic docs, Dependency Matrix. https://docs.nomagic.com/MT/2026x/magic-software-architect---magicdraw/creating-dependency-matrix-272732633.html
5. No Magic docs, simulação de máquina de estados. https://docs.nomagic.com/MMA/2026x/state-machine-simulation-255625585.html
6. No Magic docs, Parametric evaluator. https://docs.nomagic.com/MMA/2026x/parametric-evaluator-255625322.html
7. No Magic docs, Rollup Pattern Wizard (não aberta). https://docs.nomagic.com/x/O0ImC
8. No Magic docs, Recording verification status of runtime values. https://docs.nomagic.com/spaces/CST2024x/pages/136729268/Recording+Verification+status+of+runtime+values
9. No Magic docs, Parameter sweep. https://docs.nomagic.com/spaces/CST2024x/pages/136730233/Parameter+sweep
10. No Magic docs, Verify Requirement Matrix (não aberta). https://docs.nomagic.com/x/NS8mC
11. No Magic docs, Suspect Links tracking. https://docs.nomagic.com/MT/2026x/magic-software-architect---magicdraw/customizing-suspect-links-tracking-272737288.html
12. No Magic docs, Active validation suites. https://docs.nomagic.com/MT/latest/magic-cyber-systems-engineer---cameo-systems-modeler/sysml-v1-active-validation-suites-303999810.html
13. No Magic docs, Predefined Relation Maps. https://docs.nomagic.com/MT/latest/magic-cyber-systems-engineer---cameo-systems-modeler/predefined-relation-maps-303992535.html
14. No Magic docs, Timeline chart. https://docs.nomagic.com/MMA/2026x/timeline-chart-255625946.html
15. No Magic docs, Cameo Collaborator for Teamwork Cloud. https://docs.nomagic.com/MCS/2026x/teamwork-cloud-and-services/cameo-collaborator-for-teamwork-cloud-247048419.html
16. No Magic docs, análise de resultados de comparação. https://docs.nomagic.com/MT/latest/magic-software-architect---magicdraw/analyzing-comparison-results-303992048.html
17. No Magic docs, formatos de arquivo (não aberta). https://docs.nomagic.com/x/7wQmC
18. Dassault Systèmes, página do Cameo Systems Modeler. https://www.3ds.com/products-services/catia/products/no-magic/cameo-systems-modeler/
19. SPEC Innovations, comparação de ferramentas SysML (fonte de concorrente, enviesada). https://specinnovations.com/hubfs/DAU%20SysML%20Workshop%20Comparison.pdf
20. Ansys, webinar sobre ligar MBSE e análise de missão. https://www.ansys.com/webinars/bridging-mbse-and-mission-analysis-for-satellite-constellation-optimization

**Capella**

21. Capella, Features. https://mbse-capella.org/features.html
22. Capella, Add-ons. https://mbse-capella.org/addons.html
23. Capella, método Arcadia. https://mbse-capella.org/arcadia.html
24. Capella Requirements Viewpoint (wiki). https://github.com/eclipse-capella/capella-requirements-vp/wiki
25. Basic Mass Viewpoint (wiki). https://github.com/eclipse-capella/capella-basic-vp/wiki/Basic-Mass-Viewpoint
26. Python4Capella. https://github.com/labs4capella/python4capella
27. PVMT (wiki). https://github.com/eclipse-capella/capella/wiki/PVMT
28. Obeo, DSM4Capella. https://news.obeosoft.com/en/post/optimize-architecture-by-generating-n2-design-structure-matrices-with-dsm4capella
29. Obeo, Team for Capella. https://www.obeosoft.com/en/team-for-capella
30. Obeo, Publication for Capella. https://www.obeosoft.com/en/products/publication-for-capella
31. Fórum Capella, resolução de conflitos de merge. https://forum.mbse-capella.org/t/merge-conflict-resolution/6862
32. Obeo, Cloud for Capella. https://www.obeosoft.com/en/products/cloud-for-capella/
33. DB InfraGO, Capella Collaboration Manager. https://github.com/DSD-DBS/capella-collab-manager
34. ESA, experiência com MBSE na Spaceship FR. https://indico.esa.int/event/407/contributions/7405/attachments/4802/7889/1430%20-%20Presentation%20-%20Experience%20gained%20on%20applied%20MBSE%20at%20Spaceship%20FR.pdf
35. oose, comparação de ferramentas MBSE. https://www.oose.de/wp-content/uploads/2021/03/Part-III-Comparison.pdf
36. PGM, DESS. http://www.pgmse.com/dess
37. Connector for Capella and Simulink. https://github.com/eclipse-capella/capella-simulink-connector/releases
38. Obeo, webinar sobre modelagem e simulação de missões com CubeSat (INPE, NanosatC-BR2). https://news.obeosoft.com/post/capella-webinar-modelling-simulation-of-cubesat-based-missions-concept-of-operations
39. Obeo, Capella num nanossatélite brasileiro (NANOSATC-BR3). https://news.obeosoft.com/post/using-capella-on-a-brazilian-nanosat-project
40. 3ColStar, *Aerospace* 11(9):758, 2024. https://www.mdpi.com/2226-4310/11/9/758
41. Pixxel e BlueKei, CapellaDays 2024. https://mbse-capella.org/resources/pdf/capelladays2024/CapellaDays2024_Slides_Pixxel-BlueKei.pdf
42. Capterra, Team for Capella (valor exibido no resultado de busca). https://www.capterra.co.uk/software/208078/team-for-capella
43. Fórum Capella, o que são os viewpoints. https://forum.mbse-capella.org/t/what-are-those-viewpoints/5465

**SysON**

44. SysON, What is SysON. https://doc.mbse-syson.org/syson/main/user-manual/what-is.html
45. SysON, Key features. https://docs.obeosoft.com/syson/main/user-manual/key-features.html
46. SysON, Requirement management. https://docs.obeosoft.com/syson/main/user-manual/features/requirement-management.html
47. SysON, Other views. https://docs.obeosoft.com/syson/main/user-manual/features/other-views.html
48. SysON, Configuration management. https://docs.obeosoft.com/syson/main/user-manual/features/cm.html
49. SysON, Validation. https://docs.obeosoft.com/syson/main/user-manual/features/validation.html
50. SysON, Import/export textual. https://docs.obeosoft.com/syson/main/user-manual/features/import-export-textual.html
51. SysON, instalação local. https://doc.mbse-syson.org/syson/main/installation-guide/how-tos/install/local_test.html
52. Obeo Enterprise for SysON, Expressions. https://docs.obeosoft.com/obeo-enterprise-for-syson/main/user-manual/features/expressions.html
53. SysON, Simulation. https://docs.obeosoft.com/syson/main/user-manual/features/simulation.html
54. SysON, Tour (v2026.5.0). https://docs.obeosoft.com/syson/v2026.5.0/user-manual/tour.html
55. SysON, Release notes. https://docs.obeosoft.com/syson/main/user-manual/release-notes/release-notes.html
56. OMG, aprovação final do SysML v2 (21/07/2025). https://www.omg.org/news/releases/pr2025/07-21-25.htm

**Valispace / Altium**

57. Valispace, Pricing. https://www.valispace.com/pricing/
58. Altium, Requirements & Systems Portal (Legacy). https://www.altium.com/documentation/altium-365/requirements-systems-portal
59. Altium, RSP: novidades. https://www.altium.com/documentation/altium-365/requirements-systems-portal/new
60. Altium, Requirements Portal. https://www.altium.com/documentation/altium-365/requirements-portal
61. Altium, Requirements Portal: novidades. https://www.altium.com/documentation/altium-365/requirements-portal/new
62. Altium, RSP: System Design Module. https://www.altium.com/documentation/altium-365/requirements-systems-portal/system-design-module
63. Altium, RSP: Valis and Calculations. https://www.altium.com/documentation/altium-365/requirements-systems-portal/valis-calculations
64. Altium, RSP: Margins. https://www.altium.com/documentation/altium-365/requirements-systems-portal/valis-calculations/margins
65. Altium, RSP: Budget table and chart. https://www.altium.com/documentation/altium-365/requirements-systems-portal/valis-calculations/budget-table-chart
66. Altium, RSP: Rules verification flow. https://www.altium.com/documentation/altium-365/requirements-systems-portal/verification-validation-module/flow-4-manual-rules-verification-flow
67. Valispace, Mode management. https://docs.valispace.com/vhd/mode-management-in-valispace
68. Altium, RSP: Sensitivity Analysis. https://www.altium.com/documentation/altium-365/requirements-systems-portal/valis-calculations/sensitivity-analysis
69. Valispace, Verifications. https://docs.valispace.com/vhd/verifications-within-valispace
70. Altium, RSP: Time Machine. https://www.altium.com/documentation/altium-365/requirements-systems-portal/time-machine
71. Altium, RSP: Master-Follower. https://www.altium.com/documentation/altium-365/requirements-systems-portal/requirements-module/master-follower-feature
72. Altium, RSP: Insights. https://www.altium.com/documentation/altium-365/requirements-systems-portal/requirements-module/insights
73. Altium, RSP: Connections Graph and Status. https://www.altium.com/documentation/altium-365/requirements-systems-portal/requirements-module/connections-graph-status
74. Altium, RSP: Vali relationships. https://www.altium.com/documentation/altium-365/requirements-systems-portal/valis-calculations/vali-relationships
75. Valispace, CAD viewer. https://docs.valispace.com/vhd/cad-viewer
76. Altium, RSP: Time Sequences. https://www.altium.com/documentation/altium-365/requirements-systems-portal/timesequences
77. Altium, RSP: REST/Python API. https://www.altium.com/documentation/altium-365/requirements-systems-portal/rest-python-api-documentation
78. Altium, Valispace release 1.28.24 (Component Connections, 2021). https://www.altium.com/documentation/altium-365/legacy-valispace/release-12824-feb-15-2021
79. AGI, integração Valispace–STK (2019). https://www.agi.com/blog/2019/10/press-release-digital-engineering-collaboration-wi
80. SE-Trends, Valispace, Altium e Requirements Portal (dez/2025). https://www.se-trends.de/en/valispace-altium-requirements-portal/
81. Valispace, página de preços antiga (2024). https://www.valispace.com/pricing-old-2
82. Altium, RSP: Features explained. https://www.altium.com/documentation/altium-365/requirements-systems-portal/features-explained
83. G2, depoimento sobre o Valispace. https://www.g2.com/products/valispace/testimonials/1056357.embed

**CDP4-COMET e ECSS-E-TM-10-25**

84. Starion, *CDP4-COMET User Manual* (ago/2024). https://www.stariongroup.eu/wp-content/uploads/2024/10/CDP4-COMET-User-Manual-Aug-2024.pdf
85. COMET IME Community Edition. https://github.com/STARIONGROUP/COMET-IME-Community-Edition
86. COMET Web Community Edition. https://github.com/STARIONGROUP/COMET-WEB-Community-Edition
87. COMET WebServices Community Edition. https://github.com/STARIONGROUP/COMET-WebServices-Community-Edition
88. COMET IME, plugin Budget. https://github.com/STARIONGROUP/COMET-IME-Community-Edition/tree/development/CDP4BudgetViewer
89. COMET Web, 3D Viewer (SceneObject.cs). https://github.com/STARIONGROUP/COMET-WEB-Community-Edition/blob/development/COMETwebapp/Model/SceneObject.cs
90. COMET Web, aplicações (Applications.cs). https://github.com/STARIONGROUP/COMET-WEB-Community-Edition/blob/development/COMETwebapp/Model/Applications.cs
91. COMET SDK, Annex C (wiki). https://github.com/STARIONGROUP/COMET-SDK-Community-Edition/wiki/Annex-C
92. Starion, CDP4-COMET-MODELS. https://github.com/STARIONGROUP/CDP4-COMET-MODELS
93. ECSS-E-TM-10-25A, *Engineering design model data exchange (CDF)*, 2010. https://ecss.nl/hbstms/ecss-e-tm-10-25a-engineering-design-model-data-exchange-cdf-20-october-2010/
94. ESA, atualização do COMET no CDF. https://www.esa.int/Enabling_Support/Space_Engineering_Technology/COMET_upgrade_for_ESA_s_mission_design_centre
95. Starion, página do CDP4-COMET. https://www.stariongroup.eu/services-solutions/system-engineering/concurrent-design/cdp4-comet/

**ESA, ECSS e NASA**

96. ESA, *Margin philosophy for science assessment studies*, SRE-PA/2011.097, issue 1 rev. 3, 2012. https://sci.esa.int/documents/34375/36249/1567260131067-Margin_philosophy_for_science_assessment_studies_1.3.pdf
97. ECSS-E-ST-10-02C Rev.1, *Verification*, 01/02/2018. https://ecss.nl/standard/ecss-e-st-10-02c-rev-1-verification-1-february-2018/
98. ECSS-E-ST-10-02C, *Verification*, 2009 (substituída). https://ecss.nl/standard/ecss-e-st-10-02c-verification/
99. ECSS-E-ST-10C Rev.1, *System engineering general requirements*, 2017 (anexo I: budget técnico e política de margens). https://ecss.nl/wp-content/uploads/2017/02/ECSS-E-ST-10C-Rev.1(15February2017).pdf
100. NASA, *Systems Engineering Handbook*, SP-2016-6105 Rev2. https://www.nasa.gov/sites/default/files/atoms/files/nasa_systems_engineering_handbook_0.pdf

**Ansys STK**

101. STK, notas da versão atual (v2026 R1). https://help.agi.com/stk/Content/releaseNotes/CurrentRelease.htm
102. Synopsys/Ansys, página do STK. https://ansys.synopsys.com/products/missions/ansys-stk
103. STK, edições e licenças. https://help.agi.com/stk/Content/licensing/licenseviewer.htm
104. STK, visão geral do cenário. https://help.agi.com/stk/Content/gettingstarted/GetStart_7_ScenarioOV.htm
105. Ansys SAM 2026 R1. https://ansys.synopsys.com/blog/advancing-mbse-ansys-sam-2026-r1
106. Ansys ModelCenter. https://ansys.synopsys.com/products/connect/ansys-modelcenter
107. STK, SatPro (HPOP, Lifetime, Solar Panel). https://help.agi.com/stk/Content/satPro.htm
108. STK, Analysis Workbench (Calculation Tool). https://help.agi.com/stk/Content/stk/calcTool.htm
109. STK, tutorial "SMAD: Solar and Power Design". https://help.agi.com/stk/Content/training/SMAD_SolarPowerDesign.htm
110. STK, Figure of Merit. https://help.agi.com/stk/Subsystems/dataProviders/Content/html/FigureOfMerit.htm
111. STK, margem de enlace. https://help.agi.com/stk/Content/comm/linkMargin.htm
112. STK, relatório "Link Budget - Detailed". https://help.agi.com/stk/SubSystems/dataProviders/Content/htmlStyles/Access/Reports/Link_Budget_-_Detailed.htm
113. STK, ferramenta Lifetime. https://help.agi.com/stk/Content/stk/tools-11.htm
114. STK, anúncios (Analyzer descontinuado). https://help.agi.com/stk/Content/releaseNotes/announcements.htm
115. STK, Minerva. https://help.agi.com/stk/12.7.0/Content/stk/Minerva.htm
116. STK 12.8, anúncios (Data Federate, licenças node-locked). https://help.agi.com/stk/12.8.0/Content/releaseNotes/announcements.htm
117. AGI, STK Cloud (descontinuado). https://www.agi.com/products/stk-cloud
118. STK, tempo de animação. https://help.agi.com/stk/Content/stk/sc-01.htm
119. STK, Timeline View. https://help.agi.com/stk/Content/gettingstarted/GetStart_7_TimelineView.htm
120. STK, requisitos de sistema. https://help.agi.com/stk/Content/install/sysreq.htm
121. STK, licenciamento (versão atual). https://help.agi.com/stk/Content/licensing/licensing.htm
122. CelesTrak, exemplo de cenário `.sc` em texto. https://github.com/CelesTrak/fundamentals-of-astrodynamics/blob/main/stk/BookEx2_5/Scenario1.sc
123. STK, extração de `.vdf`. https://help.agi.com/stk/Content/stk/extract_VDF.htm
124. UK Find a Tender, aviso 080629-2025 (contrato STK da UKSA), e registro OCDS. https://www.find-tender.service.gov.uk/Notice/080629-2025 ; https://www.find-tender.service.gov.uk/api/1.0/ocdsRecordPackages/ocds-h6vhtk-05f0d3
125. STK 11.4.1, licenciamento (licença gratuita da época). https://help.agi.com/stk/11.4.1/Content/licensing/licensing.htm
126. AGI, programa educacional. https://agi.com/about/EAP
127. Eddy e Kochenderfer, Brahe (arXiv 2601.06452, 2026). https://arxiv.org/abs/2601.06452
128. STK SEET, térmico básico. https://help.agi.com/stk/Content/seet/Sat_Basic_Thermal.htm
129. STK, restrições de acesso. https://help.agi.com/stk/Content/stk/AccessConstraintsOverview.htm
130. STK, Lighting Times. https://help.agi.com/stk/subsystems/dataproviders/Content/html/dataProviders/Lighting_Times~Vehicle.htm
131. AGI, *Integrating MBSE with DME* (2021). https://www.agi.com/getmedia/3a8e140a-bf93-4ccd-9cb0-7a577e18620e/Integrating-MBSE-with-DME.pdf

**NASA GMAT**

132. NASA GMAT (GitHub, Apache 2.0). https://github.com/nasa/GMAT
133. GMAT no SourceForge. https://sourceforge.net/projects/gmat/
134. GMAT docs, recurso Spacecraft. https://github.com/nasa/GMAT/blob/main/doc/help/src/Resource_Spacecraft.xml
135. GMAT docs, comando While. https://github.com/nasa/GMAT/blob/main/doc/help/src/Command_While.xml
136. GMAT docs, recurso Variable. https://github.com/nasa/GMAT/blob/main/doc/help/src/Resource_Variable.xml
137. GMAT docs, massa balística. https://github.com/nasa/GMAT/blob/main/doc/help/src/Resource_SpacecraftBallisticMass.xml
138. GMAT docs, SolarPowerSystem. https://github.com/nasa/GMAT/blob/main/doc/help/src/Resource_SolarPowerSystem.xml
139. GMAT docs, EclipseLocator. https://github.com/nasa/GMAT/blob/main/doc/help/src/Resource_EclipseLocator.xml
140. GMAT docs, ContactLocator. https://github.com/nasa/GMAT/blob/main/doc/help/src/Resource_ContactLocator.xml
141. GMAT docs, Transmitter. https://github.com/nasa/GMAT/blob/main/doc/help/src/Resource_Transmitter.xml
142. GMAT docs, comando For. https://github.com/nasa/GMAT/blob/main/doc/help/src/Command_For.xml
143. GMAT, script de exemplo `Ex_StationContactLocator`. https://github.com/nasa/GMAT/blob/main/application/samples/Ex_StationContactLocator.script
144. Refonte Learning, comparação GMAT, STK e poliastro. https://www.refontelearning.com/blog/astrodynamics-software-tools-gmat-stk-poliastro

**IBM DOORS Next**

145. IBM, DOORS Next 7.2.0. https://www.ibm.com/support/pages/ibm-engineering-requirements-management-doors-next720
146. IBM docs, tipos de link. https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.1.0?topic=projects-creating-link-types-requirements
147. IBM docs, diagramas. https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.0.3?topic=artifacts-creating-diagrams-support-requirements
148. IBM docs, Links explorer. https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.0.3?topic=artifacts-links-explorer
149. IBM docs, associação com o ETM. https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/lifecycle-management/7.0.2?topic=lciermd-associating-test-plans-engineering-requirements-management-doors-requirement-views
150. IBM docs, relatório de comparação de configurações. https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.1.0?topic=reporting-creating-compare-configuration-report
151. IBM docs, baselines. https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.0.3?topic=configurations-creating-baselines
152. IBM docs, link validity. https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/lifecycle-management/7.0.3?topic=management-link-validity
153. IBM docs, relatórios do data warehouse. https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.1.0?topic=reporting-running-data-warehouse-reports
154. IBM docs, revisões. https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.1.0?topic=artifacts-reviews
155. IBM docs, ReqIF. https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.0.3?topic=files-importing-exporting-reqif
156. G2, preço do DOORS Next. https://www.g2.com/products/ibm-engineering-requirements-management-doors-next/pricing
157. UK Digital Marketplace, G-Cloud 14. https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-14/services/261153167386638
158. PeerSpot, DOORS Next: prós e contras. https://www.peerspot.com/products/ibm-rational-doors-next-generation-pros-and-cons
159. Fórum Jazz, matriz de rastreabilidade. https://jazz.net/forum/questions/98424/how-to-include-display-traceability-matrix-inside-the-module

**Jama Connect**

160. Jama help, relationship rules. https://help.jamasoftware.com/ah/en/administration/organization-administrator/managing-process/managing-relationships/set-up-relationship-rules.html
161. Jama help, diagramas no texto rico. https://help.jamasoftware.com/ah/en/create-content/use-the-rich-text-editor/insert-rich-text-diagrams.html
162. Jama help, relationships. https://help.jamasoftware.com/ah/en/manage-content/coverage-and-traceability/relationships.html
163. Jama help, campos customizados (calculated field). https://help.jamasoftware.com/ah/en/administration/organization-administrator/managing-process/fields/custom-fields.html
164. Jama help, Test. https://help.jamasoftware.com/ah/en/test.html
165. Jama help, comparar baselines. https://help.jamasoftware.com/ah/en/manage-content/baselines/compare-baselines.html
166. Jama help, suspect links. https://help.jamasoftware.com/ah/en/reference/quick-find/find-suspect-links.html
167. Jama help, Impact Analysis. https://help.jamasoftware.com/ah/en/manage-content/change-requests/create-change-request-impact-analysis.html
168. Jama help, cálculo do Trace Score. https://help.jamasoftware.com/ah/en/manage-content/coverage-and-traceability/live-trace-explorer/interpreting-the-trace-score-calculation.html
169. Jama help, Live Trace Explorer. https://help.jamasoftware.com/ah/en/manage-content/coverage-and-traceability/live-trace-explorer.html
170. Jama, research notes sobre o Traceability Score. https://www.jamasoftware.com/media/2023/12/research-notes-traceability-score.pdf
171. Jama, datasheet de licenciamento. https://www.jamasoftware.com/datasheet/jama-connect-licensing/
172. Jama help, Coverage Report. https://help.jamasoftware.com/ah/en/manage-content/exporting-data-to-a-document/office-templates/create-a-coverage-report.html
173. Jama, opções self-hosted e nuvem (2025). https://www.jamasoftware.com/blog/2025/06/24/self-hosted-and-cloud-flexible-deployment-options-for-your-requirements-management-with-jama-software/
174. Jama, Interchange for ReqIF. https://www.jamasoftware.com/datasheet/jama-connect-interchange-for-reqif/
175. Jama, Pricing. https://www.jamasoftware.com/platform/pricing/
176. G2, preço do Jama Connect. https://www.g2.com/products/jama-connect/pricing
177. Capterra, avaliações do Jama. https://capterra.ca/reviews/80432/jama
178. Jama support, consolidação de testes via JCI. https://support.jamasoftware.com/hc/en-us/articles/27576841629965-Calculate-Test-Completion-Rollup-Using-Jama-Connect-Interchange-Excel-Functions

**Doorstop**

179. Doorstop docs, item. https://doorstop.readthedocs.io/en/latest/reference/item.html
180. Doorstop docs, criação. https://doorstop.readthedocs.io/en/latest/cli/creation.html
181. Doorstop docs, validação. https://doorstop.readthedocs.io/en/latest/cli/validation.html
182. Doorstop docs, publicação. https://doorstop.readthedocs.io/en/latest/cli/publishing.html
183. Doorstop docs, intercâmbio. https://doorstop.readthedocs.io/en/latest/cli/interchange.html
184. Doorstop, licença (LGPLv3). https://github.com/doorstop-dev/doorstop/blob/develop/LICENSE.md
185. Doorstop docs, GUI. https://doorstop.readthedocs.io/en/latest/gui/overview.html
186. Doorstop docs, web. https://doorstop.readthedocs.io/en/latest/web.html
187. Doorstop, publicador HTML (PlantUML). https://github.com/doorstop-dev/doorstop/blob/develop/doorstop/core/publishers/html.py

**NASA Open MCT**

188. Open MCT API, domain objects. https://github.com/nasa/openmct/blob/master/API.md#domain-objects-and-identifiers
189. *Open MCT User's Guide*. https://nasa.github.io/openmct/static/files/Open_MCT_Users_Guide.pdf
190. Open MCT API, telemetry metadata. https://github.com/nasa/openmct/blob/master/API.md#telemetry-metadata
191. Open MCT, plugin Derived Telemetry (comps). https://github.com/nasa/openmct/tree/master/src/plugins/comps
192. Open MCT API, Time Conductor. https://github.com/nasa/openmct/blob/master/API.md#the-time-conductor
193. Open MCT, persistência CouchDB. https://github.com/nasa/openmct/tree/master/src/plugins/persistence/couch
194. Open MCT, plugins. https://nasa.github.io/openmct/plugins/
195. Open MCT, build e execução local. https://github.com/nasa/openmct#building-and-running-open-mct-locally
196. Open MCT, licença (Apache 2.0). https://github.com/nasa/openmct/blob/master/LICENSE.md
197. Open MCT, tutorial. https://github.com/nasa/openmct-tutorial
198. Open MCT, plugin Condition. https://github.com/nasa/openmct/tree/master/src/plugins/condition
199. Open MCT, plugin LAD Table. https://github.com/nasa/openmct/tree/master/src/plugins/LADTable
200. Open MCT, plugins Timeline e Plan. https://github.com/nasa/openmct/tree/master/src/plugins/timeline ; https://github.com/nasa/openmct/blob/master/src/plugins/plan/README.md

**Regulação, referências de projeto e TRAMA**

201. FCC 22-74, *Second Report and Order* (Space Innovation; Mitigation of Orbital Debris in the New Space Age), adotada em 29/09/2022 e publicada em 30/09/2022. https://docs.fcc.gov/public/attachments/FCC-22-74A1.pdf
202. *Federal Register* 2024-17093 (vigência em 09/09/2024; cumprimento exigido a partir de 29/09/2024; 47 CFR 25.283(e)). https://www.govinfo.gov/content/pkg/FR-2024-08-09/html/2024-17093.htm
203. IADC-02-01 Rev. 4, *Space Debris Mitigation Guidelines* (jan/2025), §5.3.2; cópia no UNOOSA. https://www.unoosa.org/res/oosadoc/data/documents/2025/aac_105c_12025crp/aac_105c_12025crp_9_0_html/AC105_C1_2025_CRP09E.pdf
204. IADC, página oficial do documento (acesso instável). https://www.iadc-home.org/documents_public/view/id/318
205. NASA ODPO, *Debris Assessment Software* (DAS) 3.2.6. https://orbitaldebris.jsc.nasa.gov/mitigation/debris-assessment-software.html
206. U.S. Government, *Orbital Debris Mitigation Standard Practices* (2019). https://orbitaldebris.jsc.nasa.gov/library/usg_orbital_debris_mitigation_standard_practices_november_2019.pdf
207. J. A. King, *AMSAT/IARU Annotated Link Model System* v2.5.5 (planilha de enlace; cópia de exemplo) e página da planilha. https://community.libre.space/uploads/short-url/zC5qvNdR3BAPOp7jXcLL5Hww06.pdf ; https://iaru.amsat-uk.org/spreadsheet.htm
208. L. Lindblad, M. Witzmann, S. Vanden Bussche, *Systems engineering from a web browser*, SECESA 2016. Levantamento com 36 respondentes: Excel, Word e PowerPoint são as ferramentas de dados mais usadas; a maioria não usa ferramenta de requisitos; a afirmação mais pontuada foi "copio e colo dados entre as ferramentas". Os autores são da Valispace, o que é um viés a declarar. https://www.valispace.com/wp-content/uploads/2021/02/Lindblad-SECESA-2016-Valispace-web-browser-engineering.pdf
209. Repositório do TRAMA no GitHub, este mesmo repositório (código público, sem arquivo de licença).

**Código do TRAMA consultado:**

- `src/domain/engine/evaluate.ts`
- `src/domain/analysis/{audit,impact,matrices,mission,sweep,trace}.ts`
- `src/domain/mission/decay.ts`
- `src/components/graph2d/ArchitectureFlow.tsx` (lentes)
- `src/components/home/MissionHome.tsx` (tela "Projeto")
- `src/components/panels/{AnalysisPanel,MissionPanel,SweepCard}.tsx`
- `src/components/matrices/*`
- `src/components/layout/{SidePanel,ExportMenu,TutorialView,ViewModeTabs}.tsx`
- `src/data/demoArchitecture.json`
