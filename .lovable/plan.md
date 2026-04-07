

## Plano: Gerar documento .docx com regras de negócio do Controle de Carteiras

### Objetivo
Criar um arquivo Word (.docx) contendo a seção 14 do documento de regras de negócio — "Controle de Carteiras (Admin)" — extraída de `docs/Blueberg_Regras_de_Negocio.md`.

### Abordagem
Usar a mesma estratégia já implementada: página temporária `/gerar-docx` com a biblioteca `docx` para gerar e baixar o arquivo no navegador. Atualizar o conteúdo da página `GenerateDocxPage.tsx` para focar apenas na seção de Controle de Carteiras.

### Conteúdo do documento
- Título: "Blueberg — Regras de Negócio: Controle de Carteiras"
- Seção 14.1: Visão Geral (rota, acesso, descrição)
- Seção 14.2: Tabela de Colunas (Nome da Carteira, Data Início, Data Limite, Resgate Total, Data Cálculo, Status)

### Passos

1. **Atualizar `GenerateDocxPage.tsx`** para gerar o documento focado no Controle de Carteiras, com:
   - Heading 1 para o título principal
   - Heading 2 para cada subseção (14.1, 14.2)
   - Parágrafos descritivos
   - Tabela formatada com as 6 colunas e suas descrições
   - Nome do arquivo: `Blueberg_Controle_de_Carteiras.docx`

2. **Testar** acessando `/gerar-docx` e clicando no botão de download

### Detalhes técnicos
- Fonte: Arial 12pt
- Tabela com header sombreado e bordas
- Página A4 com margens de 1 polegada
- Reutiliza dependências `docx` e `file-saver` já instaladas

