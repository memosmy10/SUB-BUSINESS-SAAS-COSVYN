
import React, { useState, useMemo, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { Plus, Receipt, Loader2, X, Trash2, ShoppingBag, Edit2, Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStreamCollection, addItem, updateItem } from '../services/dbService';
import { GlobalExpense, ExpenseItem, INDIA_STATES } from '../services/store';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  // Derived Data
  const filteredExpenses = useMemo(() => {
    return selectedBranch === 'All' ? expenses : expenses.filter(e => e.branchId === selectedBranch);
  }, [expenses, selectedBranch]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => map[e.category] = (map[e.category] || 0) + e.amount);
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
                data[d.getMonth()].amount += (e.amount || 0);
            }
        }
    });
    return data;
  }, [filteredExpenses]);

  const handleAddExpense = async (data: any) => {
    if(!currentUser) return;
    await addItem(currentUser.uid, 'expenses', data);
    setIsModalOpen(false);
  };

  const handleBranchSubmit = async (data: any) => {
    if(!currentUser) return;
    if (selectedBranch !== 'All') {
        // Edit existing
        await updateItem(currentUser.uid, 'branches', selectedBranch, data);
    } else {
        // Add new
        const id = await addItem(currentUser.uid, 'branches', data);
        setSelectedBranch(id); // Auto-select new branch
    }
    setIsBranchModalOpen(false);
  };

  const currentBranchData = branches.find(b => b.id === selectedBranch);

  if (l1 || l2) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
         
         <div className="flex gap-3 w-full sm:w-auto">
            {/* Branch Selector with Edit/Add Button */}
            <div className="flex rounded-lg border border-slate-300 bg-white overflow-hidden shadow-sm flex-1 sm:flex-none">
                <select 
                    className="p-2 bg-transparent text-slate-900 outline-none w-full sm:w-40 text-sm font-medium" 
                    value={selectedBranch} 
                    onChange={e => setSelectedBranch(e.target.value)}
                >
                   <option value="All">All Branches</option>
                   {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button 
                    onClick={() => setIsBranchModalOpen(true)}
                    className="px-3 border-l border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center bg-slate-50"
                    title={selectedBranch === 'All' ? "Add New Branch" : "Edit This Branch"}
                >
                    {selectedBranch === 'All' ? <Plus size={16}/> : <Edit2 size={16}/>}
                </button>
            </div>

            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-2 font-bold text-sm whitespace-nowrap">
               <Plus size={18}/> <span className="hidden sm:inline">Add Expense</span>
               <span className="sm:hidden">Add</span>
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-white p-6 rounded-xl shadow h-64 border border-slate-100">
            <h3 className="font-bold mb-4 text-slate-900">Category Breakdown</h3>
            <div className="h-full pb-8">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie data={pieData} dataKey="value" outerRadius={60} label={({name, percent}) => `${(percent*100).toFixed(0)}%`}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                     </Pie>
                     <Tooltip formatter={(val: number) => `₹${val}`} />
                     <Legend iconSize={8} layout="vertical" verticalAlign="middle" align="right" />
                  </PieChart>
               </ResponsiveContainer>
            </div>
         </div>
         <div className="bg-white p-6 rounded-xl shadow overflow-y-auto h-64 border border-slate-100 custom-scrollbar">
            <h3 className="font-bold mb-4 text-slate-900">Recent Transactions</h3>
            {filteredExpenses.slice(0, 20).map((e: any, i) => (
               <div key={i} className="flex justify-between py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 -mx-2 rounded transition-colors group">
                  <div>
                     <div className="font-bold text-slate-900 text-sm">{e.title || e.category}</div>
                     <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{e.date}</span>
                        {e.items && e.items.length > 0 && (
                           <span className="bg-slate-100 text-slate-600 px-1.5 rounded flex items-center gap-1">
                              <ShoppingBag size={10}/> {e.items.length} items
                           </span>
                        )}
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="font-bold text-slate-900">₹{e.amount}</div>
                     <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${e.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {e.paymentStatus}
                     </span>
                  </div>
               </div>
            ))}
            {filteredExpenses.length === 0 && <p className="text-slate-400 text-center py-8">No expenses recorded yet.</p>}
         </div>
      </div>

      {/* Monthly Trend Chart */}
      <div className="bg-white p-6 rounded-xl shadow border border-slate-100 h-80">
          <h3 className="font-bold mb-4 text-slate-900">Monthly Expense Trend</h3>
          <div className="h-full pb-4">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} tickFormatter={(v) => `₹${v}`} />
                   <Tooltip 
                       cursor={{fill: '#f1f5f9'}}
                       contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                       formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Total Expenses']}
                   />
                   <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
             </ResponsiveContainer>
          </div>
      </div>

      {isModalOpen && <AddExpenseModal branches={branches} onClose={() => setIsModalOpen(false)} onSubmit={handleAddExpense} />}
      
      {isBranchModalOpen && (
        <BranchModal 
            initialData={selectedBranch !== 'All' ? currentBranchData : undefined}
            onClose={() => setIsBranchModalOpen(false)}
            onSubmit={handleBranchSubmit}
        />
      )}
    </div>
  );
};

// --- MODALS ---

