import { useFirebase } from "../contexts/FirebaseProvider";
import { db } from "../lib/firebase";
import React, { useEffect, useState } from "react";
import { collection, query, onSnapshot, doc, setDoc, addDoc, serverTimestamp, deleteDoc, where } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, UserPlus, Shield, Database, Copy, Check, ExternalLink, 
  Mail, Trophy, UserCheck, Plus, CircleDot, AlertCircle, Trash2
} from "lucide-react";

export default function Admin() {
  const { user, role, remindersEnabled, clientId } = useFirebase();
  const [agents, setAgents] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  
  // Create Agent Inputs
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentEmail, setNewAgentEmail] = useState("");
  const [addingAgent, setAddingAgent] = useState(false);
  
  // Public Link and Seed helper states
  const [copied, setCopied] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Google Sheets Config
  const [sheetUrl, setSheetUrl] = useState("");
  const [savingSheetUrl, setSavingSheetUrl] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);

  const appsScriptCode = `function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Name", "Phone", "Email", "Status", "Agent", "Project", "Budget", "Notes"]);
    }
    sheet.appendRow([
      data.createdAt || new Date().toISOString(),
      data.name || (data.firstName + " " + data.lastName),
      data.phone || "",
      data.email || "",
      data.status || "New Inquiry",
      data.agent || "Unassigned Agent",
      data.project || data.propertyType || "",
      data.budget || "",
      data.notes || ""
    ]);
    return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copyScript = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setScriptCopied(true);
    setTimeout(() => setScriptCopied(false), 2505);
  };

  const publicLink = ((role === "client" || role === "admin") && clientId)
    ? `${window.location.origin}/public-form?clientId=${clientId}`
    : `${window.location.origin}/public-form`;

  useEffect(() => {
    if (!user) return;

    let unsubscribeUsers = () => {};
    let unsubscribeLeads = () => {};

    if ((role === "client" || role === "admin") && clientId) {
      // Load company specific users (agents)
      const usersQ = query(collection(db, "users"), where("clientId", "==", clientId));
      unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
        const usersData = snapshot.docs.map(d => {
          const data = d.data();
          return { id: data.email || d.id, uid: data.uid || d.id, ...data };
        });
        setAgents(usersData);

        // AUTO-MIGRATOR FOR ALREADY ADDED AGENTS:
        // Automatically migrate any agent documents with auto-generated IDs to use their lowercase email as the doc ID
        snapshot.docs.forEach(async (d) => {
          const data = d.data();
          if (data.role === "agent" && !data.uid && data.email) {
            const lowerEmail = data.email.trim().toLowerCase();
            if (d.id !== lowerEmail) {
              console.log(`Auto-migrating legacy agent record ${d.id} to robust email ID: ${lowerEmail}`);
              try {
                // Clone/write under the lowercase email ID
                await setDoc(doc(db, "users", lowerEmail), {
                  ...data,
                  email: lowerEmail,
                  clientId: clientId
                });
                // Delete the old auto-generated ID doc
                await deleteDoc(doc(db, "users", d.id));
              } catch (migrationErr) {
                console.warn(`[Auto-Migrate] Failed migrating agent ${lowerEmail}:`, migrationErr);
              }
            }
          }
        });
      }, (err) => {
        console.error("Firestore user snapshot failed:", err);
      });

      // Load company specific leads
      const leadsQ = query(collection(db, "leads"), where("clientId", "==", clientId));
      unsubscribeLeads = onSnapshot(leadsQ, (snapshot) => {
        const leadsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setLeads(leadsData);
      }, (err) => {
        console.error("Firestore leads snapshot failed:", err);
      });
    } else if (role === "super_admin") {
      // Load all users
      const usersQ = collection(db, "users");
      unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
        const usersData = snapshot.docs.map(d => {
          const data = d.data();
          return { id: data.email || d.id, uid: data.uid || d.id, ...data };
        });
        setAgents(usersData);
      });

      // Admins/Super-admins are prohibited from viewing client leads
      setLeads([]);
    }

    // Listen to sheetUrl config specific to the workspace
    const configDocRef = ((role === "client" || role === "admin") && clientId) ? doc(db, "clients", clientId) : doc(db, "clients", "main_config");
    const unsubscribeSheet = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setSheetUrl(snapshot.data()?.sheetUrl || "");
      }
    }, (err) => {
      console.warn("Unable to fetch sheet config (this is expected for admins who do not own main_config):", err);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLeads();
      unsubscribeSheet();
    };
  }, [user, role, clientId]);

  const handleSaveSheetUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSheetUrl(true);
    try {
      const configDocRef = ((role === "client" || role === "admin") && clientId) ? doc(db, "clients", clientId) : doc(db, "clients", "main_config");
      await setDoc(configDocRef, {
        sheetUrl: sheetUrl.trim()
      }, { merge: true });
      alert("Google Sheets Sync URL saved successfully!");
    } catch (err) {
      console.error("Save sheet URL error:", err);
      alert("Failed to save sheets config.");
    } finally {
      setSavingSheetUrl(false);
    }
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim() || !newAgentEmail.trim()) return;
    setAddingAgent(true);

    try {
      const emailId = newAgentEmail.trim().toLowerCase();
      
      // Store agent configuration pre-registration directly using their lowercase email as Document ID
      await setDoc(doc(db, "users", emailId), {
        name: newAgentName.trim(),
        email: emailId,
        role: "agent",
        clientId: clientId,
        createdAt: new Date().toISOString()
      });

      alert(`Agent "${newAgentName}" added successfully as an active staff member!`);
      setNewAgentName("");
      setNewAgentEmail("");
    } catch (err) {
      console.error("Failed to add agent:", err);
      alert("Failed to register agent. Check Firestore security permissions.");
    } finally {
      setAddingAgent(false);
    }
  };

  const handleDeleteAgent = async (agentId: string, agentName: string) => {
    if (!agentId) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete agent "${agentName || "this agent"}"? This agent will be removed from the active team roster.`
    );
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "users", agentId));
      alert(`Agent "${agentName || "Agent"}" has been deleted from the team.`);
    } catch (err) {
      console.error("Failed to delete agent:", err);
      alert("Failed to delete agent. Check your permissions.");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const seedDemoData = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 2);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 3);

      const tStr = today.toISOString().split('T')[0];
      const yStr = yesterday.toISOString().split('T')[0];
      const tmStr = tomorrow.toISOString().split('T')[0];

      const demoLeads = [
        { firstName: "Rahul", lastName: "Sharma", phone: "+91 98765 43210", propertyType: "3BHK Apartment", budget: "1.2 Cr", location: "Andheri West", followUpDate: tStr, status: "new", source: "Facebook" },
        { firstName: "Priya", lastName: "Patel", phone: "+91 91234 56789", propertyType: "Luxury Villa", budget: "4.5 Cr", location: "Bandra", followUpDate: tStr, status: "site_visit", source: "Walk-in" },
        { firstName: "Amit", lastName: "Verma", phone: "+91 99887 76655", propertyType: "Commercial Space", budget: "85 L", location: "Thane", followUpDate: tStr, status: "meeting", source: "Call" },
        { firstName: "Sneha", lastName: "Reddy", phone: "+91 93456 78901", propertyType: "Plot", budget: "2.1 Cr", location: "Navi Mumbai", followUpDate: yStr, status: "contacted", source: "Instagram" },
        { firstName: "Vikram", lastName: "Singh", phone: "+91 90011 22334", propertyType: "2BHK Flat", budget: "65 L", location: "Goregaon", followUpDate: yStr, status: "inactive", source: "Reference" },
        { firstName: "Anjali", lastName: "Gupta", phone: "+91 95544 33221", propertyType: "Studio Complex", budget: "44 L", location: "Worli", followUpDate: tmStr, status: "new", source: "Facebook" }
      ];

      for (const lead of demoLeads) {
        await addDoc(collection(db, "leads"), {
          ...lead,
          email: `${lead.firstName.toLowerCase()}@example.com`,
          whatsapp: lead.phone,
          followUpTime: "11:00",
          assignedTo: user.uid,
          notes: "Auto-generated demo lead for layout preview.",
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });
      }
      alert("Successfully seeded 6 demo leads into your pipeline!");
    } catch (e) {
      console.error(e);
      alert("Failed to seed data.");
    } finally {
      setSeeding(false);
    }
  };

  // Helper to resolve lead metrics by agent
  const getAgentMetrics = (agentEmail: string, agentUid?: string) => {
    const normalizedEmail = (agentEmail || "").trim().toLowerCase();
    const agentLeads = leads.filter(l => {
      const assigned = (l.assignedTo || "").trim().toLowerCase();
      return assigned === normalizedEmail || (agentUid && l.assignedTo === agentUid);
    });
    const total = agentLeads.length;
    const active = agentLeads.filter(l => l.status !== "closed" && l.status !== "inactive").length;
    const closed = agentLeads.filter(l => l.status === "closed").length;
    return { total, active, closed };
  };

  return (
    <div className="p-4 lg:p-6 pb-28 font-sans max-w-md mx-auto">
      <header className="mb-6">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 font-bold">
          {(role === "client" || role === "admin") ? "Agency Portal" : "Workspace Controls"}
        </span>
        <h2 className="text-3xl font-black text-neutral-900 tracking-tight leading-none mt-1">
          {(role === "client" || role === "admin") ? "Team Workspace" : "Admin Dashboard"}
        </h2>
      </header>

      {/* Role Notice */}
      <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-3xl mb-6 flex items-center gap-3">
        <div className="p-2 bg-emerald-500 text-white rounded-xl">
          <Shield size={16} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Access Level Verified</p>
          <p className="text-xs text-neutral-600 font-semibold leading-tight mt-0.5">
            Logged in as <span className="font-extrabold capitalize">
              {role === "super_admin" ? "Super Admin" : (role === "admin" ? "Workspace Admin" : (role === "client" ? "Company Owner" : "Agent"))}
            </span>. Settings unlocked.
          </p>
        </div>
      </div>

      {/* Add Agent Form (Admins & Corporate Clients Only) */}
      {(role === "admin" || role === "client") ? (
        <section className="bg-white border border-neutral-100 p-6 rounded-[2rem] shadow-sm mb-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#10B981] mb-5 flex items-center gap-2">
            <UserPlus size={14} className="text-emerald-500" /> Register Agent Profile
          </h3>
          <form onSubmit={handleAddAgent} className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 block">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                required
                className="w-full bg-neutral-50 border border-neutral-100 rounded-xl p-3 text-xs font-extrabold text-neutral-800 outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 block">Email Address</label>
              <input
                type="email"
                placeholder="e.g. ramesh@leadpilot.com"
                value={newAgentEmail}
                onChange={(e) => setNewAgentEmail(e.target.value)}
                required
                className="w-full bg-neutral-50 border border-neutral-100 rounded-xl p-3 text-xs font-extrabold text-neutral-800 outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={addingAgent}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-100 disabled:text-neutral-400 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
            >
              <Plus size={14} />
              {addingAgent ? "Registering..." : "Add Active Agent"}
            </button>
          </form>
        </section>
      ) : (
        <div className="bg-yellow-50/60 border border-yellow-100 p-4 rounded-3xl mb-6 flex items-center gap-2">
          <AlertCircle size={16} className="text-yellow-600 shrink-0" />
          <p className="text-xs text-yellow-700 font-semibold leading-tight">
            Only administrators and client owners can add new agents. Contact support.
          </p>
        </div>
      )}

      {/* Agents Roster List with Lead Metrics */}
      <section className="space-y-4 mb-8">
        <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 ml-1 flex items-center justify-between">
          <span>Active Agents Team</span>
          <span className="text-[10px] bg-neutral-100 px-2 py-0.5 rounded-md text-neutral-500 font-bold">
            {agents.length} Profiles
          </span>
        </h3>

        <div className="space-y-3">
          {agents.map((agent) => {
            const metrics = getAgentMetrics(agent.email || "", agent.uid || agent.id);
            return (
              <motion.div 
                layout
                key={agent.uid || agent.id || agent.email}
                className="bg-white p-5 rounded-[2rem] border border-neutral-100 shadow-sm flex flex-col gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                    {(agent.name || "?")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-neutral-900 leading-tight truncate">{agent.name || "Anonymous Member"}</p>
                    <p className="font-semibold text-neutral-400 text-[10px] mt-0.5 truncate flex items-center gap-1.5">
                      <Mail size={10} /> {agent.email}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[8px] font-black uppercase bg-neutral-100 text-neutral-500 px-2.5 py-1 rounded-full">
                      {agent.role || "agent"}
                    </span>
                    {(role === "admin" || role === "client") && (agent.uid !== user?.uid && agent.id !== user?.uid) && (
                      <button
                        onClick={() => handleDeleteAgent(agent.uid || agent.id, agent.name)}
                        className="p-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 select-none active:scale-95"
                        title={`Delete agent ${agent.name}`}
                        id={`delete-agent-${agent.uid || agent.id}`}
                      >
                        <Trash2 size={10} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Team Stats */}
                <div className="grid grid-cols-3 gap-2 bg-neutral-50 p-2.5 rounded-2xl text-center">
                  <div>
                    <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-0.5">Total</span>
                    <span className="font-extrabold text-sm text-neutral-800">{metrics.total}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-0.5">Active</span>
                    <span className="font-extrabold text-sm text-neutral-800">{metrics.active}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest block mb-0.5">Closed</span>
                    <span className="font-extrabold text-sm text-emerald-600">{metrics.closed}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {agents.length === 0 && (
            <div className="text-center py-12 text-neutral-400 font-semibold bg-white border border-dashed rounded-[2rem]">
              No active agent profiles registered.
            </div>
          )}
        </div>
      </section>

      {/* System Administration Drawer (Links / Generation) */}
      <section className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 ml-1">Settings &amp; Tools</h3>

        <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 space-y-4 shadow-sm">
          {/* Public Capture Form Link tool */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2">Customer Lead Capture Link</label>
            <div className="flex items-center gap-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 shadow-inner">
              <span className="text-xs font-semibold text-neutral-400 truncate flex-1 block px-1">{publicLink}</span>
              <button
                onClick={copyToClipboard}
                className="p-2 bg-white rounded-lg shadow-sm border border-neutral-100 text-emerald-500 active:scale-90 transition-all shrink-0 cursor-pointer"
                title="Copy public inquiry link"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <a 
                href="/public-form" 
                target="_blank" 
                className="p-2 bg-white rounded-lg shadow-sm border border-neutral-100 text-neutral-400 active:scale-90 transition-all shrink-0"
              >
                <ExternalLink size={14} />
              </a>
            </div>
            <p className="mt-2 text-[9px] leading-snug text-neutral-400 font-medium ml-0.5">
              Customers filling out this form will have their inquiries automatically created and tagged inside the lead portfolio.
            </p>
          </div>

          <hr className="border-neutral-50" />

          {/* Google Sheets Webhook configuration tool */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-[#10B981] mb-2">Google Sheets Sync Webhook URL</label>
            <form onSubmit={handleSaveSheetUrl} className="space-y-2">
              <div className="flex items-center gap-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 shadow-inner">
                <input
                  type="url"
                  placeholder="e.g. https://script.google.com/macros/s/.../exec"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  className="text-xs font-semibold text-neutral-700 bg-transparent border-none outline-none flex-1 block px-1 w-full font-mono"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={savingSheetUrl}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-100"
              >
                {savingSheetUrl ? "Saving Config..." : "Save Sheets Config"}
              </button>
            </form>
            <p className="mt-2 text-[9px] leading-snug text-neutral-400 font-medium ml-0.5">
              Supply your Google Apps Script Web App execution execution URL to auto-post captured leads directly to Google Sheets.
            </p>

            {/* Expandable Apps Script Setup Guide */}
            <div className="mt-4 border border-neutral-100 rounded-2xl p-3 bg-neutral-50/50">
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="w-full flex items-center justify-between text-xs font-black text-neutral-600 uppercase tracking-wider outline-none"
              >
                <span>📋 Step-by-Step Sync Guide</span>
                <span className="text-[10px] text-emerald-500 font-extrabold">{showGuide ? "Hide" : "Show Setup Guide"}</span>
              </button>
              
              {showGuide && (
                <div className="mt-3 text-xs space-y-3 font-medium text-neutral-500 border-t border-neutral-100 pt-3">
                  <p>1. Open your <strong className="text-neutral-700">Google Sheet</strong>.</p>
                  <p>2. Select <strong className="text-neutral-700">Extensions &gt; Apps Script</strong> from top menu.</p>
                  <p>3. Delete any default code and paste the script below:</p>
                  
                  <div className="relative mt-2">
                    <pre className="p-3 bg-neutral-900 text-white rounded-xl text-[9px] overflow-x-auto max-h-48 font-mono leading-relaxed whitespace-pre select-all">
                      {appsScriptCode}
                    </pre>
                    <button
                      type="button"
                      onClick={copyScript}
                      className="absolute top-2 right-2 px-2.5 py-1 text-[9px] font-extrabold bg-emerald-500 text-white rounded hover:bg-emerald-600 shadow-sm transition-all"
                    >
                      {scriptCopied ? "Copied! ✓" : "Copy Code"}
                    </button>
                  </div>
                  
                  <p>4. Tap <strong className="text-neutral-700">Deploy &gt; New Deployment</strong>.</p>
                  <p>5. Choose Type: <strong className="text-neutral-700">Web App</strong>.</p>
                  <p>6. Execute as: <strong className="text-neutral-700">Me (your email)</strong>.</p>
                  <p>7. Who has access: <strong className="text-neutral-700">Anyone</strong> (essential for API delivery).</p>
                  <p>8. Click Deploy, authorize permissions, and <strong className="text-neutral-700">copy the Web App URL</strong>.</p>
                  <p>9. Paste that Web App URL above, hit "Save Sheets Config", and your pipeline will sync on every lead insertion!</p>
                </div>
              )}
            </div>
          </div>

          <hr className="border-neutral-50" />

          {/* Seed demo data */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2">Workspace Pipeline Seeder</label>
            <button
              onClick={seedDemoData}
              disabled={seeding}
              className="w-full flex items-center justify-center gap-2.5 py-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-extrabold text-xs uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50"
            >
              {seeding ? (
                <>
                  <CircleDot className="animate-spin" size={14} /> Seeding...
                </>
              ) : (
                <>
                  <Database size={14} /> Seed 6 Demo Leads
                </>
              )}
            </button>
            <p className="mt-2 text-[9px] leading-snug text-neutral-400 font-medium ml-0.5">
              Seeds real leads with realistic locations, phone numbers, and statuses for UI testing.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-12 text-center text-[10px] uppercase font-bold tracking-[0.3em] text-neutral-300">
        LeadPilot System v1.1.0
      </div>
    </div>
  );
}
