
import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Package, 
  Settings, 
  BarChart3, 
  MessageSquare, 
  Receipt,
  LogOut,
  Zap,
  ClipboardList
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/app' },
    { icon: Users, label: 'Customers', path: '/app/customers' },
    { icon: CreditCard, label: 'Payments', path: '/app/payments' },
    { icon: Receipt, label: 'Expenses', path: '/app/expenses' },
    { icon: Package, label: 'Deliveries', path: '/app/deliveries' },
    { icon: ClipboardList, label: 'Inventory', path: '/app/inventory' },
    { icon: BarChart3, label: 'Analytics', path: '/app/analytics' },
    { icon: MessageSquare, label: 'Support', path: '/app/support' },
    { icon: Settings, label: 'Configuration', path: '/app/settings' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 flex flex-col z-10 hidden md:flex">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-violet-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
            <Zap size={18} fill="currentColor" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">ScaleKitchen</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                isActive 
                  ? 'bg-primary-50 text-primary-700' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon size={20} className={isActive ? 'text-primary-600' : 'text-slate-400'} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
