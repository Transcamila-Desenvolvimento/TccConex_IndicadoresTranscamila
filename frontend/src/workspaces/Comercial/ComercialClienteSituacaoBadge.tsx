import React from 'react';
import type { ClienteComercialSituacao } from '../../types/domain';
import { CLIENTE_COMERCIAL_SITUACAO_LABEL } from '../../types/domain';

const SITUACAO_CLASS: Record<ClienteComercialSituacao, string> = {
  cliente: 'is-cliente',
  potencial: 'is-potencial',
  inativo: 'is-inativo',
};

interface ComercialClienteSituacaoBadgeProps {
  situacao: ClienteComercialSituacao;
}

const ComercialClienteSituacaoBadge: React.FC<ComercialClienteSituacaoBadgeProps> = ({ situacao }) => (
  <span className={`comercial-cliente-situacao-badge ${SITUACAO_CLASS[situacao]}`}>
    {situacao === 'potencial' ? 'Potencial' : CLIENTE_COMERCIAL_SITUACAO_LABEL[situacao]}
  </span>
);

export default ComercialClienteSituacaoBadge;
