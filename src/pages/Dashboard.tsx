import React, { useEffect, useState } from "react";
import { useFirebase } from "../contexts/FirebaseProvider";
import { collection, query, where, onSnapshot, getDocs, doc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { APP_MODE } from "../config";
import {
  AlertCircle,
  Clock,
  Calendar,
  Trophy,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import AddLeadModal from "../components/AddLeadModal";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user, role, plan, clientId } = useFirebase();
  const [leads, setLeads] = useState<any[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Background Migration: Convert old email-assigned leads to new UID-assigned leads
  useEffect(() => {
    if (!user || (role !== "client" && role !== "admin" && role !== "super_admin")) return;

    const runLeadsMigration = async () => {
      try {
        // 1. Fetch all users for this client workspace
        let userQuery;
        if (role === "super_admin") {
          userQuery = query(collection(db, "users"));
        } else if (clientId) {
          userQuery = query(collection(db, "users"), where("clientId", "==", clientId));
        } else {
          return;
        }

        const userSnap = await getDocs(userQuery);
        const registeredUsers = userSnap.docs
          .map(docRef => ({ id: docRef.id, ...docRef.data() as any }))
          .filter(u => u.uid && u.email && u.role === "agent");

        if (registeredUsers.length === 0) return;

        // 2. Fetch leads for this client workspace
        let leadsQuery;
        if (role === "super_admin") {
          leadsQuery = query(collection(db, "leads"));
        } else if (clientId) {
          leadsQuery = query(collection(db, "leads"), where("clientId", "==", clientId));
        } else {
          return;
        }

        const leadsSnap = await getDocs(leadsQuery);
        const leadsData = leadsSnap.docs.map(docRef => ({ id: docRef.id, ...docRef.data() as any }));

        // 3. Match old email-based assignedTo with corresponding canonical UIDs
        const batch = writeBatch(db);
        let updateCount = 0;

        leadsData.forEach(lead => {
          if (!lead.assignedTo) return;
          const assignedToLower = lead.assignedTo.trim().toLowerCase();

          const matchingAgent = registeredUsers.find(
            u => u.email.trim().toLowerCase() === assignedToLower
          );

          if (matchingAgent && lead.assignedTo !== matchingAgent.uid) {
            batch.update(doc(db, "leads", lead.id), {
              assignedTo: matchingAgent.uid
            });
            updateCount++;
          }
        });

        if (updateCount > 0) {
          await batch.commit();
          console.log(`[Migration] Successfully migrated ${updateCount} leads from email assignment to UID assignment.`);
        }
      } catch (err) {
        console.error("[Migration] Error during background migration of old leads:", err);
      }
    };

    runLeadsMigration();
  }, [user, role, clientId]);

  useEffect(() => {
    if (!user || role === null) return;

    const baseQuery = collection(db, "leads");
    let q;
    
    if (role === "super_admin") {
      q = baseQuery;
    } else if ((role === "client" || role === "admin") && clientId) {
      q = query(baseQuery, where("clientId", "==", clientId));
    } else if (role === "agent" && clientId) {
      const matchAssignees = [user.uid];
      if (user.email) matchAssignees.push(user.email.toLowerCase());
      q = query(baseQuery, where("clientId", "==", clientId), where("assignedTo", "in", matchAssignees));
    } else {
      setLeads([]);
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLeads = snapshot.docs.map(docRef => ({ id: docRef.id, ...docRef.data() as any }));
      setLeads(allLeads);
    }, (err) => {
      console.error("Dashboard leads query error:", err);
    });

    return unsubscribe;
  }, [user, role, plan, clientId]);

  const todayStr = new Date().toISOString().split("T")[0];

  // Stats Calculations
  const missedFollowups = leads.filter(l => {
    if (!l.followUpDate) return false;
    return l.followUpDate < todayStr && l.status !== "closed" && l.status !== "inactive" && !l.followUpCompleted;
  });

  const todayFollowups = leads.filter(l => {
    if (!l.followUpDate) return false;
    return l.followUpDate === todayStr && l.status !== "closed" && l.status !== "inactive" && !l.followUpCompleted;
  });

  const missedCount = missedFollowups.length;
  const followupsDueCount = todayFollowups.length;

  const meetingsToday = leads.filter(l =>
    (l.status === "site_visit" || l.status === "meeting" || l.status === "site_visit_postponed") &&
    l.followUpDate === todayStr
  ).length;

  const closedDeals = leads.filter(l => l.status === "closed").length;

  const totalLeads = leads.length;
  const todayLeads = leads.filter(l => l.followUpDate === todayStr).length;
  const openLeads = leads.filter(l => l.status !== "closed" && l.status !== "inactive").length;

  // Funnel counts
  const contactedCount = leads.filter(l => l.status === "contacted").length;
  const meetingCount = leads.filter(l => l.status === "meeting").length;
  const siteVisitScheduledCount = leads.filter(l => l.status === "site_visit").length;
  const siteVisitPostponedCount = leads.filter(l => l.status === "site_visit_postponed").length;
  const bookedCount = leads.filter(l => l.status === "booked").length;
  const closedCount = leads.filter(l => l.status === "closed").length;
  const inactiveCount = leads.filter(l => l.status === "inactive").length;

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 lg:p-6 pb-28 font-sans">

      {/* 🔥 REVISED WORKSPACE PORTFOLIO HEADER */}
      <header className="mb-6 flex items-end justify-between select-none">
        <div>
          <span className="text-[10px] font-black text-[#10B981] uppercase tracking-[0.2em] block">
            Workspace Portfolio
          </span>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight mt-1.5 leading-none">
            Today's Tasks
          </h1>
        </div>

        <div>
          <span className="text-[10px] font-extrabold text-neutral-500 bg-neutral-100/65 border border-neutral-150/40 px-4 py-2.5 rounded-full uppercase tracking-wider select-none block">
            {format(new Date(), "EEE, d MMM").toUpperCase()}
          </span>
        </div>
      </header>

      {/* 🔥 WARNING ALERT ALIGNMENT */}
      {missedCount > 0 && (
        <Link
          to="/leads?filter=missed"
          className="bg-[#FFF5F5] border border-[#FFE4E6] p-4.5 rounded-[2rem] mb-6 flex items-center gap-3.5 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition duration-200 cursor-pointer block"
          id="missed-alert-banner"
        >
          <div className="w-6 h-6 rounded-full bg-white border border-[#E11D48] flex items-center justify-center shrink-0 text-[#E11D48] shadow-sm">
            <span className="text-xs font-black leading-none mb-[1px]">!</span>
          </div>
          <p className="text-xs font-bold text-neutral-500">
            You have <span className="font-extrabold text-[#E11D48]">{missedCount} missed follow-ups</span>
          </p>
        </Link>
      )}

      {/* 🔥 GRID 2x2 METRICS */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard
          label="Today Follow-ups"
          value={followupsDueCount}
          icon={<Clock size={20} className="text-amber-500" />}
          to="/leads?filter=today"
        />

        <StatCard
          label="Missed Follow-ups"
          value={missedCount}
          icon={<AlertCircle size={20} className="text-rose-500" />}
          to="/leads?filter=missed"
        />

        <StatCard
          label="Meetings Today"
          value={meetingsToday}
          icon={<Calendar size={20} className="text-orange-500" />}
          to="/leads?filter=meetings"
        />

        <StatCard
          label="Closed Deals"
          value={closedDeals}
          icon={<Trophy size={20} className="text-emerald-500" />}
          to="/leads?filter=closed"
        />
      </div>

      {/* 🔥 DOUBLE GRID WORKSPACE SECTION */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">

        {/* LEAD DIRECTORY OVERVIEW CARD */}
        <section className="bg-white border border-neutral-100 rounded-[2.5rem] p-6 shadow-sm transition">
          <div className="flex items-center gap-2 mb-6 select-none pb-4 border-b border-neutral-50">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
              Lead Directory Overview
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <MiniCard label="Total Leads" value={totalLeads} to="/leads" />
            <MiniCard label="Today Leads" value={todayLeads} to="/leads?filter=today" />
            <MiniCard label="Closed Deals" value={closedDeals} to="/leads?filter=closed" />
            <MiniCard label="Open Leads" value={openLeads} to="/leads?status=open" />
          </div>
        </section>

        {/* CONVERSION FUNNEL BAR VISUALLY PERFECTED */}
        <section className="bg-white border border-neutral-100 rounded-[2.5rem] p-6 shadow-sm transition">
          <div className="flex items-center gap-2 mb-6 select-none pb-4 border-b border-neutral-50">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
            <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
              Conversion Pipeline
            </h3>
          </div>

          <div className="space-y-4">
            <FunnelRow label="Contacted" value={contactedCount} total={totalLeads} color="bg-purple-500" to="/leads?status=contacted" />
            <FunnelRow label="Meetings" value={meetingCount} total={totalLeads} color="bg-indigo-500" to="/leads?status=meeting" />
            <FunnelRow label="Site Visit Scheduled" value={siteVisitScheduledCount} total={totalLeads} color="bg-sky-500" to="/leads?status=site_visit" />
            <FunnelRow label="Site Visit Postponed" value={siteVisitPostponedCount} total={totalLeads} color="bg-amber-500" to="/leads?status=site_visit_postponed" />
            <FunnelRow label="Booked" value={bookedCount} total={totalLeads} color="bg-teal-500" to="/leads?status=booked" />
            <FunnelRow label="Closed Deals" value={closedCount} total={totalLeads} color="bg-emerald-500" to="/leads?status=closed" />
            <FunnelRow label="Inactive" value={inactiveCount} total={totalLeads} color="bg-rose-400" to="/leads?status=inactive" />
          </div>
        </section>

      </div>

      {/* FLOAT BUTTON */}
      <button
        onClick={() => setIsAddOpen(true)}
        className="fixed bottom-28 right-6 bg-emerald-500 text-white w-14 h-14 rounded-full shadow-lg hover:scale-105 active:scale-95 transition flex items-center justify-center z-40 outline-none hover:shadow-emerald-250 hover:bg-emerald-600"
        title="Add New Lead"
      >
        <Plus size={24} />
      </button>

      <AddLeadModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}

/* 🔥 NATIVE HIGH-FIDELITY CUSTOM RENDERERS */

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  to: string;
}

function StatCard({ label, value, icon, to }: StatCardProps) {
  let theme = {
    bg: "bg-[#FFFDF0]",
    border: "border-[#FEF08A]",
    text: "text-[#CA8A04]",
  };

  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes("missed")) {
    theme = {
      bg: "bg-[#FFF1F2]",
      border: "border-[#FECDD3]",
      text: "text-[#E11D48]",
    };
  } else if (lowerLabel.includes("meet")) {
    theme = {
      bg: "bg-[#FFF7ED]",
      border: "border-[#FFEDD5]",
      text: "text-[#EA580C]",
    };
  } else if (lowerLabel.includes("close")) {
    theme = {
      bg: "bg-[#F0FDF4]",
      border: "border-[#BBF7D0]",
      text: "text-[#059669]",
    };
  }

  return (
    <Link
      to={to}
      className="p-5 bg-white border border-[#1A1A1A] rounded-[1.75rem] shadow-sm hover:shadow-md hover:scale-[1.015] active:scale-[0.985] transition-all duration-200 cursor-pointer flex items-center gap-4 group select-none"
    >
      <div className={`w-12 h-12 ${theme.bg} border ${theme.border} rounded-2xl flex items-center justify-center shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] shrink-0`}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { className: `${theme.text} stroke-[2.5] w-5 h-5` }) : icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-neutral-400 tracking-wider uppercase leading-none">
          {label}
        </p>
        <p className="text-3xl font-black text-[#111827] mt-2 leading-none">
          {value}
        </p>
      </div>
    </Link>
  );
}

