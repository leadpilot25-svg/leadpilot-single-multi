import { Home, Calendar, Users, Settings, Plus, Search, Bell, LogOut, Sliders, Clock, TrendingUp, Building2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { useState } from "react";
import AddLeadModal from "./AddLeadModal";
import { useFirebase } from "../contexts/FirebaseProvider";
import { auth } from "../lib/firebase";
import PaperPlaneLogo from "./PaperPlaneLogo";
import { APP_MODE } from "../config";

const formatName = (name: string) => {
  if (!name) return "";
  return name.replace(/\bLead\s+Pilot\b/gi, "LeadPilot");
};

export function Header() {
  const { user } = useFirebase();
  const location = useLocation();

  // Map route paths to premium page titles
  const getPageTitle = (pathname: string) => {
    if (pathname === "/") return "Today's Action Queue";
    if (pathname.startsWith("/leads")) {
      if (pathname === "/leads/new") return "Add New Lead";
      if (pathname.includes("/leads/")) return "Lead Inspection";
      return "Leads Directory";
    }
    if (pathname === "/today") return "Task Manager";
    if (pathname === "/funnel") return "Pipeline Funnel";
    if (pathname === "/profile") return "User Profile";
    if (pathname === "/admin") return "Admin Center";
    return "LeadPilot Dashboard";
  };

  return (
    <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-white border-b border-neutral-100 z-40 px-4 md:px-8 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-all duration-200">
      {/* Left side: branding alongside page title with NO logo */}
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-1 select-none">
          <span className="text-sm font-black text-[#111827] tracking-tight font-sans">LeadPilot</span>
        </div>

        {/* Vertical divider */}
        <div className="w-px h-4 bg-neutral-200/80" />

        <h2 className="text-xs md:text-sm font-black text-neutral-800 tracking-tight uppercase font-sans">
          {getPageTitle(location.pathname)}
        </h2>
      </div>

      {/* Right side: search, and utilities */}
      <div className="flex items-center gap-3.5">
        {/* Search button with sleek hover action */}
        <Link 
          to="/leads"
          className="p-2 text-neutral-400 hover:text-[#10B981] hover:bg-neutral-50 rounded-xl transition-all duration-200 active:scale-95"
          title="Search Leads"
        >
          <Search size={18} />
        </Link>
        
        {/* Divider */}
        <div className="w-px h-5 bg-neutral-200/60 hidden md:block" />

        {/* User profile avatar info */}
        <Link 
          to="/profile" 
          className="flex items-center gap-2 group p-0.5 pr-2 rounded-full hover:bg-neutral-50 transition-all duration-200"
        >
          <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden border border-neutral-200 shadow-sm transition-transform duration-200 group-hover:scale-105 group-hover:shadow">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={formatName(user.displayName || "User")} className="object-cover w-full h-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-[10px] font-bold text-neutral-500">
                {(user?.displayName?.[0] || user?.email?.[0] || "?").toUpperCase()}
              </span>
            )}
          </div>
          {user && (
            <span className="hidden md:block text-xs font-bold text-neutral-600 max-w-[120px] truncate group-hover:text-[#10B981] transition-colors font-sans">
              {formatName(user.displayName || user.email?.split("@")[0] || "")}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

export function BottomNav() {
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { role, plan } = useFirebase();

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/leads", icon: Users, label: "Leads" },
    { path: "/today", icon: Clock, label: "Tasks" },
    { path: "/profile", icon: Settings, label: "Settings" }
  ];

  if ((role === "admin" || role === "client" || role === "super_admin") && plan === "multi") {
    navItems.push({ path: "/admin", icon: Settings, label: "Admin Center" });
  }

  return (
    <>
      <nav className="lg:hidden fixed bottom-6 left-4 right-4 bg-white/95 backdrop-blur-xl border border-neutral-100 px-6 py-4.5 z-50 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
        <div className="flex justify-between items-center relative">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative flex flex-col items-center group flex-1"
              >
                <Icon
                  size={20}
                  className={isActive ? "text-[#10B981] font-bold" : "text-neutral-300 group-hover:text-emerald-400 transition-colors"}
                />
                <span className={`text-[10px] font-black uppercase tracking-tight mt-1 transition-all ${isActive ? "text-[#10B981] scale-105" : "text-neutral-400"}`}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    className="absolute -bottom-2 w-1.5 h-1.5 bg-[#10B981] rounded-full"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      <AddLeadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

export function DesktopSidebar() {
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { role, user, plan } = useFirebase();

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/leads", icon: Users, label: "Leads List" },
    { path: "/today", icon: Clock, label: "Daily Tasks" },
    { path: "/funnel", icon: Sliders, label: "Pipeline Funnel" },
    { path: "/profile", icon: Settings, label: "Settings & Form" }
  ];

  if ((role === "admin" || role === "client" || role === "super_admin") && plan === "multi") {
    navItems.push({ path: "/admin", icon: Users, label: "Admin Center" });
  }

  return (
    <>
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-72 bg-white border-r border-neutral-100/80 z-50 p-8">
        {/* Deleted logo from left side as requested */}
        <div className="mb-6" />

        {user && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-emerald-100/80 flex items-center justify-center gap-2.5 transition-all mb-8 active:scale-[0.98] text-sm tracking-wide transform hover:-translate-y-0.5 duration-200"
          >
            <Plus size={18} strokeWidth={3} />
            ADD NEW LEAD
          </button>
        )}

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm group ${
                  isActive 
                    ? "bg-emerald-50/70 text-[#10B981] shadow-sm shadow-emerald-50/20" 
                    : "text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700"
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span className="tracking-tight">{item.label}</span>
                {isActive && (
                   <motion.div layoutId="sidebar-active" className="ml-auto w-1.5 h-1.5 bg-[#10B981] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-8 border-t border-neutral-50 space-y-4 font-sans">
          <div className="flex items-center gap-3 px-2">
             <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="object-cover w-full h-full" />
                ) : (
                  <PaperPlaneLogo />
                )}
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-sm font-black text-neutral-900 truncate tracking-tight">{formatName(user?.displayName || "LeadPilot")}</p>
               <p className="text-[10px] font-bold text-neutral-400 truncate uppercase tracking-widest">{user?.email}</p>
             </div>
          </div>
          <button 
            className="flex items-center gap-3 px-4 py-3 text-neutral-300 hover:text-rose-500 font-extrabold transition-colors text-xs w-full uppercase tracking-[0.15em] hover:bg-rose-50/20 rounded-xl"
            onClick={() => auth.signOut()}
          >
            <LogOut size={16} />
            SIGN OUT
          </button>
        </div>
      </aside>
      <AddLeadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

export default function Navigation() {
  return (
    <>
      <Header />
      <DesktopSidebar />
      <BottomNav />
    </>
  );
}
