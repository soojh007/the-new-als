import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBkt,
  updateSkillMastery,
  targetDifficulty,
  difficultyLoad,
  normalizeAnswer,
  pct,
} from "../lib/engine/bkt.ts";
import {
  inferFlowZone,
  ableFromSignal,
  affectAdjustedDifficulty,
  ableStudentMessage,
  generateWorkedExample,
  feedbackCopy,
} from "../lib/engine/affect.ts";
import {
  averageMastery,
  getActivePathIndex,
  isCourseComplete,
  calculateMasterySummary,
  generateDynamicGraphLayout,
} from "../lib/engine/graph.ts";
import { recommendNextItem } from "../lib/engine/recommender.ts";
import {
  AVAILABLE_PACKAGES,
  P4_ENGLISH_SVA,
  P5_MATH_DECIMALS,
  SEC3_GEOG_TOURISM,
  getPackageById,
} from "../lib/content/packages.ts";
import { validateContentPackage } from "../lib/content/loader.ts";

test("BKT Engine: computes correct posterior and learning gain", () => {
  const skill = {
    id: "test-skill",
    label: "Test Skill",
    description: "Testing BKT",
    mastery: 0.2,
    learn: 0.15,
    guess: 0.1,
    slip: 0.05,
  };

  // Correct answer test
  const calcCorrect = calculateBkt(skill, true);
  assert.equal(calcCorrect.correct, true);
  assert.ok(calcCorrect.posterior > skill.mastery, "Posterior should increase on correct answer");
  assert.ok(calcCorrect.afterLearning > calcCorrect.posterior, "After learning should add transition probability");

  // Incorrect answer test
  const calcIncorrect = calculateBkt(skill, false);
  assert.equal(calcIncorrect.correct, false);
  assert.ok(calcIncorrect.posterior < skill.mastery, "Posterior should decrease on incorrect answer");

  // Update registry test
  const registry = { [skill.id]: skill };
  const { updatedSkills } = updateSkillMastery(registry, skill.id, true);
  assert.ok(updatedSkills[skill.id].mastery > skill.mastery);
});

test("BKT Engine: maps mastery to target difficulty correctly", () => {
  assert.equal(targetDifficulty(0.1), "Easy");
  assert.equal(targetDifficulty(0.34), "Easy");
  assert.equal(targetDifficulty(0.35), "Medium");
  assert.equal(targetDifficulty(0.69), "Medium");
  assert.equal(targetDifficulty(0.70), "Hard");
  assert.equal(targetDifficulty(0.95), "Hard");
});

test("Affect / AbLe Engine: classifies flow zones and selects ABLe strategies", () => {
  // Overwhelmed
  const zoneOverwhelmed = inferFlowZone("Hard", {
    correct: false,
    timeSeconds: 90,
    hints: 3,
    answerChanges: 5,
    attempt: 3,
    masteryBefore: 0.1,
  });
  assert.equal(zoneOverwhelmed, "Overwhelmed");
  const able1 = ableFromSignal(zoneOverwhelmed, false);
  assert.equal(able1.able, "ABLE 1");

  // Immersed / Mastered
  const zoneImmersed = inferFlowZone("Easy", {
    correct: true,
    timeSeconds: 15,
    hints: 0,
    answerChanges: 0,
    attempt: 1,
    masteryBefore: 0.85,
  });
  assert.equal(zoneImmersed, "Immersed");
  const able4 = ableFromSignal(zoneImmersed, true);
  assert.equal(able4.able, "ABLE 4");

  // Difficulty softening
  const adjusted = affectAdjustedDifficulty("Hard", {
    problemTitle: "Test",
    skillLabel: "Test",
    correct: false,
    timeSeconds: 60,
    hints: 2,
    answerChanges: 3,
    attempt: 2,
    masteryBefore: 0.2,
    masteryAfter: 0.15,
    zone: "Overwhelmed",
    able: "ABLE 1",
    support: "Worked example",
  });
  assert.equal(adjusted, "Easy");
});

test("Graph Engine: computes dynamic DAG layout and mastery analytics", () => {
  const layout = generateDynamicGraphLayout(
    P5_MATH_DECIMALS.curriculum,
    P5_MATH_DECIMALS.chapters,
    "Math Model"
  );
  assert.ok(layout.nodes.length >= P5_MATH_DECIMALS.curriculum.length + P5_MATH_DECIMALS.chapters.length + 1);
  assert.ok(layout.inclusionLinks.length > 0);
  assert.ok(layout.sequenceLinks.length > 0);

  const skillsMap = Object.fromEntries(
    P5_MATH_DECIMALS.skills.map((s) => [s.id, { ...s, mastery: 0.5 }])
  );

  const summary = calculateMasterySummary(P5_MATH_DECIMALS.curriculum, skillsMap);
  assert.equal(summary.activePathIndex, 0);
  assert.equal(summary.isCourseComplete, false);
});

test("Recommender Engine: supports multiple subjects and loops", () => {
  // Test SVA Package recommendation
  const svaSkills = Object.fromEntries(P4_ENGLISH_SVA.skills.map((s) => [s.id, { ...s }]));
  const recSva = recommendNextItem(P4_ENGLISH_SVA, svaSkills, []);
  assert.ok(recSva.item);
  assert.ok(recSva.rationale.includes("Guided Learning"));

  // Test Math Package recommendation
  const mathSkills = Object.fromEntries(P5_MATH_DECIMALS.skills.map((s) => [s.id, { ...s }]));
  const recMath = recommendNextItem(P5_MATH_DECIMALS, mathSkills, []);
  assert.ok(recMath.item);
  assert.equal(recMath.item.ku.startsWith("KU_MATH"), true);

  // Test Geog Package recommendation
  const geogSkills = Object.fromEntries(SEC3_GEOG_TOURISM.skills.map((s) => [s.id, { ...s }]));
  const recGeog = recommendNextItem(SEC3_GEOG_TOURISM, geogSkills, [], undefined, undefined, "revision");
  assert.ok(recGeog.item);
  assert.ok(recGeog.rationale.includes("Revision"));
});

test("Content Loader: validates package referential integrity across all available packages", () => {
  assert.equal(AVAILABLE_PACKAGES.length, 3);

  for (const pkg of AVAILABLE_PACKAGES) {
    const { valid, errors } = validateContentPackage(pkg);
    assert.equal(valid, true, `Package ${pkg.id} failed validation: ${errors.join(", ")}`);
  }
});
