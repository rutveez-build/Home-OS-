// A Skill is a named capability the assistant knows about. Each skill ships
// as a small TS object: enough metadata that the LLM can offer it, plus a
// suggested table schema and implementation checklist for adopters to flesh
// out. The chat-core auto-injects every registered skill's `systemPromptHint`
// so the model already knows what it can offer on day one — even before
// adopters have wired the persistence + UI cards.

export type SkillStatus = "scaffold" | "beta" | "live";

export type Skill = {
  /** Stable id, used in slash routing and analytics. */
  id: string;
  /** Human-readable name (used in UI). */
  name: string;
  /** One short line shown on the landing page + in the assistant's brief. */
  oneLiner: string;
  /** A short instruction appended to the assistant's system prompt. */
  systemPromptHint: string;
  /** What a user might say to invoke this. Used for prompting + intent docs. */
  examples: string[];
  /** Optional slash-commands a WhatsApp user can type. */
  slashCommands?: string[];
  /** SQL-ish table sketches an adopter would add via Drizzle. */
  suggestedSchema: string[];
  /** Status: scaffold = metadata only, beta = partial wiring, live = end-to-end. */
  status: SkillStatus;
};
