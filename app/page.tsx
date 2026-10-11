"use client";

import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  FileJson,
  Flame,
  Layers,
  Lightbulb,
  ListChecks,
  Menu,
  MessageSquareHeart,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { AVAILABLE_PACKAGES, P4_ENGLISH_SVA } from "@/lib/content/packages";
import {
  ableFromSignal,
  ableStudentMessage,
  affectAdjustedDifficulty,
  feedbackCopy,
  generateWorkedExample,
  inferFlowZone,
} from "@/lib/engine/affect";
import {
  calculateBkt,
  decimal,
  DEFAULT_MASTERY_THRESHOLD,
  normalizeAnswer,
  pct,
  targetDifficulty,
} from "@/lib/engine/bkt";
import {
  averageMastery,
  calculateMasterySummary,
  generateDynamicGraphLayout,
  isCourseComplete,
} from "@/lib/engine/graph";
import { recommendNextItem } from "@/lib/engine/recommender";
import type {
  AffectRecord,
  BktCalculation,
  ContentPackage,
  EventLog,
  GenericItem,
  LearningLoopType,
  SkillDefinition,
  SkillId,
} from "@/lib/types/als";

type InfoTab = "curriculum" | "mastery" | "affect" | "item" | "events" | "model";

// Alias for backwards compatibility with tests and domain contracts
export const workedExampleFor = generateWorkedExample;

