export interface CmdSlashSuggestion {
  readonly category: string;
  readonly command: string;
  readonly description: string;
}

export const CMD_SLASH_COMMANDS: readonly Readonly<CmdSlashSuggestion>[];
export function findCmdSlashSuggestions(value: unknown, limit?: number): readonly Readonly<CmdSlashSuggestion>[];
