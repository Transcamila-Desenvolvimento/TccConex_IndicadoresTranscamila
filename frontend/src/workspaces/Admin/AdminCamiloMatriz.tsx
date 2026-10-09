import React from 'react';
import {
  useCamiloMatrizDocumentos,
  useCamiloMatrizDriveBrowse,
  useCamiloMatrizDriveStatus,
  useCamiloMatrizPastas,
  useCreateCamiloMatrizDocumento,
  useCreateCamiloMatrizPasta,
  useDeleteCamiloMatrizDocumento,
  useDeleteCamiloMatrizPasta,
  useDownloadCamiloMatrizDocumento,
  useMoverCamiloMatrizDocumento,
  useRenomearCamiloMatrizDocumento,
  useRenomearCamiloMatrizPasta,
  useSubstituirCamiloMatrizDocumento,
} from '../../hooks/useCamiloMatriz';
import type { GoogleDriveItem } from '../../types/domain';
import { MatrizConhecimento } from '../RH/RHDocumentos';
import RHDrivePicker from '../RH/RHDrivePicker';

const DrivePicker: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (item: GoogleDriveItem) => void;
}> = (props) => (
  <RHDrivePicker {...props} useStatus={useCamiloMatrizDriveStatus} useBrowse={useCamiloMatrizDriveBrowse} />
);

const AdminCamiloMatriz: React.FC = () => {
  const documentosQuery = useCamiloMatrizDocumentos();
  const pastasQuery = useCamiloMatrizPastas();
  const criar = useCreateCamiloMatrizDocumento();
  const renomear = useRenomearCamiloMatrizDocumento();
  const substituir = useSubstituirCamiloMatrizDocumento();
  const excluir = useDeleteCamiloMatrizDocumento();
  const baixar = useDownloadCamiloMatrizDocumento();
  const criarPasta = useCreateCamiloMatrizPasta();
  const renomearPasta = useRenomearCamiloMatrizPasta();
  const excluirPasta = useDeleteCamiloMatrizPasta();
  const mover = useMoverCamiloMatrizDocumento();

  return (
    <div className="admin-camilo-matriz">
      <MatrizConhecimento
        raiz="Matriz empresarial"
        embutida
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
        DrivePicker={DrivePicker}
      />
    </div>
  );
};

export default AdminCamiloMatriz;
