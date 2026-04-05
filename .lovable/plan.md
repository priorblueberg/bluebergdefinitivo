
Objetivo

Corrigir definitivamente a boleta de Resgate aberta em `/posicao-consolidada`, cobrindo regras de data, saldo disponível e o comportamento do check “Fechar Posição”.

Plano

1. Trocar o campo de data do modal por uma entrada controlada de verdade.
- Parar de usar o `<input type="date">` nativo dentro de `BoletaCustodiaDialog`.
- Substituir por um campo mascarado `dd/mm/aaaa` com seletor de calendário Shadcn.
- Limitar a digitação a 8 números / 10 caracteres formatados, garantindo ano com exatamente 4 dígitos.
- Separar o “texto digitado” da `date` válida, para a edição parcial não apagar dia/mês e não deixar cálculo velho na tela.
- Teclado e calendário passarão pela mesma rotina de parse, validação e cálculo.

2. Aplicar as regras corretas no campo “Data da Transação”.
- Se a data for anterior à `data_inicio` do ativo, mostrar alerta: “A data selecionada não pode ser anterior à aplicação inicial.”
- Manter os bloqueios já existentes para:
  - data futura
  - data posterior ao vencimento
  - dia não útil
- Incluir a regra da faixa de resgate quando houver `resgate_total`: aceitar apenas datas de `data_inicio` até o dia anterior ao `resgate_total`.
- Quando a data estiver parcial ou inválida, limpar `saldoDisponivel`, `valorCotaDia`, `fecharPosicao` e `valor`, sem apagar o que o usuário digitou.

3. Ajustar os dados enviados da Posição Consolidada para a boleta.
- Em `PosicaoConsolidadaPage`, passar também `resgate_total` para `CustodiaRowForBoleta`.
- Isso é necessário para o modal saber até onde o resgate manual pode ser permitido.

4. Ajustar o comportamento do saldo e do fechamento de posição.
- Só mostrar o bloco “Saldo disponível para resgate” quando a data estiver válida e dentro da faixa permitida.
- Continuar usando o valor de `rowDia.liquido` (Líquido 1), como você definiu.
- Só mostrar o check “Fechar Posição” quando houver saldo calculado maior que zero.
- Ao marcar o check, preencher o campo `Valor` com o saldo disponível.
- Se o usuário digitar exatamente o valor total disponível, marcar o check automaticamente.

5. Revisar o submit do resgate.
- Manter o bloqueio por `dateError`.
- Garantir que nenhuma data fora da faixa válida siga para gravação.
- Preservar o comportamento atual de gravar `Resgate Total` quando “Fechar Posição” estiver marcado.

Arquivos envolvidos
- `src/components/BoletaCustodiaDialog.tsx`
- `src/pages/PosicaoConsolidadaPage.tsx`

Detalhes técnicos
- Novo estado de texto para a data, separado do estado `Date`.
- Helper único para:
  - aplicar máscara `dd/mm/aaaa`
  - converter para ISO
  - validar faixa da data
  - disparar cálculo de saldo/cota
- Uso do `Calendar` com `pointer-events-auto` dentro do modal.
- Nenhuma mudança de banco será necessária.

QA prevista
- Digitar a data inteira pelo teclado sem perder dia/mês ao chegar no ano.
- Confirmar que o ano não aceita mais de 4 dígitos.
- Selecionar a mesma data pelo calendário e validar que o resultado é idêntico ao digitado.
- Testar data anterior à aplicação inicial.
- Testar data igual à aplicação inicial.
- Testar data anterior ao `resgate_total`, igual ao `resgate_total` e posterior ao `resgate_total`.
- Testar o auto-preenchimento e a auto-marcação do “Fechar Posição”.
