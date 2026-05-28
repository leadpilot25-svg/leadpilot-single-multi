import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { APP_MODE } from "../config";
import { useFirebase } from "../contexts/FirebaseProvider";
import { useNavigate } from "react-router-dom";
import { User, Phone, Mail, Home, DollarSign, MapPin, Tag, UserCheck, Send, ArrowLeft, Building2 } from "lucide-react";
import { syncLeadToGoogleSheets } from "../lib/sheetsSync";
import { AgentSelect } from "../components/AgentSelect";

export default function NewLead() {
  const { user, role, plan, clientId } = useFirebase();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    project: "",
    budget: "",
    location: "",
    source: "Manual Entry",
    assignedTo: user?.uid || "",
    clientId: "",
  });

  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        assignedTo: prev.assignedTo || user.uid
      }));
    }
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let snap;
        if (role === "super_admin") {
          snap = await getDocs(collection(db, "users"));
        } else if (clientId) {
          snap = await getDocs(query(collection(db, "users"), where("clientId", "==", clientId)));
        } else {
          snap = await getDocs(collection(db, "users"));
        }
        setAgents(snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, uid: data.uid || d.id, ...data };
        }));

        const clientSnap = await getDocs(collection(db, "clients"));
        setClients(clientSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.id !== "main_config")
        );
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };
    fetchData();
  }, [role, clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const parts = form.name.trim().split(" ");
      const firstName = parts[0] || "New";
      const lastName = parts.slice(1).join(" ") || "";
      const today = new Date().toISOString().split('T')[0];

        const leadData = {
          firstName,
          lastName,
          phone: form.phone,
          email: form.email || "",
          propertyType: form.project || "Not specified",
          project: form.project || "Not specified",
          budget: form.budget || "",
          location: form.location || "",
          source: form.source,
          notes: "Lead added manually from form page",
          followUpDate: today,
          followUpTime: "10:00",
          status: "new", // "New Inquiry"
          assignedTo: APP_MODE === "single" ? user.uid : (plan === "single" ? user.uid : (form.assignedTo || user.uid)),
          clientId: (role === "client" || role === "agent" || role === "admin") ? (clientId || "") : (form.clientId || ""),
          userId: user.uid,
          createdBy: user.uid,
          createdAt: new Date(),
        };

      // Save to Firebase Firestore
      const docRef = await addDoc(collection(db, "leads"), {
        ...leadData,
        createdAt: serverTimestamp()
      });

      // Log followup activity
      await addDoc(collection(db, "activities"), {
        leadId: docRef.id,
        type: "followup",
        date: today,
        time: "10:00",
        status: "pending",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      // Sync to sheets webhook on server
      const assignedToId = APP_MODE === "single" ? user.uid : (plan === "single" ? user.uid : (form.assignedTo || user.uid));
      const assignedAgentObj = agents.find(a => a.id === assignedToId);
      const agentName = assignedAgentObj?.name || user.displayName || (APP_MODE === "single" ? "Personal Agent" : plan === "single" ? "Solo Agent" : "Admin");

      try {
        await syncLeadToGoogleSheets({
          id: docRef.id,
          firstName,
          lastName,
          phone: form.phone,
          email: form.email || "",
          project: form.project,
          budget: form.budget,
          location: form.location,
          source: form.source,
          followUpDate: today,
          assignedToName: agentName,
          assignedTo: assignedToId,
          clientId: (role === "client" || role === "agent" || role === "admin") ? (clientId || "") : (form.clientId || ""),
          status: "New Inquiry",
          notes: "Lead added manually from form page",
          createdAt: today
        });
      } catch (e) {
        console.warn("Sheets sync fetch failed", e);
      }

      navigate("/leads");
    } catch (error) {
      console.error("Error adding lead:", error);
      alert("Failed to save lead. Please check network connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 pb-28 overflow-y-auto h-screen scrollbar-hide font-sans text-neutral-800">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold text-neutral-900">Add New Lead</h2>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <InputGroup 
          label="Full Name *" 
          icon={User} 
          placeholder="e.g. Liam Johnson" 
          value={form.name} 
          onChange={(v: string) => setForm({...form, name: v})} 
          required 
        />
        
        <InputGroup 
          label="Phone Number *" 
          icon={Phone} 
          placeholder="e.g. +1 555-0199" 
          type="tel" 
          value={form.phone} 
          onChange={(v: string) => setForm({...form, phone: v})} 
          required 
        />

        <InputGroup 
          label="Email Address (Optional)" 
          icon={Mail} 
          placeholder="john@example.com" 
          type="email" 
          value={form.email} 
          onChange={(v: string) => setForm({...form, email: v})} 
        />
        
        <InputGroup 
          label="Project Name (Optional)" 
          icon={Home} 
          placeholder="e.g. Horizon Heights" 
          value={form.project} 
          onChange={(v: string) => setForm({...form, project: v})} 
        />
        <InputGroup 
          label="Approx. Budget (Optional)" 
          icon={DollarSign} 
          placeholder="e.g. $450k or 2 Cr" 
          value={form.budget} 
          onChange={(v: string) => setForm({...form, budget: v})} 
        />

        <InputGroup 
          label="Location (Optional)" 
          icon={MapPin} 
          placeholder="Area / City" 
          value={form.location} 
          onChange={(v: string) => setForm({...form, location: v})} 
        />
        
        <SelectGroup 
          label="Source (Optional)" 
          icon={Tag} 
          options={["Manual Entry", "Call", "Facebook", "Instagram", "Reference"]} 
          value={form.source} 
          onChange={(v: string) => setForm({...form, source: v})} 
        />
        {(role === "admin" || role === "client" || role === "super_admin") && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
              Assign Agent (Optional)
            </label>
            <AgentSelect
              agents={agents}
              value={form.assignedTo}
              onChange={(v: string) => setForm({ ...form, assignedTo: v })}
              includeUnassigned={true}
            />
          </div>
        )}
        {APP_MODE !== "single" && role === "admin" && clients.length > 0 && (
          <SelectGroup 
            label="Assign Client Company (Optional)" 
            icon={Building2} 
            options={[
              { label: "None / General Lead", value: "" },
              ...clients.map(c => ({ label: c.name, value: c.id }))
            ]} 
            value={form.clientId} 
            onChange={(v: string) => setForm({...form, clientId: v})} 
          />
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-100 disabled:text-neutral-400 text-white font-extrabold py-5 rounded-[2rem] shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-6 cursor-pointer"
        >
          {loading ? "Adding..." : (
            <>
              Confirm & Save <Send size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function InputGroup({ label, icon: Icon, value, onChange, ...props }: any) {
  return (
    <div className="space-y-1.5 font-sans">
      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="flex items-center gap-3 bg-neutral-50 px-4 py-3.5 rounded-2xl border border-neutral-100 focus-within:bg-white focus-within:border-emerald-500 transition-all shadow-inner">
        <Icon size={16} className="text-neutral-400" />
        <input
          {...props}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-transparent border-none outline-none text-sm font-semibold text-neutral-800 w-full placeholder-neutral-300"
        />
      </div>
    </div>
  );
}

function SelectGroup({ label, icon: Icon, options, value, onChange }: any) {
  return (
    <div className="space-y-1.5 font-sans">
      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="flex items-center gap-3 bg-neutral-50 px-4 py-3.5 rounded-2xl border border-neutral-100 focus-within:bg-white focus-within:border-emerald-500 transition-all shadow-inner">
        <Icon size={16} className="text-neutral-400 shrink-0" />
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-transparent border-none outline-none text-sm font-semibold text-neutral-800 w-full appearance-none pr-4"
        >
          {options.map((opt: any) => (
            <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
              {typeof opt === 'string' ? opt : opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
