import {
  addDoc,
  collection,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { Check, MessageCircle, Pencil, Send, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { validateGuestText } from "../lib/contentPolicy";
import { auth, db, ensureGuestAuth } from "../lib/firebase";
import { requireGuestName } from "../lib/guestProfile";

type Comment = {
  id: string;
  commenterName: string;
  text: string;
  ownerUid: string;
  editCount?: number;
};

export function CommentThread({ entryId, commentCount = 0 }: { entryId: string; commentCount?: number }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const uid = auth.currentUser?.uid;
  const demo = new URLSearchParams(window.location.search).get("demo") === "1";

  useEffect(() => {
    if (!open) return;
    if (demo) {
      setComments([
        { id: `${entryId}-demo-1`, commenterName: "Auntie Julie", text: "So proud of you both.", ownerUid: "demo-a" },
        { id: `${entryId}-demo-2`, commenterName: "Uncle Rahman", text: "Beautiful moment. Congratulations!", ownerUid: "demo-b" },
      ].slice(0, Math.max(1, Math.min(2, commentCount || 1))));
      return;
    }
    const q = query(
      collection(db, "photobook", entryId, "comments"),
      where("isDeleted", "==", false),
      orderBy("createdAt", "asc"),
      limit(50)
    );
    return onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, "id">) })));
    });
  }, [commentCount, demo, entryId, open]);

  async function addComment() {
    if (busy) return;
    setBusy(true);
    try {
      if (demo) throw new Error("Demo mode is read-only.");
      const commenterName = requireGuestName();
      const safeText = validateGuestText(text, 500);
      if (!safeText) throw new Error("Please write a comment first.");
      const user = await ensureGuestAuth();
      await addDoc(collection(db, "photobook", entryId, "comments"), {
        commenterName,
        text: safeText,
        ownerUid: user.uid,
        editCount: 0,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
      });
      await updateDoc(doc(db, "photobook", entryId), {
        commentCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      setText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Comment was not posted.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(comment: Comment) {
    if (comment.ownerUid !== uid) return;
    setBusy(true);
    try {
      if (demo) throw new Error("Demo mode is read-only.");
      await updateDoc(doc(db, "photobook", entryId, "comments", comment.id), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "photobook", entryId), {
        commentCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } catch {
      toast.error("Comment could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditText(comment.text);
  }

  async function saveEdit(comment: Comment) {
    if (comment.ownerUid !== uid || (comment.editCount ?? 0) >= 1 || busy) return;
    setBusy(true);
    try {
      if (demo) throw new Error("Demo mode is read-only.");
      const safeText = validateGuestText(editText, 500);
      if (!safeText) throw new Error("Please write a comment first.");
      await updateDoc(doc(db, "photobook", entryId, "comments", comment.id), {
        text: safeText,
        editCount: 1,
        updatedAt: serverTimestamp(),
      });
      setEditingId(null);
      setEditText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Comment could not be edited.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-ink/10 pt-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-semibold text-ink/65"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="inline-flex items-center gap-2">
          <MessageCircle size={16} />
          Comments ({open ? comments.length : commentCount})
        </span>
        <span>{open ? "Hide" : "Open"}</span>
      </button>
      {open && (
        <div className="mt-3 grid gap-3">
          <div className="grid max-h-48 gap-2 overflow-y-auto">
            {!comments.length && <p className="text-center text-sm text-ink/45">No comments yet.</p>}
            {comments.map((comment) => (
              <div key={comment.id} className={`rounded-lg px-3 py-2 text-sm ${comment.ownerUid === uid ? "bg-gold/20" : "bg-black/5"}`}>
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-xs text-ink/75">{comment.commenterName}</strong>
                  {comment.ownerUid === uid && editingId !== comment.id && (
                    <div className="flex items-center gap-2">
                      {(comment.editCount ?? 0) < 1 && (
                        <button
                          type="button"
                          className="text-ink/40 transition hover:text-ink"
                          onClick={() => startEdit(comment)}
                          disabled={busy}
                          aria-label="Edit comment"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-ink/40 transition hover:text-red-700"
                        onClick={() => void deleteComment(comment)}
                        disabled={busy}
                        aria-label="Delete comment"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {editingId === comment.id ? (
                  <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2">
                    <input
                      className="rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      maxLength={500}
                    />
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-lg bg-ink px-3 text-ivory disabled:opacity-45"
                      onClick={() => void saveEdit(comment)}
                      disabled={busy || !editText.trim()}
                      aria-label="Save comment edit"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-lg border border-ink/10 px-3 text-ink/60"
                      onClick={() => { setEditingId(null); setEditText(""); }}
                      disabled={busy}
                      aria-label="Cancel comment edit"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 leading-5 text-ink/75">
                    {comment.text}
                    {(comment.editCount ?? 0) > 0 && <span className="ml-2 text-xs text-ink/40">edited</span>}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className="rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a comment..."
              maxLength={500}
            />
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-ink px-3 text-ivory disabled:opacity-45"
              onClick={() => void addComment()}
              disabled={busy || !text.trim()}
              aria-label="Post comment"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
