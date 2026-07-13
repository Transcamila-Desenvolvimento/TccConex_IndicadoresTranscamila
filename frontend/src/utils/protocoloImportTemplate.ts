import ExcelJS from 'exceljs';

/** Gera a planilha de referência (.xlsx) alinhada ao modelo do backend. */
export async function buildProtocoloImportTemplateBlob(): Promise<Blob> {
  const wb = new ExcelJS.Workbook();

  const ws = wb.addWorksheet('Exemplos');
  const headers = ['Data', 'Nota Fiscal', 'Expedição', 'Filial', 'Ano', 'Número protocolo'];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF118CC4' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  const exemplos: (string | number)[][] = [
    ['10/07/2026', '1001', 'Transcamila Ibiporã', 'Matriz SP', '', ''],
    ['11/07/2026', '1002', 'Transcamila Barueri/Ibiporã', 'Filial RJ', '', ''],
    ['12/07/2026', '1003, 1004', 'Transcamila Paranaguá', 'Matriz SP', '', ''],
    ['13/07/2026', '1005, 1006', 'Transcamila Rondonópolis', 'Matriz SP, Filial RJ', '', ''],
    ['14/07/2026', '2001', 'Transcamila Ibiporã', 'Matriz SP', 2026, 1],
    ['14/07/2026', '2002', 'Transcamila Ibiporã', 'Filial RJ', 2026, 1],
    ['15/07/2026', '2003', 'Transcamila Barueri', 'Matriz SP', 2026, 2],
  ];

  for (const row of exemplos) {
    const excelRow = ws.addRow(row);
    excelRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
    });
  }

  ws.addRow([]);
  const note = ws.addRow([
    'Os exemplos acima são apenas referência — apague-os e preencha com os dados reais '
      + 'antes de importar. Colunas Expedição, Filial, Ano e Número protocolo são opcionais.',
  ]);
  ws.mergeCells(note.number, 1, note.number, 6);
  note.getCell(1).font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
  note.getCell(1).alignment = { wrapText: true };

  [12, 18, 32, 24, 8, 18].forEach((width, i) => {
    ws.getColumn(i + 1).width = width;
  });

  const wi = wb.addWorksheet('Instruções');
  wi.mergeCells('A1:B1');
  wi.getCell('A1').value = 'Como preencher a planilha de importação de protocolos';
  wi.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };

  const instrucoes: [string, string][] = [
    ['', ''],
    ['Colunas obrigatórias', ''],
    ['Data', 'Data de envio. Formatos aceitos: DD/MM/AAAA, AAAA-MM-DD, DD-MM-AAAA.'],
    [
      'Nota Fiscal',
      'Uma ou mais NFs separadas por vírgula (ex.: 1001, 1002). Máximo de 72 por protocolo.',
    ],
    ['', ''],
    ['Colunas opcionais', ''],
    [
      'Expedição',
      'Valores reconhecidos: Transcamila Ibiporã, Transcamila Barueri, '
        + 'Transcamila Paranaguá, Transcamila Rondonópolis.',
    ],
    [
      'Expedição (duas)',
      'Até 2 expedições por protocolo. Escreva as duas na mesma célula, por exemplo: '
        + '"Transcamila Barueri/Ibiporã" ou "Transcamila Barueri Transcamila Ibiporã".',
    ],
    [
      'Filial',
      'Nome da filial do cliente (deve existir no cadastro do cliente, se possível). '
        + 'Uma filial na célula = aplica a todas as NFs da linha. '
        + 'Várias filiais separadas por vírgula = associa na ordem das NFs '
        + '(ex.: NFs "1005, 1006" e Filial "Matriz SP, Filial RJ").',
    ],
    [
      'Ano + Número protocolo',
      'Se ambas existirem, linhas com o mesmo Ano e Número são agrupadas em um único '
        + 'protocolo (útil para várias NFs, cada uma com sua filial em linhas separadas). '
        + 'Sem essas colunas, cada linha vira um protocolo (número gerado automaticamente).',
    ],
    ['', ''],
    ['Dicas', ''],
    [
      'Cliente com exigência',
      'Se o cliente "requer expedição" ou "exige filial", a importação ainda grava '
        + 'mesmo sem a coluna — mas gera avisos para você revisar depois.',
    ],
    [
      'Nomes de coluna',
      'O sistema detecta automaticamente variações (Data, Nota Fiscal, NF, Expedição, '
        + 'Transportadora, Filial, Filial do cliente, Ano, Número protocolo, etc.).',
    ],
    [
      'Dry-run',
      'Na tela de importação, use "Simular importação" para validar sem gravar no banco.',
    ],
  ];

  let rowNum = 3;
  for (const [titulo, texto] of instrucoes) {
    if (titulo && !texto) {
      wi.getCell(rowNum, 1).value = titulo;
      wi.getCell(rowNum, 1).font = { bold: true, size: 12, color: { argb: 'FF118CC4' } };
    } else if (titulo) {
      wi.getCell(rowNum, 1).value = titulo;
      wi.getCell(rowNum, 1).font = { bold: true, color: { argb: 'FF334155' } };
      wi.getCell(rowNum, 2).value = texto;
      wi.getCell(rowNum, 2).alignment = { wrapText: true, vertical: 'top' };
    }
    rowNum += 1;
  }

  wi.getColumn(1).width = 28;
  wi.getColumn(2).width = 90;
  for (let r = 3; r < rowNum; r += 1) {
    wi.getRow(r).height = 36;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
