import { UploadOrchestrator } from "../components/UploadOrchestrator";
import { GuestbookFeed } from "../components/GuestbookFeed";
import { ProjectorView } from "../components/ProjectorView";
import { DebugPanel, ErrorBoundary } from "../components/DebugPanel";
import { useGuestIdentity } from "../hooks/useGuestIdentity";

const DEBUG = import.meta.env.VITE_DEBUG_PANEL === "true";

export default function App() {
  useGuestIdentity();

  if (new URLSearchParams(window.location.search).get("projector") === "1") {
    return <ProjectorView />;
  }

  return (
    <ErrorBoundary>
      <main className="min-h-safe-screen bg-guestbook text-ink">
        <section
          className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8"
          style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}
        >
          <header className="album-surface overflow-hidden rounded-lg border border-white/70 px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose">Private Wedding Timeline</p>
                <h1 className="mt-3 font-serif text-5xl leading-none text-ink sm:text-7xl">Malik & Sabrina</h1>
                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.22em] text-gold">2026 Memory Book</p>
              </div>
              <div className="max-w-sm border-l border-gold/30 pl-4 text-sm leading-6 text-ink/68">
                Snap the arrival, the table laughs, the wishes, the tiny moments. Every post becomes part of the live wedding album.
              </div>
            </div>
          </header>
          <UploadOrchestrator />
          <GuestbookFeed />
        </section>
        {DEBUG && <DebugPanel />}
      </main>
    </ErrorBoundary>
  );
}
