// Minimal ClassValue type used by the `cn` helper in utils.ts.
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };
