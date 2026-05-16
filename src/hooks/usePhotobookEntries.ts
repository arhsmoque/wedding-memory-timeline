import {
  collection, getDocs, limit, orderBy, query,
  startAfter, where, type QueryDocumentSnapshot
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../lib/firebase";

export type PhotobookEntry = {
  id: string;
  uploaderName: string;
  caption: string;
  mediaUrl: string;
  mediaPublicId: string;
  mediaType: "image" | "video";
  mediaItems?: Array<{
    mediaUrl: string;
    mediaPublicId: string;
    mediaType: "image" | "video";
    width?: number;
    height?: number;
    duration?: number;
  }>;
  mediaCount?: number;
  postType?: "photo" | "video";
  likeCount: number;
  commentCount?: number;
  ownerUid?: string;
  createdAt: unknown;
};

const PAGE_SIZE = 20;

const DEMO_ITEMS = [
  "/demo-media/01-portrait-arrival.jpg",
  "/demo-media/02-landscape-hall.jpg",
  "/demo-media/03-table-friends.jpg",
  "/demo-media/04-family-wish.jpg",
  "/demo-media/05-dancefloor.jpg"
];

function demoEntries(): PhotobookEntry[] {
  return [
    {
      id: "demo-gallery",
      uploaderName: "Auntie Julie",
      caption: "The first table photo before everyone starts dancing.",
      mediaUrl: DEMO_ITEMS[0],
      mediaPublicId: "demo/gallery-1",
      mediaType: "image",
      mediaItems: DEMO_ITEMS.map((mediaUrl, index) => ({
        mediaUrl,
        mediaPublicId: `demo/gallery-${index + 1}`,
        mediaType: "image" as const,
      })),
      mediaCount: 5,
      postType: "photo",
      likeCount: 18,
      commentCount: 3,
      createdAt: new Date(),
    },
    {
      id: "demo-video",
      uploaderName: "Amir Table 12",
      caption: "Short clip from the entrance.",
      mediaUrl: "/demo-media/07-short-wedding-clip.mp4",
      mediaPublicId: "demo/video-1",
      mediaType: "video",
      mediaItems: [{
        mediaUrl: "/demo-media/07-short-wedding-clip.mp4",
        mediaPublicId: "demo/video-1",
        mediaType: "video",
        duration: 8,
      }],
      mediaCount: 1,
      postType: "video",
      likeCount: 11,
      commentCount: 1,
      createdAt: new Date(),
    },
    {
      id: "demo-portrait",
      uploaderName: "Nadia & Amir",
      caption: "So happy for both of you. May this be the beginning of a gentle, joyful life together.",
      mediaUrl: "/demo-media/06-dessert.jpg",
      mediaPublicId: "demo/portrait-1",
      mediaType: "image",
      mediaCount: 1,
      postType: "photo",
      likeCount: 24,
      commentCount: 6,
      createdAt: new Date(),
    },
  ];
}

export function usePhotobookEntries() {
  const [entries, setEntries] = useState<PhotobookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);
  const latestAtRef = useRef<unknown>(null);

  const fetchPage = useCallback(async (cursor: QueryDocumentSnapshot | null) => {
    const col = collection(db, "photobook");
    const q = cursor
      ? query(col, where("isDeleted", "==", false), orderBy("createdAt", "desc"), startAfter(cursor), limit(PAGE_SIZE))
      : query(col, where("isDeleted", "==", false), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
    const snap = await getDocs(q);
    const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PhotobookEntry, "id">) }));
    if (!cursor && snap.docs.length > 0) latestAtRef.current = snap.docs[0].data().createdAt;
    cursorRef.current = snap.docs[snap.docs.length - 1] ?? null;
    setHasMore(snap.docs.length === PAGE_SIZE);
    return mapped;
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      setEntries(demoEntries());
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetchPage(null)
      .then((first) => { setEntries(first); setLoading(false); })
      .catch(() => {
        setEntries([]);
        setError("Memories could not load. Please check the connection and try again.");
        setLoading(false);
      });

    const intervalId = setInterval(async () => {
      try {
        if (!latestAtRef.current) return;
        const pollQ = query(
          collection(db, "photobook"),
          where("isDeleted", "==", false),
          where("createdAt", ">", latestAtRef.current),
          limit(1)
        );
        const snap = await getDocs(pollQ);
        if (!snap.empty) setHasNewPosts(true);
      } catch {
        setError("Live refresh paused. Tap refresh or check the connection.");
      }
    }, 60_000);

    return () => clearInterval(intervalId);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!cursorRef.current || !hasMore) return;
    try {
      const more = await fetchPage(cursorRef.current);
      setEntries((prev) => [...prev, ...more]);
    } catch {
      setError("More memories could not load. Please try again.");
    }
  }, [fetchPage, hasMore]);

  const refresh = useCallback(async () => {
    setHasNewPosts(false);
    setError(null);
    cursorRef.current = null;
    try {
      const fresh = await fetchPage(null);
      setEntries(fresh);
    } catch {
      setError("Memories could not refresh. Please check the connection and try again.");
    }
  }, [fetchPage]);

  return { entries, loading, error, hasMore, hasNewPosts, loadMore, refresh };
}
