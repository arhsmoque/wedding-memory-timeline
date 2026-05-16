import { Download, Images } from "lucide-react";
import { CommentThread } from "./CommentThread";
import { LikeButton } from "./LikeButton";
import type { PhotobookEntry } from "../hooks/usePhotobookEntries";
import { downloadMedia, safeFilenamePart } from "../lib/download";

export function MemoryCard({ entry }: { entry: PhotobookEntry }) {
  const items = entry.mediaItems?.length
    ? entry.mediaItems
    : [{ mediaUrl: entry.mediaUrl, mediaPublicId: entry.mediaPublicId, mediaType: entry.mediaType }];
  const cover = items[0];
  const filenameBase = `malik-sabrina-2026-${safeFilenamePart(entry.uploaderName)}`;

  function downloadAll() {
    items.forEach((item, index) => {
      const ext = item.mediaType === "video" ? "mp4" : "jpg";
      window.setTimeout(() => {
        void downloadMedia(item.mediaUrl, `${filenameBase}-${String(index + 1).padStart(2, "0")}.${ext}`);
      }, index * 250);
    });
  }

  return (
    <article className="overflow-hidden rounded-lg border border-white/75 bg-ivory text-ink shadow-[0_18px_48px_rgb(83_55_30/0.16)]">
      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-[#201915]">
        {cover.mediaType === "video" ? (
          <video src={cover.mediaUrl} controls playsInline preload="metadata" className="h-full w-full object-contain" />
        ) : (
          <img
            src={cover.mediaUrl}
            alt={entry.caption || `Memory by ${entry.uploaderName}`}
            className="h-full w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        )}
        {items.length > 1 && (
          <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
            <Images size={14} />
            +{items.length - 1}
          </div>
        )}
      </div>
      <div className="grid gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-[15px]">{entry.uploaderName}</strong>
          <div className="flex items-center gap-3">
            <button type="button" onClick={downloadAll} className="text-ink/45 transition hover:text-ink" aria-label="Download media">
              <Download size={17} />
            </button>
            <LikeButton entryId={entry.id} likeCount={entry.likeCount} />
          </div>
        </div>
        {entry.caption ? <p className="text-sm leading-6 text-ink/80">{entry.caption}</p> : null}
        <CommentThread entryId={entry.id} commentCount={entry.commentCount ?? 0} />
      </div>
    </article>
  );
}
