// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { PageInfo } from "$lib/types";

declare global {
  const __COMMIT_SHA__: string;
  const __APP_VERSION__: string;
  namespace App {
    // interface Error {}
    // interface Locals {}
    interface PageData {
      pageInfo: PageInfo;
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
