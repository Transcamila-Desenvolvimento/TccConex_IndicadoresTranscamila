import type { ReportImportType } from '../types/domain';

export const REPORT_TEMPLATE_HINTS: Record<ReportImportType, string> = {
  pagar: 'Contas a pagar DD.MM.AAAA.xlsx',
  receber: 'CRs e Faturas vencidas Posição DD.MM.AAAA Fluxo Novo.xlsx',
  aging: 'aging luft.xlsx',
};
