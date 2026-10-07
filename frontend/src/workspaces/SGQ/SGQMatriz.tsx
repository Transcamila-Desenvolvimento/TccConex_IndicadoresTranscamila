import React from 'react';
import {
  useCreateDocumentoSGQ,
  useCreatePastaMatrizSGQ,
  useDeleteDocumentoSGQ,
  useDeletePastaMatrizSGQ,
  useDocumentosSGQ,
  useDownloadDocumentoSGQ,
  useMoverDocumentoSGQ,
  usePastasMatrizSGQ,
  useRenomearDocumentoSGQ,
  useRenomearPastaMatrizSGQ,
  useSubstituirDocumentoSGQ,
} from '../../hooks/useSGQMatriz';
import { MatrizConhecimento } from '../RH/RHDocumentos';
import SGQDrivePicker from './SGQDrivePicker';

const SGQMatriz: React.FC = () => {
  const documentosQuery = useDocumentosSGQ();
  const pastasQuery = usePastasMatrizSGQ();
  const criar = useCreateDocumentoSGQ();
  const renomear = useRenomearDocumentoSGQ();
  const substituir = useSubstituirDocumentoSGQ();
  const excluir = useDeleteDocumentoSGQ();
  const baixar = useDownloadDocumentoSGQ();
  const criarPasta = useCreatePastaMatrizSGQ();
  const renomearPasta = useRenomearPastaMatrizSGQ();
  const excluirPasta = useDeletePastaMatrizSGQ();
  const mover = useMoverDocumentoSGQ();

  return (
    <MatrizConhecimento
      raiz="Matriz SGQ"
      documentosQuery={documentosQuery}
      pastasQuery={pastasQuery}
      criar={criar}
      renomear={renomear}
      substituir={substituir}
      excluir={excluir}
      baixar={baixar}
      criarPasta={criarPasta}
      renomearPasta={renomearPasta}
      excluirPasta={excluirPasta}
      mover={mover}
      DrivePicker={SGQDrivePicker}
    />
  );
};

export default SGQMatriz;