interface MiniCardProps {
  label: string;
  value: number;
  to: string;
}

function MiniCard({ label, value, to }: MiniCardProps) {
  return (
    <Link
      to={to}
      className="bg-neutral-50 hover:bg-neutral-100/60 border border-neutral-100 p-4.5 rounded-[2rem] shadow-sm select-none hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer block"
    >
      <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider leading-none">{label}</p>
      <p className="text-2xl font-black text-neutral-900 mt-2 leading-none">{value}</p>
    </Link>
  );
}

interface FunnelRowProps {
  label: string;
  value: number;
  total: number;
  color: string;
  to: string;
}

function FunnelRow({ label, value, total, color, to }: FunnelRowProps) {
  const percentage = total > 0 ? Math.min(100, (value / total) * 100) : 0;

  return (
    <Link
      to={to}
      className="mb-3 block select-none group hover:scale-[1.01] transition-all duration-150 cursor-pointer"
    >
      <div className="flex justify-between text-xs mb-1.5 font-medium">
        <span className="text-neutral-500 group-hover:text-neutral-950 font-bold tracking-tight transition-colors">{label}</span>
        <span className="text-neutral-400 group-hover:text-neutral-700 transition-colors">{value} {value === 1 ? "lead" : "leads"} ({Math.round(percentage)}%)</span>
      </div>
      <div className="w-full h-2 bg-neutral-100 rounded-full relative overflow-hidden">
        <div
          className={`h-2 rounded-full absolute left-0 top-0 transition-all duration-500 ease-out ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </Link>
  );
}
