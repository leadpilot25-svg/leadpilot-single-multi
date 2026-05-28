/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { FirebaseProvider, useFirebase } from "./contexts/FirebaseProvider";
import Dashboard from "./pages/Dashboard";
import TodayView from "./pages/TodayView";
import Funnel from "./pages/Funnel";
import LeadDetails from "./pages/LeadDetails";
import LeadsList from "./pages/LeadsList";
import NewLead from "./pages/NewLead";
import PublicLeadForm from "./pages/PublicLeadForm";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import { Header, BottomNav, DesktopSidebar } from "./components/Navigation";
import React, { useEffect } from "react";
import { APP_MODE } from "./config";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useFirebase();
  if (loading) return <div className="h-screen w-screen flex items-center justify-center font-sans">Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans text-neutral-900">
      <DesktopSidebar />
      <div className="lg:pl-72 min-h-screen">
        <Header />
        <main className="pt-20 lg:pt-24 pb-32 lg:pb-12 px-4 lg:px-8 max-w-6xl mx-auto">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

function AppContent() {
  const { user, role, plan } = useFirebase();

  // Notification setup
  useEffect(() => {
    if (user && "Notification" in window) {
      Notification.requestPermission();
    }
  }, [user]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/public-form" element={<PublicLeadForm />} />
        
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <MainLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/today" element={<TodayView />} />
                  <Route path="/funnel" element={<Funnel />} />
                  <Route path="/leads" element={<LeadsList />} />
                  <Route path="/leads/new" element={<NewLead />} />
                  <Route path="/leads/:id" element={<LeadDetails />} />
                  <Route path="/profile" element={<Profile />} />
                  {((role === "client" && plan === "multi") || role === "admin") && <Route path="/admin" element={<Admin />} />}
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </MainLayout>
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <AppContent />
    </FirebaseProvider>
  );
}

