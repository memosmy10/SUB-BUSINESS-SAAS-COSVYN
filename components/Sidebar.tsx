import React, { useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGlobalCollection, useStreamCollection } from '../services/dbService';
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
  ClipboardList,
  ShoppingBag,
  StickyNote,
  ChefHat,
  BellRing,
  FileText
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();

  // Fetch messages and read status
  const { data: adminMessages = [] } = useGlobalCollection('admin_messages');
  const { data: readReceipts = [] } = useStreamCollection<any>('read_messages');

  const unreadCount = useMemo(() => {
    if (!currentUser) return 0;
    
    const myMessages = adminMessages.filter((msg: any) => {
      const isGlobal = msg.targetType === 'ALL';
      const isSpecific = msg.targetType === 'SPECIFIC' && msg.recipientId === currentUser.uid;
      return isGlobal || isSpecific || msg.targetType === 'ACTIVE';
    });

    const readIds = new Set(readReceipts.map(r => r.id));
    return myMessages.filter((msg: any) => !readIds.has(msg.id)).length;
  }, [adminMessages, readReceipts, currentUser]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/app' },
    { icon: ChefHat, label: 'Kitchen Prep', path: '/app/prep' },
    { icon: Users, label: 'Customers', path: '/app/customers' },
    { icon: ShoppingBag, label: 'Single Orders', path: '/app/single-orders' },
    { icon: CreditCard, label: 'Payments', path: '/app/payments' },
    { icon: FileText, label: 'Invoices', path: '/app/invoices' },
    { icon: Receipt, label: 'Expenses', path: '/app/expenses' },
    { icon: Package, label: 'Deliveries', path: '/app/deliveries' },
    { icon: ClipboardList, label: 'Inventory', path: '/app/inventory' },
    { icon: StickyNote, label: 'Notes', path: '/app/notes' },
    { icon: BarChart3, label: 'Analytics', path: '/app/analytics' },
    { icon: BellRing, label: 'Messages', path: '/app/messages', badge: unreadCount },
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

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                isActive 
                  ? 'bg-primary-50 text-primary-700' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={20} className={isActive ? 'text-primary-600' : 'text-slate-400'} />
                {item.label}
              </div>
              {item.badge ? (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge}
                </span>
              ) : null}
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