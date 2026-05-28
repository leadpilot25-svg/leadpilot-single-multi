import React, { useState } from "react";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useFirebase } from "../contexts/FirebaseProvider";
import Modal from "./Modal";
import { MessageSquare, Calendar, Clock, Activity, Send } from "lucide-react";

interface AfterCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
}

export default function AfterCallModal({ isOpen, onClose, lead }: AfterCallModalProps) {
  const { user } = useFirebase();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState(lead?.status || "contacted");
  const [location, setLocation] = useState(lead?.location || "");
  const [propertyType, setPropertyType] = useState(lead?.propertyType || "");
  const [nextAction, setNextAction] = useState({
    type: "followup",
    date: new Date().toISOString().split('T')[0],
    time: "10:00"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lead) return;
    setLoading(true);

    try {
      const leadRef = doc(db, "leads", lead.id);
      
      // Update lead with new notes and next follow-up date
      await updateDoc(leadRef, {
        notes: notes.trim() ? (lead.notes ? `${lead.notes}\n---\n${notes}` : notes) : lead.notes,
        followUpDate: nextAction.date,
        followUpTime: nextAction.time,
        status: status,
        location: location,
        propertyType: propertyType
      });

      // Log activity
      await addDoc(collection(db, "activities"), {
        leadId: lead.id,
        type: nextAction.type,
        date: nextAction.date,
        time: nextAction.time,
        status: "pending",
        notes: notes,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      onClose();
    } catch (error) {
      console.error("Error updating after call:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update After Call">
      <form onSubmit={handleSubmit} className="space-y-6 pb-8 font-sans">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Call Notes</label>
            <div className="flex bg-neutral-50 p-4 rounded-2xl border border-neutral-100 min-h-[120px]">
              <MessageSquare size={18} className="text-neutral-300 mr-3 mt-1 flex-shrink-0" />
              <textarea
                placeholder="What did the client say?"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-sm font-semibold text-neutral-800 placeholder-neutral-300 resize-none h-full"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Update Status</label>
              <select
                value={status}
                onChange={e => {
                  const val = e.target.value;
                  setStatus(val);
                  if (["site_visit", "site_visit_postponed", "booked", "closed", "inactive", "meeting"].includes(val)) {
                    setNextAction(prev => ({ ...prev, type: val }));
                  }
                }}
                className="w-full bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-100 text-sm font-semibold text-neutral-800 outline-none"
              >
                <option value="new">New Inquiry</option>
                <option value="contacted">Contacted</option>
                <option value="meeting">Meeting</option>
                <option value="site_visit">Site Visit Scheduled</option>
                <option value="site_visit_postponed">Site Visit Postponed</option>
                <option value="booked">Booked</option>
                <option value="closed">Closed Deal</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Property Interest</label>
              <input
                type="text"
                value={propertyType}
                onChange={e => setPropertyType(e.target.value)}
                placeholder="2BHK, Villa, etc"
                className="w-full bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-100 text-sm font-semibold text-neutral-800 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Update Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Client's location/preference"
              className="w-full bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-100 text-sm font-semibold text-neutral-800 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Schedule Next Action</label>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-3 bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-100">
                <Activity size={18} className="text-neutral-400" />
                <select
                  value={nextAction.type}
                  onChange={e => {
                    const val = e.target.value;
                    setNextAction({...nextAction, type: val});
                    if (["site_visit", "site_visit_postponed", "booked", "closed", "inactive", "meeting"].includes(val)) {
                      setStatus(val);
                    }
                  }}
                  className="bg-transparent border-none outline-none text-sm font-semibold text-neutral-800 w-full"
                >
                  <option value="followup">Follow-up Call</option>
                  <option value="meeting">Meeting</option>
                  <option value="site_visit">Site Visit Scheduled</option>
                  <option value="site_visit_postponed">Site Visit Postponed</option>
                  <option value="booked">Booked</option>
                  <option value="callback">Callback</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-100">
                  <Calendar size={18} className="text-neutral-400" />
                  <input
                    type="date"
                    value={nextAction.date}
                    onChange={e => setNextAction({...nextAction, date: e.target.value})}
                    className="bg-transparent border-none outline-none text-sm font-semibold text-neutral-800 w-full"
                  />
                </div>
                <div className="flex items-center gap-3 bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-100">
                  <Clock size={18} className="text-neutral-400" />
                  <input
                    type="time"
                    value={nextAction.time}
                    onChange={e => setNextAction({...nextAction, time: e.target.value})}
                    className="bg-transparent border-none outline-none text-sm font-semibold text-neutral-800 w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
        >
          {loading ? "Saving..." : (
            <>
              Confirm Action <Send size={18} />
            </>
          )}
        </button>
      </form>
    </Modal>
  );
}
