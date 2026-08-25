export function normalizeBuzzAgentIdentityBindings(value: unknown): Readonly<Record<string, string>>;

export function resolveBuzzAgentIdentityBinding(input: {
  readonly profileId: string;
  readonly configuredPubkey?: string;
  readonly localBindings?: Readonly<Record<string, string>>;
}): string;
