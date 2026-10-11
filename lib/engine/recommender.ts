import type {
  AffectRecord,
  ContentPackage,
  GenericItem,
  LearningLoopType,
  SkillDefinition,
  SkillId,
} from "../types/als.ts";
import { affectAdjustedDifficulty } from "./affect.ts";
import { targetDifficulty } from "./bkt.ts";
import { averageMastery, getActivePathIndex, getWeakestSkillForKU } from "./graph.ts";

export interface RecommendationResult {
  item: GenericItem;
  targetDifficulty: string;
  targetSkill: SkillDefinition;
  rationale: string;
  loopName: string;
  loopDescription: string;
}

export function recommendNextItem(
  pkg: ContentPackage,
  skills: Record<SkillId, SkillDefinition>,
  attemptedIds: string[] = [],
  currentId?: string,
  latestAffect?: AffectRecord,
  loopType: LearningLoopType = "guided_learning"
): RecommendationResult {
  const { curriculum, items } = pkg;

  let targetKuIndex = getActivePathIndex(curriculum, skills);
  let loopName = "Guided Learning";
  let loopDescription = "Scaffolded practice targeting your active learning frontier with adaptive difficulty and worked examples.";
  let preferredDifficulty: "Easy" | "Medium" | "Hard" | null = null;

  // 1. Differentiate by Learning Loop
  if (loopType === "mastery_check") {
    loopName = "Mastery Check";
    loopDescription = "Diagnostic check to rapidly evaluate whether you have mastered this concept.";
    // Mastery check prefers Medium/Hard items for concise diagnostic evaluation
    preferredDifficulty = "Medium";
  } else if (loopType === "revision") {
    loopName = "Revision Mode";
    loopDescription = "Spaced retrieval practice across previously mastered concepts to strengthen retention.";

    // Find mastered KUs (>= 80%)
    const masteredEntries = curriculum
      .map((node, index) => ({ node, index, score: averageMastery(node.skills, skills) }))
      .filter((entry) => entry.score >= 0.8);

    if (masteredEntries.length > 0) {
      // Pick the mastered KU with the lowest relative score among mastered ones
      masteredEntries.sort((a, b) => a.score - b.score);
      targetKuIndex = masteredEntries[0].index;
    } else {
      // If none mastered yet, review the first foundational KU
      targetKuIndex = 0;
    }
  } else if (loopType === "test_myself") {
    loopName = "Test Myself";
    loopDescription = "Interleaved practice across multiple topics to check broader conceptual understanding.";

    // Sample across different KUs across the entire curriculum
    const candidateKus = curriculum.map((_, idx) => idx);
    // Deterministically pick a different KU from the current item if possible
    const currentItem = items.find((i) => i.id === currentId);
    const currentKuIndex = curriculum.findIndex((k) => k.ku === currentItem?.ku);
    const otherKuIndices = candidateKus.filter((idx) => idx !== currentKuIndex);
    targetKuIndex = otherKuIndices.length > 0
      ? otherKuIndices[Math.floor(Math.random() * otherKuIndices.length)]
      : 0;
  }

  const activeNode = curriculum[targetKuIndex] ?? curriculum[0];
  const targetSkill = getWeakestSkillForKU(activeNode, skills);
  const baseDifficulty = preferredDifficulty ?? targetDifficulty(targetSkill.mastery);
  const supportDifficulty = loopType === "guided_learning"
    ? affectAdjustedDifficulty(baseDifficulty, latestAffect)
    : baseDifficulty;

  // 2. Candidate Filtering
  const otherItems = items.filter((item) => item.id !== currentId);
  const kuItems = otherItems.filter((item) => item.ku === activeNode.ku);
  const skillItems = kuItems.filter((item) => item.skill === targetSkill.id);

  // Match priority:
  const matchA = skillItems.find(
    (item) => item.difficulty === supportDifficulty && !attemptedIds.includes(item.id)
  );
  const matchB = skillItems.find((item) => !attemptedIds.includes(item.id));
  const matchC = kuItems.find(
    (item) => item.difficulty === supportDifficulty && !attemptedIds.includes(item.id)
  );
  const matchD = kuItems.find((item) => !attemptedIds.includes(item.id));
  const matchE = otherItems.find(
    (item) => item.difficulty === supportDifficulty && !attemptedIds.includes(item.id)
  );
  const matchF = otherItems.find((item) => !attemptedIds.includes(item.id));
  const matchG = kuItems[0];
  const finalItem = matchA ?? matchB ?? matchC ?? matchD ?? matchE ?? matchF ?? matchG ?? otherItems[0] ?? items[0];

  const rationale = `${loopName}: Recommend "${finalItem.title}" for ${activeNode.ku} ("${targetSkill.label}") at ${supportDifficulty} difficulty.`;

  return {
    item: finalItem,
    targetDifficulty: supportDifficulty,
    targetSkill,
    rationale,
    loopName,
    loopDescription,
  };
}
