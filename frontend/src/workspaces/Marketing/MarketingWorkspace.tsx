import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MarketingHome from './MarketingHome';
import MarketingInstagramPosts from './MarketingInstagramPosts';
import InstagramCallbackPage from './InstagramCallbackPage';

const MarketingWorkspace: React.FC = () => {
  return (
    <Routes>
      <Route index element={<MarketingHome />} />
      <Route path="instagram-posts" element={<MarketingInstagramPosts />} />
      <Route path="instagram/callback" element={<InstagramCallbackPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

export default MarketingWorkspace;
