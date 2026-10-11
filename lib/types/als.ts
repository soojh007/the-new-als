export type SkillId = string;
export type KnowledgeUnitId = string;
export type Difficulty = "Easy" | "Medium" | "Hard";
export type AlpStage = "ALP1" | "ALP2" | "ALP3" | "QUIZ";
export type LearningLoopType = "guided_learning" | "mastery_check" | "revision" | "test_myself";

export interface SkillDefinition {
  id: SkillId;
  label: string;
  description: string;
  mastery: number; // default prior P(L0)
  learn: number;   // P(T)
  guess: number;   // P(G)
  slip: number;    // P(S)
}

export interface GenericItem {
  id: string;
  ku: KnowledgeUnitId;
  skill: SkillId;
  sourcePage?: number;
  title: string;
  prompt: string;
  alpStage?: AlpStage;
  difficulty: Difficulty;
  answer: string;
  options: string[];
  hints: string[];
  scaffold: string;
  workedExample?: {
    label: string;
    detail: string;
  }[];
  answerStatus?: string;
}

export interface KnowledgeUnit {
  ku: KnowledgeUnitId;
  title: string;
  goal: string;
  skills: SkillId[];
  chapter?: string;
}

export interface DomainEdge {
  from: string;
  to: string;
  type: "inclusion" | "sequence" | "pertinence" | "prerequisite";
}

export interface Chapter {
  id: string;
  title: string;
  kus: KnowledgeUnitId[];
}

export interface ContentPackage {
  id: string;
  subject: string;
  title: string;
  level: string;
  description: string;
  chapters: Chapter[];
  curriculum: KnowledgeUnit[];
  skills: SkillDefinition[];
  items: GenericItem[];
  edges?: DomainEdge[];
}

export type FlowZone = "Overwhelmed" | "Struggle" | "Developing" | "Focused" | "Growth" | "Immersed";
export type AbleCode = "ABLE 1" | "ABLE 2" | "ABLE 3" | "ABLE 4";

export interface AffectiveTelemetry {
  correct: boolean;
  timeSeconds: number;
  hints: number;
  answerChanges: number;
  attempt: number;
  masteryBefore: number;
}

export interface AffectRecord extends AffectiveTelemetry {
  problemTitle: string;
  skillLabel: string;
  masteryAfter: number;
  zone: FlowZone;
  able: AbleCode;
  support: string;
}

export interface BktCalculation {
  correct: boolean;
  skillLabel: string;
  masteryBefore: number;
  complement: number;
  knownObservationRate: number;
  unknownObservationRate: number;
  knownEvidence: number;
  unknownEvidence: number;
  posterior: number;
  afterLearning: number;
  learn: number;
}

export interface GraphNodeLayout {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "course" | "chapter" | "ku";
  chapterId?: string;
}

export interface EventLog {
  label: string;
  detail: string;
  correct?: boolean;
  timestamp?: number;
}

export interface MasterySummary {
  activePathIndex: number;
  activePathNode: KnowledgeUnit;
  activePathProgress: number;
  weakestSkill: SkillDefinition;
  strongestSkill: SkillDefinition;
  readiness: number;
  prerequisiteGap: number;
  isUnlocked: boolean;
  isCourseComplete: boolean;
}
