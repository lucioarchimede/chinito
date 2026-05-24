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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
