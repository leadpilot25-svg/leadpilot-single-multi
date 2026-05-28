import React, { useState } from "react";
import { addDoc, collection, serverTimestamp, getDocs, limit, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { APP_MODE } from "../config";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, Send, User, Phone, MapPin, DollarSign, Home } from "lucide-react";
import { syncLeadToGoogleSheets } from "../lib/sheetsSync";

export default function PublicLeadForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    project: "",
    budget: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const todayString = new Date().toISOString().split("T")[0];
      const parts = form.name.trim().split(" ");
      const firstName = parts[0] || "New";
      const lastName = parts.slice(1).join(" ") || "";

      let assignedTo = "";
      let userId = "";
      let agentName = "Unassigned Agent";
      let fallbackClientId = "";

      try {
        const userSnap = await getDocs(query(collection(db, "users"), limit(1)));
        if (!userSnap.empty) {
          const soleUser = userSnap.docs[0];
          const userData = soleUser.data();
          fallbackClientId = userData?.clientId || "";
          
          if (APP_MODE === "single") {
            assignedTo = soleUser.id;
            userId = soleUser.id;
            agentName = userData?.name || userData?.displayName || "Solo Agent";
          }
        }
      } catch (e) {
        console.error("Error auto-fetching active users for public lead assignment:", e);
      }

      const queryParams = new URLSearchParams(window.location.search);
      const urlClientId = queryParams.get("clientId") || queryParams.get("client") || "";

      const leadData = {
        firstName,
        lastName,
        phone: form.phone,
        propertyType: form.project || "Not specified", // keep propertyType mapping
        project: form.project || "Not specified",       // explicit project field
        budget: form.budget || "",
        source: "Public Form",
        followUpDate: todayString,
        followUpTime: "10:00",
        assignedTo, // Auto-assign to sole user in single mode
        userId,     // Set lead owner ID for single mode
        clientId: urlClientId || fallbackClientId, // Router tag for SaaS tenancy with robust workspace fallback
        status: "new", // "New Inquiry"
        notes: "Lead captured automatically via customer-facing Public Form",
        createdAt: new Date(),
      };

      // 1. Save to Firestore
      const docRef = await addDoc(collection(db, "leads"), {
        ...leadData,
        createdAt: serverTimestamp() // safe atomic timestamp
      });

      // 2. Push to Google Sheet
      try {
        await syncLeadToGoogleSheets({
          id: docRef.id,
          firstName,
          lastName,
          phone: form.phone,
          project: form.project,
          budget: form.budget,
          source: "Public Form",
          followUpDate: todayString,
          assignedToName: agentName,
          assignedTo,
          clientId: urlClientId || fallbackClientId,
          status: "New Inquiry",
          notes: "Lead captured automatically via customer-facing Public Form",
          createdAt: todayString
        });
      } catch (sheetErr) {
        console.warn("Sheet sync failed but data was saved locally:", sheetErr);
      }

      setSubmitted(true);
    } catch (error) {
      console.error("Submission failed:", error);
      alert("Failed to submit inquiry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-8 bg-emerald-500 text-white text-center font-sans">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <CheckCircle className="w-24 h-24 mx-auto mb-6 text-white bg-white/20 p-4 rounded-full border-4 border-white/40" />
          <h2 className="text-3xl font-black mb-2 text-white tracking-tight">Inquiry Received!</h2>
          <p className="text-emerald-100 opacity-90 max-w-sm mx-auto leading-relaxed text-sm font-semibold">
            Thank you! Your property inquiry has been catalogued. An real estate agent will reach out to you via call or WhatsApp shortly.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12 flex flex-col items-center font-sans">
      <div className="w-full max-w-md">
        <header className="text-center mb-10">
          <div className="w-16 h-16 bg-white border border-neutral-100 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Home className="text-emerald-500" size={28} />
          </div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight">Express Interest</h1>
          <p className="text-neutral-400 font-semibold text-sm mt-1">Get in touch with an agent regarding property options.</p>
        </header>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-xl shadow-slate-100 space-y-5">
          <InputGroup 
            icon={User} 
            placeholder="Full Name" 
            value={form.name} 
            onChange={(v) => setForm({ ...form, name: v })} 
            required 
            label="Name *"
          />
          
          <InputGroup 
            icon={Phone} 
            placeholder="e.g. +1 555-0155" 
            value={form.phone} 
            onChange={(v) => setForm({ ...form, phone: v })} 
            required 
            type="tel" 
            label="Phone Number *"
          />

          <div className="grid grid-cols-1 gap-5">
            <InputGroup 
              icon={Home} 
              placeholder="e.g. Horizon Heights" 
              value={form.project} 
              onChange={(v) => setForm({ ...form, project: v })} 
              label="Interested Project (Optional)"
            />

            <InputGroup 
              icon={DollarSign} 
              placeholder="e.g. $450,000 or 1.5 Cr" 
              value={form.budget} 
              onChange={(v) => setForm({ ...form, budget: v })} 
              label="Approx. Budget (Optional)"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 font-black py-4.5 rounded-2xl text-white shadow-lg shadow-emerald-100 flex items-center justify-center gap-3 transition-all disabled:opacity-50 active:scale-[0.98] mt-8 uppercase tracking-[0.15em] text-xs"
          >
            {loading ? "Submitting Request..." : (
              <>
                Request Call <Send size={15} />
              </>
            )}
          </button>
        </form>

        <p className="mt-12 text-[10px] uppercase tracking-widest text-neutral-400 font-bold text-center">
          LeadPilot Verified Form • SSL Encrypted
        </p>
      </div>
    </div>
  );
}

function InputGroup({ icon: Icon, placeholder, value, onChange, required, type = "text", label }: any) {
  return (
    <div className="space-y-1.5 text-left">
      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="bg-neutral-50 p-1.5 rounded-2xl border border-neutral-100 focus-within:border-emerald-500 focus-within:bg-white transition-all flex items-center gap-3 shadow-inner">
        <div className="p-2.5 bg-white rounded-xl text-neutral-400">
          <Icon size={18} />
        </div>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="flex-1 bg-transparent border-none outline-none font-bold text-neutral-800 placeholder-neutral-300 text-sm py-2"
        />
      </div>
    </div>
  );
}
