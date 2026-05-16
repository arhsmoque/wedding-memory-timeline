import { Download, Images } from "lucide-react";
import { CommentThread } from "./CommentThread";
import { LikeButton } from "./LikeButton";
import type { PhotobookEntry } from "../hooks/usePhotobookEntries";
import { downloadMedia, safeFilenamePart } from "../lib/download";

export function MemoryCard({ entry, index = 0 }: { entry: PhotobookEntry; index?: number }) {
  const items = entry.mediaItems?.length
    ? entry.mediaItems
    : [{ mediaUrl: entry.mediaUrl, mediaPublicId: entry.mediaPublicId, mediaType: entry.mediaType }];
  const cover = items[0];
  const filenameBase = `malik-sabrina-2026-${safeFilenamePart(entry.uploaderName)}`;
  const tiltClass = index % 2 === 0 ? "polaroid-odd" : "polaroid-even";

  function downloadAll() {
    items.forEach((item, i) => {
      const ext = item.mediaType === "video" ? "mp4" : "jpg";
      window.setTimeout(() => {
        void downloadMedia(item.mediaUrl, `${filenameBase}-${String(i + 1).padStart(2, "0")}.${ext}`);
      }, i * 250);
    });
  }

  return (
    <article className={`polaroid ${tiltClass} relative w-full max-w-sm rounded-sm`} style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
      {/* Photo / video — fills the polaroid top area */}
      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-[#1a1410]">
        {cover.mediaType === "video" ? (
          <video src={cover.mediaUrl} controls playsInline preload="metadata" className="h-full w-full object-contain" />
        ) : (
          <img
            src={cover.mediaUrl}
            alt={entry.caption || `Memory by ${entry.uploaderName}`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
        {items.length > 1 && (
          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-0.5 text-xs font-semibold text-white">
            <Images size={12} />
            +{items.length - 1}
          </div>
        )}
      </div>

      {/* Polaroid label strip — sits inside the bottom padding */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-2">
        <div className="flex items-center justify-between gap-2">
          <strong className="font-serif text-[15px] italic text-ink/85" style={{ fontFamily: "Lora, Georgia, serif" }}>
            {entry.uploaderName}
          </strong>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={downloadAll} className="text-ink/35 transition hover:text-sage" aria-label="Download">
              <Download size={15} />
            </button>
            <LikeButton entryId={entry.id} likeCount={entry.likeCount} />
          </div>
        </div>
        {entry.caption && (
          <p className="mt-1 text-xs leading-5 text-ink/60">{entry.caption}</p>
        )}
        <div className="mt-1.5">
          <CommentThread entryId={entry.id} commentCount={entry.commentCount ?? 0} />
        </div>
      </div>
    </article>
  );
}
