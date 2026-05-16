import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Camera, ImagePlus, Lock, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { auth, db, ensureGuestAuth } from "../lib/firebase";
import { deleteCloudinaryUpload, uploadToCloudinary } from "../lib/cloudinary";
import type { UploadedMedia } from "../lib/cloudinary";
import { validateGuestText } from "../lib/contentPolicy";
import { canEditGuestName, readGuestProfile, saveGuestName } from "../lib/guestProfile";
import {
  compressPhoto,
  recordVideoUpload,
  splitAndValidateSelection,
  validateVideoFile,
} from "../lib/mediaPolicy";

export function UploadOrchestrator() {
  const [profile, setProfile] = useState(readGuestProfile());
  const [name, setName] = useState(profile.displayName);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const nameEditable = canEditGuestName(profile);

  function persistName() {
    try {
      const next = saveGuestName(name);
      setProfile(next);
      setName(next.displayName);
      toast.success("Name saved for this device.");
      return next.displayName;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Name could not be saved.");
      return null;
    }
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList || busy) return;
    const savedName = profile.displayName === name.trim() ? profile.displayName : persistName();
    if (!savedName) return;
    setBusy(true);
    setProgress(0);
    const uploaded: UploadedMedia[] = [];
    try {
      await ensureGuestAuth();
      const safeCaption = validateGuestText(caption, 500);
      const { photos, videos } = splitAndValidateSelection(Array.from(fileList));
      const filesToUpload = videos.length
        ? [videos[0]]
        : await Promise.all(photos.map((file) => compressPhoto(file)));
      if (videos.length) await validateVideoFile(videos[0]);

      for (const file of filesToUpload) {
        const media = await uploadToCloudinary(file, (pct) => {
          const itemProgress = pct / filesToUpload.length;
          setProgress(Math.round((uploaded.length / filesToUpload.length) * 100 + itemProgress));
        });
        uploaded.push(media);
      }

      const first = uploaded[0];
      try {
        await addDoc(collection(db, "photobook"), {
          ...first,
          mediaItems: uploaded,
          mediaCount: uploaded.length,
          postType: first.mediaType === "video" ? "video" : "photo",
          uploaderName: savedName,
          caption: safeCaption,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          deletedAt: null,
          isDeleted: false,
          likeCount: 0,
          commentCount: 0,
          ownerUid: auth.currentUser?.uid
        });
      } catch (error) {
        await Promise.all(uploaded.map((media) => deleteCloudinaryUpload(media).catch((e) => console.warn("Cloudinary cleanup failed", e))));
        throw error;
      }
      if (videos.length) recordVideoUpload();
      setCaption("");
      setProgress(0);
      toast.success(uploaded.length > 1 ? "Photo set added!" : "Memory added!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="upload-surface grid gap-4 rounded-xl p-5 sm:p-6" style={{ fontFamily: "Nunito, system-ui, sans-serif" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em]" style={{ color: "#c46a52" }}>Add a Memory</p>
          <h2 className="mt-1 font-serif text-2xl italic text-ink" style={{ fontFamily: "Lora, Georgia, serif" }}>Post to the wedding timeline</h2>
        </div>
        {busy && <span className="rounded-full px-3 py-1 text-xs font-bold text-ivory" style={{ backgroundColor: "#7a9068" }}>Uploading</span>}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          className="input"
          value={name}
          disabled={!nameEditable}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
        <button type="button" className="button-outline" onClick={persistName} disabled={!nameEditable || busy}>
          {nameEditable ? <Save size={18} /> : <Lock size={18} />}
          {profile.displayName ? "Save edit" : "Save name"}
        </button>
      </div>
      <p className="text-xs leading-5 text-ink/55">
        Name is required and saved on this device. One typo edit is allowed.
      </p>
      <textarea
        className="input min-h-24"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Caption or wish (optional)"
      />
      {busy && progress > 0 && (
        <div className="h-2 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-gold transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className={`button ${busy ? "pointer-events-none opacity-60" : ""}`}>
          <Camera size={18} />
          {busy ? "Uploading..." : "Camera"}
          <input
            className="hidden"
            type="file"
            accept="image/*,video/*"
            capture="environment"
            disabled={busy}
            onChange={(e) => void onFiles(e.target.files)}
          />
        </label>
        <label className={`button-outline ${busy ? "pointer-events-none opacity-60" : ""}`}>
          <ImagePlus size={18} />
          Gallery
          <input
            className="hidden"
            type="file"
            accept="image/*,video/*"
            multiple
            disabled={busy}
            onChange={(e) => void onFiles(e.target.files)}
          />
        </label>
      </div>
      <p className="text-xs leading-5 text-ink/55">
        Photos: up to 5 per post. Videos: one clip, 15 seconds max.
      </p>
    </section>
  );
}
