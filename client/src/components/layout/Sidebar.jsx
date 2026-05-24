import { NavLink } from 'react-router-dom';
import { X, LayoutDashboard, Package, ShoppingCart, Receipt, Layers,
  Users, TrendingUp, Megaphone, FileText, BarChart2, Settings } from 'lucide-react';

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

export default function Sidebar({ isOpen, onClose }) {
  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 flex flex-col h-full flex-shrink-0
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <LayoutDashboard size={15} className="text-white" />
          </div>
          <span className="text-white font-semibold text-base tracking-tight">EcomDash</span>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        <ul className="space-y-0.5 px-3">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                  }`
                }
              >
                <Icon size={16} className="flex-shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-4 py-3 border-t border-slate-800">
        <p className="text-slate-600 text-xs text-center">EcomDash v2.0</p>
      </div>
    </aside>
  );
}