export default function Home() {
  // 1. Content Package Selection State
  const [selectedPackageId, setSelectedPackageId] = useState<string>(P4_ENGLISH_SVA.id);
  const activePackage: ContentPackage = useMemo(() => {
    return AVAILABLE_PACKAGES.find((pkg) => pkg.id === selectedPackageId) ?? P4_ENGLISH_SVA;
  }, [selectedPackageId]);

  // 2. Learning Loop Selection State
  const [learningLoop, setLearningLoop] = useState<LearningLoopType>("guided_learning");

  // 3. Cognitive Skill Registry State (initialized per package)
  const initialSkillMap = useMemo(() => {
    return Object.fromEntries(
      activePackage.skills.map((skill) => [skill.id, { ...skill }])
    ) as Record<SkillId, SkillDefinition>;
  }, [activePackage]);

  const [skills, setSkills] = useState<Record<SkillId, SkillDefinition>>(initialSkillMap);
  const [currentId, setCurrentId] = useState<string>(() => {
    return activePackage.items[2]?.id ?? activePackage.items[0]?.id ?? "";
  });

  const [answer, setAnswer] = useState("");
  const [hintCount, setHintCount] = useState(0);
  const [attemptedIds, setAttemptedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [lastCalculation, setLastCalculation] = useState<BktCalculation | null>(null);
  const [activeInfoTab, setActiveInfoTab] = useState<InfoTab>("curriculum");
  const [itemStartedAt, setItemStartedAt] = useState(() => Date.now());
  const [answerChangeCount, setAnswerChangeCount] = useState(0);
  const [itemAttemptCount, setItemAttemptCount] = useState(0);
  const [showWorkedExample, setShowWorkedExample] = useState(false);
  const [showAbleModal, setShowAbleModal] = useState(false);
  const [affectRecords, setAffectRecords] = useState<AffectRecord[]>([]);
  const [events, setEvents] = useState<EventLog[]>([
    {
      label: `${activePackage.subject} package loaded`,
      detail: `${activePackage.title} initialized in Guided Learning mode.`,
    },
  ]);

  // Current problem and active skill
  const current: GenericItem = useMemo(() => {
    return (
      activePackage.items.find((problem) => problem.id === currentId) ??
      activePackage.items[0]
    );
  }, [activePackage, currentId]);

  const activeSkill: SkillDefinition = useMemo(() => {
    return (
      skills[current.skill] ??
      activePackage.skills.find((s) => s.id === current.skill) ??
      activePackage.skills[0]
    );
  }, [activePackage, current.skill, skills]);

  // Graph and Mastery Analytics
  const masteryThreshold = DEFAULT_MASTERY_THRESHOLD;
  const courseComplete = isCourseComplete(activePackage.curriculum, skills, masteryThreshold);
  const masterySummary = useMemo(() => {
    return calculateMasterySummary(activePackage.curriculum, skills, masteryThreshold);
  }, [activePackage.curriculum, skills, masteryThreshold]);

  const {
    activePathNode,
    activePathProgress,
    weakestSkill,
    strongestSkill,
    readiness,
    prerequisiteGap,
    isUnlocked,
  } = masterySummary;

  const activePathSkills = useMemo(() => {
    return activePathNode.skills
      .map((skillId) => skills[skillId] ?? initialSkillMap[skillId])
      .filter((s): s is SkillDefinition => Boolean(s))
      .sort((a, b) => a.mastery - b.mastery);
  }, [activePathNode, initialSkillMap, skills]);

  const strongestPathSkill = strongestSkill;
  const desiredDifficulty = targetDifficulty(weakestSkill.mastery);

  // Dynamic DAG Layout
  const domainGraph = useMemo(() => {
    return generateDynamicGraphLayout(
      activePackage.curriculum,
      activePackage.chapters,
      `${activePackage.title} Model`
    );
  }, [activePackage]);

  const domainNodes = domainGraph.nodes;
  const inclusionLinks = domainGraph.inclusionLinks;
  const sequenceLinks = domainGraph.sequenceLinks;
  const pertinenceLinks = domainGraph.pertinenceLinks;

  // BKT Calculation Preview & Display
  const previewCalculation = useMemo(() => {
    return calculateBkt(activeSkill, true);
  }, [activeSkill]);

  const displayedCalculation = lastCalculation ?? previewCalculation;
  const observationText = displayedCalculation.correct ? "correct" : "wrong";
  const observationSymbol = displayedCalculation.correct ? "Correct" : "Wrong";
  const knownRateLabel = displayedCalculation.correct
    ? "Correct if they know it"
    : "Wrong despite knowing it";
  const unknownRateLabel = displayedCalculation.correct
    ? "Correct by guessing"
    : "Wrong if not mastered";
  const knownEvidenceLabel = displayedCalculation.correct
    ? "Knows and correct"
    : "Knows but slipped";
  const unknownEvidenceLabel = displayedCalculation.correct
    ? "Guessed and correct"
    : "Not mastered and wrong";
  const observedOutcomeLabel = displayedCalculation.correct
    ? "Observed correct answer"
    : "Observed wrong answer";

  // Affective Telemetry & Scaffolding
  const workedExampleSteps = useMemo(() => {
    return generateWorkedExample(current, activeSkill);
  }, [current, activeSkill]);

  const latestAffect = affectRecords[0];
  const currentAffect =
    latestAffect?.problemTitle === current.title ? latestAffect : undefined;
  const shouldOfferWorkedExample = currentAffect?.able === "ABLE 1";

  const previewZone = inferFlowZone(current.difficulty, {
    correct: feedback === "correct",
    timeSeconds: Math.max(1, Math.round((Date.now() - itemStartedAt) / 1000)),
    hints: hintCount,
    answerChanges: answerChangeCount,
    attempt: Math.max(1, itemAttemptCount || 1),
    masteryBefore: activeSkill.mastery,
  });

  const previewAble = ableFromSignal(previewZone, courseComplete);
  const supportDifficulty = affectAdjustedDifficulty(desiredDifficulty, latestAffect);

  // Recommendation Engine (re-calculated dynamically)
  const recommendation = useMemo(() => {
    return recommendNextItem(
      activePackage,
      skills,
      attemptedIds,
      currentId,
      affectRecords[0],
      learningLoop
    );
  }, [activePackage, affectRecords, attemptedIds, currentId, learningLoop, skills]);

  const recommended = recommendation.item;

  // Active KU Badge Label (e.g. KU 1, KU 2)
  const kuIndex = activePackage.curriculum.findIndex((k) => k.ku === activePathNode.ku);
  const kuDisplayBadge = courseComplete ? "✓" : `KU ${kuIndex >= 0 ? kuIndex + 1 : 1}`;

  // Handler: Switch Subject / Content Package
  function handlePackageChange(packageId: string) {
    const nextPkg = AVAILABLE_PACKAGES.find((p) => p.id === packageId) ?? P4_ENGLISH_SVA;
    const nextSkills = Object.fromEntries(
      nextPkg.skills.map((skill) => [skill.id, { ...skill }])
    ) as Record<SkillId, SkillDefinition>;

    const nextRec = recommendNextItem(nextPkg, nextSkills, [], undefined, undefined, learningLoop);

    setSelectedPackageId(nextPkg.id);
    setSkills(nextSkills);
    setCurrentId(nextRec.item.id);
    setAnswer("");
    setHintCount(0);
    setAttemptedIds([]);
    setFeedback(null);
    setLastCalculation(null);
    setItemStartedAt(Date.now());
    setAnswerChangeCount(0);
    setItemAttemptCount(0);
    setShowWorkedExample(false);
    setShowAbleModal(false);
    setAffectRecords([]);
    setEvents([
      {
        label: `${nextPkg.subject} package loaded`,
        detail: `Switched to ${nextPkg.title} (${nextPkg.level}). Decoupled engine loaded ${nextPkg.curriculum.length} KUs and ${nextPkg.items.length} items.`,
      },
    ]);
  }

  // Handler: Switch Learning Loop
  function handleLoopChange(newLoop: LearningLoopType) {
    setLearningLoop(newLoop);
    const nextRec = recommendNextItem(activePackage, skills, attemptedIds, currentId, affectRecords[0], newLoop);

    setCurrentId(nextRec.item.id);
    setAnswer("");
    setHintCount(0);
    setFeedback(null);
    setLastCalculation(null);
    setItemStartedAt(Date.now());
    setAnswerChangeCount(0);
    setItemAttemptCount(0);
    setShowWorkedExample(false);
    setShowAbleModal(false);

    setEvents((prev) => [
      {
        label: `Switched to ${nextRec.loopName}`,
        detail: `${nextRec.rationale} (${nextRec.loopDescription})`,
      },
      ...prev,
    ]);
  }

  // Handler: Submit Answer
  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const correct = normalizeAnswer(answer) === normalizeAnswer(current.answer);
    const calculation = calculateBkt(activeSkill, correct);
    const updatedMastery = calculation.afterLearning;
    const timeSeconds = Math.max(1, Math.round((Date.now() - itemStartedAt) / 1000));
    const attempt = itemAttemptCount + 1;

    const zone = inferFlowZone(current.difficulty, {
      correct,
      timeSeconds,
      hints: hintCount,
      answerChanges: answerChangeCount,
      attempt,
      masteryBefore: activeSkill.mastery,
    });

    const able = ableFromSignal(zone, updatedMastery >= masteryThreshold);
    const nextSkills = {
      ...skills,
      [activeSkill.id]: {
        ...activeSkill,
        mastery: updatedMastery,
      },
    };
    const nextAttemptedIds = [...new Set([...attemptedIds, current.id])];

    setSkills(nextSkills);
    setAttemptedIds(nextAttemptedIds);
    setLastCalculation(calculation);
    setFeedback(correct ? "correct" : "incorrect");
    setItemAttemptCount(attempt);
    setShowWorkedExample(false);

    // Open AbLe feedback modal for student
    setShowAbleModal(true);

    setAffectRecords((records) => [
      {
        problemTitle: current.title,
        skillLabel: activeSkill.label,
        correct,
        timeSeconds,
        hints: hintCount,
        answerChanges: answerChangeCount,
        attempt,
        masteryBefore: activeSkill.mastery,
        masteryAfter: updatedMastery,
        zone,
        able: able.able,
        support: able.support,
      },
      ...records,
    ]);

    setEvents((items) => [
      {
        label: correct ? "Correct response" : "Needs practice",
        detail: `${activeSkill.label} moved from ${pct(activeSkill.mastery)} to ${pct(updatedMastery)} mastery. AbLe reads this as ${zone}.`,
        correct,
      },
      ...items,
    ]);
  }

  // Handler: Show Hint
  function showHint() {
    setHintCount((count) => Math.min(current.hints.length, count + 1));
    setEvents((items) => [
      {
        label: "Hint requested",
        detail: `${current.title}: scaffold clue ${Math.min(current.hints.length, hintCount + 1)} opened.`,
      },
      ...items,
    ]);
  }

  // Handler: Open Worked Example
  function openWorkedExample() {
    setShowWorkedExample(true);
    setShowAbleModal(false);
    setEvents((items) => [
      {
        label: "Worked example opened",
        detail: `${current.title}: step-by-step pedagogical reasoning shown before next item.`,
      },
      ...items,
    ]);
  }

  // Handler: Advance to Next Question
  function goNext() {
    setShowAbleModal(false);

    if (courseComplete) {
      setEvents((items) => [
        {
          label: "Course mastered",
          detail: "All knowledge units are at or above the 80% mastery target. No more required practice is queued.",
          correct: true,
        },
        ...items,
      ]);
      return;
    }

    const nextRec = recommendNextItem(
      activePackage,
      skills,
      attemptedIds,
      currentId,
      affectRecords[0],
      learningLoop
    );

    const next = nextRec.item;
    setCurrentId(next.id);
    setAnswer("");
    setFeedback(null);
    setLastCalculation(null);
    setHintCount(0);
    setAnswerChangeCount(0);
    setItemAttemptCount(0);
    setShowWorkedExample(false);
    setItemStartedAt(Date.now());

    setEvents((items) => [
      {
        label: "Next question",
        detail: `${next.title} selected for ${skills[next.skill]?.label ?? next.skill} at ${next.difficulty.toLowerCase()} difficulty.`,
      },
      ...items,
    ]);
  }

  // Handler: Reset Session
  function resetSession() {
    const freshSkills = Object.fromEntries(
      activePackage.skills.map((skill) => [skill.id, { ...skill }])
    ) as Record<SkillId, SkillDefinition>;

    const nextRec = recommendNextItem(activePackage, freshSkills, [], undefined, undefined, learningLoop);

    setSkills(freshSkills);
    setCurrentId(nextRec.item.id);
    setAnswer("");
    setHintCount(0);
    setAttemptedIds([]);
    setFeedback(null);
    setLastCalculation(null);
    setItemStartedAt(Date.now());
    setAnswerChangeCount(0);
    setItemAttemptCount(0);
    setShowWorkedExample(false);
    setShowAbleModal(false);
    setAffectRecords([]);
    setEvents([
      {
        label: "Session reset",
        detail: `${activePackage.subject} mastery estimates returned to seed profile.`,
      },
    ]);
  }

  return (
    <main className="min-h-screen bg-[#f1f3f7] text-[#20242a]">
      {/* SLS Brand Top Bar */}
      <header className="sls-topbar">
        <div className="sls-logo">SLS</div>
        <span className="class-chip">
          [ALS] {activePackage.subject} · {activePackage.level}
        </span>
        <p>{activePackage.description}</p>
        <div className="topbar-actions flex items-center gap-2">
          <a
            href="/student"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0c2f74] hover:bg-[#1241a3] px-3 py-1 rounded-md transition border border-[#2b6be8] shadow-xs"
            title="Open Student Facing Page"
          >
            Student Portal →
          </a>
          <button aria-label="Menu" title="Menu">
            <Menu size={18} />
          </button>
          <button aria-label="Learner profile" title="Learner profile">
            <Brain size={18} />
          </button>
        </div>
      </header>

      {/* Decoupled ALS Control Ribbon (Shifted Left, No Extraneous Text) */}
      <div className="paused-band">
        <div className="flex flex-wrap items-center gap-3">
          {/* Subject Package Switcher */}
          <div className="flex items-center gap-2 bg-[#0a2f7c] hover:bg-[#072461] px-3 py-1.5 rounded border border-[#2b6be8] transition">
            <Layers size={15} className="text-[#a4c5ff]" />
            <span className="font-bold text-[0.72rem] uppercase tracking-wider text-[#b8d2ff]">
              Subject:
            </span>
            <select
              aria-label="Select Content Package"
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-2"
              value={selectedPackageId}
              onChange={(e) => handlePackageChange(e.target.value)}
            >
              {AVAILABLE_PACKAGES.map((pkg) => (
                <option key={pkg.id} value={pkg.id} className="text-black bg-white">
                  {pkg.level} - {pkg.title} ({pkg.subject})
                </option>
              ))}
            </select>
          </div>

          {/* Learning Loop Switcher */}
          <div className="flex items-center gap-2 bg-[#0a2f7c] hover:bg-[#072461] px-3 py-1.5 rounded border border-[#2b6be8] transition">
            <Compass size={15} className="text-[#a4c5ff]" />
            <span className="font-bold text-[0.72rem] uppercase tracking-wider text-[#b8d2ff]">
              Learning Loop:
            </span>
            <select
              aria-label="Select Learning Loop"
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-2"
              value={learningLoop}
              onChange={(e) => handleLoopChange(e.target.value as LearningLoopType)}
            >
              <option value="guided_learning" className="text-black bg-white">
                Guided Learning (Scaffolded)
              </option>
              <option value="mastery_check" className="text-black bg-white">
                Mastery Check (Diagnostic Sprint)
              </option>
              <option value="revision" className="text-black bg-white">
                Revision Mode (Spaced Retrieval)
              </option>
              <option value="test_myself" className="text-black bg-white">
                Test Myself (Interleaved Test)
              </option>
            </select>
          </div>
        </div>

        {/* Right Status / Actions */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#d0e0ff] hidden md:inline font-medium">
            Active: <strong>{recommendation.loopName}</strong>
          </span>
          <button
            type="button"
            onClick={resetSession}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded bg-[#ffffff18] hover:bg-[#ffffff28] text-white border border-[#ffffff30] transition cursor-pointer"
            title="Reset active learner profile"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <section className="workspace-shell">
        <section className="product-frame">
          <header className="top-bar">
            <div>
              <div className="activity-title">
                <span>{kuDisplayBadge}</span>
                <p>{courseComplete ? "Course complete" : "Current knowledge unit"}</p>
              </div>
              <h1>{courseComplete ? `${activePackage.title} mastered` : activePathNode.title}</h1>
              <p className="goal-copy">
                {courseComplete
                  ? "All knowledge units are at or above the 80% mastery target. The learner can stop required practice or move to review."
                  : `Learning goal: ${activePathNode.goal}`}
              </p>
            </div>
            <div className="session-score" aria-label="Current weakest skill">
              <Flame size={18} />
              <div className="text-left leading-tight">
                <span className="block font-bold text-xs">
                  {courseComplete ? "All KUs mastered" : `Focus Skill: ${weakestSkill.label}`}
                </span>
                {!courseComplete && (
                  <span className="block text-[0.68rem] text-gray-500 font-normal">
                    {activePathNode.ku} Composite: {pct(activePathProgress)}
                  </span>
                )}
              </div>
              <strong className="text-right text-base">{courseComplete ? "80%+" : pct(weakestSkill.mastery)}</strong>
            </div>
          </header>

          <div className="learning-grid">
            <section className="tutor-surface" aria-label="Active tutoring problem">
              {courseComplete ? (
                <div className="completion-panel">
                  <div className="completion-mark">
                    <Check size={28} />
                  </div>
                  <p>Course mastered</p>
                  <h2>Required practice is complete.</h2>
                  <span>
                    Every knowledge unit in {activePackage.title} has reached the 80% mastery target.
                    The next useful action is review, enrichment, or selecting another subject package.
                  </span>
                  <div className="completion-actions">
                    <button type="button" className="secondary-action" onClick={resetSession}>
                      <RotateCcw size={18} />
                      <span>Reset learner</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="problem-header">
                    <div>
                      <p>
                        Q1 · {current.difficulty} item · <strong className="text-[#1854cb]">{recommendation.loopName}</strong>
                      </p>
                      <h2>{current.title}</h2>
                    </div>
                    <span>{activeSkill.label}</span>
                  </div>

                  {showWorkedExample ? (
                    <>
                      <section className="worked-example" aria-label="Worked example">
                        <div className="worked-example-title">
                          <BookOpenCheck size={20} />
                          <div>
                            <p>Worked example</p>
                            <h3>Watch the pedagogical step, then try the next item.</h3>
                          </div>
                        </div>
                        <div className="worked-sentence">
                          <span>Problem Statement</span>
                          <strong>{current.prompt}</strong>
                        </div>
                        <div className="worked-steps">
                          {workedExampleSteps.map((step, index) => (
                            <article key={step.label}>
                              <span>{index + 1}</span>
                              <div>
                                <strong>{step.label}</strong>
                                <p>{step.detail}</p>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                      <div className="action-strip worked-actions">
                        <button
                          type="button"
                          onClick={() => setShowWorkedExample(false)}
                          className="secondary-action"
                        >
                          <ArrowRight size={18} />
                          <span>Try this item</span>
                        </button>
                        <button type="button" onClick={goNext} className="primary-action">
                          <span>Next question</span>
                          <ArrowRight size={18} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="prompt-band grammar-prompt">
                        <p>{current.prompt}</p>
                      </div>

                      {current.options && current.options.length > 0 && (
                        <div className="option-grid" aria-label="Answer choices">
                          {current.options.map((option) => (
                            <button
                              className={answer === option ? "selected-option" : ""}
                              key={option}
                              type="button"
                              onClick={() => {
                                if (answer !== option) {
                                  setAnswerChangeCount((count) => count + 1);
                                }
                                setAnswer(option);
                              }}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}

                      <form className="answer-row" onSubmit={submitAnswer}>
                        <label htmlFor="answer">Student answer</label>
                        <div>
                          <input
                            id="answer"
                            value={answer}
                            onChange={(event) => {
                              setAnswerChangeCount((count) => count + 1);
                              setAnswer(event.target.value);
                            }}
                            placeholder="Choose or type the answer"
                            autoComplete="off"
                          />
                          <button type="submit" aria-label="Submit answer">
                            <Send size={18} />
                          </button>
                        </div>
                      </form>

                      {feedback && (
                        <div className={`feedback ${feedback}`}>
                          {feedback === "correct" ? <Check size={18} /> : <CircleHelp size={18} />}
                          <span>{feedbackCopy(current, answer, feedback === "correct", activeSkill)}</span>
                        </div>
                      )}

                      {/* Compact AbLe Feedback Trigger */}
                      {currentAffect && (
                        <button
                          type="button"
                          onClick={() => setShowAbleModal(true)}
                          className={`able-message cursor-pointer text-left transition hover:shadow-md ${
                            currentAffect.able === "ABLE 1" ? "needs-example" : ""
                          }`}
                          style={{ width: "100%" }}
                        >
                          <MessageSquareHeart size={20} />
                          <div>
                            <strong>
                              {currentAffect.able}: {currentAffect.zone}
                            </strong>
                            <p>{ableStudentMessage(currentAffect)}</p>
                          </div>
                          <span className="px-3 py-1.5 rounded-md bg-white border text-xs font-bold text-[#1854cb] shadow-sm">
                            Open Guidance Modal →
                          </span>
                        </button>
                      )}

                      <div className="action-strip">
                        <button type="button" onClick={showHint} className="secondary-action">
                          <Lightbulb size={18} />
                          <span>Show hint</span>
                        </button>
                        <button type="button" onClick={goNext} className="primary-action">
                          <span>Next question</span>
                          <ArrowRight size={18} />
                        </button>
                      </div>

                      <div className="hint-stack">
                        <div className="scaffold-note">
                          <Sparkles size={18} />
                          <p>{current.scaffold}</p>
                        </div>
                        {current.hints &&
                          current.hints.slice(0, hintCount).map((hint, index) => (
                            <div className="hint-line" key={hint}>
                              <span>{index + 1}</span>
                              <p>{hint}</p>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          </div>

          {/* AbLe Feedback Pop-up Modal */}
          {showAbleModal && currentAffect && (
            <div className="modal-overlay" onClick={() => setShowAbleModal(false)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        currentAffect.able === "ABLE 1"
                          ? "bg-[#ffe7e0] text-[#d94c3d]"
                          : "bg-[#e8f1ff] text-[#1854cb]"
                      }`}
                    >
                      <MessageSquareHeart size={22} />
                    </div>
                    <div>
                      <span className="text-[0.72rem] font-bold uppercase tracking-wider text-[#1854cb] block">
                        Adaptive Guidance · {recommendation.loopName}
                      </span>
                      <h2 className="text-xl font-extrabold text-[#082442] m-0">
                        {currentAffect.able}: {currentAffect.zone}
                      </h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAbleModal(false)}
                    className="modal-close-btn cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="modal-body space-y-4">
                  <div
                    className={`p-4 rounded-lg border ${
                      currentAffect.able === "ABLE 1"
                        ? "bg-[#fff8f5] border-[#fcd7cc] text-[#7c3825]"
                        : "bg-[#f5f8ff] border-[#cdddfa] text-[#1a386b]"
                    }`}
                  >
                    <p className="text-base font-semibold leading-relaxed m-0">
                      {ableStudentMessage(currentAffect)}
                    </p>
                  </div>

                  {/* Telemetry signals snapshot */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-gray-50 border border-gray-200">
                      <span className="text-gray-500 block font-medium">Time on Task</span>
                      <strong className="text-gray-900 text-sm">{currentAffect.timeSeconds}s</strong>
                    </div>
                    <div className="p-2.5 rounded bg-gray-50 border border-gray-200">
                      <span className="text-gray-500 block font-medium">Hints Viewed</span>
                      <strong className="text-gray-900 text-sm">{currentAffect.hints}</strong>
                    </div>
                    <div className="p-2.5 rounded bg-gray-50 border border-gray-200">
                      <span className="text-gray-500 block font-medium">Answer Changes</span>
                      <strong className="text-gray-900 text-sm">{currentAffect.answerChanges}</strong>
                    </div>
                    <div className="p-2.5 rounded bg-gray-50 border border-gray-200">
                      <span className="text-gray-500 block font-medium">Mastery Trend</span>
                      <strong className="text-gray-900 text-sm">
                        {pct(currentAffect.masteryBefore)} → {pct(currentAffect.masteryAfter)}
                      </strong>
                    </div>
                  </div>

                  {/* Worked Example Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpenCheck size={18} className="text-[#1854cb]" />
                      <h3 className="font-bold text-sm text-[#082442] m-0">
                        Step-by-Step Pedagogical Reasoning
                      </h3>
                    </div>

                    <div className="p-3 bg-[#f8fbff] rounded-md border border-[#d8e3f4] mb-3 text-sm">
                      <span className="text-[0.7rem] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                        Target Problem
                      </span>
                      <strong className="text-gray-900">{current.prompt}</strong>
                    </div>

                    <div className="grid gap-2">
                      {workedExampleSteps.map((step, index) => (
                        <div
                          key={step.label}
                          className="p-3 rounded-md border border-gray-200 bg-white flex gap-3 items-start shadow-xs"
                        >
                          <span className="w-6 h-6 rounded-full bg-[#1854cb] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                            {index + 1}
                          </span>
                          <div>
                            <strong className="text-xs text-[#082442] block mb-0.5">{step.label}</strong>
                            <p className="text-xs text-gray-600 m-0 leading-relaxed">{step.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="modal-footer flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={openWorkedExample}
                    className="px-4 py-2 text-xs font-bold rounded border border-[#1854cb] bg-white hover:bg-[#eef4ff] text-[#1854cb] cursor-pointer"
                  >
                    Open worked example in tutor
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAbleModal(false)}
                    className="px-4 py-2 text-xs font-bold rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer"
                  >
                    Close & Try Question
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAbleModal(false);
                      goNext();
                    }}
                    className="px-4 py-2 text-xs font-bold rounded bg-[#1854cb] hover:bg-[#1242a8] text-white cursor-pointer"
                  >
                    Next question →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Diagnostic Subpage & Inspectors */}
          <section className="subpage-shell" aria-label="Supporting information">
            <div className="subpage-tabs" role="tablist" aria-label="Supporting views">
              <button
                type="button"
                className={activeInfoTab === "curriculum" ? "active-tab" : ""}
                onClick={() => setActiveInfoTab("curriculum")}
              >
                <ListChecks size={17} />
                <span>Curriculum</span>
              </button>
              <button
                type="button"
                className={activeInfoTab === "mastery" ? "active-tab" : ""}
                onClick={() => setActiveInfoTab("mastery")}
              >
                <BarChart3 size={17} />
                <span>Mastery</span>
              </button>
              <button
                type="button"
                className={activeInfoTab === "affect" ? "active-tab" : ""}
                onClick={() => setActiveInfoTab("affect")}
              >
                <MessageSquareHeart size={17} />
                <span>Affect / AbLe</span>
              </button>
              <button
                type="button"
                className={activeInfoTab === "item" ? "active-tab" : ""}
                onClick={() => setActiveInfoTab("item")}
              >
                <FileJson size={17} />
                <span>Item JSON</span>
              </button>
              <button
                type="button"
                className={activeInfoTab === "events" ? "active-tab" : ""}
                onClick={() => setActiveInfoTab("events")}
              >
                <ListChecks size={17} />
                <span>Events</span>
              </button>
              <button
                type="button"
                className={activeInfoTab === "model" ? "active-tab" : ""}
                onClick={() => setActiveInfoTab("model")}
              >
                <Brain size={17} />
                <span>BKT model</span>
              </button>
            </div>

            <div className="subpage-content">
              {/* Tab 1: Curriculum Map */}
              {activeInfoTab === "curriculum" && (
                <section className="curriculum-panel tab-panel">
                  <div className="panel-title">
                    <ListChecks size={18} />
                    <h2>
                      {activePackage.id === "p4-english-sva"
                        ? "Subject-verb agreement curriculum map"
                        : `${activePackage.title} curriculum map`}
                    </h2>
                  </div>
                  <div className="curriculum-grid">
                    {activePackage.curriculum.map((node) => (
                      <article className="curriculum-node" key={node.ku}>
                        <strong>
                          {node.ku}: {node.title}
                        </strong>
                        <p>{node.goal}</p>
                        <span>
                          {node.skills
                            .map((sId) => skills[sId]?.label ?? sId)
                            .join(", ")}
                        </span>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* Tab 2: Mastery & Dynamic Learning Path */}
              {activeInfoTab === "mastery" && (
                <div className="subpage-two-col">
                  <section className="mastery-panel">
                    <div className="panel-title">
                      <BarChart3 size={18} />
                      <h2>Learning path</h2>
                    </div>
                    <div className="path-map">
                      <svg
                        className="domain-map"
                        viewBox="0 0 920 540"
                        role="img"
                        aria-label="Subject-verb agreement domain knowledge model"
                      >
                        <defs>
                          <marker
                            id="arrow"
                            markerHeight="8"
                            markerWidth="8"
                            orient="auto"
                            refX="7"
                            refY="4"
                          >
                            <path d="M0,0 L8,4 L0,8 Z" />
                          </marker>
                        </defs>
                        <rect className="domain-band" x="25" y="90" width="870" height="85" />
                        <rect className="domain-band" x="25" y="195" width="870" height="140" />
                        <rect className="domain-band" x="25" y="355" width="870" height="130" />

                        {inclusionLinks.map(([fromId, toId]) => {
                          const from = domainNodes.find((node) => node.id === fromId);
                          const to = domainNodes.find((node) => node.id === toId);
                          return from && to ? (
                            <line
                              className="relation inclusion"
                              key={`${fromId}-${toId}`}
                              x1={from.x}
                              y1={from.y}
                              x2={to.x}
                              y2={to.y}
                            />
                          ) : null;
                        })}

                        {sequenceLinks.map(([fromId, toId]) => {
                          const from = domainNodes.find((node) => node.id === fromId);
                          const to = domainNodes.find((node) => node.id === toId);
                          return from && to ? (
                            <line
                              className="relation sequence"
                              key={`${fromId}-${toId}`}
                              x1={from.x}
                              y1={from.y}
                              x2={to.x}
                              y2={to.y}
                            />
                          ) : null;
                        })}

                        {pertinenceLinks.map(([fromId, toId]) => {
                          const from = domainNodes.find((node) => node.id === fromId);
                          const to = domainNodes.find((node) => node.id === toId);
                          return from && to ? (
                            <line
                              className="relation pertinence"
                              key={`${fromId}-${toId}`}
                              x1={from.x}
                              y1={from.y}
                              x2={to.x}
                              y2={to.y}
                            />
                          ) : null;
                        })}

                        {domainNodes.map((domainNode) => {
                          const curriculumNode = activePackage.curriculum.find(
                            (node) => node.ku === domainNode.id
                          );
                          const progress = curriculumNode
                            ? averageMastery(curriculumNode.skills, skills)
                            : 1;
                          const index = curriculumNode
                            ? activePackage.curriculum.findIndex(
                                (node) => node.ku === curriculumNode.ku
                              )
                            : -1;
                          const status = !curriculumNode
                            ? "structural"
                            : progress >= masteryThreshold
                            ? "complete"
                            : index === masterySummary.activePathIndex
                            ? "active"
                            : "building";

                          const width =
                            domainNode.kind === "course"
                              ? 140
                              : domainNode.kind === "chapter"
                              ? 135
                              : 96;
                          const height = domainNode.kind === "ku" ? 72 : 44;

                          return (
                            <g
                              className={`domain-node ${domainNode.kind} ${status}`}
                              key={domainNode.id}
                            >
                              <rect
                                x={domainNode.x - width / 2}
                                y={domainNode.y - height / 2}
                                width={width}
                                height={height}
                                rx="22"
                              />
                              <text
                                className="domain-label"
                                x={domainNode.x}
                                y={domainNode.y - (domainNode.kind === "ku" ? 8 : -4)}
                              >
                                {domainNode.label}
                              </text>
                              {curriculumNode && (
                                <>
                                  <text
                                    className="domain-progress"
                                    x={domainNode.x}
                                    y={domainNode.y + 14}
                                  >
                                    {pct(progress)}
                                  </text>
                                  {status === "complete" && (
                                    <text
                                      className="domain-star"
                                      x={domainNode.x + 32}
                                      y={domainNode.y - 18}
                                    >
                                      ★
                                    </text>
                                  )}
                                </>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                      <div className="domain-legend" aria-label="Domain map legend">
                        <span>
                          <i className="legend-node complete" />Mastered
                        </span>
                        <span>
                          <i className="legend-node active" />Current
                        </span>
                        <span>
                          <i className="legend-line solid" />Inclusion
                        </span>
                        <span>
                          <i className="legend-line dotted" />Sequence
                        </span>
                        <span>
                          <i className="legend-line pertinence" />Pertinence
                        </span>
                      </div>
                    </div>
                  </section>

                  <div className="path-side-stack">
                    <section className="recommendation-panel">
                      <div className="panel-title">
                        <Target size={18} />
                        <h2>Next rationale ({recommendation.loopName})</h2>
                      </div>
                      {courseComplete ? (
                        <>
                          <p>
                            No required question is queued because every knowledge unit has reached the 80% mastery target.
                          </p>
                          <button type="button" onClick={resetSession}>
                            <RotateCcw size={18} />
                            <span>Reset learner</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <p>
                            {recommendation.rationale}
                          </p>
                          <p className="text-xs text-gray-500 italic">
                            {recommendation.loopDescription}
                          </p>
                          <button type="button" onClick={goNext}>
                            <ChevronRight size={18} />
                            <span>Queue question</span>
                          </button>
                        </>
                      )}
                    </section>

                    <section className="mastery-panel teaching-signals">
                      <div className="panel-title">
                        <BarChart3 size={18} />
                        <h2>Teaching signals</h2>
                      </div>
                      <div className="signal-summary">
                        <p>Current KU</p>
                        <strong>{activePathNode.title}</strong>
                        <span>{pct(activePathProgress)} of 80% mastery target</span>
                      </div>
                      <div className="signal-cards">
                        <article>
                          <span>Blocker</span>
                          <strong>{weakestSkill.label}</strong>
                          <p>{weakestSkill.description}</p>
                          <em>{pct(weakestSkill.mastery)}</em>
                        </article>
                        <article>
                          <span>Secure skill</span>
                          <strong>{strongestPathSkill.label}</strong>
                          <p>{strongestPathSkill.description}</p>
                          <em>{pct(strongestPathSkill.mastery)}</em>
                        </article>
                      </div>
                      <div className="instruction-plan">
                        <strong>Use this information</strong>
                        <p>
                          Keep practising <strong>{weakestSkill.label}</strong> with{" "}
                          <strong>{supportDifficulty.toLowerCase()}</strong> items until {activePathNode.ku} reaches 80%.
                          {latestAffect && supportDifficulty !== desiredDifficulty
                            ? ` AbLe adjusted this from ${desiredDifficulty.toLowerCase()} because the last response showed ${latestAffect.zone.toLowerCase()} signals.`
                            : ""}
                        </p>
                      </div>
                      <section className="curriculum-calculation" aria-label="Curriculum model calculation">
                        <div className="panel-title">
                          <ListChecks size={18} />
                          <h2>Curriculum calculation</h2>
                        </div>
                        <div className="calculation-grid">
                          <article>
                            <span>KU mastery</span>
                            <strong>{pct(activePathProgress)}</strong>
                            <p>
                              average(
                              {activePathSkills
                                .map((skill) => `${skill.label} ${pct(skill.mastery)}`)
                                .join(", ")})
                            </p>
                          </article>
                          <article>
                            <span>Readiness</span>
                            <strong>{pct(readiness)}</strong>
                            <p>
                              {masterySummary.activePathIndex > 0
                                ? `${activePackage.curriculum[masterySummary.activePathIndex - 1]?.ku} prerequisite mastery`
                                : "First KU has no prerequisite"}
                            </p>
                          </article>
                          <article>
                            <span>Prerequisite gap</span>
                            <strong>{pct(prerequisiteGap)}</strong>
                            <p>max(0, 80% - readiness)</p>
                          </article>
                          <article className={isUnlocked ? "unlocked" : "blocked"}>
                            <span>{isUnlocked ? "Unlocked" : "Blocked"}</span>
                            <strong>{activePathNode.ku}</strong>
                            <p>{isUnlocked ? "Ready for practice in this KU." : "Strengthen the prerequisite KU first."}</p>
                          </article>
                        </div>
                      </section>
                      <div className="skill-chip-list" aria-label={`${activePathNode.ku} skill signals`}>
                        {activePathSkills.map((skill) => (
                          <span key={skill.id}>
                            {skill.label} · {pct(skill.mastery)}
                          </span>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {/* Tab 3: Affect / AbLe */}
              {activeInfoTab === "affect" && (
                <section className="affect-panel tab-panel">
                  <div className="panel-title">
                    <MessageSquareHeart size={18} />
                    <h2>Affect / AbLe layer</h2>
                  </div>
                  <div className="able-grid">
                    <article className="able-hero">
                      <span>{latestAffect?.able ?? previewAble.able}</span>
                      <strong>{latestAffect?.zone ?? previewZone}</strong>
                      <p>{latestAffect?.support ?? previewAble.support}</p>
                    </article>
                    <article>
                      <span>Observed signals</span>
                      <strong>{latestAffect ? latestAffect.problemTitle : "Current item preview"}</strong>
                      <p>
                        {latestAffect
                          ? `${latestAffect.timeSeconds}s, ${latestAffect.hints} hints, ${latestAffect.answerChanges} answer changes, attempt ${latestAffect.attempt}`
                          : "Submit an answer to record time, hints, answer changes, and attempt count."}
                      </p>
                    </article>
                    <article>
                      <span>Mastery context</span>
                      <strong>
                        {latestAffect
                          ? `${pct(latestAffect.masteryBefore)} → ${pct(latestAffect.masteryAfter)}`
                          : pct(activeSkill.mastery)}
                      </strong>
                      <p>BKT still handles knowledge. AbLe handles the support strategy around that knowledge estimate.</p>
                    </article>
                    <article>
                      <span>Router effect</span>
                      <strong>{supportDifficulty}</strong>
                      <p>
                        The curriculum router keeps the weakest skill, then AbLe may soften the difficulty when support is needed.
                      </p>
                    </article>
                  </div>
                  <div className="able-flow">
                    {[
                      ["ABLE 1", "Overwhelmed", "Worked example + easier repair"],
                      ["ABLE 2", "Struggle / Developing", "Scaffolded progress message"],
                      ["ABLE 3", "Focused / Growth", "Targeted next item"],
                      ["ABLE 4", "Mastered / Immersed", "Completion reinforcement"],
                    ].map(([code, zone, support]) => (
                      <article
                        className={
                          latestAffect?.able === code || (!latestAffect && previewAble.able === code)
                            ? "active-able"
                            : ""
                        }
                        key={code}
                      >
                        <span>{code}</span>
                        <strong>{zone}</strong>
                        <p>{support}</p>
                      </article>
                    ))}
                  </div>
                  <div className="affect-history">
                    <div className="panel-title">
                      <ListChecks size={18} />
                      <h2>Recent affect records</h2>
                    </div>
                    {affectRecords.length === 0 ? (
                      <p className="empty-state">
                        No affect record yet. Answer a question to create the first AbLe reading.
                      </p>
                    ) : (
                      <div className="event-list">
                        {affectRecords.slice(0, 4).map((record, index) => (
                          <article className="event-item" key={`${record.problemTitle}-${index}`}>
                            <span className={record.correct ? "ok" : "repair"} />
                            <div>
                              <strong>
                                {record.able}: {record.zone}
                              </strong>
                              <p>
                                {record.skillLabel}: {record.correct ? "correct" : "wrong"} after {record.timeSeconds}s,{" "}
                                {record.hints} hints, {record.answerChanges} answer changes.
                              </p>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Tab 4: Raw Item JSON */}
              {activeInfoTab === "item" && (
                <section className="schema-panel tab-panel">
                  <div className="panel-title">
                    <FileJson size={18} />
                    <h2>Reusable item definition</h2>
                  </div>
                  <pre>
                    {JSON.stringify(
                      {
                        packageId: activePackage.id,
                        subject: activePackage.subject,
                        id: current.id,
                        ku: current.ku,
                        sourcePage: current.sourcePage,
                        skill: current.skill,
                        difficulty: current.difficulty,
                        options: current.options,
                        answer: current.answer,
                        answerStatus: current.answerStatus,
                        hints: current.hints,
                      },
                      null,
                      2
                    )}
                  </pre>
                </section>
              )}

              {/* Tab 5: Event Stream */}
              {activeInfoTab === "events" && (
                <section className="event-panel tab-panel">
                  <div className="panel-title">
                    <ListChecks size={18} />
                    <h2>Learning events</h2>
                  </div>
                  <div className="event-list">
                    {events.slice(0, 6).map((item, index) => (
                      <article className="event-item" key={`${item.label}-${index}`}>
                        <span
                          className={
                            item.correct === undefined
                              ? ""
                              : item.correct
                              ? "ok"
                              : "repair"
                          }
                        />
                        <div>
                          <strong>{item.label}</strong>
                          <p>{item.detail}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* Tab 6: BKT Model Inspector */}
              {activeInfoTab === "model" && (
                <div className="model-subpage">
                  <section className="model-panel">
                    <div className="panel-title">
                      <SlidersHorizontal size={18} />
                      <h2>BKT parameters ({activeSkill.label})</h2>
                    </div>
                    <div className="parameter-grid">
                      <span>Learn {activeSkill.learn}</span>
                      <span>Guess {activeSkill.guess}</span>
                      <span>Slip {activeSkill.slip}</span>
                    </div>
                    <button type="button" onClick={resetSession}>
                      <RotateCcw size={17} />
                      <span>Reset learner</span>
                    </button>
                  </section>

                  <section className="bkt-explainer" aria-label="Annotated BKT calculation">
                    <div className="panel-title">
                      <Brain size={18} />
                      <h2>
                        {lastCalculation
                          ? "Last answer BKT calculation"
                          : "Preview BKT calculation"}
                      </h2>
                    </div>
                    <p className="calculation-context">
                      {lastCalculation
                        ? `This uses the ${displayedCalculation.skillLabel} mastery before the learner's ${observationText} answer.`
                        : "No answer has been submitted for this item yet, so this previews the correct-answer path."}
                    </p>
                    <div className="bkt-flow">
                      <div className="flow-source">
                        <p>Before answer</p>
                        <strong>{pct(displayedCalculation.masteryBefore)}</strong>
                        <span>chance learner knows this {activePackage.subject} skill</span>
                      </div>
                      <div className="flow-branches">
                        <div className="flow-path knows-path">
                          <div className="path-node">
                            <span>P(Knows)</span>
                            <strong>{decimal(displayedCalculation.masteryBefore)}</strong>
                          </div>
                          <div className="path-multiply">x</div>
                          <div className="path-node">
                            <span>{knownRateLabel}</span>
                            <strong>{decimal(displayedCalculation.knownObservationRate)}</strong>
                          </div>
                          <div className="path-equals">=</div>
                          <div className="path-node evidence-node">
                            <span>{knownEvidenceLabel}</span>
                            <strong>{decimal(displayedCalculation.knownEvidence)}</strong>
                          </div>
                        </div>
                        <div className="flow-path not-path">
                          <div className="path-node">
                            <span>P(Not mastered)</span>
                            <strong>{decimal(displayedCalculation.complement)}</strong>
                          </div>
                          <div className="path-multiply">x</div>
                          <div className="path-node">
                            <span>{unknownRateLabel}</span>
                            <strong>{decimal(displayedCalculation.unknownObservationRate)}</strong>
                          </div>
                          <div className="path-equals">=</div>
                          <div className="path-node evidence-node">
                            <span>{unknownEvidenceLabel}</span>
                            <strong>{decimal(displayedCalculation.unknownEvidence)}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="flow-result">
                        <p>{observedOutcomeLabel}</p>
                        <div className="mini-equation">
                          <strong>{decimal(displayedCalculation.knownEvidence)}</strong>
                          <span>
                            {decimal(displayedCalculation.knownEvidence)} +{" "}
                            {decimal(displayedCalculation.unknownEvidence)}
                          </span>
                        </div>
                        <strong>{pct(displayedCalculation.posterior)}</strong>
                        <span>evidence-adjusted mastery</span>
                      </div>
                      <div className="flow-next">
                        <p>Add learning</p>
                        <span>
                          {pct(displayedCalculation.posterior)} + remaining gap x{" "}
                          {decimal(displayedCalculation.learn)}
                        </span>
                        <strong>{pct(displayedCalculation.afterLearning)}</strong>
                        <em>mastery for next question</em>
                      </div>
                    </div>
                    <p className="formula-caption">
                      Same equation underneath: P(Knows | {observationSymbol}) ={" "}
                      {decimal(displayedCalculation.knownEvidence)} / (
                      {decimal(displayedCalculation.knownEvidence)} +{" "}
                      {decimal(displayedCalculation.unknownEvidence)}).
                    </p>
                    <p className="model-note">
                      BKT was introduced through the knowledge tracing work of Albert Corbett and John Anderson for
                      intelligent tutoring systems. In this decoupled platform, parameters can vary per skill,
                      learning loop, subject domain, or be learned from student response data.
                    </p>
                  </section>
                </div>
              )}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
