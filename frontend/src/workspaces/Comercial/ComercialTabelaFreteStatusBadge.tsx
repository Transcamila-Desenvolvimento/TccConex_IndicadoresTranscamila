import type { TabelaFreteStatus } from '../../types/domain';
import { TABELA_FRETE_STATUS_LABEL } from '../../types/domain';

const STATUS_CLASS: Record<TabelaFreteStatus, string> = {
  rascunho: 'is-potencial',
  publicada: 'is-publicada',
  expirada: 'is-expirada',
  arquivada: 'is-potencial',
};

interface Props {
  status: TabelaFreteStatus;
}

export default function ComercialTabelaFreteStatusBadge({ status }: Props) {
  return (
    <span className={`comercial-cliente-situacao-badge ${STATUS_CLASS[status]}`}>
      {TABELA_FRETE_STATUS_LABEL[status]}
    </span>
  );
}
