// AgentSelect.tsx
// Drop-in replacement for any agent dropdown in the app.
// Shows all registered agents including those pending their first login,
// allowing clients to pre-assign leads to them smoothly.

import React, { useState, useRef, useEffect } from "react";
import { UserCheck } from "lucide-react";

interface Agent {
  id: string;
  uid?: string;
  name?: string;
  displayName?: string;
  email?: string;
  role?: string;
}

interface AgentSelectProps {
  agents: Agent[];
  value: string;
  onChange: (uidOrId: string) => void;
  includeUnassigned?: boolean;
}

function hasLoggedIn(agent: Agent): boolean {
  return !!(agent.uid && agent.uid === agent.id);
}

function getLabel(agent: Agent): string {
  return agent.name?.trim() ||
    agent.displayName?.trim() ||
    agent.email?.split("@")[0] ||
    "Agent";
}

export function AgentSelect({ agents, value, onChange, includeUnassigned = true }: AgentSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const activeAgents = agents.filter(a => a.role === "agent");
  const readyAgents  = activeAgents.filter(hasLoggedIn);
  const pendingAgents = activeAgents.filter(a => !hasLoggedIn(a));

  // Match of currently selected agent (either by real uid or pre-registration email document id)
  const selected = activeAgents.find(a => (a.uid && a.uid === value) || a.id === value);

  return (
    <div ref={containerRef} className="space-y-1.5 font-sans relative">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          className="flex items-center gap-3 bg-neutral-50 px-4 py-3.5 rounded-2xl border border-neutral-100 hover:border-emerald-500 hover:bg-neutral-50/50 focus:border-emerald-500 focus:bg-white transition-all shadow-inner w-full text-left"
        >
          <UserCheck size={16} className="text-neutral-400 shrink-0" />
          <span className="text-sm font-semibold text-neutral-800 flex-1 truncate">
            {selected ? getLabel(selected) : "Unassigned"}
          </span>
          <svg
            className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <ul className="absolute left-0 right-0 mt-2 bg-white border border-neutral-100 rounded-2xl shadow-xl z-[9999] max-h-60 overflow-y-auto py-1">

            {/* Unassigned option */}
            {includeUnassigned && (
              <li
                onClick={() => { onChange(""); setOpen(false); }}
                className={`px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 transition-colors ${
                  !value ? "bg-emerald-50 text-emerald-700 font-extrabold" : "text-neutral-500"
                }`}
              >
                Unassigned
              </li>
            )}

            {/* Active agents who have logged in */}
            {readyAgents.map(agent => (
              <li
                key={agent.uid}
                onClick={() => { onChange(agent.uid!); setOpen(false); }}
                className={`px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 transition-colors ${
                  (agent.uid === value || agent.id === value)
                    ? "bg-emerald-50 text-emerald-700 font-extrabold"
                    : "text-neutral-700"
                }`}
              >
                {getLabel(agent)}
              </li>
            ))}

            {/* Pending agents — listed as fully selectable now! */}
            {pendingAgents.map(agent => (
              <li
                key={agent.id}
                onClick={() => { onChange(agent.id); setOpen(false); }}
                className={`px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center justify-between ${
                  (agent.id === value)
                    ? "bg-emerald-50 text-emerald-700 font-extrabold"
                    : "text-neutral-700"
                }`}
              >
                <span className="truncate mr-2">{getLabel(agent)}</span>
                <span className="text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-500 px-2 py-0.5 rounded-full shrink-0">
                  Pending login
                </span>
              </li>
            ))}

            {activeAgents.length === 0 && (
              <li className="px-4 py-3 text-sm text-neutral-400 font-medium text-center">
                No agents added yet
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
