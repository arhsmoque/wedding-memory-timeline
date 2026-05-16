import { doc, increment, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { auth, db } from "../lib/firebase";
import { requireGuestName } from "../lib/guestProfile";

export function LikeButton({ entryId, likeCount }: { entryId: string; likeCount: number }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(likeCount);
  const [pending, setPending] = useState(false);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "photobook", entryId, "likes", uid), (snap) => {
      setLiked(snap.exists());
    });
  }, [entryId, uid]);

  async function toggle() {
    if (!uid || pending) return;
    let likerName = "";
    try {
      likerName = requireGuestName();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please enter your name first.");
      return;
    }
    const likeRef = doc(db, "photobook", entryId, "likes", uid);
    const entryRef = doc(db, "photobook", entryId);
    setPending(true);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(likeRef);
        if (snap.exists()) {
          tx.delete(likeRef);
          tx.update(entryRef, { likeCount: increment(-1), updatedAt: serverTimestamp() });
        } else {
          tx.set(likeRef, { createdAt: serverTimestamp(), likerName });
          tx.update(entryRef, { likeCount: increment(1), updatedAt: serverTimestamp() });
        }
      });
      setLiked((value) => !value);
      setCount((c) => (liked ? Math.max(0, c - 1) : c + 1));
    } catch {
      // onSnapshot will reconcile state
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={() => void toggle()}
      disabled={pending || !uid}
      className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? "text-gold" : "text-ink/50"}`}
      aria-label={liked ? "Unlike" : "Like"}
    >
      <Heart size={16} fill={liked ? "currentColor" : "none"} />
      {count}
    </button>
  );
}
