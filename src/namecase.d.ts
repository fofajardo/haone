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
