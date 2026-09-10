import React from 'react';
import type { ClienteComercialCompatibilidade } from '../../types/domain';
import { CLIENTE_COMERCIAL_COMPATIBILIDADE_LABEL } from '../../types/domain';

const CLASS_MAP: Record<ClienteComercialCompatibilidade, string> = {
  nao_analisado: 'is-pendente',
  pendente_validacao: 'is-pendente',
  homologado: 'is-homologado',
  reprovado: 'is-reprovado',
};

type Props = {
  status: ClienteComercialCompatibilidade;
};

const ComercialHomologacaoBadge: React.FC<Props> = ({ status }) => (
  <span className={`comercial-homologacao-badge ${CLASS_MAP[status]}`}>
    {status === 'homologado' || status === 'reprovado'
      ? CLIENTE_COMERCIAL_COMPATIBILIDADE_LABEL[status]
      : 'Pendente'}
  </span>
);

export default ComercialHomologacaoBadge;
