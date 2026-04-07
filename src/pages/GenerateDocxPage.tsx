import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  LevelFormat,
  PageBreak,
} from "docx";
import { saveAs } from "file-saver";

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function p(text: string, opts?: { bold?: boolean; size?: number; spacing?: { before?: number; after?: number } }) {
  return new Paragraph({
    spacing: opts?.spacing || { after: 120 },
    children: [new TextRun({ text, bold: opts?.bold, size: opts?.size || 24, font: "Arial" })],
  });
}

function heading1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, font: "Arial" })],
  });
}

function heading2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, font: "Arial" })],
  });
}

function heading3(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, font: "Arial", italics: true })],
  });
}

function makeTable(headers: string[], rows: string[][]) {
  const colCount = headers.length;
  const colWidth = Math.floor(9026 / colCount);
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: Array(colCount).fill(colWidth),
    rows: [
      new TableRow({
        children: headers.map(
          (h) =>
            new TableCell({
              borders: cellBorders,
              width: { size: colWidth, type: WidthType.DXA },
              shading: { fill: "1a3a5c", type: ShadingType.CLEAR },
              margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, font: "Arial", color: "FFFFFF" })] })],
            })
        ),
      }),
      ...rows.map(
        (row, ri) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  borders: cellBorders,
                  width: { size: colWidth, type: WidthType.DXA },
                  shading: ri % 2 === 0 ? { fill: "F2F7FB", type: ShadingType.CLEAR } : undefined,
                  margins: cellMargins,
                  children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, font: "Arial" })] })],
                })
            ),
          })
      ),
    ],
  });
}

function bullet(text: string, ref: string, level = 0) {
  return new Paragraph({
    numbering: { reference: ref, level },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, font: "Arial" })],
  });
}

