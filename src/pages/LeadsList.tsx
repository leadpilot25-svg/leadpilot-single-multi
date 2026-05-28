import { useFirebase } from "../contexts/FirebaseProvider";
import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, getDocs, doc, writeBatch, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { APP_MODE } from "../config";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  ChevronRight, 
  UserPlus, 
  Filter, 
  FileUp, 
  Mail, 
  UserCheck, 
  Users, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle,
  FileSpreadsheet,
  Trash2
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Papa from "papaparse";

export default function LeadsList() {
  const { user, role, plan, clientId } = useFirebase();
  const [searchParams] = useSearchParams();
  const filterType = searchParams.get("filter");
  const statusFilter = searchParams.get("status");

  const [leads, setLeads] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgentFilter, setSelectedAgentFilter] = useState("all");

  // Bulk assignment states
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isBulkAssignMode, setIsBulkAssignMode] = useState(false);
  const [bulkAssignAgentId, setBulkAssignAgentId] = useState("");

  // CSV Import States
  const [csvPreviewLeads, setCsvPreviewLeads] = useState<any[]>([]);
  const [csvImportModalOpen, setCsvImportModalOpen] = useState(false);
  const [csvAssignAgentId, setCsvAssignAgentId] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!user || role === null) return;

    // Fetch leads
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
      let data = snapshot.docs.map(docRef => ({ id: docRef.id, ...docRef.data() as any }));
      
      // Sort in memory by creation date
      data.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      
      const todayString = new Date().toISOString().split("T")[0];

      if (filterType === "today") {
        data = data.filter((l: any) => l.followUpDate === todayString);
      } else if (filterType === "missed" || filterType === "overdue") {
        data = data.filter((l: any) => {
          if (!l.followUpDate) return false;
          return l.followUpDate < todayString && l.status !== "closed" && l.status !== "inactive" && !l.followUpCompleted;
        });
      } else if (filterType === "meetings") {
        data = data.filter((l: any) => 
          (l.status === "site_visit" || l.status === "meeting" || l.status === "site_visit_postponed") && 
          l.followUpDate === todayString
        );
      } else if (filterType === "closed") {
        data = data.filter((l: any) => l.status === "closed");
      } else if (filterType === "upcoming") {
        data = data.filter((l: any) => l.followUpDate > todayString);
      }

      if (statusFilter) {
        if (statusFilter === "open") {
          data = data.filter((l: any) => l.status !== "closed" && l.status !== "inactive");
        } else {
          data = data.filter((l: any) => l.status === statusFilter);
        }
      }

      setLeads(data);
    });

    // Fetch Agents
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
  }, [user, role, plan, clientId, filterType, statusFilter]);

  // CSV Reader trigger
  const handleCSVSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.map((row: any) => {
          const rawName = row.firstName || row.name || "";
          const phone = row.phone || row.phoneNumber || row.Phone || "";
          const email = row.email || row.Email || "";
          const project = row.project || row.propertyType || "";
          const budget = row.budget || "";

          // Perform verification checks
          const isValid = rawName.trim().length > 0 && phone.trim().length > 0;
          return {
            name: rawName,
            phone,
            email,
            project,
            budget,
            isValid
          };
        });

        setCsvPreviewLeads(parsed);
        setCsvImportModalOpen(true);
        // Clear input value for repeated selections
        e.target.value = "";
      }
    });
  };

  // Bulk Firestore insert for CSV
  const handleCSVBulkSubmit = async () => {
    if (csvPreviewLeads.length === 0 || !user) return;
    setIsImporting(true);

    let successCount = 0;
    try {
      const todayString = new Date().toISOString().split("T")[0];
      const batch = writeBatch(db);

      for (const row of csvPreviewLeads) {
        if (!row.isValid) continue; // Skip invalid entries

        const parts = row.name.split(" ");
        const firstName = parts[0] || "Imported";
        const lastName = parts.slice(1).join(" ") || "";

        const leadRef = doc(collection(db, "leads"));
        batch.set(leadRef, {
          firstName,
          lastName,
          phone: row.phone,
          email: row.email,
          propertyType: row.project || "Not specified",
          project: row.project || "Not specified",
          budget: row.budget,
          status: "new", // "New Inquiry"
          assignedTo: csvAssignAgentId || user.uid,
          clientId: (role === "client" || role === "agent" || role === "admin") ? (clientId || "") : "",
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          followUpDate: todayString,
          followUpTime: "10:00",
          source: "CSV Import"
        });

        successCount++;
      }

      await batch.commit();
      alert(`CSV upload successful! Processed and registered ${successCount} leads.`);
      setCsvImportModalOpen(false);
      setCsvPreviewLeads([]);
      setCsvAssignAgentId("");
    } catch (err) {
      console.error("Bulk CSV import error:", err);
      alert("Error committing batch. Please verify connectivity.");
    } finally {
      setIsImporting(false);
    }
  };

  // Bulk Assignment Logic
  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDeleteLead = async (e: React.MouseEvent, leadId: string, leadName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete lead "${leadName}"? This action is permanent.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, "leads", leadId));
      alert("Lead deleted successfully!");
    } catch (err) {
      console.error("Error deleting lead:", err);
      alert("Failed to delete lead. Check permission rules.");
    }
  };

  const handleBulkAssignAgentsSubmit = async () => {
    if (selectedLeadIds.length === 0 || !bulkAssignAgentId) return;
    try {
      const batch = writeBatch(db);
      selectedLeadIds.forEach(id => {
        batch.update(doc(db, "leads", id), {
          assignedTo: bulkAssignAgentId
        });
      });
      await batch.commit();
      alert(`Success! Handed ${selectedLeadIds.length} leads to agent profile.`);
      setSelectedLeadIds([]);
      setIsBulkAssignMode(false);
      setBulkAssignAgentId("");
    } catch (err) {
      console.error("Bulk allocate trigger error:", err);
      alert("Allocation batch fail.");
    }
  };

  // Combined Filters: Selector search, Status parameters, and Agent filters
  const finalFilteredLeads = leads.filter(l => {
    const combinedName = `${l.firstName || ""} ${l.lastName || ""}`.toLowerCase();
    const phoneNum = l.phone || "";
    
    const matchesSearch = combinedName.includes(searchTerm.toLowerCase()) || phoneNum.includes(searchTerm);
    const matchesAgent = selectedAgentFilter === "all" || l.assignedTo === selectedAgentFilter;
    
    return matchesSearch && matchesAgent;
  });

  return (
    <div className="p-4 lg:p-6 pb-24 font-sans max-w-md mx-auto">
      
      {/* Header section with inline action buttons */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-neutral-900 tracking-tight">Leads Catalog</h2>
          <p className="text-xs text-neutral-400 font-medium mt-1">Review active pipeline and CSV import triggers</p>
        </div>
        
        <div className="flex gap-2 shrink-0">
          {/* CSV File Select Button */}
          <label className="p-3 bg-white border border-neutral-100 rounded-2xl text-neutral-400 cursor-pointer hover:bg-neutral-50 hover:text-emerald-500 transition-colors shadow-sm flex items-center justify-center">
            <FileSpreadsheet size={20} />
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleCSVSelect} 
              className="hidden" 
            />
          </label>
          {/* Create new lead */}
          <Link to="/leads/new" className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-100 flex items-center justify-center transition-all">
            <UserPlus size={20} />
          </Link>
        </div>
      </header>

      {/* Advanced Filter and Search Section */}
      <div className="space-y-3 mb-6">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300 group-focus-within:text-emerald-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-neutral-100 rounded-2xl py-4.5 pl-12 pr-4 outline-none font-semibold text-sm text-neutral-800 shadow-sm focus:border-emerald-500 transition-all"
          />
        </div>

        {/* Filter by Agent select dropdown (Admins only) */}
        {(role === "admin" || role === "client") && (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white border border-neutral-100 p-2.5 rounded-2xl shadow-sm flex items-center justify-between">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-2">Filter Agent</span>
              <select
                value={selectedAgentFilter}
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-bold text-neutral-700 outline-none pr-3 max-w-[150px] truncate"
              >
                <option value="all">All Agents</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name?.trim() || a.displayName?.trim() || a.email?.split("@")[0] || "Agent"}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setIsBulkAssignMode(!isBulkAssignMode);
                setSelectedLeadIds([]);
              }}
              className={`px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                isBulkAssignMode ? "bg-rose-50 text-rose-500 border border-rose-100" : "bg-white border border-neutral-100 text-neutral-500 shadow-sm"
              }`}
            >
              Bulk Assign
            </button>
          </div>
        )}
      </div>

      {/* Bulk Re-assign Overlay Panel */}
      <AnimatePresence>
        {isBulkAssignMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-emerald-50 border border-emerald-100 p-4 rounded-[2rem] mb-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-neutral-800 uppercase tracking-wider">
                Allocate ({selectedLeadIds.length} Checked)
              </span>
              <button onClick={() => setIsBulkAssignMode(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-2">
              <select
                value={bulkAssignAgentId}
                onChange={(e) => setBulkAssignAgentId(e.target.value)}
                className="bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-700 outline-none flex-1"
              >
                <option value="">Select Agent...</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name?.trim() || a.displayName?.trim() || a.email?.split("@")[0] || "Agent"}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkAssignAgentsSubmit}
                disabled={selectedLeadIds.length === 0 || !bulkAssignAgentId}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-200 text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all"
              >
                Assign
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Catalog Lead Rows */}
      <div className="space-y-3">
        {finalFilteredLeads.map((lead) => (
          <div key={lead.id} className="relative group">
            {isBulkAssignMode && (
              <input
                type="checkbox"
                checked={selectedLeadIds.includes(lead.id)}
                onChange={() => toggleSelectLead(lead.id)}
                className="absolute top-1/2 -translate-y-1/2 left-4 z-10 w-4 h-4 accent-emerald-500"
              />
            )}
            
            <Link to={`/leads/${lead.id}`} className="block">
              <motion.div
                layout
                className={`bg-white p-4.5 rounded-[2rem] border border-neutral-100 shadow-sm flex items-center justify-between group transition-all duration-200 ${
                  isBulkAssignMode ? "pl-12" : "hover:scale-[1.01]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-neutral-50 text-neutral-400 rounded-2xl flex items-center justify-center font-bold text-base border border-neutral-100 shadow-inner shrink-0">
                    {(lead.firstName || "?")[0]}
                  </div>
                  <div>
                    <p className="font-extrabold text-neutral-900 leading-tight">
                      {lead.firstName || "Unknown"} {lead.lastName || ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={`text-[8px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full ${
                        lead.status === 'new' ? 'bg-emerald-50 text-emerald-600' :
                        lead.status === 'closed' ? 'bg-emerald-500 text-white' :
                        lead.status === 'booked' ? 'bg-teal-500 text-white' :
                        lead.status === 'inactive' ? 'bg-neutral-100 text-neutral-400' :
                        'bg-orange-50 text-orange-600'
                      }`}>
                        {lead.status === 'new' ? 'New Inquiry' : (lead.status || 'new').replace('_', ' ')}
                      </span>
                      {lead.project && (
                        <span className="text-[8px] font-black text-neutral-300 uppercase tracking-widest truncate max-w-[80px]">
                          {lead.project}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {lead.email && (
                    <a 
                      href={`mailto:${lead.email}`} 
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 text-neutral-300 hover:text-emerald-500 transition-colors shrink-0"
                    >
                      <Mail size={16} />
                    </a>
                  )}
                  {(role === "admin" || role === "client" || APP_MODE === "single") && (
                    <button
                      onClick={(e) => handleDeleteLead(e, lead.id, `${lead.firstName || ""} ${lead.lastName || ""}`)}
                      className="p-2 text-neutral-300 hover:text-rose-500 transition-colors shrink-0"
                      title="Delete Lead"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <ChevronRight size={18} className="text-neutral-200 group-hover:text-emerald-500 transition-colors shrink-0" />
                </div>
              </motion.div>
            </Link>
          </div>
        ))}

        {finalFilteredLeads.length === 0 && (
          <div className="text-center py-20 text-neutral-400 font-semibold bg-white border border-dashed rounded-[2rem]">
            No leads found inside catalog.
          </div>
        )}
      </div>

      {/* CSV Preview and Import Validation Modal overlay */}
      <AnimatePresence>
        {csvImportModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-sm flex items-end justify-center p-4"
          >
            <motion.div 
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              exit={{ y: 50 }}
              className="bg-white rounded-[2.5rem] p-6 max-w-sm w-full shadow-2xl relative max-h-[85vh] overflow-y-auto"
            >
              <button 
                onClick={() => setCsvImportModalOpen(false)}
                className="absolute top-5 right-5 p-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 rounded-full transition-colors"
              >
                <X size={16} />
              </button>

              <div className="mb-4">
                <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest bg-emerald-50 px-2.5 py-1 rounded-full">
                  CSV Bulk Importer
                </span>
                <h3 className="text-xl font-black text-neutral-900 tracking-tight mt-2">Validate &amp; Allocate</h3>
                <p className="text-xs text-neutral-400 font-semibold leading-relaxed mt-1">
                  Verify name and phone requirements prior to committing to Firestore database.
                </p>
              </div>

              {/* Agent assignment trigger for CSV leads */}
              <div className="space-y-1.5 mb-5 text-left bg-neutral-50 p-4 rounded-2xl border border-neutral-100 shadow-inner">
                <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                  <UserCheck size={12} /> Assign All Leads To
                </label>
                <select
                  value={csvAssignAgentId}
                  onChange={(e) => setCsvAssignAgentId(e.target.value)}
                  className="bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-700 outline-none w-full"
                >
                  <option value="">Unassigned...</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name?.trim() || a.displayName?.trim() || a.email?.split("@")[0] || "Agent"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Parsed Rows Preview */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto border border-neutral-100 p-2.5 rounded-2xl bg-neutral-50/50 mb-5 no-scrollbar">
                {csvPreviewLeads.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-neutral-100 flex items-center justify-between text-xs">
                    <div className="overflow-hidden mr-2">
                      <p className="font-extrabold text-neutral-800 truncate">{item.name || "Missing Name"}</p>
                      <p className="font-medium text-neutral-400 text-[10px] mt-0.5 truncate">{item.phone || "Missing Phone"}</p>
                    </div>

                    {/* Check indicator */}
                    {item.isValid ? (
                      <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full shrink-0 uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 size={10} /> Valid
                      </span>
                    ) : (
                      <span className="text-[9px] font-black bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full shrink-0 uppercase tracking-widest flex items-center gap-1">
                        <AlertTriangle size={10} /> Error
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCsvImportModalOpen(false)}
                  className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-2xl flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCSVBulkSubmit}
                  disabled={isImporting || csvPreviewLeads.filter(x => x.isValid).length === 0}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-100 disabled:text-neutral-400 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-2xl flex-1 flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                >
                  {isImporting ? "Importing..." : "Confirm Import"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
