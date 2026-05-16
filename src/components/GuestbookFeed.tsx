import { usePhotobookEntries } from "../hooks/usePhotobookEntries";
import { MemoryCard } from "./MemoryCard";

export function GuestbookFeed() {
  const { entries, loading, error, hasMore, hasNewPosts, loadMore, refresh } = usePhotobookEntries();

  return (
    <section className="flex flex-col gap-4">
      {hasNewPosts && (
        <button
          onClick={() => void refresh()}
          className="mx-auto rounded-full bg-ink px-4 py-2 text-sm font-semibold text-ivory shadow-lg"
        >
          New memories - tap to refresh
        </button>
      )}
      {loading && <p className="rounded-lg border border-white/60 bg-white/35 p-5 text-ink/60">Loading memories...</p>}
      {error && (
        <div className="rounded-lg border border-rose/20 bg-white/45 p-5 text-sm text-ink/70">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()} className="mt-3 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-ivory">
            Try again
          </button>
        </div>
      )}
      {!loading && !error && !entries.length && (
        <div className="rounded-lg border border-white/70 bg-white/40 p-8 text-center text-ink/65">
          <p className="font-serif text-3xl text-ink">No memories yet</p>
          <p className="mt-2 text-sm">Be the first to add a photo, short clip, or wish.</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {entries.map((entry) => <MemoryCard key={entry.id} entry={entry} />)}
      </div>
      {hasMore && (
        <button
          onClick={() => void loadMore()}
          className="mx-auto rounded-full border border-gold/40 bg-white/35 px-6 py-2 text-sm font-semibold text-ink/75"
        >
          Load more memories
        </button>
      )}
    </section>
  );
}
