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
  FileText,
  X
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  businessData?: any;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, businessData }) => {
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
    onClose();
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/app/dashboard' },
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
    <>
      {/* Overlay Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] transition-opacity animate-in fade-in duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed left-0 top-0 bottom-0 w-72 bg-white/90 backdrop-blur-2xl border-r border-slate-200/80 z-[70] 
        flex flex-col transform transition-transform duration-300 ease-in-out shadow-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-5 border-b border-slate-100/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {businessData?.logoUrl ? (
              <img 
                src={businessData.logoUrl} 
                alt="Brand Logo" 
                className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shadow-xs shrink-0" 
              />
            ) : (
              <div className="w-9 h-9 bg-gradient-to-tr from-primary-600 via-primary-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-primary-500/25 shrink-0">
                <Zap size={18} fill="currentColor" />
              </div>
            )}
            <div className="overflow-hidden">
              <span className="text-base font-bold text-slate-900 tracking-tight font-display truncate block max-w-[160px]">
                {businessData?.businessName || 'ScaleKitchen'}
              </span>
              <span className="block text-[11px] font-medium text-slate-400">Meal Ops Suite</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100/70 rounded-xl transition-all"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/app/dashboard' && location.pathname === '/app');
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium ${
                  isActive 
                    ? 'bg-primary-50/90 text-primary-700 font-semibold shadow-xs border border-primary-200/60 backdrop-blur-sm' 
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} className={isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-xs">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3.5 border-t border-slate-100/80">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50/80 rounded-xl transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;