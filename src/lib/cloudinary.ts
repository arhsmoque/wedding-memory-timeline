import { getAppCheckToken } from "./firebase";

type SignedUpload = {
  uploadUrl: string;
  fields: Record<string, string | number>;
  publicId: string;
};

export type UploadedMedia = {
  mediaUrl: string;
  mediaPublicId: string;
  mediaType: "image" | "video";
  width?: number;
  height?: number;
  duration?: number;
};

async function appCheckHeaders(contentType = "application/json") {
  const headers: Record<string, string> = { "content-type": contentType };
  const token = await getAppCheckToken();
  if (token) headers["x-firebase-appcheck"] = token;
  return headers;
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok || response.status < 500 || attempt === attempts - 1) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error("Network request failed");
}

export async function uploadToCloudinary(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{
  mediaUrl: string;
  mediaPublicId: string;
  mediaType: "image" | "video";
  width?: number;
  height?: number;
  duration?: number;
}> {
  const signResponse = await fetchWithRetry(import.meta.env.VITE_UPLOAD_WORKER_URL, {
    method: "POST",
    headers: await appCheckHeaders(),
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size })
  });
  if (!signResponse.ok) throw new Error("Upload was not accepted");
  const signed = (await signResponse.json()) as SignedUpload;

  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(signed.fields)) {
    form.append(key, String(value));
  }

  const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as Record<string, unknown>);
      } else {
        reject(new Error("Cloudinary upload failed"));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.open("POST", signed.uploadUrl);
    xhr.send(form);
  });

  return {
    mediaUrl: data.secure_url as string,
    mediaPublicId: (data.public_id as string) || signed.publicId,
    mediaType: data.resource_type === "video" ? "video" : "image",
    width: data.width as number | undefined,
    height: data.height as number | undefined,
    duration: data.duration as number | undefined
  };
}

export async function deleteCloudinaryUpload(media: Pick<UploadedMedia, "mediaPublicId" | "mediaType">) {
  const response = await fetchWithRetry(import.meta.env.VITE_UPLOAD_WORKER_URL, {
    method: "DELETE",
    headers: await appCheckHeaders(),
    body: JSON.stringify({ publicId: media.mediaPublicId, mediaType: media.mediaType })
  });
  if (!response.ok) throw new Error("Cloudinary cleanup failed");
}
