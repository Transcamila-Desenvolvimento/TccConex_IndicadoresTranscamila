import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminCamiloPanel from './AdminCamiloPanel';
import AdminHome from './AdminHome';
import AdminWorkspace from './AdminWorkspace';

const AdminRouter: React.FC = () => {
  return (
    <Routes>
      <Route index element={<AdminHome />} />
      <Route path="usuarios" element={<AdminWorkspace />} />
      <Route path="camilo" element={<AdminCamiloPanel />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
};

export default AdminRouter;
