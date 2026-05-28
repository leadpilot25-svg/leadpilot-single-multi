import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  browserPopupRedirectResolver 
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { LogIn, AlertCircle, HelpCircle, Settings, X, Check, Trash2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [configIsPlaceholder, setConfigIsPlaceholder] = useState(false);

  // Check for whitelisting auth gate denial
  useEffect(() => {
    const isDenied = sessionStorage.getItem("auth_error");
    if (isDenied === "unauthorized") {
      setError("ACCESS DENIED: Your email address is not registered as an active workspace owner or authorized staff of this workspace. Please contact your system administrator.");
      sessionStorage.removeItem("auth_error");
    }
  }, []);

  // Custom setup form states
  const [showConfig, setShowConfig] = useState(false);
  const [snippet, setSnippet] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [appIdInput, setAppIdInput] = useState("");
  const [senderIdInput, setSenderIdInput] = useState("");
  const [projectIdInput, setProjectIdInput] = useState("leadpilot-master");
  const [authDomainInput, setAuthDomainInput] = useState("leadpilot-master.firebaseapp.com");
  const [storageBucketInput, setStorageBucketInput] = useState("leadpilot-master.appspot.com");
  const [isUsingCustomConfig, setIsUsingCustomConfig] = useState(false);

  // Check for configuration status on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("leadpilot_custom_firebase_config");
      if (saved) {
        setIsUsingCustomConfig(true);
        const parsed = JSON.parse(saved);
        setApiKeyInput(parsed.apiKey || "");
        setAppIdInput(parsed.appId || "");
        setSenderIdInput(parsed.messagingSenderId || "");
        setProjectIdInput(parsed.projectId || "leadpilot-master");
        setAuthDomainInput(parsed.authDomain || "leadpilot-master.firebaseapp.com");
        setStorageBucketInput(parsed.storageBucket || "leadpilot-master.appspot.com");
      } else {
        setIsUsingCustomConfig(false);
        setApiKeyInput(auth.app.options.apiKey || "");
        setAppIdInput(auth.app.options.appId || "");
        setSenderIdInput(auth.app.options.messagingSenderId || "");
        setProjectIdInput(auth.app.options.projectId || "leadpilot-master");
        setAuthDomainInput(auth.app.options.authDomain || "leadpilot-master.firebaseapp.com");
        setStorageBucketInput(auth.app.options.storageBucket || "leadpilot-master.appspot.com");
      }
    } catch (e) {}

    const key = auth.app.options.apiKey;
    const appId = auth.app.options.appId;
    if (
      !key ||
      key.includes("YOUR_") ||
      key.includes("REPLACE_") ||
      !appId ||
      appId.includes("YOUR_") ||
      appId.includes("REPLACE_")
    ) {
      setConfigIsPlaceholder(true);
    }
  }, []);

  // Check for redirect result on mount
  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          navigate("/");
        }
      } catch (err: any) {
        console.error("Redirect Login Error:", err);
        if (err.code === "auth/unauthorized-domain") {
          setError(`Unauthorized Domain: Please add "${window.location.hostname}" to Firebase Console.`);
        } else if (err.code === "auth/api-key-not-valid") {
          setError("Your Firebase API Key is invalid. Click 'Project Settings' below to set standard LeadPilot credentials.");
        }
      }
    };
    checkRedirect();
  }, [navigate]);

  const handleSaveConfig = () => {
    if (!apiKeyInput.trim()) {
      setError("Please key in a valid Firebase API Key.");
      return;
    }
    if (!appIdInput.trim()) {
      setError("Please key in a valid Firebase App ID.");
      return;
    }

    const config = {
      apiKey: apiKeyInput.trim(),
      authDomain: authDomainInput.trim() || "leadpilot-master.firebaseapp.com",
      projectId: projectIdInput.trim() || "leadpilot-master",
      storageBucket: storageBucketInput.trim() || "leadpilot-master.appspot.com",
      messagingSenderId: senderIdInput.trim() || undefined,
      appId: appIdInput.trim()
    };

    localStorage.setItem("leadpilot_custom_firebase_config", JSON.stringify(config));
    setError(null);
    window.location.reload();
  };

  const handleClearCustomConfig = () => {
    localStorage.removeItem("leadpilot_custom_firebase_config");
    window.location.reload();
  };

  const handleSnippetParse = (text: string) => {
    setSnippet(text);
    
    const apiKeyMatch = text.match(/apiKey:\s*["']([^"']+)["']/);
    const appIdMatch = text.match(/appId:\s*["']([^"']+)["']/);
    const senderIdMatch = text.match(/messagingSenderId:\s*["']([^"']+)["']/);
    const projectIdMatch = text.match(/projectId:\s*["']([^"']+)["']/);
    const authDomainMatch = text.match(/authDomain:\s*["']([^"']+)["']/);
    const storageBucketMatch = text.match(/storageBucket:\s*["']([^"']+)["']/);

    if (apiKeyMatch) setApiKeyInput(apiKeyMatch[1]);
    if (appIdMatch) setAppIdInput(appIdMatch[1]);
    if (senderIdMatch) setSenderIdInput(senderIdMatch[1]);
    if (projectIdMatch) setProjectIdInput(projectIdMatch[1]);
    if (authDomainMatch) setAuthDomainInput(authDomainMatch[1]);
    if (storageBucketMatch) setStorageBucketInput(storageBucketMatch[1]);
  };

  const handleLogin = async (useRedirect = true) => {
    setLoading(true);
    setError(null);
    
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError("Sign-in is taking unusually long. Ensure your Google popups are enabled or check your Firebase Console Authorized Domains.");
    }, 15000);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      if (useRedirect) {
        console.log("Attempting Google Sign-In Redirect...");
        await signInWithRedirect(auth, provider);
      } else {
        console.log("Attempting Google Sign-In Pop-up...");
        const result = await signInWithPopup(auth, provider);
        clearTimeout(timeoutId);
        setLoading(false);
        if (result?.user) {
          navigate("/");
        }
      }
    } catch (err: any) {
      setLoading(false);
      clearTimeout(timeoutId);
      console.error("Login Error:", err);
      
      if (err.code === "auth/unauthorized-domain") {
        setError(`Unauthorized Domain: "${window.location.hostname}" must be added to your LeadPilot Master project in Firebase Console.`);
        setShowTroubleshoot(true);
      } else if (err.code === "auth/api-key-not-valid" || err.message?.includes("key")) {
        setError("Your LeadPilot Firebase API Key is missing or invalid. Please check the project settings form below.");
        setShowConfig(true);
      } else if (err.code === "auth/popup-blocked") {
        setError("Pop-up blocked by your browser. Please allow pop-ups for this site or use the standard redirection button.");
      } else if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        setError("The login popup was closed before finishing. Please try again and complete the Google login inside the popup, or click the green 'Continue with Google (Redirect)' button.");
      } else {
        setError(err.message || "An unexpected error occurred during login.");
      }
    }
  };

  const handleHardReset = async () => {
    setLoading(true);
    setError("Clearing cache and resetting...");
    try {
      await auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      const dbs = ['firebase-auth-storage', 'firestore-storage'];
      for (const dbName of dbs) {
        try { indexedDB.deleteDatabase(dbName); } catch (e) {}
      }
      window.location.reload();
    } catch (err) {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-50 font-sans overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 rounded-3xl border border-neutral-100 shadow-xl shadow-slate-100/40 text-center"
      >
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <LogIn className="text-emerald-500 w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 mb-1">LeadPilot</h1>
        <p className="text-neutral-500 text-sm mb-8 font-normal">The premium lead platform for elite real estate agents.</p>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-sm overflow-hidden"
            >
              <div className="flex items-start gap-3 text-left">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                <div>
                  <p className="font-bold mb-1">Authentication Failure</p>
                  <p className="opacity-90 text-xs leading-normal">{error}</p>
                </div>
              </div>

              {showTroubleshoot && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 pt-4 border-t border-rose-100 flex flex-col gap-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Troubleshooting Steps:</p>
                  
                  <div className="bg-white/50 p-3 rounded-xl flex flex-col gap-2 border border-rose-100/50">
                    <p className="text-xs text-neutral-700">
                      1. Copy this domain: <code className="bg-rose-100 text-rose-800 px-1 rounded font-mono">{window.location.hostname}</code>
                    </p>
                    <p className="text-xs text-neutral-700">
                      2. Add it to <a href={`https://console.firebase.google.com/project/${auth.app.options.projectId}/authentication/settings`} target="_blank" rel="noopener noreferrer" className="underline font-bold text-rose-700">Authorized Domains</a>.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleHardReset}
                    className="text-[10px] text-rose-500 hover:text-rose-700 font-bold underline text-left"
                  >
                    Clear Authentication Cache
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-5 bg-neutral-50 border border-neutral-200 rounded-2xl text-left overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 border-b border-neutral-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-500" />
                  <span className="font-bold text-xs text-neutral-800 uppercase tracking-wider">Project Settings</span>
                </div>
                <button 
                  onClick={() => setShowConfig(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200/50 rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Option A: Paste Firebase Snippet</label>
                  <textarea
                    rows={2}
                    placeholder="Paste the firebaseConfig object here to auto-fill..."
                    value={snippet}
                    onChange={(e) => handleSnippetParse(e.target.value)}
                    className="w-full text-xs p-2 font-mono bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="relative text-center my-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-neutral-200/70"></span>
                  </div>
                  <span className="relative bg-neutral-50 px-2 text-[9px] text-neutral-400 font-bold uppercase">or fill fields</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 mb-0.5">API KEY</label>
                    <input
                      type="text"
                      placeholder="AIzaSy..."
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 mb-0.5">APP ID</label>
                    <input
                      type="text"
                      placeholder="1:15115623903:web:..."
                      value={appIdInput}
                      onChange={(e) => setAppIdInput(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 mb-0.5">SENDER ID (OPTIONAL)</label>
                    <input
                      type="text"
                      placeholder="15115623903"
                      value={senderIdInput}
                      onChange={(e) => setSenderIdInput(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSaveConfig}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save & Apply
                  </button>
                  {isUsingCustomConfig && (
                    <button
                      onClick={handleClearCustomConfig}
                      className="bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      title="Reset to default config"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {configIsPlaceholder && !showConfig && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-sm text-left shadow-sm">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <p className="font-bold mb-0.5 text-xs text-neutral-900">Setup Project Credentials</p>
                <p className="opacity-95 text-[11px] text-neutral-600 leading-normal">
                  You are using placeholder credentials. Please enter your valid Firebase API key and App ID to enable signing in.
                </p>
                <button
                  onClick={() => setShowConfig(true)}
                  className="mt-2 text-xs font-bold text-amber-700 hover:text-amber-900 inline-flex items-center gap-1 hover:underline"
                >
                  Configure Credentials Now
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleLogin(true)}
            disabled={loading || configIsPlaceholder}
            className={`w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:shadow-none text-white font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-200 active:scale-95 ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 invert grayscale brightness-200" />
            )}
            {loading ? "Connecting..." : "Continue with Google (Redirect)"}
          </button>

          <button
            onClick={() => handleLogin(false)}
            disabled={loading || configIsPlaceholder}
            className="w-full bg-white hover:bg-neutral-50 active:bg-neutral-100 disabled:bg-neutral-50 disabled:text-neutral-300 border border-neutral-200 text-neutral-700 font-semibold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 shrink-0" />
            Try Google Login (Pop-up Window)
          </button>
        </div>

        {!showConfig && (
          <button 
            type="button"
            onClick={() => setShowConfig(true)}
            className="mt-6 text-xs text-neutral-400 hover:text-neutral-600 inline-flex items-center gap-1.5 select-none font-medium"
          >
            <Settings className="w-3.5 h-3.5" />
            Project Settings
          </button>
        )}

        <p className="mt-8 text-[11px] text-neutral-400">
          By continuing, you agree to our Terms and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
