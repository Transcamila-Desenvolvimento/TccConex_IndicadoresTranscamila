import ExcelJS from 'exceljs';

/** Gera a planilha de referência (.xlsx) no formato oficial de importação. */
export async function buildProtocoloImportTemplateBlob(): Promise<Blob> {
  const wb = new ExcelJS.Workbook();

  const ws = wb.addWorksheet('Importação');
  const headers = [
    'Ano',
    'Numero Protocolo',
    'Expedição',
    'Data de envio',
    'Cliente',
    'Nota Fiscal',
  ];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF118CC4' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  const exemplos: (string | number)[][] = [
    [2025, 1, '', '04/02/2025', 'Ascenza brasil ltda.', '44'],
    [2025, 1, '', '04/02/2025', 'Ascenza brasil ltda.', '34'],
    [2025, 1, '', '04/02/2025', 'Ascenza brasil ltda.', '36'],
    [2025, 2, 'Transcamila Ibiporã', '10/02/2025', 'Ascenza brasil ltda.', '100'],
    [2026, 1, '', '15/01/2026', 'Cliente Exemplo', '2001'],
    [2026, 1, '', '15/01/2026', 'Cliente Exemplo', '2002'],
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
      + 'antes de importar. Expedição é opcional (pode ficar em branco). Filial também é '
      + 'opcional: se precisar, adicione uma coluna "Filial".',
  ]);
  ws.mergeCells(note.number, 1, note.number, 6);
  note.getCell(1).font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
  note.getCell(1).alignment = { wrapText: true };

  [8, 18, 24, 14, 28, 14].forEach((width, i) => {
    ws.getColumn(i + 1).width = width;
  });

  const wi = wb.addWorksheet('Instruções');
  wi.mergeCells('A1:B1');
  wi.getCell('A1').value = 'Como preencher a planilha de importação de protocolos';
  wi.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };

  const instrucoes: [string, string][] = [
    ['', ''],
    ['Colunas do modelo', ''],
    ['Ano', 'Ano do protocolo (ex.: 2025). Usado com "Numero Protocolo" para agrupar NFs.'],
    [
      'Numero Protocolo',
      'Número sequencial do protocolo. Linhas com o mesmo Ano + Numero Protocolo '
        + 'viram um único protocolo (várias NFs).',
    ],
    [
      'Expedição',
      'Opcional. Pode ficar em branco. Valores reconhecidos quando informados: '
        + 'Transcamila Ibiporã, Transcamila Barueri, Transcamila Paranaguá, '
        + 'Transcamila Rondonópolis.',
    ],
    [
      'Data de envio',
      'Obrigatória. Formatos aceitos: DD/MM/AAAA, AAAA-MM-DD, DD-MM-AAAA '
        + '(ou data nativa do Excel).',
    ],
    [
      'Cliente',
      'Informativo na planilha. Na tela de importação, selecione o cliente no sistema '
        + '(a coluna não substitui essa seleção).',
    ],
    [
      'Nota Fiscal',
      'Obrigatória. Uma NF por linha (recomendado) ou várias separadas por vírgula. '
        + 'Máximo de 72 por protocolo.',
    ],
    ['', ''],
    ['Coluna extra opcional', ''],
    [
      'Filial',
      'Opcional. Só use se o cliente tiver filiais cadastradas. Pode ficar ausente '
        + 'ou em branco — a importação não exige filial.',
    ],
    ['', ''],
    ['Dicas', ''],
    [
      'Expedição / Filial',
      'Nunca são obrigatórias na importação. Se o cliente estiver marcado como '
        + '"requer expedição" ou "exige filial", a falta gera apenas aviso.',
    ],
    [
      'Agrupamento',
      'Com Ano + Numero Protocolo preenchidos, várias linhas do mesmo grupo '
        + 'formam um protocolo. Sem essas colunas, cada linha vira um protocolo.',
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
