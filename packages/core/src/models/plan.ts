/** Chapter plan status lifecycle: unplanned → pending → approved/rejected → written */
export type PlanStatus = "unplanned" | "pending" | "approved" | "rejected" | "written";

export interface PlanEntry {
  readonly chapter: number;
  readonly status: PlanStatus;
  readonly version: number;
  readonly createdAt?: string;
  readonly approvedAt?: string;
  readonly rejectedAt?: string;
  readonly writtenAt?: string;
  readonly feedback?: string;
}

export interface PlanIndex {
  readonly plans: ReadonlyArray<PlanEntry>;
}

export interface PlanStats {
  readonly total: number;
  readonly unplanned: number;
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
  readonly written: number;
}

/** Truth files snapshot passed to planChapter for context */
export interface PlanTruthFiles {
  readonly storyBible: string;
  readonly volumeOutline: string;
  readonly bookRules: string;
  readonly currentState: string;
  readonly pendingHooks: string;
  readonly subplotBoard: string;
  readonly emotionalArcs: string;
  readonly entityRegistry: string;
  readonly chapterSummaries: string;
  readonly characterMatrix: string;
}
