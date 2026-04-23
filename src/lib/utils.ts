import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { auth } from "$lib/auth.svelte";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let serverCache: Record<string, any> = {};

/**
 * Clears the server API data cache.
 */
export function invalidateServerCache() {
  serverCache = {};
}

/**
 * Unified fetch wrapper for server API calls.
 * Automatically injects auth token and handles 401 unauthorized errors.
 * Includes session-based caching.
 */
export async function fetchServer<T = any>(
  url: string,
  options: RequestInit = {},
  forceRefresh = false
): Promise<T> {
  const isLaundry = url.includes("/api/resident/laundry");
  const useCache = options.method === "GET" || !options.method;

  if (!forceRefresh && !isLaundry && useCache && serverCache[url]) {
    return serverCache[url] as T;
  }

  const headers = new Headers(options.headers || {});
  if (auth.accessToken) {
    headers.set("Authorization", `Bearer ${auth.accessToken}`);
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    auth.logout();
    throw new Error("Session expired. Please sign in again.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `Server error: ${response.statusText}`);
  }

  if (!isLaundry && useCache) {
    serverCache[url] = data;
  }

  return data as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

/**
 * Transforms a standard Google Drive sharing link into a direct link
 * that can be used in an <img> tag.
 */
export function transformGoogleDriveLink(url: string): string {
  if (!url.includes("drive.google.com") && !url.includes("lh3.googleusercontent.com")) {
    return url;
  }

  // Regex to capture Google Drive file ID
  const idRegex = /(?:id=|\/d\/)([a-zA-Z0-9-_]{25,})/;
  const match = url.match(idRegex);

  if (match && match[1]) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }

  return url;
}

/**
 * Compresses an image using Canvas to fit under the target size (MB).
 */
export async function compressImage(file: File, maxSizeMB = 0.7): Promise<Blob | File> {
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Max dimensions for a receipt/announcement image
        const MAX_DIM = 1280;
        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Could not get canvas context");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject("Canvas toBlob failed");
          },
          "image/jpeg",
          0.7
        );
      };
      img.onerror = () => reject("Image load failed");
    };
    reader.onerror = () => reject("File read failed");
  });
}

/**
 * Deletes an uploaded image from Firestore via the proxy API.
 */
export async function deleteUploadedImage(url: string, accessToken: string) {
  if (!url || !url.includes("/api/image/")) {
    return;
  }

  const id = url.split("/api/image/").pop();
  if (!id) {
    return;
  }

  try {
    const resp = await fetch(`/api/image/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!resp.ok) {
      console.warn("Failed to delete image:", await resp.text());
    }
  } catch (err) {
    console.warn("Error deleting image:", err);
  }
}

/**
 * Extracts image IDs from a string of HTML content.
 */
export function extractImageIds(content: string): string[] {
  const regex = /\/api\/image\/([a-f0-9-]{36})/g;
  const ids: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}
