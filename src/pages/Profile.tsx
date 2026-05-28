import { useFirebase } from "../contexts/FirebaseProvider";
import { auth, db } from "../lib/firebase";
import { LogOut, Copy, Check, ExternalLink, Database, Sparkles, Bell, BellOff } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { APP_MODE } from "../config";

export default function Profile() {
  const { user, role, plan, remindersEnabled, setRemindersEnabled } = useFirebase();
  const [copied, setCopied] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const publicLink = `${window.location.origin}/public-form`;

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
        { firstName: "Rahul", lastName: "Sharma", phone: "9876543210", propertyType: "3BHK Apartment", budget: "1.2 Cr", location: "Andheri West", followUpDate: tStr, status: "active", source: "Facebook" },
        { firstName: "Priya", lastName: "Patel", phone: "9123456789", propertyType: "Luxury Villa", budget: "4.5 Cr", location: "Bandra", followUpDate: tStr, status: "visit", source: "Walk-in" },
        { firstName: "Amit", lastName: "Verma", phone: "9988776655", propertyType: "Commercial Space", budget: "85 L", location: "Thane", followUpDate: tStr, status: "meeting", source: "Call" },
        { firstName: "Sneha", lastName: "Reddy", phone: "9345678901", propertyType: "Plot", budget: "2.1 Cr", location: "Navi Mumbai", followUpDate: yStr, status: "followup", source: "Instagram" },
        { firstName: "Vikram", lastName: "Singh", phone: "9001122334", propertyType: "2BHK Flat", budget: "65 L", location: "Goregaon", followUpDate: yStr, status: "contacted", source: "Reference" },
        { firstName: "Anjali", lastName: "Gupta", phone: "9554433221", propertyType: "Studio", budget: "44 L", location: "Worli", followUpDate: tmStr, status: "active", source: "Facebook" },
        { firstName: "Karan", lastName: "Johar", phone: "9667788990", propertyType: "Penthouse", budget: "12 Cr", location: "Juhu", followUpDate: tmStr, status: "meeting", source: "Walk-in" }
      ];

      for (const lead of demoLeads) {
        await addDoc(collection(db, "leads"), {
          ...lead,
          email: `${lead.firstName.toLowerCase()}@example.com`,
          whatsapp: lead.phone,
          followUpTime: "11:00",
          assignedTo: user.uid,
          userId: user.uid,
          notes: "Auto-generated demo lead.",
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });
      }
      alert("Demo data seeded successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to seed data.");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="p-6">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900">Settings</h2>
      </header>

      <div className="bg-white rounded-[2rem] p-8 border border-neutral-100 shadow-sm mb-8 text-center">
        <div className="w-20 h-20 bg-neutral-50 text-neutral-400 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-neutral-100 uppercase text-2xl font-black">
          {user?.displayName?.[0] || user?.email?.[0]}
        </div>
        <h3 className="text-xl font-bold text-neutral-900">{(user?.displayName || "User").replace(/\bLead\s+Pilot\b/gi, "LeadPilot")}</h3>
        {APP_MODE !== "single" && <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500 mt-1">{role}</p>}
      </div>

      <div className="space-y-4">
        <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">Notifications</label>
          <div 
            onClick={() => setRemindersEnabled(!remindersEnabled)}
            className="flex items-center justify-between bg-neutral-50 p-4 rounded-2xl border border-neutral-100 cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${remindersEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-400'}`}>
                {remindersEnabled ? <Bell size={18} /> : <BellOff size={18} />}
              </div>
              <span className="font-bold text-neutral-700 text-sm">Follow-up Reminders</span>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors relative ${remindersEnabled ? 'bg-emerald-500' : 'bg-neutral-200'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${remindersEnabled ? 'left-7' : 'left-1'}`} />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">Pricing Plan</label>
          <div className="flex items-center justify-between bg-neutral-50 px-5 py-4 rounded-2xl border border-neutral-100">
            <span className="font-bold text-neutral-700 text-sm">Account Type</span>
            <span className="text-xs font-black uppercase text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">
              {plan === "single" ? "Plan: Single" : "Plan: Team"}
            </span>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-neutral-400 font-medium select-none">
            {plan === "single"
              ? "Solo Plan active: This platform is authorized for 1 main user. Team management, agent rosters, and assignment controls are dynamically deactivated."
              : "Team Plan active: Multi-agent routing, roster management, and lead assignments are active for team collaboration."}
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
          <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400 mb-4">Lead Capture Form</label>
          <div className="flex items-center gap-3 bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-medium text-neutral-400 truncate">{publicLink}</p>
            </div>
            <button
              onClick={copyToClipboard}
              className="p-2.5 bg-white rounded-xl shadow-sm border border-neutral-100 text-emerald-500 active:scale-95 transition-all"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
            <a 
              href="/public-form" 
              target="_blank" 
              className="p-2.5 bg-white rounded-xl shadow-sm border border-neutral-100 text-neutral-400 active:scale-95 transition-all"
            >
              <ExternalLink size={18} />
            </a>
          </div>
          <p className="mt-4 text-[10px] leading-relaxed text-neutral-400 font-medium">
            Share this link to capture leads directly into LeadPilot.
          </p>
        </div>

        <button
          onClick={seedDemoData}
          disabled={seeding}
          className="w-full flex items-center justify-center gap-3 py-5 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-600 font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50"
        >
          {seeding ? <Sparkles size={20} className="animate-spin" /> : <Database size={20} />}
          {seeding ? "Seeding..." : "Seed Demo Data"}
        </button>

        <button
          onClick={() => auth.signOut()}
          className="w-full flex items-center justify-center gap-3 py-5 bg-white border border-neutral-100 rounded-3xl text-rose-500 font-bold hover:bg-rose-50 transition-colors"
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>

      <div className="mt-12 text-center text-[10px] uppercase font-bold tracking-[0.3em] text-neutral-300">
        LeadPilot v1.0.0
      </div>
    </div>
  );
}
