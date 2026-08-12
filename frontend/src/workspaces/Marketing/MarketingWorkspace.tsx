import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MarketingHome from './MarketingHome';
import MarketingCampanhas from './MarketingCampanhas';
import MarketingDriveBank from './MarketingDriveBank';

const MarketingWorkspace: React.FC = () => {
  return (
    <Routes>
      <Route index element={<MarketingHome />} />
      <Route path="campanhas" element={<MarketingCampanhas />} />
      <Route path="banco-midias" element={<MarketingDriveBank />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

export default MarketingWorkspace;
