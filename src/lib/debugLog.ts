import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export type LogLevel = "error" | "warn" | "manual";

type RawEntry = {
  level: LogLevel;
  message: string;
  stack?: string;
  context: {
    ua: string;
    screen: string;
    url: string;
    uid: string | null;
    ts: string;
  };
  createdAt: unknown;
};

const LS_KEY = "guestbook_debug_log";
const MAX_LOCAL = 50;

function capture(): RawEntry["context"] {
  return {
    ua: navigator.userAgent,
    screen: `${screen.width}x${screen.height}@${window.devicePixelRatio}`,
    url: location.href,
    uid: auth.currentUser?.uid ?? null,
    ts: new Date().toISOString(),
  };
}

export async function logDebug(level: LogLevel, message: string, stack?: string): Promise<void> {
  const entry: RawEntry = {
    level,
    message: message.slice(0, 2000),
    stack: stack?.slice(0, 3000),
    context: capture(),
    createdAt: serverTimestamp(),
  };

  // Always write to localStorage first — survives Firestore failures
  try {
    const prev = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as RawEntry[];
    prev.push({ ...entry, createdAt: entry.context.ts });
    localStorage.setItem(LS_KEY, JSON.stringify(prev.slice(-MAX_LOCAL)));
  } catch { /* storage quota or private mode */ }

  // Best-effort Firestore write — never throws to caller
  try {
    await addDoc(collection(db, "debug_logs"), entry);
  } catch { /* network down or rules rejected */ }
}

export function installGlobalHandlers(): void {
  window.addEventListener("error", (e) => {
    void logDebug("error", e.message || "Script error", e.error instanceof Error ? e.error.stack : undefined);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "Unhandled rejection");
    const stack = e.reason instanceof Error ? e.reason.stack : undefined;
    void logDebug("error", msg, stack);
  });
}

export function getLocalLogs(): RawEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as RawEntry[];
  } catch {
    return [];
  }
}
