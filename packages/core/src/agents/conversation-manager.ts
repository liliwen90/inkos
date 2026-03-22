/**
 * ConversationManager — manages multi-turn chat state for any agent.
 * Handles context window truncation, dynamic system prompts, and phase transitions.
 */

import type { LLMMessage } from "../llm/provider.js";

export interface ConversationPhase {
  readonly name: string;
  readonly systemPrompt: string;
  /** Max user+assistant turns to keep in context (oldest trimmed first) */
  readonly maxTurns?: number;
}

export interface ConversationState {
  readonly phase: string;
  readonly turns: ReadonlyArray<LLMMessage>;
  readonly metadata: Record<string, unknown>;
}

export class ConversationManager {
  private phases: Map<string, ConversationPhase> = new Map();
  private currentPhase: string = "";
  private turns: LLMMessage[] = [];
  private metadata: Record<string, unknown> = {};
  private maxTurns: number = 20;

  /** Register available phases */
  registerPhases(phases: ConversationPhase[]): void {
    for (const p of phases) {
      this.phases.set(p.name, p);
    }
    if (phases.length > 0 && !this.currentPhase) {
      this.currentPhase = phases[0].name;
    }
  }

  /** Switch to a different phase (changes system prompt) */
  setPhase(phaseName: string): void {
    if (!this.phases.has(phaseName)) throw new Error(`Unknown phase: ${phaseName}`);
    this.currentPhase = phaseName;
  }

  getPhase(): string {
    return this.currentPhase;
  }

  /** Store arbitrary metadata (e.g., selected language, genre, book title) */
  setMeta(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  getMeta(key: string): unknown {
    return this.metadata[key];
  }

  /** Add a user message */
  addUserMessage(content: string): void {
    this.turns.push({ role: "user", content });
    this.trimTurns();
  }

  /** Add an assistant message (after receiving full response) */
  addAssistantMessage(content: string): void {
    this.turns.push({ role: "assistant", content });
    this.trimTurns();
  }

  /** Inject a system-level context message (e.g., search results, file contents) */
  injectContext(content: string): void {
    this.turns.push({ role: "user", content: `[系统上下文]\n${content}` });
    this.trimTurns();
  }

  /** Build the full message array for LLM call (system prompt + trimmed turns) */
  buildMessages(): LLMMessage[] {
    const phase = this.phases.get(this.currentPhase);
    if (!phase) return [...this.turns];

    // Interpolate metadata into system prompt
    let systemPrompt = phase.systemPrompt;
    for (const [key, val] of Object.entries(this.metadata)) {
      systemPrompt = systemPrompt.replaceAll(`{${key}}`, String(val ?? ""));
    }

    return [
      { role: "system", content: systemPrompt },
      ...this.turns,
    ];
  }

  /** Get the full conversation state (for persistence) */
  getState(): ConversationState {
    return {
      phase: this.currentPhase,
      turns: [...this.turns],
      metadata: { ...this.metadata },
    };
  }

  /** Restore from saved state */
  restoreState(state: ConversationState): void {
    this.currentPhase = state.phase;
    this.turns = [...state.turns];
    this.metadata = { ...state.metadata };
  }

  /** Clear all conversation history */
  reset(): void {
    this.turns = [];
    this.metadata = {};
    if (this.phases.size > 0) {
      this.currentPhase = this.phases.keys().next().value!;
    }
  }

  getTurns(): ReadonlyArray<LLMMessage> {
    return this.turns;
  }

  getTurnCount(): number {
    return this.turns.filter(t => t.role === "user").length;
  }

  private trimTurns(): void {
    const phase = this.phases.get(this.currentPhase);
    const limit = phase?.maxTurns ?? this.maxTurns;
    // Count user-assistant pairs, trim from the front
    while (this.turns.length > limit * 2 + 2) {
      this.turns.shift();
    }
  }
}
