import React, { useState, useMemo } from 'react';
import { Send, Users, ShieldCheck, Clock, Trash2, Loader2, Search, Info, AlertTriangle, CheckCircle2, UserCheck, UserX, Check } from 'lucide-react';
import { useAdminTenants, useGlobalCollection, addGlobalItem } from '../../services/dbService';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

const AdminMessages = () => {
  const { currentUser } = useAuth();
  const { tenants, loading: tenantsLoading } = useAdminTenants();
  const { data: messages, loading: messagesLoading } = useGlobalCollection('admin_messages');

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetType: 'ALL' as 'ALL' | 'ACTIVE' | 'INACTIVE' | 'SPECIFIC',
    recipientIds: [] as string[],
    priority: 'info' as 'info' | 'warning' | 'urgent'
  });
  
  const [sending, setSending] = useState(false);
  const [searchTenant, setSearchTenant] = useState('');

  const targetedTenants = useMemo(() => {
    if (formData.targetType === 'ALL') return tenants;
    if (formData.targetType === 'ACTIVE') return tenants.filter(t => t.planStatus === 'Active');
    if (formData.targetType === 'INACTIVE') return tenants.filter(t => t.planStatus !== 'Active');
    if (formData.targetType === 'SPECIFIC') {
      return tenants.filter(t => formData.recipientIds.includes(t.id));
    }
    return [];
  }, [tenants, formData.targetType, formData.recipientIds]);

  const pickerTenants = useMemo(() => {
    return tenants.filter(t => 
      (t.businessName || '').toLowerCase().includes(searchTenant.toLowerCase()) ||
      (t.ownerName || '').toLowerCase().includes(searchTenant.toLowerCase())
    );
  }, [tenants, searchTenant]);

  const toggleRecipient = (id: string) => {
    setFormData(prev => ({
      ...prev,
      recipientIds: prev.recipientIds.includes(id) 
        ? prev.recipientIds.filter(rid => rid !== id) 
        : [...prev.recipientIds, id]
    }));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Initiating broadcast deployment for:", currentUser?.email);
    
    if (!formData.title.trim() || !formData.content.trim()) {
      alert("Please enter a title and message content.");
      return;
    }

    if (formData.targetType === 'SPECIFIC' && formData.recipientIds.length === 0) {
      alert("Please select at least one recipient business.");
      return;
    }

    setSending(true);
    try {
      // Clean structure for Firestore
      const messagePayload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        targetType: formData.targetType,
        recipientIds: formData.targetType === 'SPECIFIC' ? formData.recipientIds : [],
        priority: formData.priority,
        sentAt: new Date().toISOString(),
        createdBy: currentUser?.email || 'Admin'
      };

      // Add to global collection
      await addGlobalItem('admin_messages', messagePayload);
      
      console.log("Broadcast successfully stored in database.");
      
      setFormData({
        title: '',
        content: '',
        targetType: 'ALL',
        recipientIds: [],
        priority: 'info'
      });
      setSearchTenant('');
      alert("Broadcast deployed successfully!");
    } catch (err: any) {
      console.error("Critical Deployment Error Detail:", err);
      
      if (err.code === 'permission-denied') {
        alert(
          `Security Rejection: Permission Denied.\n\nLogged-in Email: ${currentUser?.email}\n\nACTION REQUIRED:\n1. Your email MUST BE 'cosvynsolutions@gmail.com'.\n2. If it is correct, you MUST LOG OUT and LOG IN again to refresh your session after the security rule update.`
        );
      } else {
        alert(`Deployment failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this broadcast from history?")) return;
    try {
      await deleteDoc(doc(db, 'admin_messages', id));
    } catch (err: any) {
      console.error("Delete error:", err);
      alert("Failed to delete log: " + err.message);
    }
  };

  if (tenantsLoading || messagesLoading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      
      <div className="xl:col-span-2 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-10">
             <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400">
                <Send size={28} />
             </div>
             <div>
                <h2 className="text-2xl font-black text-white tracking-tight">New Broadcast</h2>
                <p className="text-sm text-slate-500 font-medium">Communicate with your SaaS users.</p>
             </div>
          </div>

          <form onSubmit={handleSend} className="space-y-8">
             <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-1">Message Target</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                   {[
                      { id: 'ALL', label: 'All Users' },
                      { id: 'ACTIVE', label: 'Active' },
                      { id: 'INACTIVE', label: 'Inactive' },
                      { id: 'SPECIFIC', label: 'Single/Multi' }
                   ].map(opt => (
                      <button 
                        key={opt.id}
                        type="button"
                        onClick={() => setFormData({...formData, targetType: opt.id as any, recipientIds: []})}
                        className={`py-3 px-1 rounded-xl text-[10px] font-black uppercase transition-all ${
                          formData.targetType === opt.id 
                            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                         {opt.label}
                      </button>
                   ))}
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-1">Priority Level</label>
                      <div className="flex gap-6">
                         {['info', 'warning', 'urgent'].map(p => (
                            <label key={p} className="flex items-center gap-2.5 cursor-pointer group">
                               <input 
                                  type="radio" 
                                  name="priority" 
                                  className="hidden" 
                                  checked={formData.priority === p} 
                                  onChange={() => setFormData({...formData, priority: p as any})} 
                               />
                               <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                                  formData.priority === p 
                                    ? (p === 'info' ? 'bg-cyan-500 border-cyan-500' : p === 'warning' ? 'bg-amber-500 border-amber-500' : 'bg-red-500 border-red-500 scale-110 shadow-lg')
                                    : 'border-slate-700 bg-transparent'
                               }`}>
                                  {formData.priority === p && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                               </div>
                               <span className={`text-[11px] font-black uppercase tracking-widest ${formData.priority === p ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'}`}>{p}</span>
                            </label>
                         ))}
                      </div>
                   </div>

                   <div className="space-y-5">
                      <div>
                         <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Title</label>
                         <input 
                            required
                            placeholder="Enter subject..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-cyan-500 outline-none transition-all placeholder:text-slate-700"
                            value={formData.title}
                            onChange={e => setFormData({...formData, title: e.target.value})}
                         />
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Message Content</label>
                         <textarea 
                            required
                            rows={8}
                            placeholder="Write your message here..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-sm text-white focus:border-cyan-500 outline-none transition-all resize-none placeholder:text-slate-700 leading-relaxed"
                            value={formData.content}
                            onChange={e => setFormData({...formData, content: e.target.value})}
                         />
                      </div>
                   </div>
                </div>

                <div className="bg-slate-950/50 border border-slate-800 rounded-3xl overflow-hidden flex flex-col h-[480px]">
                   <div className="p-5 border-b border-slate-800 bg-slate-950/80">
                      <div className="flex justify-between items-center mb-4">
                         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            {formData.targetType === 'SPECIFIC' ? 'Select Recipients' : 'Recipient Preview'}
                         </h3>
                         <span className="bg-cyan-500/10 text-cyan-400 text-[10px] font-black px-2.5 py-1 rounded-full border border-cyan-500/20">
                            {targetedTenants.length} Users
                         </span>
                      </div>
                      <div className="relative">
                         <Search className="absolute left-3 top-2.5 text-slate-600" size={14} />
                         <input 
                           className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-[11px] text-slate-200 focus:border-cyan-500 outline-none placeholder:text-slate-600"
                           placeholder="Search users..."
                           value={searchTenant}
                           onChange={e => setSearchTenant(e.target.value)}
                         />
                      </div>
                   </div>

                   <div className="flex-1 overflow-y-auto p-2 no-scrollbar divide-y divide-slate-800/50">
                      {(formData.targetType === 'SPECIFIC' ? pickerTenants : targetedTenants).map(t => {
                         const isSelected = formData.recipientIds.includes(t.id);
                         const isFilteredOut = searchTenant && 
                           !(t.businessName || '').toLowerCase().includes(searchTenant.toLowerCase()) && 
                           !(t.ownerName || '').toLowerCase().includes(searchTenant.toLowerCase());
                         
                         if (isFilteredOut && formData.targetType !== 'SPECIFIC') return null;

                         return (
                            <div 
                               key={t.id} 
                               onClick={() => formData.targetType === 'SPECIFIC' && toggleRecipient(t.id)}
                               className={`p-3 flex items-center justify-between transition-colors ${
                                  formData.targetType === 'SPECIFIC' ? 'cursor-pointer hover:bg-slate-900/50' : ''
                               } ${isSelected && formData.targetType === 'SPECIFIC' ? 'bg-cyan-500/5' : ''}`}
                            >
                               <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${
                                     t.planStatus === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'
                                  }`}>
                                     {t.businessName?.charAt(0) || 'B'}
                                  </div>
                                  <div>
                                     <p className="text-[11px] font-bold text-slate-200">{t.businessName || 'Unnamed'}</p>
                                     <p className="text-[9px] text-slate-500 font-medium uppercase tracking-tighter">{t.ownerName}</p>
                                  </div>
                               </div>
                               {formData.targetType === 'SPECIFIC' ? (
                                  <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
                                     isSelected ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-slate-800'
                                  }`}>
                                     {isSelected && <Check size={12} strokeWidth={4} />}
                                  </div>
                               ) : (
                                  <div className="text-[9px] font-black uppercase text-slate-700">Recipient</div>
                               )}
                            </div>
                         );
                      })}
                      {pickerTenants.length === 0 && <p className="p-10 text-center text-[10px] text-slate-600 font-black uppercase italic">No users found</p>}
                   </div>
                </div>
             </div>

             <button 
                disabled={sending}
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-cyan-900/40 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-70 uppercase text-sm tracking-widest"
             >
                {sending ? <Loader2 className="animate-spin" /> : <><Send size={20} /> Deploy Broadcast</>}
             </button>
          </form>
        </div>
      </div>

      <div className="xl:col-span-1 space-y-6">
         <div className="flex justify-between items-end px-2 mb-4">
            <div>
               <h2 className="text-xl font-black text-white tracking-tight uppercase">History</h2>
               <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">Previous logs</p>
            </div>
            <div className="bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest">
               {messages.length} Logs
            </div>
         </div>

         <div className="space-y-4 max-h-[1000px] overflow-y-auto no-scrollbar pr-1">
            {messages.map((msg: any) => (
               <div key={msg.id} className="bg-slate-900/50 border border-slate-800/50 rounded-[2rem] p-6 hover:border-slate-700/50 transition-all group backdrop-blur-xs">
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl bg-opacity-10 ${
                           msg.priority === 'urgent' ? 'bg-red-500 text-red-500' : 
                           msg.priority === 'warning' ? 'bg-amber-500 text-amber-500' : 
                           'bg-cyan-500 text-cyan-500'
                        }`}>
                           {msg.priority === 'urgent' ? <AlertTriangle size={16} /> : msg.priority === 'warning' ? <Info size={16} /> : <CheckCircle2 size={16} />}
                        </div>
                        <div>
                           <h3 className="text-white font-bold text-sm leading-tight">{msg.title}</h3>
                           <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                 msg.targetType === 'ALL' ? 'bg-cyan-500/10 text-cyan-400' :
                                 msg.targetType === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' :
                                 msg.targetType === 'INACTIVE' ? 'bg-amber-500/10 text-amber-400' :
                                 'bg-violet-500/10 text-violet-400'
                              }`}>
                                 {msg.targetType}
                              </span>
                              <span className="flex items-center gap-1 text-[8px] font-bold text-slate-600 uppercase">
                                 <Clock size={10} /> {new Date(msg.sentAt).toLocaleDateString()}
                              </span>
                           </div>
                        </div>
                     </div>
                     <button 
                        onClick={() => handleDelete(msg.id)}
                        className="p-1.5 text-slate-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                     >
                        <Trash2 size={14} />
                     </button>
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed line-clamp-3">
                     {msg.content}
                  </p>
                  
                  {msg.targetType === 'SPECIFIC' && (
                     <div className="mt-3 pt-3 border-t border-slate-800/20 flex items-center gap-2">
                        <Users size={10} className="text-slate-700" />
                        <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">
                           {msg.recipientIds?.length || 0} Targets
                        </span>
                     </div>
                  )}
               </div>
            ))}

            {messages.length === 0 && (
               <div className="py-20 text-center text-slate-600 flex flex-col items-center bg-slate-900/20 rounded-[2.5rem] border border-dashed border-slate-800">
                  <ShieldCheck size={40} className="mb-4 opacity-10" />
                  <p className="font-black uppercase tracking-[0.2em] text-[10px]">No logs</p>
               </div>
            )}
         </div>
      </div>

    </div>
  );
};

export default AdminMessages;