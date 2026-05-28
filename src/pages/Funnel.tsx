import { useFirebase } from "../contexts/FirebaseProvider";
import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, getDocs, doc, writeBatch, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { APP_MODE } from "../config";
import { motion, AnimatePresence } from "motion/react";
import { Filter, Users, ChevronRight, UserCheck, ArrowRightLeft, DollarSign, Phone, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

const STAGES = [
  { label: "New Inquiry", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Meeting", value: "meeting" },
  { label: "Site Visit Scheduled", value: "site_visit" },
  { label: "Site Visit Postponed", value: "site_visit_postponed" },
  { label: "Booked", value: "booked" },
  { label: "Closed", value: "closed" },
  { label: "Inactive", value: "inactive" }
];

export default function Funnel() {
  const { user, role, plan, clientId } = useFirebase();
  const [leads, setLeads] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");
  const [activeTabStage, setActiveTabStage] = useState<string>("new"); // Mobile horizontal tab switcher

  // Bulk assignment states
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkAssignAgentId, setBulkAssignAgentId] = useState<string>("");
  const [isBulkAssignMode, setIsBulkAssignMode] = useState<boolean>(false);

  useEffect(() => {
    if (!user || role === null) return;

    if (role === "super_admin") {
      setLeads([]);
      setAgents([]);
      return;
    }

    // Fetch leads based on role
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
      setAgents([]);
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLeads(data);
    });

    const fetchAgents = async () => {
      if (role === "super_admin") {
        const snap = await getDocs(collection(db, "users"));
        setAgents(snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, uid: data.uid || d.id, ...data };
        }));
      } else if ((role === "client" || role === "admin") && clientId) {
        const snap = await getDocs(query(collection(db, "users"), where("clientId", "==", clientId)));
        setAgents(snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, uid: data.uid || d.id, ...data };
        }));
      }
    };

    fetchAgents();
    return unsubscribe;
  }, [user, role, plan, clientId]);

  const filteredLeads = leads.filter(l => {
    if (selectedAgentId !== "all") {
      return l.assignedTo === selectedAgentId;
    }
    return true;
  });

  const getLeadsInStage = (stageVal: string) => {
    return filteredLeads.filter(l => (l.status || "new") === stageVal);
  };

  const handleLeadStageChange = async (leadId: string, newStage: string) => {
    try {
      await updateDoc(doc(db, "leads", leadId), {
        status: newStage
      });
    } catch (err) {
      console.error("Error setting lead stage:", err);
    }
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleBulkAssign = async () => {
    if (selectedLeadIds.length === 0 || !bulkAssignAgentId) return;
    try {
      const batch = writeBatch(db);
      selectedLeadIds.forEach(id => {
        batch.update(doc(db, "leads", id), {
          assignedTo: bulkAssignAgentId
        });
      });
      await batch.commit();
      alert(`Assigned ${selectedLeadIds.length} leads successfully!`);
      setSelectedLeadIds([]);
      setIsBulkAssignMode(false);
      setBulkAssignAgentId("");
    } catch (err) {
      console.error("Bulk assign failed:", err);
      alert("Error executing bulk assignment.");
    }
  };

  return (
    <div className="p-4 lg:p-6 pb-24 font-sans max-w-7xl mx-auto">
      <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-neutral-900 tracking-tight">Lead Funnel</h2>
          <p className="text-sm font-medium text-neutral-400">Track and progress inquiries through the conversion pipeline</p>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {(role === "admin" || role === "client" || role === "super_admin") && (
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-neutral-100 shadow-sm">
               <span className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                <Users size={14} /> Agent:
              </span>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-bold text-neutral-700 outline-none"
              >
                <option value="all">All Agents</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name?.trim() || a.displayName?.trim() || a.email?.split("@")[0] || "Agent"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(role === "admin" || role === "client" || role === "super_admin") && (
            <button
              onClick={() => {
                setIsBulkAssignMode(!isBulkAssignMode);
                setSelectedLeadIds([]);
              }}
              className={`text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all border ${
                isBulkAssignMode 
                  ? "bg-rose-50 border-rose-200 text-rose-600" 
                  : "bg-white hover:bg-neutral-50 border-neutral-100 text-neutral-500 shadow-sm"
              }`}
            >
              {isBulkAssignMode ? "Cancel Bulk" : "Bulk Assign"}
            </button>
          )}
        </div>
      </header>

      {/* Bulk Assign Panel */}
      <AnimatePresence>
        {isBulkAssignMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl mb-6 flex flex-col md:flex-row items-center justify-between gap-4"
          >
            <div>
              <p className="text-sm font-extrabold text-neutral-800">
                Bulk Assign ({selectedLeadIds.length} Selected)
              </p>
              <p className="text-xs text-neutral-500">Toggle checkboxes on lead cards, then select an agent to assign them to.</p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={bulkAssignAgentId}
                onChange={(e) => setBulkAssignAgentId(e.target.value)}
                className="bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-700 outline-none w-full md:w-48"
              >
                <option value="">Choose Agent...</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name?.trim() || a.displayName?.trim() || a.email?.split("@")[0] || "Agent"}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={selectedLeadIds.length === 0 || !bulkAssignAgentId}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-200 text-white text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all whitespace-nowrap shadow-md shadow-emerald-100 disabled:shadow-none"
              >
                Apply Assignment
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Column Pipeline view */}
      <div className="hidden lg:grid grid-cols-8 gap-4 items-start overflow-x-auto pb-6">
        {STAGES.map(stage => {
          const stageLeads = getLeadsInStage(stage.value);
          return (
            <div key={stage.value} className="bg-neutral-100/60 p-3 rounded-2xl flex flex-col min-h-[500px] border border-neutral-100/50">
              <div className="mb-3 px-1 flex items-center justify-between">
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider truncate mr-1">
                  {stage.label}
                </span>
                <span className="bg-neutral-200 text-neutral-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {stageLeads.length}
                </span>
              </div>

              <div className="space-y-3 flex-1">
                {stageLeads.map(lead => (
                  <div key={lead.id} className="relative group">
                    {isBulkAssignMode && (
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                        className="absolute top-3 left-3 z-10 w-4 h-4 accent-emerald-500"
                      />
                    )}
                    <div className={`p-4 bg-white rounded-xl border border-neutral-100 shadow-sm hover:shadow-md transition-all ${
                      selectedLeadIds.includes(lead.id) ? "ring-2 ring-emerald-500" : ""
                    } ${isBulkAssignMode ? "pl-9" : ""}`}>
                      <Link to={`/leads/${lead.id}`}>
                        <h4 className="font-extrabold text-neutral-900 text-sm hover:underline">
                          {lead.firstName || "Unknown"} {lead.lastName || ""}
                        </h4>
                      </Link>
                      <p className="text-xs font-semibold text-neutral-400 mt-1">{lead.phone}</p>
                      
                      {lead.project && (
                        <p className="text-[10px] bg-neutral-50 text-neutral-500 px-2 py-0.5 rounded-md mt-2 w-fit font-bold uppercase tracking-wider">{lead.project}</p>
                      )}
                      
                      {lead.budget && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-neutral-400 mt-1.5">
                          <DollarSign size={10} /> {lead.budget}
                        </div>
                      )}

                      {/* Manual Quick Stage Transition in UI */}
                      <div className="mt-3 pt-2.5 border-t border-neutral-50 flex items-center justify-between">
                        <select
                          value={lead.status || "new"}
                          onChange={(e) => handleLeadStageChange(lead.id, e.target.value)}
                          className="bg-neutral-50 text-[10px] font-bold text-neutral-400 border-none outline-none py-1 px-1.5 rounded-lg w-full"
                        >
                          {STAGES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <div className="h-20 flex items-center justify-center border border-dashed border-neutral-200 rounded-xl text-neutral-400 text-xs">
                    No leads
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile view with Horizon horizontal switcher */}
      <div className="lg:hidden">
        {/* Horizontal Navigation Chips */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
          {STAGES.map(stage => {
            const count = getLeadsInStage(stage.value).length;
            const isActive = activeTabStage === stage.value;
            return (
              <button
                key={stage.value}
                onClick={() => setActiveTabStage(stage.value)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl transition-all border text-xs font-black uppercase tracking-wider flex items-center gap-2 ${
                  isActive ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-100" : "bg-white border-neutral-100 text-neutral-400"
                }`}
              >
                {stage.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Stage lead list */}
        <div className="space-y-3">
          {getLeadsInStage(activeTabStage).map(lead => (
            <div
              key={lead.id}
              className={`p-4 bg-white rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between relative ${
                selectedLeadIds.includes(lead.id) ? "ring-2 ring-emerald-500" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                {isBulkAssignMode && (
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.includes(lead.id)}
                    onChange={() => toggleLeadSelection(lead.id)}
                    className="w-4 h-4 accent-emerald-500 shrink-0"
                  />
                )}
                <div>
                  <Link to={`/leads/${lead.id}`} className="hover:underline">
                    <p className="font-extrabold text-neutral-900 text-sm">
                      {lead.firstName || "Unknown"} {lead.lastName || ""}
                    </p>
                  </Link>
                  <p className="text-xs text-neutral-400 mt-0.5">{lead.phone}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {lead.project && (
                      <span className="text-[9px] bg-neutral-50 text-neutral-500 px-2 py-0.5 rounded font-black uppercase tracking-wider">{lead.project}</span>
                    )}
                    {lead.budget && (
                      <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-black uppercase tracking-wider">{lead.budget}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Manual stage dropdown */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <select
                  value={lead.status || "new"}
                  onChange={(e) => handleLeadStageChange(lead.id, e.target.value)}
                  className="bg-neutral-50 text-[10px] font-black uppercase tracking-wider text-neutral-500 p-1.5 rounded-xl border-none outline-none appearance-none pr-6 relative"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a3a3a3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundSize: "10px", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
                >
                  {STAGES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <Link to={`/leads/${lead.id}`} className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1 mt-1">
                  View Profile <ChevronRight size={12} />
                </Link>
              </div>
            </div>
          ))}
          {getLeadsInStage(activeTabStage).length === 0 && (
            <div className="text-center py-16 bg-white border border-dashed border-neutral-200 rounded-3xl text-neutral-400 text-sm">
              No leads currently in this stage.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
