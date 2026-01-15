
import React, { useState, useMemo, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { Plus, Receipt, Loader2, X, Trash2, ShoppingBag, Edit2, Store, Download, Calendar, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStreamCollection, addItem, updateItem, deleteItem } from '../services/dbService';
import { GlobalExpense, ExpenseItem } from '../services/store';

const EXPENSE_CATEGORIES = ['Food', 'Salaries', 'Packaging', 'Rent', 'Marketing', 'Transportation', 'Others'];
const UNITS = ['kg', 'g', 'L', 'ml', 'dozen', 'pcs', 'pkt'];
const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

interface Branch { id: string; name: string; city: string; state: string; }

const Expenses = () => {
  const { currentUser } = useAuth();
  
  // Real Data
  const { data: expenses, loading: l1 } = useStreamCollection<GlobalExpense>('expenses');
  const { data: branches, loading: l2 } = useStreamCollection<Branch>('branches');

  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<GlobalExpense | null>(null);

  // Derived available years
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear().toString();
    years.add(currentYear);
    expenses.forEach(e => {
      if (e.date) {
        const y = new Date(e.date).getFullYear().toString();
        if (y !== 'NaN') years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  // Derived Data
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesBranch = selectedBranch === 'All' || e.branchId === selectedBranch;
      const matchesYear = selectedYear === 'All' || (e.date && new Date(e.date).getFullYear().toString() === selectedYear);
      return matchesBranch && matchesYear;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, selectedBranch, selectedYear]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => map[e.category] = (map[e.category] || 0) + (Number(e.amount) || 0));
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [filteredExpenses]);

  // Monthly Trend Data
  const monthlyTrendData = useMemo(() => {
    const data = [
        { name: 'Jan', amount: 0 }, { name: 'Feb', amount: 0 }, { name: 'Mar', amount: 0 },
        { name: 'Apr', amount: 0 }, { name: 'May', amount: 0 }, { name: 'Jun', amount: 0 },
        { name: 'Jul', amount: 0 }, { name: 'Aug', amount: 0 }, { name: 'Sep', amount: 0 },
        { name: 'Oct', amount: 0 }, { name: 'Nov', amount: 0 }, { name: 'Dec', amount: 0 }
    ];

    filteredExpenses.forEach(e => {
        if(e.date) {
            const d = new Date(e.date);
            if(!isNaN(d.getTime())) {
                data[d.getMonth()].amount += (Number(e.amount) || 0);
            }
        }
    });
    return data;
  }, [filteredExpenses]);

  const handleExport = () => {
    if (filteredExpenses.length === 0) return alert("No expenses to export.");

    // CSV Header
    const headers = ["Date", "Branch", "Category", "Title", "Amount", "Status", "Method", "Description", "Items Count"];
    
    // CSV Rows
    const rows = filteredExpenses.map(e => {
      const branchName = branches.find(b => b.id === e.branchId)?.name || 'Unknown';
      return [
        e.date,
        `"${branchName}"`,
        `"${e.category}"`,
        `"${e.title}"`,
        e.amount,
        `"${e.paymentStatus}"`,
        `"${e.paymentMethod}"`,
        `"${e.description || ''}"`,
        e.items?.length || 0
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `expenses_${selectedBranch}_${selectedYear}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddOrEditExpense = async (data: any) => {
    if(!currentUser) return;
    if (editingExpense) {
        await updateItem(currentUser.uid, 'expenses', editingExpense.id, data);
    } else {
        await addItem(currentUser.uid, 'expenses', data);
    }
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const handleDeleteExpense = async (id: string) => {
    if(!currentUser || !window.confirm("Delete this expense record?")) return;
    await deleteItem(currentUser.uid, 'expenses', id);
  };

  const openAddModal = () => {
     setEditingExpense(null);
     setIsModalOpen(true);
  };

  const openEditModal = (expense: GlobalExpense) => {
     setEditingExpense(expense);
     setIsModalOpen(true);
  };

  if (l1 || l2) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             Expenses
          </h1>
          <p className="text-slate-500 font-medium mt-1">Operational costs and outgoing cash flow.</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            {/* Branch Filter */}
            <div className="relative flex-1 sm:flex-none">
              <select 
                className="w-full sm:w-44 p-3 bg-white border border-slate-200 rounded-xl text-xs font-black shadow-sm outline-none focus:ring-2 focus:ring-primary-500 appearance-none pr-10 uppercase tracking-widest cursor-pointer" 
                value={selectedBranch} 
                onChange={e => setSelectedBranch(e.target.value)}
              >
                <option value="All">All Branches</option>
                {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>

            {/* Year Filter */}
            <div className="relative flex-1 sm:flex-none">
              <select 
                className="w-full sm:w-32 p-3 bg-white border border-slate-200 rounded-xl text-xs font-black shadow-sm outline-none focus:ring-2 focus:ring-primary-500 appearance-none pr-10 uppercase tracking-widest cursor-pointer" 
                value={selectedYear} 
                onChange={e => setSelectedYear(e.target.value)}
              >
                <option value="All">All Years</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>

            {/* Export Button */}
            <button 
              onClick={handleExport}
              className="bg-slate-900 hover:bg-black text-white p-3 rounded-xl transition-all shadow-md flex items-center gap-2 font-bold text-xs uppercase tracking-widest active:scale-95"
              title="Export to CSV"
            >
               <Download size={18}/> <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* Add Button */}
            <button onClick={openAddModal} className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl transition-all shadow-lg shadow-primary-500/20 flex items-center gap-2 font-black text-xs uppercase tracking-widest active:scale-95">
               <Plus size={18}/> <span className="hidden sm:inline">Add Expense</span>
               <span className="sm:hidden">Add</span>
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
         {/* Category Breakdown */}
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-80 flex flex-col">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
               <Receipt size={20} className="text-violet-600"/> Category Breakdown
            </h3>
            <div className="flex-1">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie data={pieData} dataKey="value" innerRadius={60} outerRadius={80} paddingAngle={5}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
                     </Pie>
                     <Tooltip 
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        formatter={(val: number) => `₹${val.toLocaleString()}`} 
                     />
                     <Legend iconSize={8} iconType="circle" layout="vertical" verticalAlign="middle" align="right" />
                  </PieChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Recent List */}
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col h-80">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
               <ShoppingBag size={20} className="text-primary-600"/> Recent Expenses
            </h3>
            <div className="flex-1 overflow-y-auto no-scrollbar pr-2">
               {filteredExpenses.map((e: any, i) => (
                  <div key={i} className="flex justify-between py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/80 px-3 -mx-3 rounded-2xl transition-colors group cursor-default">
                     <div className="flex-1">
                        <div className="font-black text-slate-900 text-sm uppercase tracking-tight">{e.title || e.category}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-3">
                           <span>{e.date}</span>
                           {e.items && e.items.length > 0 && (
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                 {e.items.length} items
                              </span>
                           )}
                           <span className="text-slate-300 font-normal">
                             {branches.find(b => b.id === e.branchId)?.name}
                           </span>
                        </div>
                     </div>
                     <div className="text-right flex items-center gap-4">
                        <div>
                           <div className="font-black text-slate-900 text-lg">₹{e.amount}</div>
                           <span className={`text-[8px] uppercase font-black px-2 py-0.5 rounded border ${
                             e.paymentStatus === 'Paid' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'
                           }`}>
                              {e.paymentStatus}
                           </span>
                        </div>
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => openEditModal(e)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg"><Edit2 size={14} /></button>
                           <button onClick={() => handleDeleteExpense(e.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Trash2 size={14} /></button>
                        </div>
                     </div>
                  </div>
               ))}
               {filteredExpenses.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50 py-10">
                   <Receipt size={40} className="mb-2"/>
                   <p className="font-bold text-xs uppercase tracking-widest">No expenses recorded</p>
                 </div>
               )}
            </div>
         </div>
      </div>

      {/* Monthly Trend Chart */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-[400px]">
          <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-2">
             <Calendar size={20} className="text-emerald-600"/> Monthly Trend {selectedYear === 'All' ? '(All Years)' : `(${selectedYear})`}
          </h3>
          <div className="h-full pb-12">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 900}} />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 900}} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(1) + 'k' : v}`} />
                   <Tooltip 
                       cursor={{fill: '#f8fafc'}}
                       contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                       formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Total Expenses']}
                   />
                   <Bar dataKey="amount" fill="#4f46e5" radius={[8, 8, 0, 0]} barSize={40} />
                </BarChart>
             </ResponsiveContainer>
          </div>
      </div>

      {isModalOpen && (
         <AddExpenseModal 
            branches={branches} 
            initialData={editingExpense} 
            onClose={() => setIsModalOpen(false)} 
            onSubmit={handleAddOrEditExpense} 
         />
      )}
    </div>
  );
};

// --- MODALS ---

const AddExpenseModal = ({ branches, initialData, onClose, onSubmit }: any) => {
   const [formData, setFormData] = useState({
      branchId: branches[0]?.id || '', 
      date: new Date().toISOString().split('T')[0], 
      category: 'Food', 
      title: '', 
      description: '',
      paymentStatus: 'Paid',
      paymentMethod: 'UPI',
      ...initialData,
      amount: initialData ? String(initialData.amount) : '', 
   });

   // Line Items State
   const [items, setItems] = useState<ExpenseItem[]>(initialData?.items || []);
   const [newItem, setNewItem] = useState({ name: '', quantity: '', unit: 'kg', price: '' });

   // Update total amount when items change
   useEffect(() => {
      if (items.length > 0) {
         const total = items.reduce((sum, item) => sum + item.amount, 0);
         setFormData(prev => ({ ...prev, amount: String(total) }));
      }
   }, [items]);

   const handleAddItem = () => {
      if (!newItem.name || !newItem.price) return;
      const amount = parseFloat(newItem.price);
      const quantity = parseFloat(newItem.quantity) || 1;
      
      setItems([...items, {
         name: newItem.name,
         quantity,
         unit: newItem.unit,
         amount
      }]);
      setNewItem({ name: '', quantity: '', unit: 'kg', price: '' });
   };

   const handleRemoveItem = (index: number) => {
      const updated = items.filter((_, i) => i !== index);
      setItems(updated);
      if (updated.length === 0) {
         setFormData(prev => ({ ...prev, amount: '' }));
      }
   };

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit({
         ...formData,
         amount: Number(formData.amount),
         items: items.length > 0 ? items : undefined
      });
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
         <div className="bg-white w-full max-w-2xl rounded-[2rem] p-8 shadow-2xl max-h-[95vh] overflow-y-auto no-scrollbar relative">
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-2xl font-black text-slate-900">{initialData ? 'Edit Expense' : 'Add New Expense'}</h3>
               <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
               
               {/* Top Section: Basic Info */}
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                     <ModalLabel>Branch</ModalLabel>
                     <select className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500" value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})}>
                        {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                     </select>
                  </div>
                  <div>
                     <ModalLabel>Date</ModalLabel>
                     <input required type="date" value={formData.date} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500" onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                  <div>
                     <ModalLabel>Category</ModalLabel>
                     <select className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                  </div>
               </div>

               {/* Middle Section: Details */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                     <ModalLabel>Title</ModalLabel>
                     <input required placeholder="e.g. Weekly Market Run" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                     <ModalLabel>Description (Optional)</ModalLabel>
                     <input placeholder="Details about this purchase..." className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
               </div>

               {/* Line Items Section */}
               <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                     <ShoppingBag size={14} className="text-primary-600"/> Item Breakdown (Optional)
                  </label>
                  
                  {/* Item Input Row */}
                  <div className="flex flex-wrap md:flex-nowrap gap-3 mb-4">
                     <input 
                        placeholder="Item Name" 
                        className="flex-[2] min-w-[120px] p-3 text-sm font-bold border border-slate-200 rounded-xl bg-white text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                        value={newItem.name}
                        onChange={e => setNewItem({...newItem, name: e.target.value})}
                     />
                     <input 
                        type="number" 
                        placeholder="Qty" 
                        className="w-20 p-3 text-sm font-bold border border-slate-200 rounded-xl bg-white text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                        value={newItem.quantity}
                        onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                     />
                     <select 
                        className="w-24 p-3 text-sm font-bold border border-slate-200 rounded-xl bg-white text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                        value={newItem.unit}
                        onChange={e => setNewItem({...newItem, unit: e.target.value})}
                     >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                     </select>
                     <input 
                        type="number" 
                        placeholder="Price" 
                        className="w-28 p-3 text-sm font-bold border border-slate-200 rounded-xl bg-white text-slate-900 outline-none focus:ring-2 focus:ring-primary-500"
                        value={newItem.price}
                        onChange={e => setNewItem({...newItem, price: e.target.value})}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
                     />
                     <button 
                        type="button" 
                        onClick={handleAddItem}
                        className="bg-slate-900 text-white p-3 rounded-xl hover:bg-black transition-all shadow-md flex items-center justify-center active:scale-95"
                     >
                        <Plus size={20} />
                     </button>
                  </div>

                  {/* Items List */}
                  {items.length > 0 && (
                     <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                           <thead className="bg-slate-100 text-slate-400 text-[10px] uppercase font-black tracking-widest">
                              <tr>
                                 <th className="p-3 pl-4">Item</th>
                                 <th className="p-3">Qty</th>
                                 <th className="p-3">Amount</th>
                                 <th className="p-3 w-10"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {items.map((item, idx) => (
                                 <tr key={idx}>
                                    <td className="p-3 pl-4 text-slate-800 font-bold uppercase text-[11px]">{item.name}</td>
                                    <td className="p-3 text-slate-500 font-bold">{item.quantity} {item.unit}</td>
                                    <td className="p-3 font-black text-slate-900">₹{item.amount}</td>
                                    <td className="p-3 text-center">
                                       <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                                          <X size={16} />
                                       </button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  )}
               </div>

               {/* Bottom Section: Totals & Payment */}
               <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-900 p-6 rounded-[1.5rem] shadow-xl text-white">
                  <div className="w-full md:w-1/3">
                     <ModalLabel><span className="text-slate-400">Total Amount (₹)</span></ModalLabel>
                     <input 
                        required 
                        type="number" 
                        className={`w-full p-3 bg-slate-800 border-none rounded-xl text-white font-black text-xl outline-none ${items.length > 0 ? 'opacity-50' : ''}`} 
                        value={formData.amount} 
                        onChange={e => items.length === 0 && setFormData({...formData, amount: e.target.value})}
                        readOnly={items.length > 0}
                     />
                  </div>
                  <div className="w-full md:w-1/3">
                     <ModalLabel><span className="text-slate-400">Status</span></ModalLabel>
                     <select className="w-full p-3 bg-slate-800 border-none rounded-xl text-white font-bold text-sm outline-none" value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value})}>
                        <option value="Paid">Paid</option>
                        <option value="Pending">Pending</option>
                     </select>
                  </div>
                  <div className="w-full md:w-1/3">
                     <ModalLabel><span className="text-slate-400">Method</span></ModalLabel>
                     <select className="w-full p-3 bg-slate-800 border-none rounded-xl text-white font-bold text-sm outline-none" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                     </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4 pt-4 pb-2">
                  <button type="button" onClick={onClose} className="py-4 border-2 border-slate-100 rounded-2xl font-black text-slate-500 hover:bg-slate-50 transition-colors uppercase text-xs tracking-widest">Cancel</button>
                  <button type="submit" className="py-4 bg-primary-600 text-white rounded-2xl font-black shadow-xl shadow-primary-500/20 hover:bg-primary-700 transition-all active:scale-95 uppercase text-xs tracking-widest">
                     {initialData ? 'Save Changes' : 'Record Expense'}
                  </button>
               </div>
            </form>
         </div>
      </div>
   );
}

const ModalLabel = ({ children }: React.PropsWithChildren<{}>) => (
  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{children}</label>
);

export default Expenses;
