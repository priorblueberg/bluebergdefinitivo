

## Plano: Gerar documento .docx das Regras de Negócio

### Objetivo
Converter o conteúdo completo de `docs/Blueberg_Regras_de_Negocio.md` em um arquivo `.docx` formatado, sem imagens.

### Abordagem
Usar a biblioteca `docx` (docx-js) via Node.js para gerar o documento programaticamente, seguindo o skill disponível.

### Passos

1. **Ler o conteúdo** de `docs/Blueberg_Regras_de_Negocio.md` para extrair todos os 18 capítulos
2. **Instalar dependência**: `npm install -g docx`
3. **Criar script Node.js** em `/tmp/generate_docx.js` que:
   - Estrutura o documento com estilos (Heading1, Heading2, body text, bullets)
   - Inclui todos os 18 capítulos do documento de regras de negócio
   - Formata tabelas, listas e seções adequadamente
   - Gera o arquivo em `/home/lovable/Blueberg_Regras_de_Negocio.docx`
4. **Validar** o documento gerado
5. **Converter para imagem** para QA visual

### Detalhes técnicos
- Fonte: Arial 12pt
- Headings formatados com hierarquia (H1, H2)
- Listas usando `LevelFormat.BULLET` (não unicode)
- Página A4 com margens de 1 polegada

### Entrega
Arquivo `.docx` em `/home/lovable/` (storage temporário, pois `/mnt/documents` está indisponível)

