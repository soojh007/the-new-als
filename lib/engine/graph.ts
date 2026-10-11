import type {
  Chapter,
  DomainEdge,
  GraphNodeLayout,
  KnowledgeUnit,
  MasterySummary,
  SkillDefinition,
  SkillId,
} from "../types/als.ts";
import { DEFAULT_MASTERY_THRESHOLD } from "./bkt.ts";

/**
 * Calculates average mastery for an array of skills.
 */
export function averageMastery(
  skillIds: SkillId[],
  skillState: Record<SkillId, SkillDefinition>
): number {
  if (skillIds.length === 0) return 0;
  const validSkills = skillIds.filter((id) => skillState[id] !== undefined);
  if (validSkills.length === 0) return 0;
  const sum = validSkills.reduce((acc, id) => acc + skillState[id].mastery, 0);
  return sum / validSkills.length;
}

/**
 * Identifies the currently active Knowledge Unit index in the learning sequence.
 */
export function getActivePathIndex(
  curriculum: KnowledgeUnit[],
  skillState: Record<SkillId, SkillDefinition>,
  threshold = DEFAULT_MASTERY_THRESHOLD
): number {
  const index = curriculum.findIndex(
    (node) => averageMastery(node.skills, skillState) < threshold
  );
  return index === -1 ? curriculum.length - 1 : index;
}

/**
 * Checks whether all Knowledge Units in the curriculum meet the mastery threshold.
 */
export function isCourseComplete(
  curriculum: KnowledgeUnit[],
  skillState: Record<SkillId, SkillDefinition>,
  threshold = DEFAULT_MASTERY_THRESHOLD
): boolean {
  return curriculum.every(
    (node) => averageMastery(node.skills, skillState) >= threshold
  );
}

/**
 * Finds the weakest skill within the currently active Knowledge Unit.
 */
export function getWeakestSkillForKU(
  node: KnowledgeUnit,
  skillState: Record<SkillId, SkillDefinition>
): SkillDefinition {
  const nodeSkills = node.skills
    .map((id) => skillState[id])
    .filter((s): s is SkillDefinition => Boolean(s));

  if (nodeSkills.length === 0) {
    const firstSkill = Object.values(skillState)[0];
    return firstSkill ?? { id: "unknown", label: "General", description: "", mastery: 0, learn: 0.1, guess: 0.1, slip: 0.1 };
  }

  return [...nodeSkills].sort((a, b) => a.mastery - b.mastery)[0];
}

/**
 * Computes a comprehensive mastery and readiness summary for the active session.
 */
export function calculateMasterySummary(
  curriculum: KnowledgeUnit[],
  skillState: Record<SkillId, SkillDefinition>,
  threshold = DEFAULT_MASTERY_THRESHOLD
): MasterySummary {
  const activeIndex = getActivePathIndex(curriculum, skillState, threshold);
  const activeNode = curriculum[activeIndex] ?? curriculum[0];
  const activeProgress = averageMastery(activeNode.skills, skillState);
  const nodeSkills = activeNode.skills
    .map((id) => skillState[id])
    .filter((s): s is SkillDefinition => Boolean(s))
    .sort((a, b) => a.mastery - b.mastery);

  const weakestSkill = nodeSkills[0] ?? {
    id: "unknown",
    label: "General Concept",
    description: "",
    mastery: 0,
    learn: 0.1,
    guess: 0.1,
    slip: 0.1,
  };
  const strongestSkill = nodeSkills[nodeSkills.length - 1] ?? weakestSkill;

  const prereqNode = activeIndex > 0 ? curriculum[activeIndex - 1] : null;
  const readiness = prereqNode ? averageMastery(prereqNode.skills, skillState) : 1;
  const prerequisiteGap = Math.max(0, threshold - readiness);
  const isUnlocked = readiness >= threshold;
  const complete = isCourseComplete(curriculum, skillState, threshold);

  return {
    activePathIndex: activeIndex,
    activePathNode: activeNode,
    activePathProgress: activeProgress,
    weakestSkill,
    strongestSkill,
    readiness,
    prerequisiteGap,
    isUnlocked,
    isCourseComplete: complete,
  };
}

/**
 * Dynamically computes a responsive SVG DAG node layout for any arbitrary subject/curriculum.
 */
export function generateDynamicGraphLayout(
  curriculum: KnowledgeUnit[],
  chapters: Chapter[],
  courseTitle = "Domain Model",
  viewWidth = 920
): {
  nodes: GraphNodeLayout[];
  inclusionLinks: [string, string][];
  sequenceLinks: [string, string][];
  pertinenceLinks: [string, string][];
} {
  const nodes: GraphNodeLayout[] = [];
  const inclusionLinks: [string, string][] = [];
  const sequenceLinks: [string, string][] = [];
  const pertinenceLinks: [string, string][] = [];

  // 1. Root Course Node
  const centerX = Math.round(viewWidth / 2);
  nodes.push({
    id: "course",
    label: courseTitle,
    x: centerX,
    y: 45,
    kind: "course",
  });

  // If no chapters defined, construct default chapter
  const effectiveChapters: Chapter[] =
    chapters.length > 0
      ? chapters
      : [{ id: "chapter-main", title: "Core Modules", kus: curriculum.map((k) => k.ku) }];

  // 2. Chapter Nodes
  const chapterCount = effectiveChapters.length;
  const chapterSpacing = viewWidth / (chapterCount + 1);

  effectiveChapters.forEach((chapter, index) => {
    const chapterX = Math.round(chapterSpacing * (index + 1));
    const chapterY = 125;

    nodes.push({
      id: chapter.id,
      label: chapter.title,
      x: chapterX,
      y: chapterY,
      kind: "chapter",
    });

    inclusionLinks.push(["course", chapter.id]);

    // 3. KU Nodes under Chapter
    const kusInChapter = chapter.kus;
    const kuCount = kusInChapter.length;

    kusInChapter.forEach((kuId, kuIndex) => {
      const row = kuIndex % 3;
      const col = Math.floor(kuIndex / 3);
      const rowY = 230 + row * 110;
      const colOffset = (col - (Math.ceil(kuCount / 3) - 1) / 2) * 110;
      const kuX = Math.max(70, Math.min(viewWidth - 70, Math.round(chapterX + colOffset)));

      const kuObj = curriculum.find((k) => k.ku === kuId);
      const label = kuObj ? kuObj.ku : kuId;

      nodes.push({
        id: kuId,
        label,
        x: kuX,
        y: rowY,
        kind: "ku",
        chapterId: chapter.id,
      });

      inclusionLinks.push([chapter.id, kuId]);
    });
  });

  // 4. Sequential links between consecutive KUs in curriculum
  for (let i = 0; i < curriculum.length - 1; i++) {
    sequenceLinks.push([curriculum[i].ku, curriculum[i + 1].ku]);
  }

  // 5. Derive pertinence/prerequisite links across chapters or common prerequisites
  for (let i = 0; i < curriculum.length; i++) {
    const currentKu = curriculum[i];
    for (let j = i + 1; j < curriculum.length; j++) {
      const targetKu = curriculum[j];
      const sharedSkills = currentKu.skills.filter((s) => targetKu.skills.includes(s));
      if (sharedSkills.length > 0 && j > i + 1) {
        pertinenceLinks.push([currentKu.ku, targetKu.ku]);
      }
    }
  }

  return {
    nodes,
    inclusionLinks,
    sequenceLinks,
    pertinenceLinks,
  };
}
