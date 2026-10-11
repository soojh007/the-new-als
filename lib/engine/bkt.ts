import type { BktCalculation, Difficulty, SkillDefinition, SkillId } from "../types/als.ts";

export const DEFAULT_MASTERY_THRESHOLD = 0.8;

export function normalizeAnswer(value: string): string {
  return value.toLowerCase().trim().replace(/[.!?]/g, "").replace(/\s+/g, " ");
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function decimal(value: number, digits = 3): string {
  return value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Calculates standard Bayesian Knowledge Tracing posterior and updated mastery.
 */
export function calculateBkt(skill: SkillDefinition, correct: boolean): BktCalculation {
  const { mastery, guess, slip, learn } = skill;
  const knownObservationRate = correct ? 1 - slip : slip;
  const unknownObservationRate = correct ? guess : 1 - guess;
  const knownEvidence = mastery * knownObservationRate;
  const unknownEvidence = (1 - mastery) * unknownObservationRate;
  const denominator = knownEvidence + unknownEvidence;
  const posterior = denominator === 0 ? mastery : knownEvidence / denominator;
  const afterLearning = Math.min(0.98, Math.max(0.02, posterior + (1 - posterior) * learn));

  return {
    correct,
    skillLabel: skill.label,
    masteryBefore: mastery,
    complement: 1 - mastery,
    knownObservationRate,
    unknownObservationRate,
    knownEvidence,
    unknownEvidence,
    posterior,
    afterLearning,
    learn,
  };
}

/**
 * Updates a specific skill in the skill registry after a student response.
 */
export function updateSkillMastery(
  skills: Record<SkillId, SkillDefinition>,
  skillId: SkillId,
  correct: boolean
): { updatedSkills: Record<SkillId, SkillDefinition>; calculation: BktCalculation } {
  const currentSkill = skills[skillId];
  if (!currentSkill) {
    throw new Error(`Skill ${skillId} not found in skill registry`);
  }

  const calculation = calculateBkt(currentSkill, correct);
  const updatedSkills: Record<SkillId, SkillDefinition> = {
    ...skills,
    [skillId]: {
      ...currentSkill,
      mastery: calculation.afterLearning,
    },
  };

  return { updatedSkills, calculation };
}

/**
 * Maps mastery level to pedagogical target difficulty.
 */
export function targetDifficulty(mastery: number): Difficulty {
  if (mastery < 0.35) {
    return "Easy";
  }
  if (mastery < 0.7) {
    return "Medium";
  }
  return "Hard";
}

/**
 * Computes cognitive load weight for a given difficulty level.
 */
export function difficultyLoad(difficulty: Difficulty): number {
  if (difficulty === "Easy") {
    return 0.35;
  }
  if (difficulty === "Medium") {
    return 0.6;
  }
  return 0.85;
}
