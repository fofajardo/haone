// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { PageInfo } from "$lib/types";

declare global {
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