function codeBlock(text: string) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    indent: { left: 360 },
    children: [new TextRun({ text, size: 20, font: "Courier New" })],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function buildDocument(): Document {
  return new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 24 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, font: "Arial" }, paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, font: "Arial" }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }, { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } }] },
        { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children: [
          // COVER
          new Paragraph({ spacing: { before: 4000 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "BLUEBERG", bold: true, size: 56, font: "Arial", color: "1a3a5c" })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Documento Completo de Regras de Negócio", size: 32, font: "Arial", color: "1a3a5c" })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Versão 1.0 — Abril 2026", size: 24, font: "Arial", color: "666666" })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Plataforma de Gerenciamento de Investimentos", size: 24, font: "Arial", color: "666666" })] }),
          pageBreak(),

          // SUMÁRIO
          heading1("Sumário"),
          ...([
            "1. Visão Geral da Plataforma", "2. Autenticação e Onboarding", "3. Layout e Navegação",
            "4. Cadastro de Transações", "5. Motor de Sincronização (syncEngine)", "6. Motor de Cálculo — Renda Fixa",
            "7. Motor de Cálculo — Poupança", "8. Motor de Carteira de Renda Fixa", "9. Página: Carteira de Renda Fixa",
            "10. Página: Posição Consolidada", "11. Página: Movimentações", "12. Página: Proventos Recebidos",
            "13. Página: Custódia (Admin)", "14. Página: Controle de Carteiras (Admin)", "15. Página: Configurações",
            "16. Análise Individual de Ativos", "17. Calculadora (Admin)", "18. Regras Especiais e Restrições",
          ].map((t) => bullet(t, "numbers"))),
          pageBreak(),

          // 1. VISÃO GERAL
          heading1("1. Visão Geral da Plataforma"),
          heading2("1.1 O que é a Blueberg"),
          p("A Blueberg é uma plataforma web de gestão de investimentos pessoais com foco em acompanhamento diário de rentabilidade. Diferente de agregadores de mercado, a Blueberg realiza cálculos próprios de rentabilidade utilizando motores de cálculo internos baseados em metodologia TWR (Time-Weighted Return)."),
          heading2("1.2 Público-alvo"),
          p("Investidores pessoa física que desejam acompanhar, de forma detalhada e precisa, a evolução diária de seus investimentos em Renda Fixa e Poupança."),
          heading2("1.3 Stack Tecnológica"),
          makeTable(["Componente", "Tecnologia"], [
            ["Frontend", "React 18 + TypeScript + Vite 5"],
            ["Estilização", "Tailwind CSS v3 + shadcn/ui"],
            ["Backend", "Lovable Cloud (Supabase)"],
            ["Banco de Dados", "PostgreSQL"],
            ["Autenticação", "Supabase Auth (email/senha)"],
            ["Deploy", "Lovable Cloud"],
          ]),
          heading2("1.4 Categorias de Investimento Suportadas"),
          makeTable(["Categoria", "Status"], [
            ["Renda Fixa", "✅ Implementado"],
            ["Poupança", "✅ Implementado"],
            ["Renda Variável", "❌ Não implementado"],
            ["Fundos", "❌ Não implementado"],
          ]),
          pageBreak(),

          // 2. AUTENTICAÇÃO E ONBOARDING
          heading1("2. Autenticação e Onboarding"),
          heading2("2.1 Modelo de Acesso"),
          p("O acesso à plataforma é controlado por administrador. Não há cadastro público livre — o admin deve pré-registrar o email do usuário."),
          p("Fluxo de autenticação:", { bold: true }),
          bullet("Usuário acessa a Landing Page", "bullets"),
          bullet('Clica em "Login" ou "Cadastre-se"', "bullets"),
          bullet("Se o email existe no sistema → permite login com email/senha", "bullets"),
          bullet("Se o email não existe → função RPC check_email_exists bloqueia o acesso", "bullets"),
          bullet("Após autenticação bem-sucedida, verifica existência de perfil na tabela profiles", "bullets"),
          bullet("Se não existe perfil → redireciona para Onboarding", "bullets"),
          heading2("2.2 Onboarding"),
          p("O onboarding coleta informações obrigatórias do usuário:"),
          makeTable(["Campo", "Obrigatório", "Formato"], [
            ["Nome Completo", "Sim", "Texto livre"],
            ["Data de Nascimento", "Sim", "dd/MM/yyyy"],
          ]),
          p("Após preenchimento, cria registro na tabela profiles com: user_id, nome_completo, data_nascimento, email."),
          heading2("2.3 Rotas Protegidas"),
          p("Todas as rotas internas (/carteira/*, /posicao-consolidada, /movimentacoes, etc.) são protegidas:"),
          bullet("Sem autenticação → redireciona para /auth", "bullets"),
          bullet("Autenticado sem perfil → redireciona para /onboarding", "bullets"),
          bullet("Autenticado com perfil → acesso liberado", "bullets"),
          heading2("2.4 Controle de Admin"),
          p('O sistema identifica o administrador por email hardcoded: ADMIN_EMAIL = "daniel.prior.soares@gmail.com"'),
          p("Funcionalidades exclusivas do admin: Páginas Custódia, Controle de Carteiras, Admin, Calculadora; Botão Reprocessar; Edição/exclusão de movimentações automáticas."),
          pageBreak(),

          // 3. LAYOUT E NAVEGAÇÃO
          heading1("3. Layout e Navegação"),
          heading2("3.1 Estrutura Geral"),
          p("A aplicação possui três áreas principais: Sidebar (colapsável), Header (AppHeader) e Conteúdo Principal (Outlet/Páginas)."),
          heading2("3.2 Sidebar (AppSidebar)"),
          p("A sidebar é colapsável com duas larguras: Expandida (220px) e Colapsada (56px)."),
          makeTable(["Item", "Rota", "Visível para"], [
            ["Carteira de Investimentos", "/carteira/renda-fixa", "Todos"],
            ["Posição Consolidada", "/posicao-consolidada", "Todos"],
            ["Movimentações", "/movimentacoes", "Todos"],
            ["Custódia", "/custodia", "Admin"],
            ["Controle de Carteiras", "/controle-carteiras", "Admin"],
            ["Proventos Recebidos", "/proventos", "Todos"],
            ["Configurações", "/configuracoes", "Todos"],
            ["Admin", "/admin", "Admin"],
            ["Calculadora", "/calculadora", "Admin"],
          ]),
          heading2("3.3 Header (AppHeader)"),
          makeTable(["Elemento", "Descrição"], [
            ["Email do usuário", "Dropdown com opção de logout"],
            ['Botão "+ Cadastrar Transação"', "Abre a página de cadastro de transação"],
            ['Seletor "Posição em:"', "Data de referência com calendário"],
            ['Botão "Aplicar"', "Aplica a data de referência selecionada"],
            ['Botão "Reprocessar" (admin)', "Recalcula TODAS as custódias e carteiras"],
            ["Ícone de notificações", "Indica se há processos pendentes"],
          ]),
          heading2("3.4 Data de Referência"),
          p("A Data de Referência é um conceito central da plataforma:"),
          bullet("Valor padrão: D-1 (ontem)", "bullets"),
          bullet("Data máxima permitida: ontem (nunca a data atual)", "bullets"),
          bullet("Impacto: Define até qual data os motores de cálculo processam", "bullets"),
          bullet("Contexto global: Gerenciada pelo DataReferenciaContext", "bullets"),
          bullet("Botão Aplicar: Incrementa appliedVersion, disparando recálculo", "bullets"),
          heading2("3.5 SubTabs"),
          p('Visível apenas dentro de /carteira/*. Atualmente exibe apenas "Renda Fixa". Preparado para futuras categorias.'),
          pageBreak(),

          // 4. CADASTRO DE TRANSAÇÕES
          heading1("4. Cadastro de Transações"),
          heading2("4.1 Pontos de Entrada"),
          bullet('Página dedicada (/cadastrar-transacao): Formulário completo via botão "+ Cadastrar Transação"', "bullets"),
          bullet("Boleta rápida (BoletaCustodiaDialog): Dialog modal com campos pré-preenchidos", "bullets"),
          heading2("4.2 Categorias e Tipos de Movimentação"),
          makeTable(["Categoria", "Tipos de Movimentação"], [
            ["Renda Fixa", "Aplicação, Resgate"],
            ["Poupança", "Aplicação, Resgate"],
          ]),
          p("Tipos de movimentação internos (gerados automaticamente):", { bold: true }),
          bullet("Aplicação Inicial: primeira aplicação em um código de custódia", "bullets"),
          bullet("Aplicação: aplicações subsequentes", "bullets"),
          bullet("Resgate: resgate parcial", "bullets"),
          bullet("Resgate Total: resgate total (fecha posição)", "bullets"),
          bullet("Resgate no Vencimento: gerado automaticamente pelo motor", "bullets"),
          heading2("4.3 Fluxo de Aplicação — Renda Fixa"),
          p("O formulário é progressivo (cada campo habilita o próximo):"),
          p("Categoria → Produto (CDB, LCI, LCA, DPGE, LC, CRI, CRA) → Instituição → Emissor → Modalidade (Prefixado, Pós Fixado) → [Se Pós Fixado] Indexador (CDI, CDI+) → Taxa → Pagamento → Vencimento → Data da Aplicação → Valor → Preço Unitário"),
          heading2("4.4 Fluxo de Aplicação — Poupança"),
          p('Fluxo simplificado: Categoria (Poupança) → Produto (auto-selecionado) → Banco → Data da Aplicação → Valor. Sem modalidade, indexador, taxa, pagamento, vencimento ou PU.'),
          heading2("4.5 Fluxo de Resgate"),
          bullet("Usuário seleciona Resgate como tipo de operação", "bullets"),
          bullet("Sistema lista ativos com saldo > 0 na data de referência", "bullets"),
          bullet("Sistema exibe saldo disponível calculado pelo motor", "bullets"),
          bullet('"Fechar Posição" preenche automaticamente o valor total', "bullets"),
          heading2("4.6 Regras de Mapeamento Interno"),
          makeTable(["Entrada do Usuário", "Armazenamento Interno"], [
            ['Modalidade "Pós Fixado" + Indexador "CDI"', 'modalidade: "Pos Fixado", indexador: "CDI"'],
            ['Modalidade "Pós Fixado" + Indexador "CDI+"', 'modalidade: "Mista", indexador: "CDI"'],
            ['Modalidade "Prefixado"', 'modalidade: "Prefixado", indexador: null'],
          ]),
          heading2("4.7 Nome do Ativo (buildNomeAtivo)"),
          p("Renda Fixa: {Produto} {Emissor} {Modalidade} {Taxa}% - {Vencimento dd/MM/yyyy}"),
          p("Poupança: Poupança {Banco}"),
          heading2("4.8 Código de Custódia"),
          p("O codigo_custodia é um identificador numérico autoincremental que agrupa todas as movimentações de um mesmo ativo."),
          bullet("Primeira aplicação: sistema gera novo codigo_custodia (MAX + 1)", "bullets"),
          bullet("Aplicações subsequentes: reutiliza o codigo_custodia existente", "bullets"),
          bullet('Tipo da primeira aplicação: sempre "Aplicação Inicial"', "bullets"),
          heading2("4.9 Validações"),
          makeTable(["Validação", "Renda Fixa", "Poupança"], [
            ["Data deve ser dia útil", "✅ Sim", "❌ Não"],
            ["Data não pode ser futura", "✅ Sim", "✅ Sim"],
            ["Valor > 0", "✅ Sim", "✅ Sim"],
            ["Preço Unitário > 0", "✅ Sim", "N/A"],
            ["Taxa ≥ 0", "✅ Sim", "N/A"],
          ]),
          heading2("4.10 Pós-Salvamento (Sincronização)"),
          p("Após salvar uma transação, o sistema executa automaticamente:"),
          codeBlock("fullSyncAfterMovimentacao(userId, dataReferencia)"),
          bullet("syncCustodiaFromMovimentacao()", "bullets"),
          bullet("syncResgateNoVencimento()", "bullets"),
          bullet("syncManualResgatesTotais()", "bullets"),
          bullet("syncPoupancaLotes()", "bullets"),
          bullet("syncControleCarteiras()", "bullets"),
          bullet("syncCarteiraGeral()", "bullets"),
          pageBreak(),

          // 5. MOTOR DE SINCRONIZAÇÃO
          heading1("5. Motor de Sincronização (syncEngine)"),
          heading2("5.1 Visão Geral"),
          p("O syncEngine.ts é o orquestrador central que mantém a consistência entre as tabelas movimentacoes, custodia, poupanca_lotes e controle_de_carteiras."),
          heading2("5.2 syncCustodiaFromMovimentacao"),
          p("Reconstrói/atualiza a tabela custodia a partir das movimentações do usuário."),
          bullet("Agrupamento por codigo_custodia", "bullets"),
          bullet('Garante que a movimentação mais antiga seja "Aplicação Inicial"', "bullets"),
          bullet("Valor Investido = Σ(aplicações) - Σ(resgates)", "bullets"),
          makeTable(["Modalidade", "Indexador", "Estratégia"], [
            ["Prefixado", "—", "Prefixado"],
            ["Pos Fixado", "CDI", "Pós Fixado CDI"],
            ["Mista", "CDI", "Pós Fixado CDI + Taxa"],
          ]),
          heading2("5.3 syncResgateNoVencimento"),
          p('Cria automaticamente movimentações de "Resgate no Vencimento" quando o vencimento de um título já passou.'),
          bullet("Para cada custódia com vencimento < data_referencia", "bullets"),
          bullet("Se não existe movimentação de Resgate no Vencimento", "bullets"),
          bullet("Executa o motor de cálculo até a data de vencimento", "bullets"),
          bullet("Cria movimentação automática com origem: Auto", "bullets"),
          heading2("5.4 syncManualResgatesTotais"),
          p('Recalcula o valor de movimentações "Resgate Total" manuais usando o motor de cálculo.'),
          heading2("5.5 syncPoupancaLotes"),
          p("Reconstrói os lotes de poupança na tabela poupanca_lotes a partir das movimentações originais (FIFO)."),
          bullet("Cada aplicação gera um lote com valor_principal = valor aplicado", "bullets"),
          bullet("Resgates consomem lotes na ordem FIFO (First In, First Out)", "bullets"),
          bullet("Lotes com valor_principal = 0 são marcados como Resgatado", "bullets"),
          heading2("5.6 syncControleCarteiras"),
          p("Atualiza a tabela controle_de_carteiras com o resumo por categoria."),
          heading2("5.7 syncCarteiraGeral"),
          p('Cria/atualiza a carteira "Investimentos" que consolida TODAS as categorias.'),
          heading2("5.8 recalculateAllForDataReferencia"),
          p('Botão "Reprocessar" (admin only). Executa o ciclo completo de sincronização para TODAS as custódias do usuário.'),
          pageBreak(),

          // 6. MOTOR DE CÁLCULO — RENDA FIXA
          heading1("6. Motor de Cálculo — Renda Fixa"),
          heading2("6.1 Visão Geral"),
          p("O rendaFixaEngine.ts é o motor de cálculo diário para títulos de renda fixa. Processa dia a dia, do início do título até a data de referência, calculando rentabilidade, patrimônio e juros."),
          heading2("6.2 Sistema de Cota Virtual"),
          p("O motor utiliza um sistema de Cota Virtual com dois níveis para calcular rentabilidade TWR de forma precisa."),
          makeTable(["Nível", "Nome", "Descrição"], [
            ["Nível 1 (C-E)", "Após resgate", "Valores finais do dia, após aplicar resgates"],
            ["Nível 2 (F-H)", "Antes do resgate", "Valores antes de aplicar resgates"],
          ]),
          heading2("6.3 Colunas Calculadas"),
          makeTable(["Coluna", "ID", "Descrição"], [
            ["Valor da Cota (1)", "C", "Cota virtual após resgate"],
            ["Saldo de Cotas (1)", "D", "Quantidade de cotas após resgate"],
            ["Líquido (1)", "E", "Patrimônio líquido do dia"],
            ["Valor da Cota (2)", "F", "Cota virtual antes do resgate"],
            ["Saldo de Cotas (2)", "G", "Cotas antes do resgate"],
            ["Líquido (2)", "H", "Patrimônio antes do resgate"],
            ["Aplicações", "I", "Valor aplicado no dia"],
            ["QTD Cotas Compra", "J", "Cotas adquiridas"],
            ["Resgate", "K", "Capital resgatado"],
            ["QTD Cotas Resgate", "L", "Cotas consumidas"],
            ["Rentabilidade diária (R$)", "M", "Ganho em reais no dia"],
            ["R$ Rent. acumulada", "N", "Soma acumulada dos ganhos"],
            ["% Rent. acumulada", "O", "(Cota atual / Cota Inicial) - 1"],
            ["Multiplicador", "P", "Fator de rendimento diário"],
            ["Juros Pago", "T", "Juros periódicos pagos"],
            ["Cupom Acumulado", "S", "Soma acumulada de juros"],
            ["Valor Investido", "U", "Capital líquido aportado"],
            ["Preço Unitário", "W", "PU do dia"],
          ]),
          heading2("6.4 Modalidades e Fórmulas do Multiplicador"),
          heading3("Prefixado"),
          codeBlock("multiplicador = (1 + taxa/100)^(1/252) - 1"),
          p("O multiplicador é constante para todos os dias úteis."),
          heading3("Pós Fixado CDI"),
          codeBlock("multiplicador = CDI_diário_anterior × (taxa/100)"),
          codeBlock("CDI_diário = (1 + CDI_anual/100)^(1/252) - 1"),
          p("Usa o CDI do dia anterior (D-1). Taxa é o percentual do CDI (ex: 103% do CDI)."),
          heading3("Mista (CDI + Spread)"),
          codeBlock("multiplicador = (1 + CDI_diário_anterior) × (1 + taxa/100)^(1/252) - 1"),
          p("Combina CDI variável com spread fixo."),
          heading2("6.5 Dias Não Úteis"),
          p("Em dias não úteis: Multiplicador = 0, valores mantidos do dia anterior."),
          heading2("6.6 Pagamento de Juros Periódicos"),
          makeTable(["Periodicidade", "Meses"], [
            ["Mensal", "1"], ["Bimestral", "2"], ["Trimestral", "3"],
            ["Quadrimestral", "4"], ["Semestral", "6"], ["No Vencimento", "—"],
          ]),
          p("Cálculo: Juros Pago = Apoio Cupom - Base Econômica"),
          p("No dia do pagamento de juros, o PU é resetado para o PU inicial."),
          heading2("6.7 Vencimento e Resgate no Vencimento"),
          p("No dia do vencimento: todo o patrimônio é resgatado automaticamente. saldoCotas = 0, líquido = 0."),
          heading2("6.8 Fórmulas Detalhadas"),
          p("Líquido(1) = Líquido_anterior × (1 + multiplicador) + Aplicações - Resgates - Juros_Pago", { bold: true }),
          p("Ganho_Diário = Líquido(1) - Líquido_anterior - Aplicações + Resgates + Juros_Pago"),
          p("Rent_Acum(%) = (Valor_Cota_atual / Cota_Inicial) - 1"),
          heading2("6.9 Parâmetros de Entrada (EngineInput)"),
          makeTable(["Parâmetro", "Descrição"], [
            ["dataInicio", "Data da primeira aplicação"],
            ["dataCalculo", "Data de referência"],
            ["taxa", "Taxa contratada (% a.a.)"],
            ["modalidade", "Prefixado, Pos Fixado, Mista"],
            ["puInicial", "Preço Unitário inicial"],
            ["calendario", "Lista de datas com flag dia_util"],
            ["movimentacoes", "Lista de aplicações e resgates"],
            ["pagamento", "Periodicidade de juros"],
            ["vencimento", "Data de vencimento do título"],
            ["indexador", "CDI ou null"],
            ["cdiRecords", "Histórico de CDI diário"],
          ]),
          pageBreak(),

          // 7. MOTOR DE CÁLCULO — POUPANÇA
          heading1("7. Motor de Cálculo — Poupança"),
          heading2("7.1 Visão Geral"),
          p("O poupancaEngine.ts calcula o rendimento de cadernetas de poupança seguindo as regras oficiais do Banco Central do Brasil."),
          heading2("7.2 Regra de Rendimento"),
          makeTable(["Condição", "Rendimento Mensal"], [
            ["Selic > 8,5% a.a.", "0,5% a.m. + TR"],
            ["Selic ≤ 8,5% a.a.", "70% da Selic mensal + TR"],
          ]),
          heading2("7.3 Fontes de Dados"),
          makeTable(["Tabela", "Descrição", "Uso"], [
            ["historico_poupanca_rendimento", "BCB Série 195", "Fonte primária"],
            ["historico_selic", "Taxa Selic diária", "Fallback"],
            ["historico_tr", "Taxa Referencial mensal", "Fallback"],
          ]),
          heading2("7.4 Sistema de Lotes (FIFO)"),
          p("Cada depósito gera um lote independente. Resgates consomem lotes na ordem FIFO."),
          heading2("7.5 Dia de Aniversário"),
          makeTable(["Dia de Depósito", "Dia de Aniversário"], [
            ["Dias 1 a 28", "Mesmo dia"],
            ["Dia 29", "Dia 1 do mês seguinte"],
            ["Dia 30", "Dia 1 do mês seguinte"],
            ["Dia 31", "Dia 1 do mês seguinte"],
          ]),
          heading2("7.6 Reconstrução de Lotes"),
          p("Os lotes são reconstruídos a cada sincronização via buildPoupancaLotesFromMovs(). Evita double-counting."),
          heading2("7.7 Precisão"),
          p("Todos os cálculos utilizam 8 casas decimais para consistência com valores oficiais do BCB."),
          pageBreak(),

          // 8. MOTOR DE CARTEIRA DE RENDA FIXA
          heading1("8. Motor de Carteira de Renda Fixa"),
          heading2("8.1 Visão Geral"),
          p("O carteiraRendaFixaEngine.ts consolida todos os produtos de Renda Fixa e Poupança em uma visão de carteira com rentabilidade diária agregada."),
          heading2("8.2 Metodologia TWR"),
          p("Rentabilidade Diária (%) = Ganho_Diário / (Líquido_anterior + Aplicações_do_dia)", { bold: true }),
          p("Rentabilidade Acumulada (%) = (1 + Rent_Acum_anterior) × (1 + Rent_Diária) - 1", { bold: true }),
          heading2("8.3 Dados de Saída"),
          makeTable(["Dado", "Descrição"], [
            ["Patrimônio", "Soma dos Líquidos de todos os ativos"],
            ["Ganho Diário (R$)", "Soma dos ganhos diários"],
            ["Ganho Acumulado (R$)", "Soma total de ganhos"],
            ["Rentabilidade Diária (%)", "TWR diária"],
            ["Rentabilidade Acumulada (%)", "TWR acumulada"],
            ["CDI Acumulado (%)", "Benchmark"],
          ]),
          pageBreak(),

          // 9. PÁGINA: CARTEIRA DE RENDA FIXA
          heading1("9. Página: Carteira de Renda Fixa"),
          p("Rota: /carteira/renda-fixa — Página principal da plataforma."),
          heading2("9.2 Cards de Resumo"),
          makeTable(["Card", "Cálculo"], [
            ["Patrimônio", "Soma dos Líquidos na data de referência"],
            ["Ganho Financeiro", "Soma dos ganhos acumulados"],
            ["Rentabilidade", "TWR acumulada da carteira"],
            ["CDI Acumulado", "CDI acumulado no período"],
          ]),
          heading2("9.3 Gráfico: Histórico de Rentabilidade"),
          p("Gráfico de linha com séries: Carteira RF, CDI (toggle), Ibovespa (toggle)."),
          heading2("9.4 Gráfico: Patrimônio Mensal"),
          p("Gráfico de barras com patrimônio no último dia útil de cada mês."),
          heading2("9.5 Tabela de Rentabilidade Mensal"),
          makeTable(["Coluna", "Descrição"], [
            ["Mês/Ano", "Período"],
            ["Patrimônio", "Valor no final do mês"],
            ["Ganho (R$)", "Rentabilidade em reais"],
            ["Rentabilidade (%)", "TWR do mês"],
            ["CDI (%)", "CDI acumulado no mês"],
            ["% CDI", "Rentabilidade / CDI × 100"],
          ]),
          heading2("9.6 Gráficos de Alocação (Pizza)"),
          p("Quatro gráficos: Por Produto, Por Estratégia, Por Instituição, Por Emissor."),
          heading2("9.7 Tabela Detalhada por Ativo"),
          p("Tabela expandível com todos os ativos. Toggle para mostrar ativos liquidados. Drill-down para Análise Individual."),
          pageBreak(),

          // 10. POSIÇÃO CONSOLIDADA
          heading1("10. Página: Posição Consolidada"),
          p("Rota: /posicao-consolidada — Exibe todos os ativos em tabela única."),
          heading2("10.2 Colunas"),
          makeTable(["Coluna", "Descrição"], [
            ["Status", "Ativa (verde) / Liquidado (azul)"],
            ["Ativo", "Nome completo"],
            ["Valor Atualizado", "Patrimônio na data de referência"],
            ["Ganho Financeiro", "Rentabilidade em R$"],
            ["Rentabilidade", "TWR acumulada (%)"],
            ["Custodiante", "Instituição financeira"],
            ["% do Portfólio", "Percentual do patrimônio total"],
          ]),
          heading2("10.3 Ações"),
          makeTable(["Ação", "Descrição"], [
            ["+ Aplicação", "Abre boleta para nova aplicação"],
            ["Resgate", "Abre boleta para resgate"],
            ["Excluir", "Remove custódia e movimentações"],
          ]),
          pageBreak(),

          // 11. MOVIMENTAÇÕES
          heading1("11. Página: Movimentações"),
          p("Rota: /movimentacoes — Extrato completo de todas as movimentações."),
          heading2("11.2 Filtros e Colunas"),
          makeTable(["Coluna", "Descrição"], [
            ["Data", "Data da movimentação"],
            ["Nome do Ativo", "Nome construído"],
            ["Tipo Mov.", "Tipo da movimentação"],
            ["Quantidade", "Número de títulos/cotas"],
            ["Preço Unitário", "PU na data"],
            ["Valor", "Valor monetário"],
          ]),
          heading2("11.3 Origem das Movimentações"),
          makeTable(["Badge", "Descrição", "Editável", "Excluível"], [
            ["Manual", "Cadastrada pelo usuário", "Sim", "Sim"],
            ["Auto", "Gerada pelo motor", "Não", "Não"],
          ]),
          pageBreak(),

          // 12. PROVENTOS RECEBIDOS
          heading1("12. Página: Proventos Recebidos"),
          p("Rota: /proventos — Lista pagamentos de juros e rendimentos."),
          makeTable(["Fonte", "Tipo", "Descrição"], [
            ["Renda Fixa", "Juros Periódicos", 'Cupons pagos em títulos com pagamento ≠ "No Vencimento"'],
            ["Poupança", "Rendimento", "Rendimentos creditados a cada aniversário"],
          ]),
          pageBreak(),

          // 13. CUSTÓDIA (ADMIN)
          heading1("13. Página: Custódia (Admin)"),
          p("Rota: /custodia — Acesso apenas admin. Visão administrativa da tabela custodia com dados brutos."),
          p("Funcionalidades: Visualização raw, Boleta rápida, Exclusão de custódia e movimentações associadas."),
          pageBreak(),

          // 14. CONTROLE DE CARTEIRAS (ADMIN)
          heading1("14. Página: Controle de Carteiras (Admin)"),
          p("Rota: /controle-carteiras — Acesso apenas admin."),
          makeTable(["Coluna", "Descrição"], [
            ["Nome da Carteira", "Nome da categoria ou Investimentos"],
            ["Data Início", "Menor data de início"],
            ["Data Limite", "Maior data limite"],
            ["Resgate Total", "Soma dos resgates totais"],
            ["Data Cálculo", "Data de referência usada"],
            ["Status", "Ativa / Encerrada / Não Iniciada"],
          ]),
          pageBreak(),

          // 15. CONFIGURAÇÕES
          heading1("15. Página: Configurações"),
          p("Rota: /configuracoes"),
          p("Funcionalidade principal: Redefinir Movimentações — AÇÃO DESTRUTIVA que apaga todas as custódias, movimentações e carteiras do usuário. Irreversível.", { bold: true }),
          pageBreak(),

          // 16. ANÁLISE INDIVIDUAL
          heading1("16. Análise Individual de Ativos"),
          p("Drill-down acessado a partir da tabela de ativos na Carteira de Renda Fixa."),
          heading2("16.2 Cards de Resumo"),
          makeTable(["Card", "Descrição"], [
            ["Patrimônio", "Valor atualizado do ativo"],
            ["Ganho Financeiro", "Rentabilidade acumulada em R$"],
            ["Rentabilidade", "TWR acumulada (%)"],
          ]),
          heading2("16.3 Gráfico e Tabela"),
          p("Gráfico de linha: Ativo individual vs CDI acumulado. Tabela de rentabilidade agrupada por mês."),
          pageBreak(),

          // 17. CALCULADORA (ADMIN)
          heading1("17. Calculadora (Admin)"),
          p("Rota: /calculadora — Acesso apenas admin."),
          p("Ferramenta para simular e inspecionar o cálculo completo de um ativo, exibindo todas as colunas do DailyRow dia a dia."),
          pageBreak(),

          // 18. REGRAS ESPECIAIS E RESTRIÇÕES
          heading1("18. Regras Especiais e Restrições"),
          heading2("18.1 Poupança vs Renda Fixa"),
          makeTable(["Aspecto", "Renda Fixa", "Poupança"], [
            ["Imposto de Renda", "Não implementado", "Isento"],
            ["IOF", "Não implementado", "Isento"],
            ["Sistema de Cotas", "Cota Virtual", "Não usa"],
            ["Preço Unitário", "Sim", "Não usa"],
            ["Marcação a Mercado", "Não implementado", "N/A"],
            ["Dia Útil obrigatório", "Sim", "Não"],
            ["Motor de cálculo", "rendaFixaEngine", "poupancaEngine"],
            ["Pagamento de juros", "Configurável", "Aniversário do lote"],
          ]),
          heading2("18.2 Limites e Restrições"),
          makeTable(["Restrição", "Valor"], [
            ["Data de referência máxima", "D-1 (ontem)"],
            ["Limite de registros por query", "1000 (Supabase default)"],
            ["Precisão — Poupança", "8 casas decimais"],
            ["Precisão — Renda Fixa", "Ponto flutuante JavaScript"],
            ["Dias úteis por ano", "252"],
          ]),
          heading2("18.3 Funcionalidades Não Implementadas"),
          makeTable(["Funcionalidade", "Status"], [
            ["Tributação (IR/IOF)", "Não implementado"],
            ["Marcação a Mercado", "Não implementado"],
            ["Renda Variável", "Não implementado"],
            ["Fundos de Investimento", "Não implementado"],
            ["Importação em lote (CSV/Excel)", "Não implementado"],
            ["Multi-moeda", "Não implementado"],
            ["Relatórios exportáveis", "Não implementado"],
          ]),
          heading2("18.4 Tabelas do Banco de Dados"),
          makeTable(["Tabela", "Descrição"], [
            ["profiles", "Dados do perfil do usuário"],
            ["custodia", "Posições de custódia (ativos)"],
            ["movimentacoes", "Todas as transações"],
            ["poupanca_lotes", "Lotes individuais de poupança"],
            ["controle_de_carteiras", "Carteiras agregadas"],
            ["produtos", "Cadastro de produtos"],
            ["categorias", "Categorias de investimento"],
            ["instituicoes", "Instituições financeiras"],
            ["emissores", "Emissores de títulos"],
            ["historico_cdi", "Histórico de CDI"],
            ["historico_selic", "Histórico de Selic"],
            ["historico_tr", "Histórico de TR"],
            ["historico_ibovespa", "Histórico de Ibovespa"],
            ["historico_poupanca_rendimento", "Rendimentos de poupança BCB"],
            ["calendario_dias_uteis", "Calendário de dias úteis"],
            ["user_settings", "Configurações do usuário"],
          ]),
        ],
      },
    ],
  });
}

export default function GenerateDocxPage() {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const doc = buildDocument();
      const blob = await Packer.toBlob(doc);
      saveAs(blob, "Blueberg_Regras_de_Negocio.docx");
      setDone(true);
    } catch (e) {
      console.error(e);
      alert("Erro ao gerar documento: " + (e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1 className="text-2xl font-bold">Gerador de Documento DOCX</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Clique no botão abaixo para gerar e baixar o documento completo de Regras de Negócio da Blueberg em formato Word (.docx).
      </p>
      <Button onClick={handleGenerate} disabled={generating} size="lg">
        {generating ? "Gerando..." : done ? "✅ Baixar novamente" : "Gerar Documento .docx"}
      </Button>
      {done && <p className="text-sm text-green-600">Documento gerado com sucesso! O download deve iniciar automaticamente.</p>}
    </div>
  );
}
