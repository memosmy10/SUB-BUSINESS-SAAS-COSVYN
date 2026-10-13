import React, { useState } from 'react';
import { 
  X, Copy, Check, MessageSquare, ExternalLink, 
  Truck, Shield, Phone, Sparkles, QrCode, Smartphone, Key, Lock 
} from 'lucide-react';
import { encodeDriverToken } from '../services/store';

interface ShareDriverLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  bizId: string;
  staff: any[];
  selectedBoy?: any;
}

export const ShareDriverLinkModal: React.FC<ShareDriverLinkModalProps> = ({
  isOpen,
  onClose,
  bizId,
  staff,
  selectedBoy
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const origin = window.location.origin;
  // Secure tokens prevent exposing raw database UIDs or phone numbers in URLs
  const generalToken = encodeDriverToken(bizId);
  const baseUrl = generalToken ? `${origin}/#/driver?auth=${generalToken}` : `${origin}/#/driver`;

  const getBoyUrl = (boy: any) => {
    const cleanMobile = (boy?.mobile || '').replace(/\D/g, '').slice(-10);
    const token = encodeDriverToken(bizId, boy?.id, cleanMobile);
    return token ? `${origin}/#/driver?auth=${token}` : `${origin}/#/driver`;
  };

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleWhatsApp = (boy: any) => {
    const boyUrl = getBoyUrl(boy);
    const pin = boy?.pin || '1234';
    const msg = `Hello ${boy.name}! 🚀\n\nHere is your secure ScaleKitchen Delivery App link for today's deliveries:\n${boyUrl}\n\n🔑 *Your 4-Digit Login PIN:* ${pin}\n\n📱 *Steps (Works on Safari, Chrome, iPhone & Android):*\n1. Open link on your phone browser\n2. Enter your 4-digit PIN: ${pin}\n3. Punch In to activate live GPS tracking and view today's meal stops!\n\nHave a safe delivery ride!`;
    const cleanDigits = (boy.mobile || '').replace(/\D/g, '');
    window.open(`https://wa.me/${cleanDigits}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-card bg-white/95 border border-white/80 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-glass-xl text-slate-800 space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-xs">
              <Smartphone size={22} />
            </div>
            <div>
              <h3 className="font-bold font-display text-lg text-slate-900 tracking-tight">
                Delivery Boy Portal Link
              </h3>
              <p className="text-xs text-slate-500">
                Share with riders to log in with their phone number & track routes
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

        {/* Selected Boy Highlight if opened for a specific driver */}
        {selectedBoy && (
          <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-xs space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-bold text-amber-950 text-sm">{selectedBoy.name}'s App Link</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-amber-800 font-semibold">{selectedBoy.mobile || 'No contact'}</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 border border-amber-400/80 font-mono text-[11px] font-bold">
                  PIN: {selectedBoy.pin || '1234'}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={getBoyUrl(selectedBoy)} 
                className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-mono text-slate-700 outline-none select-all shadow-xs"
              />
              <button
                onClick={() => handleCopy(getBoyUrl(selectedBoy), 'selected')}
                className="px-3 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
              >
                {copiedId === 'selected' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedId === 'selected' ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={() => handleWhatsApp(selectedBoy)}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
              >
                <MessageSquare size={14} fill="currentColor" />
                <span>WhatsApp</span>
              </button>
              <a
                href={getBoyUrl(selectedBoy)}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-white hover:bg-amber-100 border border-amber-200 text-slate-700 rounded-xl flex items-center justify-center transition-colors"
                title="Test Driver App in New Tab"
              >
                <ExternalLink size={15} />
              </a>
            </div>
          </div>
        )}

        {/* Feature Explainer */}
        <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl text-xs space-y-1.5 text-slate-700">
          <p className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
            <Sparkles size={14} className="text-amber-600" />
            Secure & Compatible Everywhere:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] pl-1 leading-relaxed">
            <li><strong>Works on any browser:</strong> Apple Safari (iPhone/iPad), Chrome, Samsung Internet, Firefox, Edge.</li>
            <li><strong>Zero URL Exposure:</strong> Internal database IDs and phone numbers are encrypted in the link and automatically removed from the address bar on load.</li>
            <li><strong>4-Digit Security PIN:</strong> Riders log in with their phone number + PIN. You can change this PIN in Settings anytime.</li>
          </ul>
        </div>

        {/* General Kitchen Link */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 block">General Driver Portal Link:</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              readOnly 
              value={baseUrl} 
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 outline-none select-all"
            />
            <button
              onClick={() => handleCopy(baseUrl, 'general')}
              className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              {copiedId === 'general' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedId === 'general' ? 'Copied' : 'Copy'}</span>
            </button>
            <a
              href={baseUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition-colors"
              title="Open Portal in New Tab"
            >
              <ExternalLink size={15} />
            </a>
          </div>
        </div>

        {/* Individual Delivery Partner Links */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Personalized Links for Your Riders:</span>
            <span className="text-[11px] text-slate-400 font-normal">Pre-fills rider & PIN</span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1 no-scrollbar">
            {staff.map(boy => {
              const boyUrl = getBoyUrl(boy);
              const isCopied = copiedId === boy.id;

              return (
                <div 
                  key={boy.id} 
                  className="p-3 bg-white border border-slate-200/80 rounded-xl shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 truncate">{boy.name}</span>
                      {boy.status === 'Online' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-400 font-mono">{boy.mobile || 'No mobile'}</span>
                      <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80">
                        PIN: {boy.pin || '1234'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopy(boyUrl, boy.id)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                      title="Copy Rider Link"
                    >
                      {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Link'}</span>
                    </button>
                    <button
                      onClick={() => handleWhatsApp(boy)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95"
                      title="Send WhatsApp Invitation"
                    >
                      <MessageSquare size={13} fill="currentColor" />
                      <span>WhatsApp</span>
                    </button>
                    <a
                      href={boyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center transition-colors"
                      title="Open Driver App"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              );
            })}

            {staff.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4 italic">
                No delivery partners added yet. Add staff members in Settings / Staff.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Protected with Business ID verification</span>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
