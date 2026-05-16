import { usePhotobookEntries } from "../hooks/usePhotobookEntries";
import { MemoryCard } from "./MemoryCard";

export function GuestbookFeed() {
  const { entries, loading, error, hasMore, hasNewPosts, loadMore, refresh } = usePhotobookEntries();

  return (
    <section className="flex flex-col gap-5">
      {hasNewPosts && (
        <button
          onClick={() => void refresh()}
          className="mx-auto rounded-full bg-sage px-5 py-2 text-sm font-bold text-ivory shadow-lg"
          style={{ fontFamily: "Nunito, system-ui, sans-serif", backgroundColor: "#7a9068" }}
        >
          New memories — tap to refresh
        </button>
      )}

      {loading && (
        <p className="rounded-lg border border-sage/20 bg-paper/60 p-5 text-center text-ink/55" style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
          Loading memories…
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-rose/20 bg-paper/50 p-5 text-sm text-ink/70" style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()} className="button mt-3 text-xs">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && !entries.length && (
        <div className="rounded-xl border border-sage/20 bg-paper/50 p-10 text-center">
          <p className="font-serif text-3xl italic text-ink/70" style={{ fontFamily: "Lora, Georgia, serif" }}>
            No memories yet
          </p>
          <p className="mt-2 text-sm text-ink/50" style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
            Be the first to add a photo, clip, or wish.
          </p>
        </div>
      )}

      {/* Staggered polaroid feed */}
      <div className="feed-stagger px-2 pb-8">
        {entries.map((entry, i) => (
          <MemoryCard key={entry.id} entry={entry} index={i} />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => void loadMore()}
          className="mx-auto rounded-full border border-sage/40 bg-paper/60 px-6 py-2 text-sm font-semibold text-ink/70"
          style={{ fontFamily: "Nunito, system-ui, sans-serif" }}
        >
          Load more memories
        </button>
      )}
    </section>
  );
}
