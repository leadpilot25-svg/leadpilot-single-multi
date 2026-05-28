import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDocFromServer, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

interface FirebaseContextType {
  user: User | null;
  role: "super_admin" | "admin" | "agent" | "client" | null;
  clientId: string | null;
  plan: "single" | "multi" | null;
  loading: boolean;
  remindersEnabled: boolean;
  setRemindersEnabled: (enabled: boolean) => void;
}

const FirebaseContext = createContext<FirebaseContextType>({ 
  user: null, 
  role: null, 
  clientId: null,
  plan: null,
  loading: true,
  remindersEnabled: true,
  setRemindersEnabled: () => {},
});

export const useFirebase = () => useContext(FirebaseContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"super_admin" | "admin" | "agent" | "client" | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [plan, setPlan] = useState<"single" | "multi" | null>(null);
  const [loading, setLoading] = useState(true);
  const [remindersEnabled, setRemindersEnabledState] = useState(() => {
    const saved = localStorage.getItem("remindersEnabled");
    return saved === null ? true : saved === "true";
  });

  const setRemindersEnabled = (enabled: boolean) => {
    setRemindersEnabledState(enabled);
    localStorage.setItem("remindersEnabled", String(enabled));
  };

  useEffect(() => {
    if (!auth) {
      console.warn("Firebase Auth instance not found. Authentication features will be disabled.");
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
        if (authUser) {
          try {
            const userEmailLower = authUser.email?.toLowerCase() || "";
            const isSuperAdminEmail = userEmailLower === "mail.nasiya@gmail.com";

            let determinedRole: "super_admin" | "admin" | "agent" | "client" | null = null;
            let determinedClientId: string | null = null;
            let determinedPlan: "single" | "multi" | null = null;
            let matchedPreRegisteredDocId: string | null = null;

            // 1. Get user from "users" collection using email (direct document lookup of lowercase-email is highly robust)
            let existingUserDocData: any = null;

            try {
              const emailDocRef = doc(db, "users", userEmailLower);
              const emailDocSnap = await getDoc(emailDocRef);
              if (emailDocSnap.exists()) {
                existingUserDocData = emailDocSnap.data();
                matchedPreRegisteredDocId = userEmailLower;
                console.log("Found direct pre-registered agent by lowercase email ID:", userEmailLower);
              }
            } catch (err) {
              console.warn("Direct lookup by lowercase email ID failed or not permitted:", err);
            }

            if (!existingUserDocData && authUser.email && authUser.email !== userEmailLower) {
              try {
                const exactEmailDocRef = doc(db, "users", authUser.email);
                const exactEmailDocSnap = await getDoc(exactEmailDocRef);
                if (exactEmailDocSnap.exists()) {
                  existingUserDocData = exactEmailDocSnap.data();
                  matchedPreRegisteredDocId = authUser.email;
                  console.log("Found direct pre-registered agent by exact email ID:", authUser.email);
                }
              } catch (err) {
                console.warn("Direct lookup by exact email ID failed:", err);
              }
            }

            // Fallback: Query collection by email field
            if (!existingUserDocData) {
              try {
                const usersRef = collection(db, "users");
                let userSnapshots = await getDocs(query(usersRef, where("email", "==", userEmailLower)));
                if (userSnapshots.empty && authUser.email && authUser.email !== userEmailLower) {
                  userSnapshots = await getDocs(query(usersRef, where("email", "==", authUser.email)));
                }

                if (!userSnapshots.empty) {
                  const matchedDoc = userSnapshots.docs[0];
                  existingUserDocData = matchedDoc.data();
                  matchedPreRegisteredDocId = matchedDoc.id;
                  console.log("Found agent via collection query matching email:", matchedDoc.id);
                }
              } catch (err) {
                console.warn("Collection users query lookup failed:", err);
              }
            }

            // Fallback direct uid lookup if no email record found yet
            if (!existingUserDocData) {
              try {
                const userDocRef = doc(db, "users", authUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                  existingUserDocData = userDocSnap.data();
                  matchedPreRegisteredDocId = authUser.uid;
                  console.log("Found existing user directly by UID doc ID:", authUser.uid);
                }
              } catch (err) {
                console.warn("Direct uid user lookup failed:", err);
              }
            }

            // 2. Identify Role & Client ID
            if (isSuperAdminEmail) {
              determinedRole = "super_admin";
              determinedClientId = null;
              determinedPlan = "multi";
            } else if (existingUserDocData) {
              // User has an existing record/placeholder in users
              determinedRole = existingUserDocData.role;
              determinedClientId = existingUserDocData.clientId || null;
            } else {
              // Not in users yet. Is their email listed as ownerEmail or clientEmail in the clients collection?
              try {
                const clientsRef = collection(db, "clients");
                let clientSnap = await getDocs(query(clientsRef, where("ownerEmail", "==", userEmailLower)));
                if (clientSnap.empty && authUser.email && authUser.email !== userEmailLower) {
                  clientSnap = await getDocs(query(clientsRef, where("ownerEmail", "==", authUser.email)));
                }

                if (clientSnap.empty) {
                  clientSnap = await getDocs(query(clientsRef, where("clientEmail", "==", userEmailLower)));
                  if (clientSnap.empty && authUser.email && authUser.email !== userEmailLower) {
                    clientSnap = await getDocs(query(clientsRef, where("clientEmail", "==", authUser.email)));
                  }
                }

                if (!clientSnap.empty) {
                  // Yes! Bootstrap them as client owner
                  determinedRole = "client";
                  determinedClientId = clientSnap.docs[0].id;
                  determinedPlan = clientSnap.docs[0].data()?.plan === "multi" ? "multi" : "single";
                }
              } catch (clientQueryErr) {
                console.error("Failed to query clients collection:", clientQueryErr);
              }
            }

            // Clean up empty, undefined, or string "null" workspace IDs
            if (determinedClientId === "null" || determinedClientId === "") {
              determinedClientId = null;
            }

            // AUTO-PROVISION WORKSPACE FOR ADMINS/CLIENTS WHO LACK ONE
            if ((determinedRole === "admin" || determinedRole === "client") && !determinedClientId) {
              determinedClientId = `client_${authUser.uid}`;
              determinedPlan = "multi"; // Ensure multi-agent capability is enabled

              try {
                const clientDocRef = doc(db, "clients", determinedClientId);
                const clientDocSnap = await getDoc(clientDocRef);
                if (!clientDocSnap.exists()) {
                  await setDoc(clientDocRef, {
                    name: `${authUser.displayName || authUser.email?.split("@")[0] || "Admin"}'s Workspace`,
                    ownerEmail: userEmailLower,
                    plan: "multi",
                    createdAt: new Date().toISOString()
                  });
                  console.log("Auto-created missing client workspace document:", determinedClientId);
                }
              } catch (clientCreateErr) {
                console.error("Error auto-creating client document:", clientCreateErr);
              }
            }

            // 3. Authorization check
            let isAllowed = false;
            if (determinedRole === "super_admin") {
              isAllowed = true;
            } else if (determinedRole === "client" || determinedRole === "agent" || determinedRole === "admin") {
              if (determinedClientId && determinedClientId !== "" && determinedClientId !== "null") {
                isAllowed = true;
              }
            }

            if (!isAllowed) {
              // Denied: Sign them out and pass denial code through sessionStorage
              sessionStorage.setItem("auth_error", "unauthorized");
              await auth.signOut();
              setUser(null);
              setRole(null);
              setPlan(null);
              setClientId(null);
              setLoading(false);
              return;
            }

            // If plan isn't determined yet (e.g. for agents), retrieve it from the client config
            if (determinedClientId && !determinedPlan) {
              const clientDocRef = doc(db, "clients", determinedClientId);
              const clientDocSnap = await getDoc(clientDocRef);
              if (clientDocSnap.exists()) {
                determinedPlan = clientDocSnap.data()?.plan === "multi" ? "multi" : "single";
              } else {
                determinedPlan = "single";
              }
            }

            // 4. Save/Sync user profile doc inside Firestore matching authUser.uid
            const userRef = doc(db, "users", authUser.uid);
            const userSnap = await getDoc(userRef);

            const userData = {
              uid: authUser.uid,
              name: existingUserDocData?.name || authUser.displayName || authUser.email?.split("@")[0] || "User",
              email: authUser.email,
              role: determinedRole,
              clientId: determinedClientId,
              plan: determinedPlan || "single",
              createdAt: userSnap.exists() ? (userSnap.data().createdAt || new Date().toISOString()) : new Date().toISOString(),
            };
            await setDoc(userRef, userData, { merge: true });

            // 5. Clean up temporary placeholder doc if matchedDocId was a pre-registration ID (not current uid)
            if (matchedPreRegisteredDocId && matchedPreRegisteredDocId !== authUser.uid) {
              try {
                await deleteDoc(doc(db, "users", matchedPreRegisteredDocId));
              } catch (delError) {
                console.warn("Deleted placeholder cleanup failed or already updated:", delError);
              }
            }

            // 5b. Migrate any leads assigned to this user's email to their canonical UID
            if (determinedClientId && userEmailLower) {
              try {
                const leadsToMigrateQuery = query(
                  collection(db, "leads"),
                  where("clientId", "==", determinedClientId),
                  where("assignedTo", "==", userEmailLower)
                );
                const leadsToMigrateSnap = await getDocs(leadsToMigrateQuery);
                if (!leadsToMigrateSnap.empty) {
                  const rBatch = writeBatch(db);
                  leadsToMigrateSnap.docs.forEach(leadDoc => {
                    rBatch.update(leadDoc.ref, { assignedTo: authUser.uid });
                  });
                  await rBatch.commit();
                  console.log(`[Migration] Migrated ${leadsToMigrateSnap.size} leads internally for signed-in user to UID ${authUser.uid}`);
                }
              } catch (migrateErr) {
                console.warn("Internal leads migration during login failed:", migrateErr);
              }
            }

            setUser(authUser);
            setRole(determinedRole);
            setPlan(determinedPlan || "single");
            setClientId(determinedClientId);
          } catch (firestoreError) {
            console.error("Error verifying whitelisted account details:", firestoreError);
            setUser(null);
            setRole(null);
            setPlan(null);
            setClientId(null);
          }
        } else {
          setUser(null);
          setRole(null);
          setPlan(null);
          setClientId(null);
        }
        setLoading(false);
      }, (error) => {
        console.error("Auth state observer error:", error);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Failed to initialize auth observer:", error);
      setLoading(false);
    }
  }, []);

  return (
    <FirebaseContext.Provider value={{ user, role, clientId, plan, loading, remindersEnabled, setRemindersEnabled }}>
      {children}
    </FirebaseContext.Provider>
  );
};
