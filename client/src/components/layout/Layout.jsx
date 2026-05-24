import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const titles = {
  '/': 'Dashboard',
  '/productos': 'Productos',
  '/ventas': 'Ventas',
  '/gastos': 'Gastos',
  '/stock': 'Stock',
  '/clientes': 'Clientes',
  '/cash-flow': 'Cash Flow',
  '/marketing': 'Marketing',
  '/notas': 'Notas',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
};

export default function Layout() {
  const { pathname } = useLocation();
  const title = titles[pathname] || 'EcomDash';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
          <div className="max-w-screen-xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
