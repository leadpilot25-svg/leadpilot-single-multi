import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useFirebase } from "../contexts/FirebaseProvider";
import Modal from "./Modal";
import { User, Phone, Home, DollarSign, Calendar, FileText, UserCheck, Send, MapPin, Building2 } from "lucide-react";
import { syncLeadToGoogleSheets } from "../lib/sheetsSync";
import { APP_MODE } from "../config";
import { AgentSelect } from "./AgentSelect";

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddLeadModal({ isOpen, onClose }: AddLeadModalProps) {
  const { user, role, plan, clientId } = useFirebase();
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    project: "",
    budget: "",
    location: "",
    notes: "",
    followUpDate: new Date().toISOString().split('T')[0],
    assignedTo: "",
    clientId: "",
  });

  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        assignedTo: plan === "single" ? user.uid : (prev.assignedTo || user.uid)
      }));
    }
  }, [user, plan]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [role, clientId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const parts = form.name.trim().split(" ");
      const firstName = parts[0] || "New";
      const lastName = parts.slice(1).join(" ") || "";

      const leadData = {
        firstName,
        lastName,
        phone: form.phone,
        propertyType: form.project || "Not specified", // keep backward compatibility
        project: form.project || "Not specified",       // explicit project field
        budget: form.budget || "",
        location: form.location || "",
        notes: form.notes || "",
        followUpDate: form.followUpDate || new Date().toISOString().split('T')[0],
        followUpTime: "10:00",
        source: "Manual Form",
        status: "new", // "New Inquiry"
        assignedTo: APP_MODE === "single" ? user.uid : (plan === "single" ? user.uid : (form.assignedTo || user.uid)),
        clientId: (role === "client" || role === "agent" || role === "admin") ? (clientId || "") : (form.clientId || ""),
        userId: user.uid,
        createdBy: user.uid,
        createdAt: new Date(), // use JS date for immediate client reading
      };

      // Add to Firestore
      const docRef = await addDoc(collection(db, "leads"), {
        ...leadData,
        createdAt: serverTimestamp() // override with server timestamp for safety
      });

      // Add activity
      await addDoc(collection(db, "activities"), {
        leadId: docRef.id,
        type: "followup",
        date: leadData.followUpDate,
        time: "10:00",
        status: "pending",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      // Sheet Sync Integration
      const assignedToId = APP_MODE === "single" ? user.uid : (plan === "single" ? user.uid : (form.assignedTo || user.uid));
      const assignedAgentObj = agents.find(a => a.id === assignedToId);
      const agentName = assignedAgentObj?.name || user.displayName || (APP_MODE === "single" ? "Personal Agent" : plan === "single" ? "Solo Agent" : "Admin");

      try {
        await syncLeadToGoogleSheets({
          id: docRef.id,
          firstName,
          lastName,
          phone: form.phone,
          email: "", // email is not standard in quick add form, but let's pass it for compatibility
          project: form.project,
          budget: form.budget,
          location: form.location,
          source: "Manual Form",
          followUpDate: leadData.followUpDate,
          assignedToName: agentName,
          assignedTo: assignedToId,
          clientId: (role === "client" || role === "agent" || role === "admin") ? (clientId || "") : (form.clientId || ""),
          status: "New Inquiry",
          notes: form.notes,
        });
        console.log("Successfully triggered Google Sheets sync.");
      } catch (sheetErr) {
        console.error("Error triggering sheets sync:", sheetErr);
      }

      // Reset Form and close
      setForm({
        name: "",
        phone: "",
        project: "",
        budget: "",
        location: "",
        notes: "",
        followUpDate: new Date().toISOString().split('T')[0],
        assignedTo: plan === "single" ? user.uid : user.uid,
        clientId: "",
      });
      onClose();
    } catch (error) {
      console.error("Error adding lead:", error);
      alert("Failed to save lead. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Lead">
      <form onSubmit={handleSubmit} className="space-y-4 pb-12 font-sans text-neutral-800">
        <p className="text-xs text-neutral-400 font-medium mb-4">Introduce a new prospective buyer or inquiry securely.</p>

        <InputGroup 
          label="Full Name *" 
          icon={User} 
          placeholder="e.g. Liam Johnson" 
          value={form.name} 
          onChange={v => setForm({...form, name: v})} 
          required 
        />

        <InputGroup 
          label="Phone Number *" 
          icon={Phone} 
          placeholder="e.g. +1 555-0199" 
          type="tel" 
          value={form.phone} 
          onChange={v => setForm({...form, phone: v})} 
          required 
        />

        <InputGroup 
          label="Project Name (Optional)" 
          icon={Home} 
          placeholder="e.g. Horizon Heights" 
          value={form.project} 
          onChange={v => setForm({...form, project: v})} 
        />
        <InputGroup 
          label="Approx. Budget (Optional)" 
          icon={DollarSign} 
          placeholder="e.g. $450k or 2 Cr" 
          value={form.budget} 
          onChange={v => setForm({...form, budget: v})} 
        />
        <InputGroup 
          label="Location (Optional)" 
          icon={MapPin} 
          placeholder="Area / City" 
          value={form.location} 
          onChange={v => setForm({...form, location: v})} 
        />

        <InputGroup 
          label="Next Follow-up Date" 
          icon={Calendar} 
          type="date" 
          value={form.followUpDate} 
          onChange={(v: any) => setForm({...form, followUpDate: v})} 
        />

        {(role === "admin" || role === "client" || role === "super_admin") && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">
              Assigned Agent
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
            onChange={(v: any) => setForm({...form, clientId: v})} 
          />
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
            <FileText size={12} /> Notes / Description
          </label>
          <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 focus-within:bg-white focus-within:border-emerald-500 transition-all">
            <textarea
              placeholder="Add key insights like preferred size, downpayment status, etc."
              value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full bg-transparent border-none outline-none font-medium text-sm text-neutral-700 min-h-[80px] placeholder-neutral-300 resize-none leading-relaxed"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-100 disabled:text-neutral-400 text-white font-extrabold py-5 rounded-[2rem] shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-6"
        >
          {loading ? "Saving Lead..." : (
            <>
              Create Lead &amp; Sync <Send size={18} />
            </>
          )}
        </button>
      </form>
    </Modal>
  );
}

function InputGroup({ label, icon: Icon, value, onChange, ...props }: any) {
  return (
    <div className="space-y-1.5">
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
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
