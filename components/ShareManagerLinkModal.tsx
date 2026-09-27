import React, { useState } from 'react';
import { 
  X, Copy, Check, MessageSquare, ExternalLink, 
  UserCheck, Shield, Phone, Sparkles, Key, Mail, Building
} from 'lucide-react';
import { BranchManager } from '../services/store';

interface ShareManagerLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  bizId: string;
  managers: BranchManager[];
  selectedManager?: BranchManager;
  branches: any[];
}

export const ShareManagerLinkModal: React.FC<ShareManagerLinkModalProps> = ({
  isOpen,
  onClose,
  bizId,
  managers,
  selectedManager,
  branches
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const origin = window.location.origin;
  const baseUrl = `${origin}/#/manager?biz=${bizId}`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleWhatsApp = (manager: BranchManager) => {
    const branchName = branches.find(b => b.id === manager.branchId)?.name || 'All Branches';
    const msg = `Hello ${manager.name}! 👨‍🍳\n\nHere are your ScaleKitchen Manager Portal login credentials for ${branchName}:\n\n🔗 *Manager App Link:*\n${baseUrl}\n\n🔑 *Login Credentials:*\n• *Email:* ${manager.email}\n• *Password:* ${manager.password}\n\n📌 *Permissions Enabled:* ${manager.allowedPages?.length || 0} modules\n\nPlease log in to manage orders, inventory, and kitchen dispatch for your assigned branch.`;
    window.open(`https://wa.me/${(manager.mobile || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const activeManagerList = selectedManager ? [selectedManager] : managers;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-card bg-white/95 border border-white/80 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-glass-xl text-slate-800 space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-xs">
              <UserCheck size={22} />
            </div>
            <div>
              <h3 className="font-bold font-display text-lg text-slate-900 tracking-tight">
                Share Manager Web App Link
              </h3>
              <p className="text-xs text-slate-500">
                Share login link and owner-set credentials with your branch managers
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Feature Explainer */}
        <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/60 rounded-2xl text-xs space-y-1 text-slate-700">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900 text-xs">
            <Sparkles size={14} className="text-indigo-600" />
            <span>Role-Based Branch Access & Activity Tracking</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Managers log in with the fixed email & password you configured. They only see the specific modules you checked, and their login / logout timings are automatically tracked.
          </p>
        </div>

        {/* General Link Card */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 block">General Manager Web App Link:</label>
          <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs">
            <span className="font-mono text-slate-600 truncate flex-1 pl-2 select-all text-[11px]">
              {baseUrl}
            </span>
            <button
              onClick={() => handleCopy(baseUrl, 'general')}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shrink-0 flex items-center gap-1.5 text-xs font-semibold"
              title="Copy link"
            >
              {copiedId === 'general' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedId === 'general' ? 'Copied' : 'Copy'}</span>
            </button>
            <a
              href={baseUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shrink-0"
              title="Open Portal in new tab"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Manager-Specific Cards */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-semibold text-slate-700 block">
            {selectedManager ? 'Selected Manager Credentials & Dispatch:' : 'Manager Profiles & Credentials:'}
          </label>

          {activeManagerList.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-center text-xs text-slate-400">
              No managers configured yet. Click "Add Manager" to create your first manager.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {activeManagerList.map((mgr) => {
                const branchName = branches.find(b => b.id === mgr.branchId)?.name || 'All Branches';
                const credentialsText = `Manager Portal: ${baseUrl}\nEmail: ${mgr.email}\nPassword: ${mgr.password}`;

                return (
                  <div 
                    key={mgr.id} 
                    className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-indigo-300 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                          <span>{mgr.name}</span>
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-md">
                            {branchName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>📱 {mgr.mobile}</span>
                          <span>•</span>
                          <span>🔒 {mgr.allowedPages?.length || 0} Modules Allowed</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleCopy(credentialsText, `cred-${mgr.id}`)}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold flex items-center gap-1 transition-all"
                          title="Copy Email & Password"
                        >
                          {copiedId === `cred-${mgr.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          <span>{copiedId === `cred-${mgr.id}` ? 'Copied' : 'Credentials'}</span>
                        </button>

                        <button
                          onClick={() => handleWhatsApp(mgr)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-all active:scale-95"
                          title="Send login info on WhatsApp"
                        >
                          <MessageSquare size={12} />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    </div>

                    {/* Display email & password cleanly */}
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-600">
                      <div className="truncate mr-2">
                        <span className="text-slate-400">Email:</span> {mgr.email}
                      </div>
                      <div className="shrink-0">
                        <span className="text-slate-400">Pass:</span> <span className="font-bold text-slate-800">{mgr.password}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
