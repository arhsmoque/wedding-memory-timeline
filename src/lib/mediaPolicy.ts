export const MAX_PHOTOS_PER_POST = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TARGET_LONG_EDGE = 1800;
export const PHOTO_JPEG_QUALITY = 0.8;

export const MAX_VIDEOS_PER_DEVICE = 3;
export const MAX_VIDEO_BYTES = 10 * 1024 * 1024;
export const TARGET_VIDEO_BYTES = 7.5 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 15;
export const VIDEO_COOLDOWN_MS = 10_000;

const VIDEO_COUNT_KEY = "ash2026_video_upload_count_v1";
const VIDEO_COOLDOWN_KEY = "ash2026_video_cooldown_until_v1";

export function readVideoUploadCount() {
  return Number(localStorage.getItem(VIDEO_COUNT_KEY) || "0");
}

export function recordVideoUpload() {
  const next = readVideoUploadCount() + 1;
  localStorage.setItem(VIDEO_COUNT_KEY, String(next));
  localStorage.setItem(VIDEO_COOLDOWN_KEY, String(Date.now() + VIDEO_COOLDOWN_MS));
  return next;
}

export function remainingVideoCooldownMs() {
  return Math.max(0, Number(localStorage.getItem(VIDEO_COOLDOWN_KEY) || "0") - Date.now());
}

export function validateVideoAllowance() {
  if (readVideoUploadCount() >= MAX_VIDEOS_PER_DEVICE) {
    throw new Error("This device has reached the video upload limit for the event.");
  }
  const cooldown = remainingVideoCooldownMs();
  if (cooldown > 0) {
    throw new Error(`Please wait ${Math.ceil(cooldown / 1000)} seconds before uploading another video.`);
  }
}

export async function getVideoMetadata(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video details."));
    };
    video.src = url;
  });
}

export async function validateVideoFile(file: File) {
  if (!file.type.startsWith("video/")) throw new Error("Please choose a video file.");
  validateVideoAllowance();
  const metadata = await getVideoMetadata(file);
  if (metadata.duration > MAX_VIDEO_SECONDS + 0.25) {
    throw new Error(`Videos must be ${MAX_VIDEO_SECONDS} seconds or shorter.`);
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Video is too large. Please choose a shorter WhatsApp-style clip.");
  }
  if (file.size > TARGET_VIDEO_BYTES) {
    throw new Error("Video is close to the event limit. Please use normal/standard quality if upload fails.");
  }
  return metadata;
}

export async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose image files only.");
  if (file.size <= MAX_PHOTO_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_TARGET_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare photo compression.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", PHOTO_JPEG_QUALITY);
  });
  if (!blob) throw new Error("Could not compress photo.");
  if (blob.size > MAX_PHOTO_BYTES) throw new Error("Photo is still too large after compression.");
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export function splitAndValidateSelection(files: File[]) {
  const photos = files.filter((file) => file.type.startsWith("image/"));
  const videos = files.filter((file) => file.type.startsWith("video/"));
  if (!photos.length && !videos.length) throw new Error("Please choose photos or a short video.");
  if (photos.length && videos.length) throw new Error("Please upload photos and videos separately.");
  if (videos.length > 1) throw new Error("Please upload one video at a time.");
  if (photos.length > MAX_PHOTOS_PER_POST) throw new Error(`Please choose up to ${MAX_PHOTOS_PER_POST} photos per post.`);
  return { photos, videos };
}
