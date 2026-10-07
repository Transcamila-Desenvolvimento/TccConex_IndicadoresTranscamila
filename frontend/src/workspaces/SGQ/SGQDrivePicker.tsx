import React from 'react';
import { useSGQDriveBrowse, useSGQDriveStatus } from '../../hooks/useSGQMatriz';
import type { GoogleDriveItem } from '../../types/domain';
import RHDrivePicker from '../RH/RHDrivePicker';

const SGQDrivePicker: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (item: GoogleDriveItem) => void;
}> = (props) => (
  <RHDrivePicker {...props} useStatus={useSGQDriveStatus} useBrowse={useSGQDriveBrowse} />
);

export default SGQDrivePicker;
