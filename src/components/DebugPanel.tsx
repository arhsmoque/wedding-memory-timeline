import { Component, type ErrorInfo, type ReactNode } from "react";
import { Bug, ChevronDown, Send, X } from "lucide-react";
import { useState } from "react";
import { getLocalLogs, logDebug } from "../lib/debugLog";

// ── Error Boundary ──────────────────────────────────────────────────────────

type BoundaryState = { caught: boolean; message: string };

export class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { caught: false, message: "" };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { caught: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const msg = error instanceof Error ? error.message : String(error);
    void logDebug("error", `React render crash: ${msg}`, info.componentStack ?? undefined);
  }

  render() {
    if (this.state.caught) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-guestbook p-8 text-ivory">
          <p className="text-lg font-semibold text-red-400">Something went wrong</p>
          <p className="max-w-sm text-center text-sm text-ivory/60">{this.state.message}</p>
          <button
            className="button"
            onClick={() => { this.setState({ caught: false, message: "" }); location.reload(); }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Floating Debug Panel ────────────────────────────────────────────────────

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [showLocal, setShowLocal] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const localLogs = getLocalLogs();

  async function submit() {
    if (!text.trim() || status !== "idle") return;
    setStatus("sending");
    await logDebug("manual", text.trim());
    setStatus("sent");
    setTimeout(() => { setStatus("idle"); setText(""); setOpen(false); }, 1500);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        className="fixed right-4 z-50 flex items-center gap-1.5 rounded-full bg-red-600/90 px-3 py-2 text-xs font-bold text-white shadow-xl"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <Bug size={14} />
        Bug
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-ink text-ivory shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Bug size={16} className="text-red-400" />
            <span className="font-semibold">Report Issue</span>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="p-5 grid gap-4">
          <p className="text-xs text-ivory/50">
            Device + UA + URL auto-captured. Describe what went wrong — be specific about the step.
          </p>
          <textarea
            className="input min-h-28 text-sm"
            autoFocus
            placeholder={`Examples:\n• "Camera button opened gallery instead of camera"\n• "Progress bar filled then upload failed silently"\n• "Like count shows 0 after tapping, stays 0 after refresh"\n• "App crashed on video pick — saw white screen"`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            onClick={() => void submit()}
            disabled={!text.trim() || status !== "idle"}
            className="button w-full"
          >
            <Send size={15} />
            {status === "sending" ? "Logging..." : status === "sent" ? "Logged!" : "Send Report"}
          </button>

          {localLogs.length > 0 && (
            <div>
              <button
                onClick={() => setShowLocal((s) => !s)}
                className="flex items-center gap-1 text-xs text-ivory/40"
              >
                <ChevronDown size={12} className={showLocal ? "rotate-180" : ""} />
                {localLogs.length} local log{localLogs.length !== 1 ? "s" : ""} (offline backup)
              </button>
              {showLocal && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded border border-white/10 p-2 text-xs text-ivory/60 font-mono space-y-1">
                  {[...localLogs].reverse().map((l, i) => (
                    <div key={i} className={`border-b border-white/5 pb-1 ${l.level === "error" ? "text-red-400" : l.level === "manual" ? "text-gold" : ""}`}>
                      [{l.level.toUpperCase()}] {l.context.ts.slice(11, 19)} {l.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
