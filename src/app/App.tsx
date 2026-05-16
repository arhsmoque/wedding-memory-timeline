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
          className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:px-6"
          style={{ paddingTop: "calc(1.75rem + env(safe-area-inset-top))" }}
        >
          {/* Header */}
          <header className="album-surface overflow-hidden rounded-xl px-6 py-7 sm:px-10 sm:py-9">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose" style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
              Private Wedding Timeline
            </p>
            <h1
              className="mt-3 font-serif leading-[1.05] text-ink"
              style={{ fontSize: "clamp(2.6rem, 8vw, 4rem)", fontFamily: "Lora, Georgia, serif" }}
            >
              Malik &amp; Sabrina
            </h1>

            {/* Wavy hand-drawn rule */}
            <svg
              className="wavy-rule mt-3"
              width="180" height="10" viewBox="0 0 180 10"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M0 5 Q22 0 45 5 T90 5 T135 5 T180 5"
                stroke="#7a9068"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
                opacity="0.7"
              />
            </svg>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <p
                className="text-xs font-bold uppercase tracking-[0.22em] text-sage"
                style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
              >
                2026 · Memory Book
              </p>
              <p className="max-w-xs text-sm leading-6 text-ink/60" style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
                Snap the arrival, the laughs, the wishes. Every post joins the live wedding album.
              </p>
            </div>
          </header>

          {/* Upload */}
          <UploadOrchestrator />

          {/* Feed */}
          <GuestbookFeed />
        </section>
        {DEBUG && <DebugPanel />}
      </main>
    </ErrorBoundary>
  );
}