const BranchModal = ({ initialData, onClose, onSubmit }: any) => {
    const [formData, setFormData] = useState({ 
      name: initialData?.name || '', 
      city: initialData?.city || '',
      state: initialData?.state || '' 
    });
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.city || !formData.state) return;
      onSubmit(formData);
    };
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex justify-between mb-4 items-center">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Store size={20} className="text-blue-600"/>
                {initialData ? 'Edit Branch' : 'Add Branch'}
            </h3>
            <button onClick={onClose}><X size={20} className="text-slate-500 hover:text-slate-700"/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Branch Name</label>
              <input 
                required autoFocus
                placeholder="e.g. Main Kitchen" 
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 outline-none" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">City Name</label>
              <input 
                required 
                placeholder="e.g. Mumbai" 
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 outline-none" 
                value={formData.city}
                onChange={e => setFormData({...formData, city: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">State</label>
              <select 
                required
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-primary-500 outline-none"
                value={formData.state}
                onChange={e => setFormData({...formData, state: e.target.value})}
              >
                <option value="">Select State</option>
                {INDIA_STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold transition-colors shadow-lg shadow-blue-500/20">
              {initialData ? 'Save Changes' : 'Create Branch'}
            </button>
          </form>
        </div>
      </div>
    );
};

const AddExpenseModal = ({ branches, onClose, onSubmit }: any) => {
   const [formData, setFormData] = useState({
      branchId: branches[0]?.id || '', 
      date: new Date().toISOString().split('T')[0], 
      category: 'Food', 
      amount: '', 
      title: '', 
      description: '',
      paymentStatus: 'Paid',
      paymentMethod: 'UPI'
   });

   // Line Items State
   const [items, setItems] = useState<ExpenseItem[]>([]);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in zoom-in-95">
         <div className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl text-slate-900">Add New Expense</h3>
               <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
               
               {/* Top Section: Basic Info */}
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Branch</label>
                     <select className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})}>
                        {branches.map((b:any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                     <input required type="date" value={formData.date} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                     <select className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                  </div>
               </div>

               {/* Middle Section: Details */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                     <input required placeholder="e.g. Weekly Market Run" className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                     <input placeholder="Description (Optional)" className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
               </div>

               {/* Line Items Section */}
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                     <ShoppingBag size={14}/> Expense Items (Optional)
                  </label>
                  
                  {/* Item Input Row */}
                  <div className="flex flex-wrap md:flex-nowrap gap-2 mb-3">
                     <input 
                        placeholder="Item Name" 
                        className="flex-[2] min-w-[120px] p-2 text-sm border border-slate-300 rounded bg-white text-slate-900"
                        value={newItem.name}
                        onChange={e => setNewItem({...newItem, name: e.target.value})}
                     />
                     <input 
                        type="number" 
                        placeholder="Qty" 
                        className="w-16 p-2 text-sm border border-slate-300 rounded bg-white text-slate-900"
                        value={newItem.quantity}
                        onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                     />
                     <select 
                        className="w-20 p-2 text-sm border border-slate-300 rounded bg-white text-slate-900"
                        value={newItem.unit}
                        onChange={e => setNewItem({...newItem, unit: e.target.value})}
                     >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                     </select>
                     <input 
                        type="number" 
                        placeholder="Price" 
                        className="w-24 p-2 text-sm border border-slate-300 rounded bg-white text-slate-900"
                        value={newItem.price}
                        onChange={e => setNewItem({...newItem, price: e.target.value})}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
                     />
                     <button 
                        type="button" 
                        onClick={handleAddItem}
                        className="bg-slate-800 text-white p-2 rounded hover:bg-slate-900 transition-colors"
                     >
                        <Plus size={18} />
                     </button>
                  </div>

                  {/* Items List */}
                  {items.length > 0 && (
                     <div className="bg-white rounded border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                           <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-bold">
                              <tr>
                                 <th className="p-2 pl-3">Item</th>
                                 <th className="p-2">Qty</th>
                                 <th className="p-2">Amount</th>
                                 <th className="p-2 w-8"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {items.map((item, idx) => (
                                 <tr key={idx}>
                                    <td className="p-2 pl-3 text-slate-800">{item.name}</td>
                                    <td className="p-2 text-slate-500">{item.quantity} {item.unit}</td>
                                    <td className="p-2 font-medium text-slate-900">₹{item.amount}</td>
                                    <td className="p-2 text-center">
                                       <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600">
                                          <X size={14} />
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
               <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="w-full md:w-1/3">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Total Amount (₹)</label>
                     <input 
                        required 
                        type="number" 
                        className={`w-full p-3 border rounded-lg text-slate-900 font-bold text-lg ${items.length > 0 ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300'}`} 
                        value={formData.amount} 
                        onChange={e => items.length === 0 && setFormData({...formData, amount: e.target.value})}
                        readOnly={items.length > 0}
                     />
                  </div>
                  <div className="w-full md:w-1/3">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                     <select className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900" value={formData.paymentStatus} onChange={e => setFormData({...formData, paymentStatus: e.target.value})}>
                        <option value="Paid">Paid</option>
                        <option value="Pending">Pending</option>
                     </select>
                  </div>
                  <div className="w-full md:w-1/3">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Method</label>
                     <select className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                     </select>
                  </div>
               </div>

               <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 mt-4">
                  Save Expense
               </button>
            </form>
         </div>
      </div>
   );
}

export default Expenses;
