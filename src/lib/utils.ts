import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { auth } from "$lib/auth.svelte";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Unified fetch wrapper for server API calls.
 * Automatically injects auth token and handles 401 unauthorized errors.
 */
export async function fetchServer<T = any>(url: string, options: RequestInit = {}): Promise<T> {
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

  return data as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
