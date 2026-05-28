import { useFirebase } from "../contexts/FirebaseProvider";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { APP_MODE } from "../config";
import { format, isSameDay } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Phone, MessageCircle, MapPin, User, Calendar, Clock } from "lucide-react";
import { Link } from "react-router-dom";

export default function TodayView() {
  const { user, role, plan, clientId } = useFirebase();
  const [leads, setLeads] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    if (!user || role === null) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (role === "super_admin") {
      setLeads([]);
      return;
    }

    const baseQuery = collection(db, "leads");
    let q;
    
    if ((role === "client" || role === "admin") && clientId) {
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
      const todayLeads = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() as any }))
          .filter((lead: any) => {
            if (!lead.followUpDate) return false;
            const d = new Date(lead.followUpDate);
            if (isNaN(d.getTime())) return false;
            d.setHours(0, 0, 0, 0);
            return isSameDay(d, today) && lead.status !== "closed" && lead.status !== "inactive";
          });
        setLeads(todayLeads);
    });

    return unsubscribe;
  }, [user, role, plan, clientId]);

  const stats = {
    visits: leads.filter(l => l.status === "site_visit").length,
    meetings: leads.filter(l => l.status === "meeting").length,
    followups: leads.filter(l => l.status === "contacted" || l.status === "new").length,
    callbacks: leads.filter(l => l.notes?.toLowerCase().includes("callback")).length
  };

  const filteredLeads = activeFilter === "all" ? leads : leads.filter(l => {
    if (activeFilter === "visits") return l.status === "site_visit";
    if (activeFilter === "meetings") return l.status === "meeting";
    if (activeFilter === "followups") return l.status === "contacted" || l.status === "new";
    return true;
  });

  return (
    <div className="p-6">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-neutral-900">Today</h2>
          <span className="text-sm font-medium text-neutral-400">{format(new Date(), "EEEE, MMM d")}</span>
        </div>
      </header>

      <div className="flex gap-3 overflow-x-auto pb-4 mb-8 no-scrollbar">
        <FilterCard label="All" count={leads.length} active={activeFilter === "all"} onClick={() => setActiveFilter("all")} color="bg-emerald-50 text-emerald-600" />
        <FilterCard label="Visits" count={stats.visits} active={activeFilter === "visits"} onClick={() => setActiveFilter("visits")} color="bg-blue-50 text-blue-600" icon={<MapPin size={14} />} />
        <FilterCard label="Meetings" count={stats.meetings} active={activeFilter === "meetings"} onClick={() => setActiveFilter("meetings")} color="bg-indigo-50 text-indigo-600" icon={<User size={14} />} />
        <FilterCard label="Follow-ups" count={stats.followups} active={activeFilter === "followups"} onClick={() => setActiveFilter("followups")} color="bg-amber-50 text-amber-600" icon={<Calendar size={14} />} />
      </div>

      <div className="space-y-4">
        {filteredLeads.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-200">
            <p className="text-neutral-400">No activities for {activeFilter === "all" ? "today" : activeFilter}.</p>
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <LeadRow key={lead.id} lead={lead} />
          ))
        )}
      </div>
    </div>
  );
}

function FilterCard({ label, count, active, onClick, color, icon }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 min-w-[100px] p-4 rounded-2xl flex flex-col gap-2 transition-all border ${active ? 'bg-white border-emerald-500 shadow-sm' : 'bg-white border-neutral-100 shadow-sm'}`}
    >
      <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${color}`}>
        {icon}
        {label}
      </div>
      <span className="text-xl font-bold text-neutral-900">{count}</span>
    </button>
  );
}

function LeadRow({ lead }: any) {
  return (
    <Link to={`/leads/${lead.id}`}>
      <motion.div
        whileHover={{ x: 5 }}
        className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-sm flex items-center justify-between group"
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${
            lead.status === 'site_visit' ? 'bg-orange-50 text-orange-600' :
            lead.status === 'meeting' ? 'bg-indigo-50 text-indigo-600' :
            lead.status === 'contacted' ? 'bg-blue-50 text-blue-600' :
            'bg-emerald-50 text-emerald-600'
          }`}>
            {(lead.firstName || "?")[0]}
          </div>
          <div>
            <p className="font-bold text-neutral-900">{lead.firstName || "Unknown"} {lead.lastName || ""}</p>
            <p className="text-xs font-medium text-neutral-400 flex items-center gap-1">
              <Clock size={12} /> {lead.followUpTime || '--:--'} • {lead.propertyType}
            </p>
          </div>
        </div>
        <ChevronRight size={20} className="text-neutral-300 group-hover:text-emerald-500 transition-colors" />
      </motion.div>
    </Link>
  );
}

