import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Search, Download, Share2, Printer, 
  Mail, MessageSquare, ChevronRight, CheckCircle2,
  Layout, Smartphone, Palette, ShieldCheck, Zap,
  Loader2, X, Info, Globe, Building2, Upload, Plus, Trash2, ChevronDown, Check, UserCircle, Settings2
} from 'lucide-react';
import { useStreamCollection } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

type InvoiceTemplate = 'Standard' | 'Spreadsheet' | 'Compact';
type ThemeColor = 'black' | 'orange' | 'blue' | 'green' | 'red';
type InvoiceSource = 'manual' | 'customer';

interface LineItem {
  id: string;
  description: string;
  hsn: string;
  qty: number;
  rate: number;
  sgstPercent: number;
  cgstPercent: number;
  cess: number;
}

const THEMES: Record<ThemeColor, string> = {
  black: 'bg-slate-900',
  orange: 'bg-orange-500',
  blue: 'bg-blue-600',
  green: 'bg-emerald-600',
  red: 'bg-rose-600'
};

const Invoices = () => {
  const { currentUser } = useAuth();
  const { data: customers = [], loading: l1 } = useStreamCollection<any>('customers');
  const { data: branches = [], loading: l2 } = useStreamCollection<any>('branches');
  
  // --- INVOICE SOURCE & FILTERS ---
  const [invoiceSource, setInvoiceSource] = useState<InvoiceSource>('manual');
  const [selectedBranchId, setSelectedBranchId] = useState('All');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // --- INVOICE DATA STATE ---
  const [invoiceData, setInvoiceData] = useState({
    invoiceNo: `INV-${Math.floor(100 + Math.random() * 900)}`,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    from: {
      company: '',
      name: '',
      gstin: '',
      address: '',
      city: '',
      state: '',
    },
    billTo: {
      company: '',
      gstin: '',
      address: '',
      city: '',
      state: '',
    },
    items: [
      { id: '1', description: 'Monthly Meal Subscription', hsn: '9963', qty: 1, rate: 0, sgstPercent: 6, cgstPercent: 6, cess: 0 }
    ] as LineItem[],
    notes: 'It was great doing business with you.',
    terms: 'Please make the payment by the due date.'
  });

  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate>('Standard');
  const [selectedTheme, setSelectedTheme] = useState<ThemeColor>('blue');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // --- INITIAL BUSINESS DATA FETCH ---
  useEffect(() => {
    if (currentUser) {
      getDoc(doc(db, 'businesses', currentUser.uid)).then(s => {
        if (s.exists()) {
          const d = s.data();
          setInvoiceData(prev => ({
            ...prev,
            from: {
              company: d.businessName || '',
              name: d.ownerName || '',
              gstin: d.gstin || 'Unregistered',
              address: d.description || '',
              city: d.city || '',
              state: d.state || '',
            }
          }));
        }
      });
    }
  }, [currentUser]);

  // Handle Branch/Customer Selection Pre-fill
  useEffect(() => {
    if (invoiceSource === 'customer' && selectedCustomerId) {
      const cust = customers.find(c => c.id === selectedCustomerId);
      if (cust) {
        setInvoiceData(prev => ({
          ...prev,
          billTo: {
            company: cust.name,
            gstin: 'URD',
            address: cust.address,
            city: cust.area,
            state: '',
          },
          items: cust.activePlans?.map((p: any) => ({
            id: Math.random().toString(),
            description: `${p.planName} (${p.mealTime})`,
            hsn: '9963',
            qty: 1,
            rate: p.price,
            sgstPercent: 2.5,
            cgstPercent: 2.5,
            cess: 0
          })) || prev.items
        }));
      }
    }
  }, [selectedCustomerId, invoiceSource, customers]);

  // Filter customers by selected branch
  const filteredCustomers = useMemo(() => {
    if (selectedBranchId === 'All') return customers;
    return customers.filter(c => c.branchId === selectedBranchId);
  }, [customers, selectedBranchId]);

  // --- CALCULATIONS ---
  const totals = useMemo(() => {
    const subTotal = invoiceData.items.reduce((acc, item) => acc + (item.qty * item.rate), 0);
    const sgstTotal = invoiceData.items.reduce((acc, item) => acc + (item.qty * item.rate * (item.sgstPercent / 100)), 0);
    const cgstTotal = invoiceData.items.reduce((acc, item) => acc + (item.qty * item.rate * (item.cgstPercent / 100)), 0);
    return {
      subTotal,
      sgstTotal,
      cgstTotal,
      grandTotal: subTotal + sgstTotal + cgstTotal
    };
  }, [invoiceData.items]);

  // --- HANDLERS ---
  const addItem = () => {
    setInvoiceData(prev => ({
      ...prev,
      items: [...prev.items, { id: Math.random().toString(), description: '', hsn: '', qty: 1, rate: 0, sgstPercent: 0, cgstPercent: 0, cess: 0 }]
    }));
  };

  const removeItem = (id: string) => {
    setInvoiceData(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
  };

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  if (l1 || l2) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary-600" size={40} /></div>;

  return (
    <div className="space-y-8 pb-20 pt-2 animate-in fade-in duration-500 min-h-screen">
      
      {/* 1. REFINED HEADER ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 uppercase">COSVYN ScaleKitchen Maker</h1>
          <p className="text-slate-500 font-medium mt-1">Create and customize professional tax invoices.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto">
          {/* Source Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => { setInvoiceSource('manual'); setSelectedCustomerId(''); }}
               className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${invoiceSource === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
             >
                <Settings2 size={12}/> Manual
             </button>
             <button 
               onClick={() => setInvoiceSource('customer')}
               className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${invoiceSource === 'customer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
             >
                <UserCircle size={12}/> Customer
             </button>
          </div>

          {/* Conditional Dropdowns */}
          {invoiceSource === 'customer' && (
             <div className="flex flex-col sm:flex-row gap-2 animate-in slide-in-from-right-2 duration-300">
                <div className="relative">
                  <select 
                    className="pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none appearance-none"
                    value={selectedBranchId}
                    onChange={(e) => { setSelectedBranchId(e.target.value); setSelectedCustomerId(''); }}
                  >
                    <option value="All">All Branches</option>
                    {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                </div>
                <div className="relative">
                  <select 
                    className="pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none appearance-none min-w-[120px]"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    <option value="">Select Customer</option>
                    {filteredCustomers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                </div>
             </div>
          )}
        </div>
      </div>

      {/* 2. INVOICE EDITOR & CONTROLS GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* LEFT: INVOICE EDITOR CANVAS */}
        <div className="xl:col-span-8 bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden print-area">
          <div className="p-8 md:p-12 space-y-12">
            
            {/* Header & From */}
            <div className="flex flex-col md:flex-row justify-between gap-8">
              <div className="space-y-6 flex-1">
                <div className="w-40 h-40 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:border-primary-400 hover:text-primary-600 transition-colors cursor-pointer group no-print">
                   <Upload size={32} className="mb-2 group-hover:scale-110 transition-transform" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-center">Upload Logo<br/><span className="font-medium text-slate-300">240 x 240px</span></span>
                </div>
                <div className="space-y-2 max-w-xs">
                  <EditableInput placeholder="Your Company" value={invoiceData.from.company} onChange={v => setInvoiceData({...invoiceData, from: {...invoiceData.from, company: v}})} className="text-xl font-black uppercase text-slate-900" />
                  <EditableInput placeholder="Your Name" value={invoiceData.from.name} onChange={v => setInvoiceData({...invoiceData, from: {...invoiceData.from, name: v}})} className="text-sm font-bold text-slate-600" />
                  <EditableInput placeholder="Company's GSTIN" value={invoiceData.from.gstin} onChange={v => setInvoiceData({...invoiceData, from: {...invoiceData.from, gstin: v}})} className="text-xs text-slate-400" />
                  <EditableArea placeholder="Company's Address" value={invoiceData.from.address} onChange={v => setInvoiceData({...invoiceData, from: {...invoiceData.from, address: v}})} className="text-xs text-slate-500 leading-relaxed" />
                  <div className="flex gap-2">
                    <EditableInput placeholder="City" value={invoiceData.from.city} onChange={v => setInvoiceData({...invoiceData, from: {...invoiceData.from, city: v}})} className="text-xs text-slate-500" />
                    <EditableInput placeholder="State" value={invoiceData.from.state} onChange={v => setInvoiceData({...invoiceData, from: {...invoiceData.from, state: v}})} className="text-xs text-slate-500" />
                  </div>
                </div>
              </div>
              <div className="text-right space-y-2">
                <h2 className="text-5xl font-black text-slate-200 uppercase tracking-tighter">Tax Invoice</h2>
                <div className="flex flex-col items-end gap-1 pt-4">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice#</span>
                    <EditableInput value={invoiceData.invoiceNo} onChange={v => setInvoiceData({...invoiceData, invoiceNo: v})} className="text-right font-bold text-slate-700 w-32" />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</span>
                    <input type="date" value={invoiceData.invoiceDate} onChange={e => setInvoiceData({...invoiceData, invoiceDate: e.target.value})} className="text-right text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer" />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date</span>
                    <input type="date" value={invoiceData.dueDate} onChange={e => setInvoiceData({...invoiceData, dueDate: e.target.value})} className="text-right text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="w-1/2 space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                Bill To:
              </h3>
              <div className="space-y-2">
                <EditableInput placeholder="Your Client's Company" value={invoiceData.billTo.company} onChange={v => setInvoiceData({...invoiceData, billTo: {...invoiceData.billTo, company: v}})} className="text-lg font-black uppercase text-slate-900" />
                <EditableInput placeholder="Client's GSTIN" value={invoiceData.billTo.gstin} onChange={v => setInvoiceData({...invoiceData, billTo: {...invoiceData.billTo, gstin: v}})} className="text-xs font-bold text-slate-400" />
                <EditableArea placeholder="Client's Address" value={invoiceData.billTo.address} onChange={v => setInvoiceData({...invoiceData, billTo: {...invoiceData.billTo, address: v}})} className="text-sm text-slate-600 leading-relaxed" />
                <div className="flex gap-2">
                  <EditableInput placeholder="City" value={invoiceData.billTo.city} onChange={v => setInvoiceData({...invoiceData, billTo: {...invoiceData.billTo, city: v}})} className="text-sm text-slate-600" />
                  <EditableInput placeholder="State" value={invoiceData.billTo.state} onChange={v => setInvoiceData({...invoiceData, billTo: {...invoiceData.billTo, state: v}})} className="text-sm text-slate-600" />
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className={`rounded-xl border overflow-hidden transition-all ${selectedTemplate === 'Spreadsheet' ? 'border-slate-200' : 'border-transparent shadow-sm'}`}>
              <table className="w-full text-left border-collapse">
                <thead className={`${THEMES[selectedTheme]} text-white`}>
                  <tr className="text-[10px] font-black uppercase tracking-widest">
                    <th className="p-4 w-1/3">Item Description</th>
                    <th className="p-4 text-center">Qty</th>
                    <th className="p-4 text-right">Rate</th>
                    <th className="p-4 text-center">SGST</th>
                    <th className="p-4 text-center">CGST</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 w-10 no-print"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {invoiceData.items.map((item) => (
                    <React.Fragment key={item.id}>
                      <tr className="group hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                           <EditableInput value={item.description} onChange={v => updateItem(item.id, 'description', v)} placeholder="Enter item name/description" className="w-full text-slate-900 text-sm" />
                           <div className="flex gap-2 mt-1">
                             <span className="text-[8px] font-black text-slate-300 uppercase">HSN/SAC:</span>
                             <EditableInput value={item.hsn} onChange={v => updateItem(item.id, 'hsn', v)} placeholder="Code" className="text-[8px] text-slate-400 font-mono w-16" />
                           </div>
                        </td>
                        <td className="p-4 text-center">
                           <input type="number" value={item.qty} onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} className="w-12 bg-transparent text-center text-sm font-bold text-slate-600 outline-none" />
                        </td>
                        <td className="p-4 text-right">
                           <input type="number" value={item.rate} onChange={e => updateItem(item.id, 'rate', Number(e.target.value))} className="w-20 bg-transparent text-right text-sm font-bold text-slate-600 outline-none" />
                        </td>
                        <td className="p-4 text-center">
                           <div className="flex flex-col items-center">
                             <input type="number" value={item.sgstPercent} onChange={e => updateItem(item.id, 'sgstPercent', Number(e.target.value))} className="w-10 bg-transparent text-center text-[10px] font-bold text-slate-400 outline-none" />
                             <span className="text-[10px] text-slate-300 font-normal">₹{(item.qty * item.rate * (item.sgstPercent/100)).toFixed(2)}</span>
                           </div>
                        </td>
                        <td className="p-4 text-center">
                           <div className="flex flex-col items-center">
                             <input type="number" value={item.cgstPercent} onChange={e => updateItem(item.id, 'cgstPercent', Number(e.target.value))} className="w-10 bg-transparent text-center text-[10px] font-bold text-slate-400 outline-none" />
                             <span className="text-[10px] text-slate-300 font-normal">₹{(item.qty * item.rate * (item.cgstPercent/100)).toFixed(2)}</span>
                           </div>
                        </td>
                        <td className="p-4 text-right text-slate-900 text-sm">
                           ₹{(item.qty * item.rate).toLocaleString()}
                        </td>
                        <td className="p-4 no-print text-center">
                           <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                              <X size={14} />
                           </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <button 
                onClick={addItem}
                className="w-full py-4 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-primary-600 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all no-print"
              >
                <Plus size={16} /> Add Line Item
              </button>
            </div>

            {/* Footer & Totals */}
            <div className="flex flex-col md:flex-row justify-between gap-12">
               <div className="flex-1 space-y-8">
                  <div className="space-y-2">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</p>
                     <EditableArea value={invoiceData.notes} onChange={v => setInvoiceData({...invoiceData, notes: v})} className="text-sm text-slate-600 leading-relaxed italic w-full" />
                  </div>
                  <div className="space-y-2">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Terms & Conditions</p>
                     <EditableArea value={invoiceData.terms} onChange={v => setInvoiceData({...invoiceData, terms: v})} className="text-sm text-slate-600 leading-relaxed w-full" />
                  </div>
               </div>
               <div className="w-full md:w-80">
                  <div className="space-y-3 pt-4">
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 font-bold uppercase tracking-tighter">Sub Total</span>
                        <span className="font-black text-slate-700">₹{totals.subTotal.toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 font-bold uppercase tracking-tighter">SGST Total</span>
                        <span className="font-black text-slate-700">₹{totals.sgstTotal.toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 font-bold uppercase tracking-tighter">CGST Total</span>
                        <span className="font-black text-slate-700">₹{totals.cgstTotal.toLocaleString()}</span>
                     </div>
                     <div className={`mt-6 p-6 rounded-2xl flex justify-between items-center ${THEMES[selectedTheme]} text-white shadow-xl shadow-slate-900/10`}>
                        <span className="text-xs font-black uppercase tracking-[0.2em]">Total</span>
                        <span className="text-2xl font-black tracking-tight">₹{totals.grandTotal.toLocaleString()}</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Branding */}
            <div className="pt-12 border-t border-slate-100 text-center space-y-2">
               <div className="flex items-center justify-center gap-2 opacity-30 grayscale">
                  <Zap size={14} fill="currentColor" className="text-slate-900" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Powered by ScaleKitchen ONE</span>
               </div>
            </div>
          </div>
        </div>

        {/* RIGHT: CONTROL PANEL */}
        <div className="xl:col-span-4 space-y-6 no-print">
          
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
            <div>
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Download Invoice</h3>
               <div className="h-1 w-12 bg-primary-600 rounded-full" />
            </div>

            {/* Theme Picker */}
            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Choose Theme</label>
               <div className="flex gap-4">
                  {(Object.keys(THEMES) as ThemeColor[]).map((t) => (
                    <button 
                      key={t}
                      onClick={() => setSelectedTheme(t)}
                      className={`w-10 h-10 rounded-full border-4 transition-all flex items-center justify-center ${THEMES[t]} ${selectedTheme === t ? 'border-slate-200 scale-125 shadow-lg shadow-black/10' : 'border-transparent hover:scale-110'}`}
                    >
                       {selectedTheme === t && <Check size={16} className="text-white" strokeWidth={4} />}
                    </button>
                  ))}
               </div>
            </div>

            {/* Template Picker */}
            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Layout Design</label>
               <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'Standard', icon: Smartphone },
                    { id: 'Spreadsheet', icon: Layout },
                    { id: 'Compact', icon: FileText }
                  ].map((t) => (
                    <button 
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id as any)}
                      className={`p-4 rounded-2xl border-2 text-center space-y-2 transition-all ${selectedTemplate === t.id ? 'border-primary-600 bg-primary-50 ring-4 ring-primary-500/10' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                    >
                       <t.icon size={24} className={selectedTemplate === t.id ? 'text-primary-600 mx-auto' : 'text-slate-300 mx-auto'} />
                       <p className={`text-[10px] font-black uppercase ${selectedTemplate === t.id ? 'text-primary-700' : 'text-slate-500'}`}>{t.id}</p>
                    </button>
                  ))}
                  <div className="p-4 rounded-2xl border-2 border-slate-100 text-center flex items-center justify-center cursor-not-allowed bg-slate-50/50">
                     <p className="text-[8px] font-black uppercase text-slate-300">+80 more templates</p>
                  </div>
               </div>
            </div>

            {/* Sync Alert */}
            <div className="bg-primary-50 border border-primary-100 p-6 rounded-3xl flex gap-4">
               <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="text-primary-600" size={20} />
               </div>
               <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-900 leading-tight">Save your invoices securely on the cloud.</p>
                  <button className="text-[10px] font-black uppercase tracking-widest text-primary-600 hover:underline">Try it now &rarr;</button>
               </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 space-y-4">
               <button 
                 onClick={() => setIsShareModalOpen(true)}
                 className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-500/20 transition-all transform active:scale-95 text-xs uppercase tracking-widest"
               >
                  Save and Send
               </button>
               <button 
                 onClick={() => window.print()}
                 className="w-full bg-white border-2 border-slate-900 hover:bg-slate-950 hover:text-white text-slate-950 font-black py-4 rounded-2xl transition-all transform active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
               >
                  <Download size={18} /> Download/Print <ChevronDown size={14} />
               </button>
            </div>
          </div>

        </div>
      </div>

      {/* SHARE MODAL */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in no-print">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <Share2 className="text-primary-600" /> Share Bill
                 </h3>
                 <button onClick={() => setIsShareModalOpen(false)} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
              </div>
              <div className="space-y-6">
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                       <MessageSquare size={24} />
                    </div>
                    <div className="flex-1">
                       <p className="text-xs font-bold text-slate-400 uppercase">Share via WhatsApp</p>
                       <p className="text-sm font-black text-slate-900">{invoiceData.billTo.company || 'Enter Client Name'}</p>
                    </div>
                    <button className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"><ChevronRight size={20}/></button>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                       <Mail size={24} />
                    </div>
                    <div className="flex-1">
                       <p className="text-xs font-bold text-slate-400 uppercase">Send via Email</p>
                       <p className="text-sm font-black text-slate-900">Professional PDF Link</p>
                    </div>
                    <button className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"><ChevronRight size={20}/></button>
                 </div>
                 <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                    <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                       Sending will automatically save a PDF copy in your "Sent Invoices" dashboard for future tracking.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* PRINT STYLES */}
      <style>{`
        @media print {
          body * { visibility: hidden; background: white !important; -webkit-print-color-adjust: exact; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            margin: 0; 
            padding: 20px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print { display: none !important; }
          @page { size: auto; margin: 0; }
        }
      `}</style>

    </div>
  );
};

// --- SUB-COMPONENTS ---

const EditableInput = ({ value, onChange, placeholder, className }: { value: string, onChange: (v: string) => void, placeholder?: string, className?: string }) => (
  <input 
    type="text"
    placeholder={placeholder}
    className={`bg-transparent outline-none border-b border-transparent hover:border-slate-200 focus:border-primary-500 transition-colors placeholder:text-slate-300 placeholder:italic ${className}`}
    value={value}
    onChange={e => onChange(e.target.value)}
  />
);

const EditableArea = ({ value, onChange, placeholder, className }: { value: string, onChange: (v: string) => void, placeholder?: string, className?: string }) => (
  <textarea 
    rows={2}
    placeholder={placeholder}
    className={`bg-transparent outline-none border-b border-transparent hover:border-slate-200 focus:border-primary-500 transition-colors resize-none placeholder:text-slate-300 placeholder:italic no-scrollbar ${className}`}
    value={value}
    onChange={e => onChange(e.target.value)}
  />
);

export default Invoices;