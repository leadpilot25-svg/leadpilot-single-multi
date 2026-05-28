import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, collection, getDocs, onSnapshot, deleteDoc, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useFirebase } from "../contexts/FirebaseProvider";
import { motion, AnimatePresence } from "motion/react";
import { Phone, MessageCircle, Mail, Calendar, ArrowLeft, CheckCircle2, UserCircle, MapPin, Tag, Smartphone, MessageSquare, ChevronDown, Trash2, Building2 } from "lucide-react";
import { format } from "date-fns";
import AfterCallModal from "../components/AfterCallModal";
import Modal from "../components/Modal";
import { AgentSelect } from "../components/AgentSelect";

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role, plan, clientId } = useFirebase();
  const [lead, setLead] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAfterCallOpen, setIsAfterCallOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, "leads", id), (snap) => {
      if (snap.exists()) {
        setLead({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });

    const fetchAgents = async () => {
      if (role === "super_admin") {
        const snap = await getDocs(collection(db, "users"));
        setAgents(snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, uid: data.uid || d.id, ...data as any };
        }));
      } else if ((role === "client" || role === "admin") && clientId) {
        const snap = await getDocs(query(collection(db, "users"), where("clientId", "==", clientId)));
        setAgents(snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, uid: data.uid || d.id, ...data as any };
        }));
      }
    };

    const fetchClients = async () => {
      try {
        const snap = await getDocs(collection(db, "clients"));
        setClients(snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.id !== "main_config")
        );
      } catch (err) {
        console.error("Error fetching clients:", err);
      }
    };

    fetchAgents();
    fetchClients();
    return unsubscribe;
  }, [id, role, clientId]);

  const updateStatus = async (newStatus: string) => {
    if (!id) return;
    await updateDoc(doc(db, "leads", id), { status: newStatus });
    setIsStatusModalOpen(false);
  };

  const assignAgent = async (agentId: string) => {
    if (!id) return;
    await updateDoc(doc(db, "leads", id), { assignedTo: agentId });
  };

  const assignClient = async (clientId: string) => {
    if (!id) return;
    await updateDoc(doc(db, "leads", id), { clientId });
  };

  const handleDeleteLead = async () => {
    if (!lead) return;
    if (!window.confirm(`Are you sure you want to delete lead "${lead.firstName || ""} ${lead.lastName || ""}"? This action is permanent.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, "leads", lead.id));
      alert("Lead deleted successfully!");
      navigate("/leads");
    } catch (err) {
      console.error("Error deleting lead:", err);
      alert("Failed to delete lead. Check permissions.");
    }
  };

  if (loading) return <div className="p-10 text-center font-sans">Loading...</div>;
  if (!lead) return <div className="p-10 text-center font-sans">Lead not found</div>;

  const isOverdue = lead?.followUpDate ? (new Date(lead.followUpDate) < new Date() && lead.status !== "closed" && lead.status !== "lost") : false;

  const statusOptions = [
    { label: "New Inquiry", value: "new" },
    { label: "Contacted", value: "contacted" },
    { label: "Site Visit Scheduled", value: "site_visit" },
    { label: "Site Visit Postponed", value: "site_visit_postponed" },
    { label: "Booked", value: "booked" },
    { label: "Closed", value: "closed" },
    { label: "Inactive", value: "inactive" },
  ];

  return (
    <div className="p-6 pb-24 font-sans max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-xl transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold text-neutral-900">Lead Profile</h2>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-xl shadow-neutral-100 mb-8 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-6">
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${
            lead.status === 'closed' ? 'bg-emerald-500 text-white' :
            lead.status === 'booked' ? 'bg-teal-500 text-white' :
            lead.status === 'inactive' ? 'bg-neutral-100 text-neutral-400' :
            ['site_visit', 'meeting', 'site_visit_postponed'].includes(lead.status) ? 'bg-orange-50 text-orange-600' :
            'bg-emerald-50 text-emerald-600'
          }`}>
            {lead.status === 'new' ? 'New Inquiry' : (lead.status || 'new').replace('_', ' ')}
          </span>
        </div>

        <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center text-4xl font-extrabold mx-auto mb-6 shadow-inner">
          {(lead.firstName || "?")[0]}
        </div>
        <h3 className="text-2xl font-black text-neutral-900 mb-1">{lead.firstName || "Unknown"} {lead.lastName || ""}</h3>
        <p className="text-neutral-400 font-bold mb-8 uppercase tracking-widest text-[10px]">{lead.propertyType || "N/A"} • {lead.budget || "N/A"}</p>

        <div className="grid grid-cols-4 gap-4">
          <ContactButton icon={Phone} color="bg-emerald-500" href={`tel:${lead.phone}`} />
          <ContactButton icon={MessageCircle} color="bg-green-400" href={`https://wa.me/${lead.phone}`} />
          <ContactButton icon={Smartphone} color="bg-blue-400" href={`sms:${lead.phone}`} />
          <ContactButton icon={Mail} color="bg-neutral-400" href={`mailto:${lead.email}`} />
        </div>
      </motion.div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 mb-6">
          <button 
            onClick={() => setIsAfterCallOpen(true)}
            className="w-full bg-neutral-900 text-white py-5 rounded-[2rem] font-bold flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] transition-all"
          >
            <MessageSquare size={18} />
            Update After Call
          </button>
          <button 
            onClick={() => setIsStatusModalOpen(true)}
            className="w-full bg-white border-2 border-emerald-500 text-emerald-500 py-5 rounded-[2rem] font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
          >
            <CheckCircle2 size={18} />
            Mark Done
          </button>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 space-y-6">
          <InfoRow 
            icon={Calendar} 
            label="Next Follow-up" 
            value={lead?.followUpDate && !isNaN(new Date(lead.followUpDate).getTime()) ? format(new Date(lead.followUpDate), "PPP") : "TBD"} 
            color={isOverdue ? "text-rose-500" : "text-emerald-500"} 
          />
          <InfoRow icon={MapPin} label="Location" value={lead.location || "Not specified"} />
          <InfoRow icon={Tag} label="Source" value={lead.source || "Organic"} />
          <InfoRow icon={UserCircle} label="Assigned Agent" value={agents.find(a => a.id === lead.assignedTo)?.name || "Not assigned"} />
          <InfoRow icon={Building2} label="Assigned Corporate Client" value={clients.find(c => c.id === lead.clientId)?.name || "Not assigned"} />
        </div>

        {(role === "admin" || role === "client" || role === "super_admin") && (
          <div className="space-y-4">
            <div className="bg-white p-8 rounded-[2rem] border border-neutral-100">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-4 ml-1">Reassign Agent</h4>
              <AgentSelect
                agents={agents}
                value={lead.assignedTo || ""}
                onChange={(agentId: string) => assignAgent(agentId)}
                includeUnassigned={true}
              />
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-neutral-100">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#10B981] mb-4 ml-1">Reassign Corporate Client</h4>
              <div className="relative">
                <select 
                  value={lead.clientId || ""} 
                  onChange={(e) => assignClient(e.target.value)}
                  className="w-full bg-neutral-50 border-none rounded-2xl p-4 font-bold outline-none text-neutral-700 appearance-none animate-none"
                >
                  <option value="">No Corporate / General Lead</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-8 rounded-[2rem] border border-neutral-100">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-4 ml-1">Notes Archive</h4>
          <p className="text-sm font-medium text-neutral-600 whitespace-pre-wrap leading-relaxed">
            {lead.notes || "No notes yet."}
          </p>
        </div>

        {role === "admin" && (
          <button
            onClick={handleDeleteLead}
            className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold hover:text-rose-700 py-5 rounded-[2rem] flex items-center justify-center gap-2.5 transition-all text-xs uppercase tracking-widest mt-6 cursor-pointer border-none outline-none"
          >
            <Trash2 size={16} /> Delete Lead Profile
          </button>
        )}
      </div>

      <AfterCallModal isOpen={isAfterCallOpen} onClose={() => setIsAfterCallOpen(false)} lead={lead} />
      
      <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} title="Select Lead Status">
        <div className="space-y-3 pb-8">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => updateStatus(opt.value)}
              className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-between px-6 ${
                lead.status === opt.value ? 'bg-emerald-500 text-white shadow-lg' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {opt.label}
              {lead.status === opt.value && <CheckCircle2 size={18} />}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function ContactButton({ icon: Icon, color, href }: any) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex flex-col items-center">
      <motion.div
        whileTap={{ scale: 0.9 }}
        className={`${color} text-white w-12 h-12 rounded-2xl shadow-lg flex items-center justify-center transition-transform`}
      >
        <Icon size={20} />
      </motion.div>
    </a>
  );
}

function InfoRow({ icon: Icon, label, value, color = "text-neutral-900" }: any) {
  return (
    <div className="flex items-start gap-4">
      <div className="p-3 bg-neutral-50 rounded-2xl text-neutral-300">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest mb-1">{label}</p>
        <p className={`font-bold text-sm ${color}`}>{value}</p>
      </div>
    </div>
  );
}
