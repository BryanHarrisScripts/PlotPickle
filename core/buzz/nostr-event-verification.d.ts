export type NormalizedNostrEvent = {
  readonly id: string;
  readonly pubkey: string;
  readonly sig: string;
  readonly content: string;
  readonly created_at: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
};

export type NostrSignatureVerification = {
  readonly valid: boolean;
  readonly eventId: string;
  readonly pubkey: string;
  readonly reason: string;
};

export function normalizeNostrEvent(value: unknown): NormalizedNostrEvent | null;
export function canonicalNostrEventId(value: unknown): string;
export function verifyNostrEventSignature(value: unknown): NostrSignatureVerification;
