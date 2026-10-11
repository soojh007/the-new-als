import type { AbleCode, AffectiveTelemetry, AffectRecord, Difficulty, FlowZone, GenericItem, SkillDefinition } from "../types/als.ts";
import { difficultyLoad } from "./bkt.ts";

export function inferFlowZone(difficulty: Difficulty, signal: AffectiveTelemetry): FlowZone {
  const challengeGap = difficultyLoad(difficulty) - signal.masteryBefore;
  const longPause = signal.timeSeconds >= 75;
  const quickGuess = signal.timeSeconds <= 8 && !signal.correct && signal.hints === 0;
  const repeatedAttempt = signal.attempt >= 2;
  const heavySupport = signal.hints >= 2 || signal.answerChanges >= 4;

  if (signal.correct && signal.masteryBefore >= 0.8 && !longPause && signal.hints === 0) {
    return "Immersed";
  }

  if (!signal.correct && (repeatedAttempt || heavySupport || longPause || challengeGap > 0.3)) {
    return "Overwhelmed";
  }

  if (!signal.correct || quickGuess) {
    return "Struggle";
  }

  if (signal.hints > 0 || longPause || challengeGap > 0.25) {
    return "Developing";
  }

  if (signal.masteryBefore >= 0.65) {
    return "Growth";
  }

  return "Focused";
}

export function ableFromSignal(zone: FlowZone, mastered: boolean): { able: AbleCode; label: string; support: string } {
  if (mastered) {
    return {
      able: "ABLE 4",
      label: "Completion reinforcement",
      support: "Celebrate mastery and stop required practice; offer review or enrichment only.",
    };
  }

  if (zone === "Overwhelmed") {
    return {
      able: "ABLE 1",
      label: "Avoiding loss focus",
      support: "Lower the difficulty, show a worked example, then ask one repair question.",
    };
  }

  if (zone === "Struggle" || zone === "Developing") {
    return {
      able: "ABLE 2",
      label: "Endowed progress",
      support: "Name the progress already made and continue with scaffolded practice.",
    };
  }

  return {
    able: "ABLE 3",
    label: "Goal gradient strategy",
    support: "Show that the learner is close and give a targeted next item.",
  };
}

export function affectAdjustedDifficulty(baseDifficulty: Difficulty, affect?: AffectRecord): Difficulty {
  if (!affect) {
    return baseDifficulty;
  }

  if (affect.able === "ABLE 1") {
    return "Easy";
  }

  if (affect.able === "ABLE 2" && baseDifficulty === "Hard") {
    return "Medium";
  }

  return baseDifficulty;
}

export function ableStudentMessage(record: AffectRecord): string {
  if (record.able === "ABLE 1") {
    return "This part needs a slower step. Review the worked example below, then try a similar repair question.";
  }

  if (record.able === "ABLE 2") {
    return "You are making progress. Keep using your steps: check the main concept first, then apply the rule.";
  }

  if (record.able === "ABLE 3") {
    return "You are close. One targeted question should help confirm this concept.";
  }

  return "You have mastered this section. Required practice can stop, or you can choose a review or challenge.";
}

export function generateWorkedExample(item: GenericItem, skill?: SkillDefinition): { label: string; detail: string }[] {
  if (item.workedExample && item.workedExample.length > 0) {
    return item.workedExample;
  }

  const skillName = skill?.label ?? "Target Concept";

  return [
    {
      label: "Step 1: Read the problem carefully",
      detail: item.prompt,
    },
    {
      label: `Step 2: Identify the key concept (${skillName})`,
      detail: item.scaffold || (item.hints && item.hints[0]) || "Focus on the core concept and eliminate irrelevant distractions.",
    },
    {
      label: "Step 3: Apply the method / rule",
      detail: (item.hints && item.hints[1]) || (item.hints && item.hints[0]) || "Evaluate the choices systematically based on the rule.",
    },
    {
      label: "Step 4: Formulate the solution",
      detail: `The correct answer is "${item.answer}". ${(item.hints && item.hints[2]) || ""}`.trim(),
    },
  ];
}

export function feedbackCopy(item: GenericItem, selectedAnswer: string, correct: boolean, skill?: SkillDefinition): string {
  const skillLabel = skill?.label ?? "concept";

  if (correct) {
    return `Correct. "${item.answer}" is right for ${skillLabel}. ${item.scaffold || "Keep applying this method to the next question."}`;
  }

  return `You chose "${selectedAnswer}". Check the key concept for ${skillLabel}. The correct answer is "${item.answer}". ${item.hints?.[0] ? `Tip: ${item.hints[0]}` : ""}`.trim();
}
