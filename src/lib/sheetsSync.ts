import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

interface SyncLeadData {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  property?: string;
  project?: string;
  propertyType?: string;
  budget?: string;
  location?: string;
  source?: string;
  followUpDate?: string;
  assignedTo?: string;
  assignedToName?: string;
  status?: string;
  notes?: string;
  createdAt?: string;
  clientId?: string;
}

export async function syncLeadToGoogleSheets(lead: SyncLeadData) {
  try {
    // 1. Fetch sheetUrl from clients config doc, or client-specific tenant
    let sheetUrl = "";
    if (lead.clientId && lead.clientId !== "main_config") {
      const clientDocRef = doc(db, "clients", lead.clientId);
      const clientSnap = await getDoc(clientDocRef);
      if (clientSnap.exists()) {
        sheetUrl = clientSnap.data()?.sheetUrl || "";
      }
    }

    if (!sheetUrl) {
      const docRef = doc(db, "clients", "main_config");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        sheetUrl = snap.data()?.sheetUrl || "";
      }
    }

    if (!sheetUrl) {
      console.warn("Google Sheets Sync URL is not configured.");
      return;
    }

    // 2. Build a full payload covering both scripts
    const resolvedName = lead.name || `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "New Lead";
    const resolvedFirstName = lead.firstName || resolvedName.split(" ")[0] || "New";
    const resolvedLastName = lead.lastName || resolvedName.split(" ").slice(1).join(" ") || "";
    const resolvedPhone = lead.phone || "";
    
    const payload = {
      // Keys matching their custom Apps Script
      id: lead.id || "",
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      phone: resolvedPhone,
      whatsapp: lead.whatsapp || resolvedPhone,
      email: lead.email || "",
      property: lead.project || lead.property || lead.propertyType || "",
      budget: lead.budget || "",
      location: lead.location || "",
      source: lead.source || "Manual Entry",
      followUpDate: lead.followUpDate || new Date().toISOString().split("T")[0],
      assignedTo: lead.assignedToName || lead.assignedTo || "Unassigned Agent",
      status: lead.status || "New Inquiry",
      notes: lead.notes || "",

      // Keys matching our default Apps Script for backwards compatibility
      name: resolvedName,
      agent: lead.assignedToName || lead.assignedTo || "Unassigned Agent",
      project: lead.project || lead.property || lead.propertyType || "Not specified",
      propertyType: lead.project || lead.property || lead.propertyType || "Not specified",
      createdAt: lead.createdAt || new Date().toISOString()
    };

    console.log("Triggering client-side Google Sheets Sync to:", sheetUrl);
    
    // Direct Client-Side Post to GAS!
    // We use "text/plain" and mode "no-cors" to completely bypass CORS preflight checks.
    // This allows successful delivery to Apps Script without CORS errors.
    await fetch(sheetUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain"
      },
      body: JSON.stringify(payload)
    });

    console.log("Client-side sync request posted successfully");

    // Also trigger backend proxy in parallel as an optional fallback
    try {
      await fetch("/api/sheets-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      // Backend proxy may fail on static Vercel hosts, which is fully expected and fine.
    }

  } catch (error) {
    console.error("Failed to perform Google Sheets sync:", error);
  }
}
