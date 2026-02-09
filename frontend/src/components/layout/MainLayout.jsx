
// ============================================
// src/components/layout/MainLayout.jsx
// ============================================
import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const MainLayout = () => {
  return (
    <div className="d-flex vh-100">
      <Sidebar />
      <div className="flex-grow-1 d-flex flex-column">
        <Navbar />
        <main className="flex-grow-1 overflow-auto bg-light">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;

