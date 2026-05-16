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

export type VideoMetadata = { duration: number; width: number; height: number };

export type PreparedVideo = {
  file: File;
  metadata: VideoMetadata;
  trimmed: boolean;
  warning?: string;
};

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

export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
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

function maxDurationForSize(fileSize: number, duration: number, maxSize: number) {
  const bytesPerSecond = fileSize / Math.max(duration, 0.1);
  return Math.max(0.5, Math.min((maxSize / bytesPerSecond) * 0.9, duration, MAX_VIDEO_SECONDS));
}

function trimFileName(name: string) {
  return name.replace(/\.[^.]+$/, "-trimmed.webm");
}

export function videoRequiresTrim(file: File, metadata: VideoMetadata) {
  return metadata.duration > MAX_VIDEO_SECONDS + 0.25 || file.size > MAX_VIDEO_BYTES;
}

export async function trimVideoToFit(file: File, metadata?: VideoMetadata): Promise<File> {
  if (!("MediaRecorder" in window)) {
    throw new Error("This browser cannot trim video. Please choose a shorter clip.");
  }

  const sourceMetadata = metadata ?? await getVideoMetadata(file);
  const sourceUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.captureStream) {
    URL.revokeObjectURL(sourceUrl);
    throw new Error("This browser cannot prepare video trimming.");
  }

  const ratio = Math.min(1, 1920 / Math.max(1, sourceMetadata.width), 1080 / Math.max(1, sourceMetadata.height));
  const width = Math.max(2, Math.floor((sourceMetadata.width * ratio) / 2) * 2);
  const height = Math.max(2, Math.floor((sourceMetadata.height * ratio) / 2) * 2);
  const endAt = Math.min(sourceMetadata.duration, MAX_VIDEO_SECONDS, maxDurationForSize(file.size, sourceMetadata.duration, MAX_VIDEO_BYTES));
  canvas.width = width || 1280;
  canvas.height = height || 720;

  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30);
    let audioContext: AudioContext | null = null;
    try {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
        const sourceNode = audioContext.createMediaElementSource(video);
        const destination = audioContext.createMediaStreamDestination();
        sourceNode.connect(destination);
        const audioTrack = destination.stream.getAudioTracks()[0];
        if (audioTrack) stream.addTrack(audioTrack);
      }
    } catch {
      audioContext = null;
    }

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 4_000_000,
    });
    const chunks: Blob[] = [];

    function cleanup() {
      video.pause();
      stream.getTracks().forEach((track) => track.stop());
      URL.revokeObjectURL(sourceUrl);
      if (audioContext) void audioContext.close();
    }

    function fail(error: Error) {
      if (recorder.state !== "inactive") recorder.stop();
      cleanup();
      reject(error);
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => fail(new Error("Video trimming failed."));
    recorder.onstop = () => {
      cleanup();
      const blob = new Blob(chunks, { type: "video/webm" });
      if (blob.size > MAX_VIDEO_BYTES) {
        reject(new Error("Trimmed video is still too large. Please choose a shorter clip."));
        return;
      }
      resolve(new File([blob], trimFileName(file.name), { type: "video/webm" }));
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = sourceUrl;
    video.onerror = () => fail(new Error("Could not read video for trimming."));
    let recordingStarted = false;
    const startRecording = () => {
      if (recordingStarted) return;
      recordingStarted = true;
      recorder.start(100);
      void video.play().then(() => {
        const drawFrame = () => {
          if (video.currentTime >= endAt || video.ended || video.paused) {
            if (recorder.state !== "inactive") recorder.stop();
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawFrame);
        };
        drawFrame();
      }).catch(() => fail(new Error("Browser blocked video trimming.")));
    };

    video.onloadedmetadata = () => {
      video.currentTime = 0;
      window.setTimeout(startRecording, 120);
    };
    video.onseeked = startRecording;
  });
}

export async function prepareVideoForUpload(file: File): Promise<PreparedVideo> {
  if (!file.type.startsWith("video/")) throw new Error("Please choose a video file.");
  validateVideoAllowance();
  const metadata = await getVideoMetadata(file);
  if (!videoRequiresTrim(file, metadata)) {
    return {
      file,
      metadata,
      trimmed: false,
      warning: file.size > TARGET_VIDEO_BYTES ? "Video is close to the event limit." : undefined,
    };
  }
  const trimmed = await trimVideoToFit(file, metadata);
  const trimmedMetadata = await getVideoMetadata(trimmed);
  return { file: trimmed, metadata: trimmedMetadata, trimmed: true };
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
