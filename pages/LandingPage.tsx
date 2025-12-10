
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Menu, X, ArrowRight, Zap, TrendingUp, Package, CreditCard, 
  MapPin, BarChart3, Star, Check, Layout, Users, LogIn, 
  Settings, UserPlus, Activity, PieChart
} from 'lucide-react';
import { useGlobalPricing } from '../services/dbService';
import { calculateEffectivePrice } from '../services/saasStore';

const LandingPage = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { plans, offer, loading } = useGlobalPricing();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  const isOfferActive = offer.isActive && new Date() < new Date(offer.endsAt);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-primary-200 selection:text-primary-900 overflow-x-hidden">
      
      {/* 1. TOP STRIP */}
      {isOfferActive ? (
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold py-2.5 text-center tracking-wide uppercase relative z-50 animate-pulse">
           {offer.title} - Get {offer.discountPercent}% OFF Limited Time!
        </div>
      ) : (
        <div className="bg-slate-900 text-white text-xs font-bold py-2.5 text-center tracking-widest uppercase relative z-50">
          <span className="bg-gradient-to-r from-primary-400 to-violet-400 text-transparent bg-clip-text">
            SaaS by Cosvyn
          </span>
        </div>
      )}

      {/* 2. HEADER / NAVIGATION */}
      <header className="sticky top-0 w-full bg-white/80 backdrop-blur-xl border-b border-slate-100 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => window.scrollTo(0, 0)}>
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/30 group-hover:scale-105 transition-transform duration-300">
                <Zap size={22} fill="currentColor" />
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-slate-900">COSVYN</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {['Features', 'How It Works', 'Pricing', 'Testimonials'].map((item) => (
                <button 
                  key={item}
                  onClick={() => scrollToSection(item.toLowerCase().replace(/\s+/g, '-'))} 
                  className="text-sm font-bold text-slate-600 hover:text-primary-600 transition-colors"
                >
                  {item}
                </button>
              ))}
              <div className="h-6 w-px bg-slate-200 mx-2" />
              <Link to="/login" className="text-sm font-bold text-slate-700 hover:text-primary-600 transition-colors">Log In</Link>
              <Link 
                to="/signup" 
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Start Free Demo
              </Link>
            </nav>

            {/* Mobile Menu Toggle */}
            <button className="md:hidden text-slate-900 p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 p-4 absolute w-full shadow-2xl animate-in slide-in-from-top-5">
            <div className="flex flex-col space-y-4">
              {['Features', 'How It Works', 'Pricing', 'Testimonials'].map((item) => (
                <button key={item} onClick={() => scrollToSection(item.toLowerCase().replace(/\s+/g, '-'))} className="text-left font-bold text-slate-700 py-2 border-b border-slate-50">
                  {item}
                </button>
              ))}
              <Link to="/login" className="text-left font-bold text-slate-900 py-2 flex items-center gap-2"><LogIn size={18}/> Log In</Link>
              <Link to="/signup" className="bg-gradient-to-r from-primary-600 to-violet-600 text-white py-3 rounded-xl font-bold text-center shadow-lg">Start Free Demo</Link>
            </div>
          </div>
        )}
      </header>

      {/* 3. HERO SECTION */}
      <section className="relative pt-20 pb-32 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50 via-white to-white">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-to-b from-primary-100/40 via-violet-100/20 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Hero Text */}
            <div className="text-center lg:text-left max-w-2xl mx-auto lg:mx-0 animate-in slide-in-from-bottom-10 duration-700 fade-in relative z-20">
              <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 mb-8 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Now live in 30+ cities</span>
              </div>
              
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-[1.1]">
                We handle the pain and pressure. <br className="hidden lg:block"/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-violet-600">You enjoy the profits and peace.</span>
              </h1>
              
              <p className="text-lg md:text-xl text-slate-500 mb-10 leading-relaxed font-medium">
                COSVYN is a SaaS platform for subscription meal businesses that centralizes customer management, deliveries, payments, expenses, and analytics into one dashboard.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link 
                  to="/signup" 
                  className="group relative inline-flex justify-center items-center gap-2 bg-gradient-to-r from-primary-600 to-violet-600 text-white text-lg px-8 py-4 rounded-full font-bold transition-all transform hover:scale-[1.02] shadow-xl hover:shadow-primary-500/40"
                >
                  <span>Start Free Demo</span>
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <button 
                  onClick={() => scrollToSection('features')}
                  className="inline-flex justify-center items-center text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 text-lg px-8 py-4 font-bold rounded-full transition-all shadow-sm hover:shadow-md"
                >
                  View Live Demo Dashboard
                </button>
              </div>
            </div>

            {/* Hero Visual - Dashboard Mockup */}
            <div className="relative animate-in zoom-in-95 duration-1000 delay-200 fade-in mt-12 lg:mt-0">
              {/* Blue Lighting Effect */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-500/20 rounded-full blur-[80px] -z-10" />
              
              <div className="relative z-10 bg-white/60 backdrop-blur-md border border-white/50 rounded-3xl shadow-2xl p-6 ring-1 ring-slate-900/5 rotate-1 hover:rotate-0 transition-transform duration-500">
                
                {/* Mock Header */}
                <div className="flex items-center justify-between mb-6 border-b border-slate-200/50 pb-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                    <div className="w-3 h-3 rounded-full bg-green-400/80" />
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">dashboard.cosvyn.com</div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-2 gap-4">
                   {/* Card 1 */}
                   <div className="col-span-2 bg-white/80 rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
                      <div className="flex justify-between items-start">
                         <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Total Revenue</p>
                            <h3 className="text-3xl font-bold text-slate-900 mt-1">₹12,45,592</h3>
                         </div>
                         <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <TrendingUp size={20} />
                         </div>
                      </div>
                      <div className="mt-4 h-16 flex items-end gap-1">
                         {[40, 65, 45, 70, 55, 85, 60, 90, 75, 95].map((h, i) => (
                           <div key={i} className="flex-1 bg-gradient-to-t from-primary-500 to-violet-500 rounded-t-sm opacity-80" style={{ height: `${h}%` }} />
                         ))}
                      </div>
                   </div>

                   {/* Card 2 */}
                   <div className="bg-white/80 rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                         <Package size={18} /> <span className="text-xs font-bold uppercase">Boxes To Pack</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-900">1,248</div>
                      <div className="text-[10px] text-green-600 font-bold bg-green-50 self-start px-2 py-0.5 rounded-full mt-2">On Track</div>
                   </div>

                   {/* Card 3 */}
                   <div className="bg-white/80 rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                         <CreditCard size={18} /> <span className="text-xs font-bold uppercase">Pending</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-900">₹34k</div>
                      <div className="text-[10px] text-red-500 font-bold bg-red-50 self-start px-2 py-0.5 rounded-full mt-2">Action Req.</div>
                   </div>
                </div>

                {/* Floating Elements */}
                <div className="absolute -right-6 top-1/4 bg-white p-4 rounded-xl shadow-xl border border-slate-100 animate-float hidden sm:block">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                         <MapPin size={20} className="text-primary-600" />
                      </div>
                      <div>
                         <p className="text-xs text-slate-400 font-bold">Driver Arrived</p>
                         <p className="text-sm font-bold text-slate-900">Sector 42, Gurgaon</p>
                      </div>
                   </div>
                </div>

              </div>
              
              {/* Background Blobs */}
              <div className="absolute top-10 -right-10 w-64 h-64 bg-violet-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
              <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000" />
            </div>

          </div>
        </div>
      </section>

      {/* 4. TRUSTED BY STRIP */}
      <section className="py-10 bg-white border-y border-slate-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 mb-6">
           <p className="text-center text-slate-400 text-xs font-bold tracking-[0.2em] uppercase">Trusted by fast-growing meal subscription brands</p>
        </div>
        <div className="relative flex overflow-x-hidden group">
          <div className="animate-scroll whitespace-nowrap flex gap-16 px-8 items-center">
            {/* Doubled list for infinite scroll */}
            {[...Array(4)].map((_, i) => (
              <React.Fragment key={i}>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter">FitFuel Meals</span>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter">DailyBite Box</span>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter">HealthyTiffin Co.</span>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter">MuscleBox</span>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter">NutriGrams</span>
                <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter">UrbanMealCo</span>
              </React.Fragment>
            ))}
          </div>
          <div className="absolute top-0 left-0 h-full w-32 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-white to-transparent z-10" />
        </div>
      </section>

      {/* 5. IMPACT METRICS */}
      <section className="py-24 bg-slate-50 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Real results you can measure</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Revenue Growth", value: "+18–25%", desc: "with better planning", icon: TrendingUp, color: "text-green-600" },
              { label: "Wastage Reduced", value: "10s of Boxes", desc: "saved daily from overpacking", icon: Package, color: "text-blue-600" },
              { label: "Profit Margins", value: "Higher", desc: "from reduced wastage", icon: PieChart, color: "text-violet-600" },
              { label: "Satisfaction", value: "Increased", desc: "On-time deliveries ↑", icon: Star, color: "text-yellow-500" }
            ].map((metric, idx) => (
              <div key={idx} className="bg-white/70 backdrop-blur-sm p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                <div className={`w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-6 ${metric.color} group-hover:scale-110 transition-transform`}>
                  <metric.icon size={24} />
                </div>
                <h3 className="text-4xl font-extrabold text-slate-900 mb-2">{metric.value}</h3>
                <p className="font-bold text-slate-700">{metric.label}</p>
                <p className="text-sm text-slate-500 mt-1">{metric.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FEATURES SECTION */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <span className="text-primary-600 font-bold tracking-wide uppercase text-xs mb-3 block">Powerful Features</span>
            <h2 className="text-4xl font-bold text-slate-900">Everything your subscription meal business needs in one place</h2>
            <p className="text-slate-500 mt-4 max-w-2xl mx-auto text-lg">Replace spreadsheets and manual chaos with one intelligent operating system.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { 
                title: "Smart Customer Lifecycle Management", 
                desc: "Manage signups, renewals, pauses, and expiries automatically.", 
                icon: Users 
              },
              { 
                title: "Autonomous Delivery Route Planning", 
                desc: "Assign delivery boys, optimize routes, and share via WhatsApp.", 
                icon: MapPin 
              },
              { 
                title: "Predictive Financial Intelligence", 
                desc: "Track revenue, expenses, profit, and pending payments.", 
                icon: BarChart3 
              },
              { 
                title: "Branch & Plan Performance Analytics", 
                desc: "Compare branches, plans, and monthly performance.", 
                icon: Layout 
              },
              { 
                title: "Payments & Expense Tracking", 
                desc: "See what’s paid, what’s pending, and where money is going.", 
                icon: CreditCard 
              },
              { 
                title: "One Dashboard For Your Entire Business", 
                desc: "Skip spreadsheets and manual calculations.", 
                icon: Activity 
              }
            ].map((feature, idx) => (
              <div 
                key={idx} 
                onClick={() => scrollToSection('pricing')}
                className="group p-8 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-primary-600 mb-6 group-hover:bg-primary-600 group-hover:text-white transition-colors border border-slate-100">
                  <feature.icon size={28} />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h4>
                <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. HOW IT WORKS */}
      <section id="how-it-works" className="py-24 bg-slate-50 overflow-hidden relative">
        {/* Background Lighting Blobs */}
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-20 left-0 w-[500px] h-[500px] bg-violet-400/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <span className="text-violet-600 font-bold tracking-wide uppercase text-xs mb-3 block">Simple Setup</span>
            <h2 className="text-4xl font-bold text-slate-900">How It Works</h2>
          </div>

          <div className="relative">
             {/* Connector Line */}
             <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-1/2 -z-10" />

             <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
               {[
                 { 
                   title: "Set up branches & plans", 
                   icon: Settings, 
                   color: "text-blue-600", 
                   bg: "bg-blue-50",
                   borderHover: "group-hover:border-blue-500",
                   bgHover: "group-hover:bg-blue-600"
                 },
                 { 
                   title: "Add customers & routes", 
                   icon: UserPlus, 
                   color: "text-violet-600", 
                   bg: "bg-violet-50",
                   borderHover: "group-hover:border-violet-500",
                   bgHover: "group-hover:bg-violet-600"
                 },
                 { 
                   title: "Track payments & profit", 
                   icon: Zap, 
                   color: "text-emerald-600", 
                   bg: "bg-emerald-50",
                   borderHover: "group-hover:border-emerald-500",
                   bgHover: "group-hover:bg-emerald-600"
                 },
                 { 
                   title: "Use analytics to grow", 
                   icon: TrendingUp, 
                   color: "text-orange-600", 
                   bg: "bg-orange-50",
                   borderHover: "group-hover:border-orange-500",
                   bgHover: "group-hover:bg-orange-600"
                 },
               ].map((item, i) => (
                 <div key={i} className={`bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center relative group hover:-translate-y-2 transition-transform hover:shadow-lg ${item.borderHover}`}>
                    <div className={`w-16 h-16 mx-auto ${item.bg} rounded-full flex items-center justify-center mb-6 ${item.color} font-bold text-xl border-4 border-white shadow-lg ${item.bgHover} group-hover:text-white transition-colors`}>
                       <item.icon size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </section>

      {/* 8. TESTIMONIALS */}
      <section id="testimonials" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">What our partners say</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { brand: "FitFuel Meals", quote: "Revenue increased by 22% in just 60 days. Absolute game changer.", author: "Founder, FitFuel Meals" },
              { brand: "NutriGrams", quote: "We stopped losing money on overpacking. COSVYN saves us every day.", author: "Ops Lead, NutriGrams" },
              { brand: "HealthyTiffin Co.", quote: "Finally a system that understands how subscription meal businesses actually work.", author: "Owner, HealthyTiffin Co." }
            ].map((t, idx) => (
              <div key={idx} className="bg-slate-50 p-8 rounded-3xl hover:bg-white hover:shadow-xl border border-transparent hover:border-slate-100 transition-all duration-300">
                <div className="flex items-center gap-1 mb-6 text-yellow-400">
                  {[...Array(5)].map((_, i) => <Star key={i} size={18} fill="currentColor" />)}
                </div>
                <p className="text-lg leading-relaxed mb-6 text-slate-700 italic">"{t.quote}"</p>
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                      {t.brand.charAt(0)}
                   </div>
                   <div>
                      <div className="font-bold text-slate-900">{t.brand}</div>
                      <div className="text-xs text-slate-500 font-bold uppercase">{t.author}</div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. PRICING SECTION (DYNAMIC) */}
      <section id="pricing" className="py-24 bg-slate-900 text-white relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-30 pointer-events-none">
          <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] bg-primary-600 rounded-full blur-[120px]" />
          <div className="absolute -bottom-[200px] -left-[200px] w-[600px] h-[600px] bg-violet-600 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-primary-400 font-bold tracking-wide uppercase text-xs mb-3">Simple Pricing</h2>
            <h3 className="text-4xl font-bold mb-4">One powerful plan. Three simple choices.</h3>
            <p className="text-slate-400 text-lg">All features included in every plan.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
            
            {/* Render dynamic plans */}
            {plans.map(plan => {
               const effectivePrice = calculateEffectivePrice(plan.price, offer);
               const isDiscounted = effectivePrice < plan.price;
               const monthlyRate = Math.round(effectivePrice / plan.durationMonths);

               return (
                 <div 
                   key={plan.id}
                   className={`
                     backdrop-blur-md border rounded-3xl p-8 transition-colors relative group
                     ${plan.isBestValue 
                        ? 'bg-slate-800/50 border-primary-500 shadow-2xl transform md:scale-110 z-10 bg-gradient-to-b from-slate-800 to-slate-900' 
                        : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                     }
                   `}
                 >
                    {plan.isBestValue && (
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-primary-500 to-violet-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg tracking-wide uppercase">
                          Most Popular
                       </div>
                    )}
                    {!plan.isBestValue && plan.durationMonths === 1 && (
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1 rounded-full border border-slate-600">
                          Best to get started
                       </div>
                    )}

                    <h4 className={`text-xl font-bold mb-2 ${plan.isBestValue ? 'text-white' : 'text-slate-200'}`}>{plan.label}</h4>
                    
                    <div className="mb-2">
                       {isDiscounted && <span className="block text-sm text-slate-400 line-through mb-1">₹{plan.price.toLocaleString()}</span>}
                       <span className="text-4xl lg:text-5xl font-extrabold text-white">₹{effectivePrice.toLocaleString()}</span>
                       <span className="text-slate-500 text-sm"> total</span>
                    </div>

                    {plan.durationMonths > 1 && (
                        <div className={`text-xs font-bold mb-6 inline-block px-2 py-1 rounded ${plan.isBestValue ? 'text-green-400 bg-green-500/10' : 'text-slate-400'}`}>
                           Effective ~₹{monthlyRate} / month
                        </div>
                    )}
                    {plan.durationMonths === 1 && <div className="h-6 mb-6"></div>}

                    <p className="text-slate-400 text-sm mb-8 min-h-[40px]">{plan.description}</p>
                    
                    <Link 
                      to="/signup" 
                      className={`block w-full font-bold py-3.5 rounded-xl text-center transition-all ${
                         plan.isBestValue 
                           ? 'bg-gradient-to-r from-primary-600 to-violet-600 hover:shadow-lg hover:shadow-primary-500/25 text-white' 
                           : 'bg-slate-700 hover:bg-slate-600 text-white'
                      }`}
                    >
                       Choose {plan.label}
                    </Link>
                 </div>
               );
            })}

          </div>
          
          <div className="max-w-3xl mx-auto mt-12 text-center">
             <h4 className="text-slate-400 font-bold uppercase text-xs mb-4">Included in COSVYN ONE</h4>
             <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-slate-300">
                <span className="flex items-center gap-2"><Check size={14} className="text-primary-400"/> Customer Management</span>
                <span className="flex items-center gap-2"><Check size={14} className="text-primary-400"/> Smart Delivery Routes</span>
                <span className="flex items-center gap-2"><Check size={14} className="text-primary-400"/> WhatsApp Sharing</span>
                <span className="flex items-center gap-2"><Check size={14} className="text-primary-400"/> Payments & Expenses</span>
                <span className="flex items-center gap-2"><Check size={14} className="text-primary-400"/> Analytics</span>
                <span className="flex items-center gap-2"><Check size={14} className="text-primary-400"/> Support</span>
             </div>
          </div>
        </div>
      </section>

      {/* 10. FINAL CTA */}
      <section className="py-24 relative overflow-hidden bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-12 shadow-2xl relative overflow-hidden">
             
             <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
             <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500 rounded-full blur-[80px] opacity-40 pointer-events-none" />
             <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-violet-500 rounded-full blur-[80px] opacity-40 pointer-events-none" />

             <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 relative z-10">
               Ready to run your subscription meal business on autopilot?
             </h2>
             <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto relative z-10">
               Join the fastest growing meal prep brands using COSVYN to save time and boost profits.
             </p>
             
             <div className="flex flex-col sm:flex-row gap-4 justify-center items-center relative z-10">
               <Link 
                 to="/signup" 
                 className="bg-white text-slate-900 text-lg px-10 py-4 rounded-full font-bold transition-all transform hover:scale-105 shadow-xl hover:shadow-white/20"
               >
                 Start Free Demo
               </Link>
               <button 
                 onClick={() => scrollToSection('analytics')} // Conceptually view demo
                 className="text-white border border-white/20 hover:bg-white/10 text-lg px-8 py-4 rounded-full font-bold transition-colors"
               >
                 View Admin Analytics Demo
               </button>
             </div>
          </div>
        </div>
      </section>

      {/* 11. FOOTER */}
      <footer className="bg-slate-50 text-slate-500 py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center text-white font-bold">
                <Zap size={18} fill="currentColor" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">COSVYN</span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-8 text-sm font-bold text-slate-600">
              <a href="#" className="hover:text-primary-600 transition-colors">About</a>
              <a href="#" className="hover:text-primary-600 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-primary-600 transition-colors">Terms</a>
              <a href="#" className="hover:text-primary-600 transition-colors">Contact</a>
            </div>
          </div>
          
          <div className="mt-12 text-center text-xs font-medium text-slate-400">
            <p>
              © 2025 COSVYN. All rights reserved. SaaS for Subscription Meal{' '}
              <Link to="/admin/login" className="hover:text-slate-600 transition-colors cursor-pointer">
                Businesses
              </Link>
              .
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
