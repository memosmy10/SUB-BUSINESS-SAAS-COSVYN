import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Server, 
  ShieldCheck, 
  Smartphone, 
  Building2, 
  Crown, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  RefreshCw,
  Terminal,
  Activity,
  Key,
  Users,
  Copy,
  Check
} from 'lucide-react';
import { api } from '../packages/api-client/src';
import { storage } from '../packages/utils/src/storage';

export const ArchitectureBanner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [apiHealth, setApiHealth] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Active token
  const activeToken = storage.getAccessToken();

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setApiHealth(data);
    } catch (err: any) {
      setApiHealth({ status: 'offline', error: err.message });
    } finally {
      setHealthLoading(false);
    }
  };

  const testDriverLogin = async () => {
    setTestLoading(true);
    try {
      const res = await api.driver.login({ phone: '7702667567', pin: '1234' });
      setTestResult({
        endpoint: 'POST /api/driver/login',
        status: 200,
        response: res,
      });
      if (res.tokens?.accessToken) {
        storage.setAccessToken(res.tokens.accessToken);
      }
    } catch (err: any) {
      setTestResult({
        endpoint: 'POST /api/driver/login',
        status: err.status || 500,
        error: err.message,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const testOwnerLogin = async () => {
    setTestLoading(true);
    try {
      const res = await api.auth.login({ email: 'owner@kitchen.com', password: 'password123' });
      setTestResult({
        endpoint: 'POST /api/auth/login',
        status: 200,
        response: res,
      });
      if (res.tokens?.accessToken) {
        storage.setAccessToken(res.tokens.accessToken);
      }
    } catch (err: any) {
      setTestResult({
        endpoint: 'POST /api/auth/login',
        status: err.status || 500,
        error: err.message,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const copyToken = () => {
    if (activeToken) {
      navigator.clipboard.writeText(activeToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Determine current active persona
  const currentPath = location.pathname;
  let currentPersona = 'Public';
  if (currentPath.startsWith('/admin')) currentPersona = 'Super Admin';
  else if (currentPath.startsWith('/driver')) currentPersona = 'Delivery Boy';
  else if (currentPath.startsWith('/manager')) currentPersona = 'Branch Manager';
  else if (currentPath.startsWith('/app')) currentPersona = 'Kitchen Owner';

  return (
    <div className="fixed bottom-3 right-3 z-[999] max-w-xl text-xs font-sans">
      {/* Collapsed Pill Button */}
      <div className="flex items-center gap-2 bg-slate-900/95 text-white border border-slate-700/80 rounded-full px-3.5 py-2 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Arch v2 REST API</span>
        </div>
        <span className="text-slate-500">|</span>
        <span className="text-slate-300">
          Persona: <strong className="text-white">{currentPersona}</strong>
        </span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="ml-1 p-1 hover:bg-slate-800 rounded-full text-slate-300 hover:text-white transition-colors"
          title="Toggle Architecture & Persona Panel"
        >
          {isOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>

      {/* Expanded Architecture Control Center */}
      {isOpen && (
        <div className="mt-2 bg-slate-950/95 text-slate-100 border border-slate-800 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-200 w-[92vw] max-w-lg max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                <Server size={16} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">ScaleKitchen Architecture Restructure</h4>
                <p className="text-[11px] text-slate-400">5 Personas • REST API • JWT Auth • Multi-Tenant Isolation</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-md bg-slate-800/60"
            >
              Close
            </button>
          </div>

          {/* 5 Persona Switcher */}
          <div className="mt-3">
            <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Switch User Persona (5 Bundles)</span>
              <span className="text-[10px] text-emerald-400">Live Routing Ready</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <button
                onClick={() => { navigate('/'); setIsOpen(false); }}
                className={`p-2 rounded-xl text-left border transition-all flex flex-col gap-0.5 ${
                  currentPersona === 'Public' 
                    ? 'bg-primary-950/60 border-primary-500 text-white' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1 font-bold text-[11px]">
                  <ExternalLink size={12} className="text-primary-400" /> Public Landing
                </div>
                <span className="text-[10px] text-slate-400">Marketing & Pricing</span>
              </button>

              <button
                onClick={() => { navigate('/app/dashboard'); setIsOpen(false); }}
                className={`p-2 rounded-xl text-left border transition-all flex flex-col gap-0.5 ${
                  currentPersona === 'Kitchen Owner' 
                    ? 'bg-primary-950/60 border-primary-500 text-white' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1 font-bold text-[11px]">
                  <Building2 size={12} className="text-amber-400" /> Kitchen Owner
                </div>
                <span className="text-[10px] text-slate-400">Dashboard & Ops</span>
              </button>

              <button
                onClick={() => { navigate('/manager'); setIsOpen(false); }}
                className={`p-2 rounded-xl text-left border transition-all flex flex-col gap-0.5 ${
                  currentPersona === 'Branch Manager' 
                    ? 'bg-primary-950/60 border-primary-500 text-white' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1 font-bold text-[11px]">
                  <Users size={12} className="text-blue-400" /> Branch Manager
                </div>
                <span className="text-[10px] text-slate-400">Scoped Hub Control</span>
              </button>

              <button
                onClick={() => { navigate('/driver'); setIsOpen(false); }}
                className={`p-2 rounded-xl text-left border transition-all flex flex-col gap-0.5 ${
                  currentPersona === 'Delivery Boy' 
                    ? 'bg-primary-950/60 border-primary-500 text-white' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1 font-bold text-[11px]">
                  <Smartphone size={12} className="text-emerald-400" /> Delivery Boy
                </div>
                <span className="text-[10px] text-slate-400">Phone + PIN Login</span>
              </button>

              <button
                onClick={() => { navigate('/admin'); setIsOpen(false); }}
                className={`p-2 rounded-xl text-left border transition-all flex flex-col gap-0.5 sm:col-span-2 ${
                  currentPersona === 'Super Admin' 
                    ? 'bg-primary-950/60 border-primary-500 text-white' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1 font-bold text-[11px]">
                  <Crown size={12} className="text-purple-400" /> Super Admin
                </div>
                <span className="text-[10px] text-slate-400">Multi-tenant management & audit</span>
              </button>
            </div>
          </div>

          {/* API Health & JWT Status */}
          <div className="mt-3 bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-400 font-semibold flex items-center gap-1">
                <Activity size={12} className="text-emerald-400" /> API Gateway Health
              </span>
              <button
                onClick={checkHealth}
                disabled={healthLoading}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw size={10} className={healthLoading ? 'animate-spin' : ''} /> Ping
              </button>
            </div>
            {apiHealth ? (
              <div className="font-mono text-[10px] text-slate-300 bg-black/40 p-2 rounded-lg border border-slate-800">
                <div className="text-emerald-400 font-bold">● {apiHealth.status?.toUpperCase() || 'ONLINE'} - {apiHealth.architecture}</div>
                <div className="text-slate-400 mt-0.5">Uptime: {Math.round(apiHealth.uptime || 0)}s • v{apiHealth.version || '2.0.0'}</div>
                <div className="text-slate-500 text-[9px] mt-0.5">Layers: {apiHealth.layers?.join(', ')}</div>
              </div>
            ) : (
              <div className="text-slate-400 text-[10px]">Pinging /api/health...</div>
            )}

            {/* Active JWT Access Token Info */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Key size={11} className="text-amber-400" /> Bearer Token:
              </span>
              {activeToken ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-mono truncate max-w-[140px]">{activeToken.substring(0, 16)}...</span>
                  <button onClick={copyToken} className="text-slate-300 hover:text-white p-0.5">
                    {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  </button>
                </div>
              ) : (
                <span className="text-slate-500 italic">None stored</span>
              )}
            </div>
          </div>

          {/* Live API Tester */}
          <div className="mt-3">
            <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
              <Terminal size={12} className="text-indigo-400" /> Test Restructured Endpoints Live
            </div>
            <div className="flex gap-2">
              <button
                onClick={testDriverLogin}
                disabled={testLoading}
                className="flex-1 py-1.5 px-2 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/50 rounded-lg text-emerald-200 text-[11px] font-semibold transition-colors"
              >
                Driver Login (PIN)
              </button>
              <button
                onClick={testOwnerLogin}
                disabled={testLoading}
                className="flex-1 py-1.5 px-2 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/50 rounded-lg text-indigo-200 text-[11px] font-semibold transition-colors"
              >
                Owner Login (JWT)
              </button>
            </div>

            {testResult && (
              <div className="mt-2 bg-black/50 border border-slate-800 p-2 rounded-lg font-mono text-[10px] text-slate-300 overflow-x-auto max-h-32">
                <div className="text-indigo-300 font-bold">{testResult.endpoint} (Status {testResult.status})</div>
                <pre className="text-[9px] text-slate-400 mt-1 whitespace-pre-wrap">
                  {JSON.stringify(testResult.response || testResult.error, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
