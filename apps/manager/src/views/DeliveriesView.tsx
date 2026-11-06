import React, { useState } from 'react';
import {
  Truck, CheckCircle, Clock, AlertTriangle, PackageCheck,
  MapPin, Phone, User, RefreshCw
} from 'lucide-react';
import { useManagerAuth } from '../contexts/ManagerAuthContext';
import { useStreamCollection } from '../services/dbService';
import { Customer, getTodayStr } from '../services/managerStore';

export const DeliveriesView: React.FC = () => {
  const { branchId } = useManagerAuth();
  const todayStr = getTodayStr();

  const { data: staff } = useStreamCollection<any>('staff');
  const { data: customers } = useStreamCollection<Customer>('customers');
  const { data: deliveryLogs } = useStreamCollection<any>('delivery_logs');
  const { data: driverManifests } = useStreamCollection<any>('driver_manifest');

  const drivers = staff.filter(s => s.role === 'driver' || s.role === 'delivery');
  const todayLogs = deliveryLogs.filter(l => l.date === todayStr);

  const deliveredCount = todayLogs.filter(l => l.status === 'Delivered').length;
  const inTransitCount = todayLogs.filter(l => l.status === 'In-Transit' || l.status === 'Picked-Up').length;
  const pendingCount = Math.max(0, customers.length - deliveredCount - inTransitCount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="text-indigo-600" size={24} />
            <h1 className="text-xl font-bold text-slate-900">Fleet Deliveries & Route Dispatch</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time delivery status for Branch: <strong className="text-slate-800">{branchId}</strong>
          </p>
        </div>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-card bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Scheduled Today</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{customers.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Total active drops</p>
        </div>

        <div className="glass-card bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-xs font-bold text-emerald-900">Delivered</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">{deliveredCount}</div>
          <p className="text-[11px] text-emerald-700 mt-1">Successfully dropped</p>
        </div>

        <div className="glass-card bg-amber-50/70 p-5 rounded-2xl border border-amber-200 shadow-xs">
          <span className="text-xs font-bold text-amber-900">On The Road</span>
          <div className="text-2xl font-black text-amber-900 mt-1">{inTransitCount}</div>
          <p className="text-[11px] text-amber-700 mt-1">Out for delivery</p>
        </div>

        <div className="glass-card bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Pending Dispatch</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{pendingCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting rider pickup</p>
        </div>
      </div>

      {/* Assigned Drivers Fleet */}
      <div className="glass-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Branch Delivery Drivers ({drivers.length})</h3>
          <span className="text-xs text-slate-400 font-medium">Port 3002 Partner App</span>
        </div>

        {drivers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No delivery boys assigned to this branch. Add delivery riders from Owner Settings.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {drivers.map(driver => (
              <div key={driver.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center">
                    {driver.name?.charAt(0) || 'D'}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{driver.name}</h4>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <Phone size={11} />
                      <span>{driver.mobile}</span>
                      <span>•</span>
                      <span>Vehicle: {driver.vehicleNumber || 'Bike'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Online / Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
