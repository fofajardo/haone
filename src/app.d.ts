// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  const __COMMIT_SHA__: string;
  const __APP_VERSION__: string;
  const __APP_SUFFIX__: string;
  const __BUILD_TIME__: string;
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env?: {
        CONFIG_KV?: {
          get(key: string): Promise<string | null>;
        };
      };
    }
  }
}

// XXX: Remove these once the namecase package is updated to include its own types.
declare module "@compwright/namecase" {
  export interface NamecaseOptions {
    individualFields?: boolean;
  }

  export function checkName(name: string): boolean;
  export function normalize(name: string): string;

  export function namecase(input: string, opt?: NamecaseOptions): string;
  export function namecase(input: string[], opt?: NamecaseOptions): string[];
  export function namecase<T>(input: T, opt?: NamecaseOptions): T;
}

export {};
