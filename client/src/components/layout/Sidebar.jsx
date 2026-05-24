import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Receipt, Layers,
  Users, TrendingUp, Megaphone, FileText, BarChart2, Settings
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/productos', label: 'Productos', icon: Package },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart },
  { to: '/gastos', label: 'Gastos', icon: Receipt },
  { to: '/stock', label: 'Stock', icon: Layers },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/cash-flow', label: 'Cash Flow', icon: TrendingUp },
  { to: '/marketing', label: 'Marketing', icon: Megaphone },
  { to: '/notas', label: 'Notas', icon: FileText },
  { to: '/reportes', label: 'Reportes', icon: BarChart2 },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-gray-900 flex flex-col h-full flex-shrink-0">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <LayoutDashboard size={16} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg">EcomDash</span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        <ul className="space-y-0.5 px-3">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                <Icon size={17} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="px-3 py-3 border-t border-gray-800">
        <p className="text-gray-600 text-xs text-center">EcomDash v2.0</p>
      </div>
    </aside>
  );
}
