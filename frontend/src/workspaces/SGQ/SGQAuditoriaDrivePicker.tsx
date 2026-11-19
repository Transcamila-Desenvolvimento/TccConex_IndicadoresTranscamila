import React from 'react';
import { useSgqAuditoriaDriveBrowse, useSgqAuditoriaDriveStatus } from '../../hooks/useSgqAuditorias';
import type { GoogleDriveItem } from '../../types/domain';
import RHDrivePicker from '../RH/RHDrivePicker';

const SGQAuditoriaDrivePicker: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (item: GoogleDriveItem) => void;
}> = (props) => (
  <RHDrivePicker
    {...props}
    useStatus={useSgqAuditoriaDriveStatus}
    useBrowse={useSgqAuditoriaDriveBrowse}
    dica="O arquivo fica só no seu Google Drive. A auditoria guarda o link."
  />
);

export default SGQAuditoriaDrivePicker;
