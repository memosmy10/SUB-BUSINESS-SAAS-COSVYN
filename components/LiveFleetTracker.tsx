import React, { useMemo } from 'react';
import { 
  Truck, Navigation, MapPin, Phone, MessageSquare, 
  ExternalLink, CheckCircle2, Clock, AlertTriangle, 
  Package, RotateCcw, Share2, Sparkles, Activity, ShieldCheck
} from 'lucide-react';
import { DeliveryBoyStaff, GlobalCustomer } from '../services/store';

interface LiveFleetTrackerProps {
  staff: DeliveryBoyStaff[];
  customers: GlobalCustomer[];
  deliveryLogs: any[];
  todayStr: string;
  onShareLink: (boy: any) => void;
}

export const LiveFleetTracker: React.FC<LiveFleetTrackerProps> = ({
  staff,
  customers,
  deliveryLogs,
  todayStr,
  onShareLink
}) => {
  // Compute real-time stats for each rider
  const riderMetrics = useMemo(() => {
    return staff.map(boy => {
      // Find stops assigned to this boy (by ID or name)
      const boyCustomers = customers.filter(c => 
        c.deliveryBoyId === boy.id || 
        c.deliveryBoyId === boy.name || 
        c.deliveryBoyName === boy.name
      );
      
      // Find today's logs by this boy
      const boyLogsToday = deliveryLogs.filter(l => 
        l.date === todayStr && (l.deliveryBoyId === boy.id || l.deliveryBoyName === boy.name)
      );

      const deliveredCount = boyLogsToday.filter(l => l.status === 'Delivered').length;
      const totalStops = boyCustomers.length;
      const completionRate = totalStops > 0 ? Math.round((deliveredCount / totalStops) * 100) : 0;

      // Reusable boxes recollection
      const boxesCollected = boyLogsToday.filter(l => 
        l.boxStatus === 'Collected' || l.boxStatus === 'Collected Clean'
      ).length;

      const boxIssues = boyLogsToday.filter(l => 
        l.boxStatus === 'Dirty / Unwashed' || 
        l.boxStatus === 'Damaged / Missing Parts' || 
        l.boxStatus === 'Not Returned'
      ).length;

      const isOnline = boy.status === 'Online' && boy.lastAttendanceDate === todayStr;

      // Location freshness
      let lastActiveText = 'No location reported';
      if (boy.lastLocationUpdate) {
        const diffMs = Date.now() - new Date(boy.lastLocationUpdate).getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) lastActiveText = 'Live just now';
        else if (mins < 60) lastActiveText = `${mins}m ago`;
        else lastActiveText = `${Math.floor(mins / 60)}h ago`;
      }

      return {
        ...boy,
        totalStops,
        deliveredCount,
        completionRate,
        boxesCollected,
        boxIssues,
        isOnline,
        lastActiveText,
        hasGps: typeof boy.currentLat === 'number' && typeof boy.currentLng === 'number'
      };
    });
  }, [staff, customers, deliveryLogs, todayStr]);

  // Today's live logs feed
  const recentFeed = useMemo(() => {
    return [...deliveryLogs]
      .filter(l => l.date === todayStr)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 8);
  }, [deliveryLogs, todayStr]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2.5">
            <Activity className="text-primary-600" size={24} />
            Live Rider Fleet & GPS Dispatch Tracker
          </h2>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Real-time geolocation coordinates, shift status, and delivery completions streaming from driver phones.
          </p>
        </div>
      </div>

      {/* Grid of Rider Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {riderMetrics.map(rider => (
          <div 
            key={rider.id}
            className="glass-card rounded-2xl border border-white/80 p-5 shadow-glass flex flex-col justify-between hover:shadow-glass-hover transition-all space-y-4"
          >
            {/* Top row: Name & Online Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-xs ${
                  rider.isOnline ? 'bg-emerald-600' : 'bg-slate-700'
                }`}>
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="font-bold font-display text-slate-900 text-base flex items-center gap-2">
                    {rider.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                    <Phone size={12} /> {rider.mobile || 'No contact'}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {rider.isOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Offline
                  </span>
                )}
              </div>
            </div>

            {/* Live GPS Card */}
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Navigation size={13} className={rider.isOnline ? 'text-emerald-600 animate-spin-slow' : 'text-slate-400'} />
                  GPS Status:
                </span>
                <span className="font-semibold text-slate-700">{rider.lastActiveText}</span>
              </div>

              {rider.hasGps ? (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="font-mono text-[11px] text-slate-500">
                    {rider.currentLat?.toFixed(4)}, {rider.currentLng?.toFixed(4)}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${rider.currentLat},${rider.currentLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    <MapPin size={12} />
                    <span>View on Map</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-200/60">
                  {rider.isOnline ? 'Acquiring GPS fix...' : 'Awaiting punch in from driver app'}
                </div>
              )}
            </div>

            {/* Delivery Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Today's Deliveries</span>
                <span className="font-bold text-slate-900">
                  {rider.deliveredCount} <span className="text-slate-400 font-normal">/ {rider.totalStops}</span>
                  <span className="ml-1.5 text-primary-600 font-semibold">({rider.completionRate}%)</span>
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-primary-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${rider.completionRate}%` }}
                />
              </div>
            </div>

            {/* Reusable Boxes Info */}
            <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Package size={13} className="text-amber-500" />
                Boxes Recollected:
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{rider.boxesCollected}</span>
                {rider.boxIssues > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">
                    {rider.boxIssues} Issues
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-2 border-t border-slate-100">
              <button
                onClick={() => onShareLink(rider)}
                className="flex-1 py-2 px-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <Share2 size={13} />
                <span>Share App Link</span>
              </button>
              <a
                href={`tel:${rider.mobile}`}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                title="Call Rider"
              >
                <Phone size={15} />
              </a>
            </div>

          </div>
        ))}

        {riderMetrics.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 glass-card rounded-2xl border border-white/80">
            <Truck size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="font-bold text-slate-700 text-sm">No Delivery Partners Found</h3>
            <p className="text-xs text-slate-400 mt-0.5">Add staff members in Settings to track routes.</p>
          </div>
        )}
      </div>

      {/* Real-time Delivery Activity Stream */}
      <div className="glass-card rounded-2xl border border-white/80 p-5 shadow-glass space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold font-display text-sm text-slate-900 flex items-center gap-2">
            <Clock size={16} className="text-primary-600" />
            Live Delivery & Box Stream (Today)
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Updates in real-time</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {recentFeed.map((log: any, idx: number) => {
            const timeStr = log.deliveredAt || log.boxCollectedAt || log.updatedAt;
            const formattedTime = timeStr ? new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';

            return (
              <div key={log.id || idx} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    log.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {log.status === 'Delivered' ? <CheckCircle2 size={15} /> : <Clock size={15} />}
                  </div>
                  <div className="truncate">
                    <p className="font-semibold text-slate-800 truncate">
                      {log.deliveryBoyName || 'Rider'} ➔ {log.customerName}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{log.mealTime}</span>
                      {log.boxStatus && log.boxStatus !== 'None' && (
                        <>
                          <span>•</span>
                          <span className={`font-semibold ${
                            log.boxStatus === 'Collected' || log.boxStatus === 'Collected Clean' 
                              ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            Box: {log.boxStatus}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {formattedTime}
                </span>
              </div>
            );
          })}

          {recentFeed.length === 0 && (
            <div className="py-6 text-center text-slate-400 italic">
              No delivery events logged yet today. Riders can mark stops as Delivered from their app.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
