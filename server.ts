
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin
// Note: In this environment, we might need to rely on environment variables 
// or the provided config. For now, we'll try to initialize with the project ID.
import firebaseConfig from "./firebase-applet-config.json";

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId
  });
}

const db = getFirestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Google Sheets Sync
  app.post("/api/sheets-sync", async (req, res) => {
    try {
      // Normalize incoming payload from any source (Public form, dashboard modal, or new lead page)
      const raw = req.body || {};
      
      let firstName = raw.firstName || "";
      let lastName = raw.lastName || "";
      let name = raw.name || "";
      if (!name && (firstName || lastName)) {
        name = `${firstName} ${lastName}`.trim();
      } else if (name && !firstName) {
        const parts = name.split(" ");
        firstName = parts[0] || "";
        lastName = parts.slice(1).join(" ") || "";
      }

      let email = raw.email || "";
      let phone = raw.phone || "";
      let notes = raw.notes || "";
      let followUpDate = raw.followUpDate || "";
      let followUpTime = raw.followUpTime || "10:00";
      let createdAt = raw.createdAt || new Date().toISOString();

      // Get nice status label
      let status = raw.status || "new";
      const statusLabels: Record<string, string> = {
        new: "New Inquiry",
        contacted: "Contacted",
        site_visit: "Site Visit Scheduled",
        site_visit_postponed: "Site Visit Postponed",
        booked: "Booked",
        inactive: "Inactive",
        closed: "Closed Deal"
      };
      if (statusLabels[status.toLowerCase()]) {
        status = statusLabels[status.toLowerCase()];
      }

      // Resolve Agent Name
      let agent = raw.agent || "Unassigned Agent";
      if (!raw.agent && raw.assignedTo) {
        try {
          const userSnap = await db.collection("users").doc(raw.assignedTo).get();
          if (userSnap.exists) {
            agent = userSnap.data()?.name || "Unassigned Agent";
          }
        } catch (err) {
          console.warn("Failed to fetch assigned user for sheet-sync:", err);
        }
      }

      const normalizedPayload = {
        name,
        firstName,
        lastName,
        phone,
        email,
        status,
        agent,
        followUpDate,
        followUpTime,
        notes,
        createdAt
      };
      
      // 1. Fetch sheetUrl from clients collection
      const clientSnap = await db.collection("clients").doc("main_config").get();
      let sheetUrl = "";
      
      if (clientSnap.exists) {
        sheetUrl = clientSnap.data()?.sheetUrl || "";
      } else {
        // Fallback or check if there's any doc with sheetUrl
        const clientsQuery = await db.collection("clients").limit(1).get();
        if (!clientsQuery.empty) {
          sheetUrl = clientsQuery.docs[0].data()?.sheetUrl || "";
        }
      }

      if (!sheetUrl) {
        console.warn("No sheetUrl found in clients collection");
        return res.json({ success: true, message: "No sheetUrl configured, but lead saved to DB" });
      }

      console.log("Syncing lead to Google Apps Script at URL:", sheetUrl);
      console.log("Payload:", normalizedPayload);

      // 2. Send to Google Apps Script
      try {
        let response = await fetch(sheetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(normalizedPayload),
          redirect: "manual" // manually handle redirects to avoid undici 302 POST redirect issues
        });

        // 3. Handle 301/302 redirects by following them manually with a GET request
        if (response.status === 302 || response.status === 301 || response.status === 307 || response.status === 308) {
          const redirectUrl = response.headers.get("location");
          if (redirectUrl) {
            console.log("Following Apps Script redirect manually to:", redirectUrl);
            const redirectResponse = await fetch(redirectUrl, {
              method: "GET",
              headers: {
                "Accept": "application/json"
              }
            });
            const result = await redirectResponse.text();
            console.log("Sheets Sync Final Redirect Response:", result);
          }
        } else {
          const result = await response.text();
          console.log("Sheets Sync Direct Response:", result);
        }
      } catch (e) {
        console.error("Fetch to sheets GAS failed:", e);
      }

      return res.json({ success: true, message: "Sync attempt completed" });
    } catch (error) {
      console.error("Sheet Sync Error:", error);
      // Always return valid JSON even on error
      return res.json({ success: true, error: "Sync failed but lead saved" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    // Copy PWA Icons from the generated asset
    try {
      const srcIcon = path.join(process.cwd(), "src", "assets", "images", "pwa_icon_1779416129503.png");
      if (fs.existsSync(srcIcon)) {
        const publicDir = path.join(process.cwd(), "public");
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        fs.copyFileSync(srcIcon, path.join(publicDir, "icon-192.png"));
        fs.copyFileSync(srcIcon, path.join(publicDir, "icon-512.png"));
        console.log("Successfully copied PWA icons to public folder!");
      }
    } catch (err) {
      console.warn("Could not copy PWA icons:", err);
    }
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
