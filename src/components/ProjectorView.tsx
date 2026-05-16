import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";

type SlideEntry = {
  id: string;
  mediaUrl: string;
  mediaItems?: Array<{ mediaUrl: string; mediaType: "image" | "video" }>;
  uploaderName: string;
  caption: string;
};

export function ProjectorView() {
  const [slides, setSlides] = useState<SlideEntry[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    getDocs(
      query(
        collection(db, "photobook"),
        where("isDeleted", "==", false),
        where("mediaType", "==", "image"),
        orderBy("createdAt", "desc")
      )
    ).then((snap) =>
      setSlides(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SlideEntry, "id">) })))
    );
  }, []);

  useEffect(() => {
    if (!slides.length) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => clearTimeout(t);
  }, [index, slides.length]);

  if (!slides.length) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-ivory">
        Waiting for memories...
      </div>
    );
  }

  const slide = slides[index];
  const imageUrl = slide.mediaItems?.find((item) => item.mediaType === "image")?.mediaUrl ?? slide.mediaUrl;
  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      <img
        key={slide.id}
        src={imageUrl}
        alt={slide.caption}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ animation: "ken-burns 8s ease-in-out forwards" }}
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-8 pb-10 pt-16">
        <p className="text-xl font-semibold text-ivory">{slide.uploaderName}</p>
        {slide.caption && <p className="mt-1 text-sm text-ivory/70">{slide.caption}</p>}
      </div>
    </div>
  );
}
