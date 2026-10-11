"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Globe,
  HelpCircle,
  Laptop,
  Lightbulb,
  Moon,
  MoreVertical,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Star,
  Sun,
  Target,
  Trophy,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AVAILABLE_PACKAGES,
  P4_ENGLISH_SVA,
  P5_MATH_DECIMALS,
  SEC3_GEOG_TOURISM,
} from "@/lib/content/packages";
import {
  ableFromSignal,
  ableStudentMessage,
  feedbackCopy,
  generateWorkedExample,
  inferFlowZone,
} from "@/lib/engine/affect";
import {
  calculateBkt,
  DEFAULT_MASTERY_THRESHOLD,
  normalizeAnswer,
  pct,
} from "@/lib/engine/bkt";
import {
  calculateMasterySummary,
  isCourseComplete,
} from "@/lib/engine/graph";
import { recommendNextItem } from "@/lib/engine/recommender";
import type {
  AffectRecord,
  ContentPackage,
  GenericItem,
  KnowledgeUnit,
  LearningLoopType,
  SkillDefinition,
  SkillId,
} from "@/lib/types/als";

export default function StudentPortalPage() {
  // -------------------------------------------------------------
  // View State: "dashboard" (Front page) or "practice" (ALS Tutor Session)
  // -------------------------------------------------------------
  const [activeView, setActiveView] = useState<"dashboard" | "practice">("dashboard");

  // -------------------------------------------------------------
  // Target Setting State (Interactive)
  // -------------------------------------------------------------
  const [conceptsActual, setConceptsActual] = useState(0);
  const [conceptsTarget, setConceptsTarget] = useState(2);
  const [learningSeconds, setLearningSeconds] = useState(420); // 7 mins
  const [learningTargetMinutes, setLearningTargetMinutes] = useState(30);

  // Target editing modal states
  const [editingTargetType, setEditingTargetType] = useState<"concepts" | "time" | null>(null);
  const [tempTargetValue, setTempTargetValue] = useState<number>(2);
  const [showRepairDetails, setShowRepairDetails] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showMissionsBlock, setShowMissionsBlock] = useState(true);
  const [showSubjectsBlock, setShowSubjectsBlock] = useState(true);

  // Streak & Comeback Resilience data
  const [streakDays, setStreakDays] = useState(3);
  const [mistakesConqueredToday, setMistakesConqueredToday] = useState(2);
  const [totalMistakesConquered, setTotalMistakesConquered] = useState(8);
  const weeklyStreak = [
    { day: "M", completed: true },
    { day: "T", completed: true },
    { day: "W", completed: true, isToday: true },
    { day: "T", completed: false },
    { day: "F", completed: false },
    { day: "S", completed: false },
    { day: "S", completed: false },
  ];

  // Learning Time Tracking
  useEffect(() => {
    const timer = setInterval(() => {
      setLearningSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedLearningTime = useMemo(() => {
    const hours = Math.floor(learningSeconds / 3600);
    const minutes = Math.floor((learningSeconds % 3600) / 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }, [learningSeconds]);

  const formattedTargetTime = useMemo(() => {
    const hours = Math.floor(learningTargetMinutes / 60);
    const minutes = learningTargetMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }, [learningTargetMinutes]);

  // -------------------------------------------------------------
  // ALS Subject Package & State
  // -------------------------------------------------------------
  const [selectedPackageId, setSelectedPackageId] = useState<string>(SEC3_GEOG_TOURISM.id);
  const [learningLoop, setLearningLoop] = useState<LearningLoopType>("guided_learning");

  const activePackage: ContentPackage = useMemo(() => {
    return AVAILABLE_PACKAGES.find((pkg) => pkg.id === selectedPackageId) ?? SEC3_GEOG_TOURISM;
  }, [selectedPackageId]);

  const initialSkillMap = useMemo(() => {
    return Object.fromEntries(
      activePackage.skills.map((skill) => [skill.id, { ...skill }])
    ) as Record<SkillId, SkillDefinition>;
  }, [activePackage]);

  const [skills, setSkills] = useState<Record<SkillId, SkillDefinition>>(initialSkillMap);
  const [currentId, setCurrentId] = useState<string>(() => {
    return activePackage.items[0]?.id ?? "";
  });

  const [subjectMasteries, setSubjectMasteries] = useState<Record<string, number>>({
    [SEC3_GEOG_TOURISM.id]: 0.42,
    [P5_MATH_DECIMALS.id]: 0.35,
    [P4_ENGLISH_SVA.id]: 0.55,
  });

  // Practice Interaction States
  const [answer, setAnswer] = useState("");
  const [hintCount, setHintCount] = useState(0);
  const [attemptedIds, setAttemptedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [showWorkedExample, setShowWorkedExample] = useState(false);
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [showKnowledgeUnits, setShowKnowledgeUnits] = useState(false);
  const [itemStartedAt, setItemStartedAt] = useState(() => Date.now());
  const [answerChangeCount, setAnswerChangeCount] = useState(0);
  const [itemAttemptCount, setItemAttemptCount] = useState(0);
  const [affectRecords, setAffectRecords] = useState<AffectRecord[]>([]);
  const [savedMistakes, setSavedMistakes] = useState<GenericItem[]>([]);

  // Current problem & skill
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

  // Mastery Analytics
  const masteryThreshold = DEFAULT_MASTERY_THRESHOLD;
  const courseComplete = isCourseComplete(activePackage.curriculum, skills, masteryThreshold);
  const masterySummary = useMemo(() => {
    return calculateMasterySummary(activePackage.curriculum, skills, masteryThreshold);
  }, [activePackage.curriculum, skills, masteryThreshold]);

  const { activePathNode, activePathProgress, weakestSkill, strongestSkill } = masterySummary;

  const latestAffect = affectRecords[0];
  const repairAreas = useMemo(() => {
    const savedRepairItems = savedMistakes.map((item) => ({
      id: item.id,
      title: item.title,
      skill: skills[item.skill]?.label ?? item.skill,
      source: "Saved mistake",
    }));

    const weakSkillItems = Object.values(skills)
      .filter((skill) => skill.mastery < 0.5)
      .slice(0, 3)
      .map((skill) => ({
        id: `skill-${skill.id}`,
        title: skill.label,
        skill: skill.description,
        source: "Low mastery",
      }));

    return [...savedRepairItems, ...weakSkillItems].slice(0, 4);
  }, [savedMistakes, skills]);

  const learningPathMap = useMemo(() => {
    const currentIndex = Math.max(
      0,
      activePackage.curriculum.findIndex((ku) => ku.ku === activePathNode.ku)
    );
    const width = Math.max(560, activePackage.curriculum.length * 150 + 80);
    const height = 260;
    const nodes = activePackage.curriculum.map((ku, index) => {
      const kuSkills = ku.skills.map((skillId) => skills[skillId]).filter(Boolean);
      const mastery =
        kuSkills.length > 0
          ? kuSkills.reduce((total, skill) => total + skill.mastery, 0) / kuSkills.length
          : 0;
      const isMastered = mastery >= masteryThreshold;
      const isCurrent = ku.ku === activePathNode.ku;

      return {
        id: ku.ku,
        title: ku.title,
        chapter:
          activePackage.chapters.find((chapter) => chapter.kus.includes(ku.ku))?.title ??
          activePackage.title,
        x: 70 + index * 150,
        y: index % 2 === 0 ? 82 : 160,
        mastery,
        isMastered,
        isCurrent,
        status: isMastered ? "Done" : isCurrent ? "Now" : index === currentIndex + 1 ? "Next" : "Upcoming",
      };
    });

    const sequenceLinks = nodes.slice(0, -1).map((node, index) => ({
      from: node,
      to: nodes[index + 1],
      isDone: index < currentIndex,
      isActive: index === currentIndex,
    }));

    return { width, height, nodes, sequenceLinks };
  }, [activePackage, activePathNode.ku, masteryThreshold, skills]);

  const workedExampleSteps = useMemo(() => {
    return generateWorkedExample(current, activeSkill);
  }, [current, activeSkill]);

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

  // -------------------------------------------------------------
  // DYNAMIC RECOMMENDATION ENGINE (Pedagogical Loop Recommendation)
  // -------------------------------------------------------------
  const recommendedLoopInfo = useMemo(() => {
    if (courseComplete) {
      return {
        loop: "test_myself" as LearningLoopType,
        title: "Test Myself",
        tag: "RECOMMENDED",
        reason: "All units mastered! Interleaved testing is recommended to maintain peak recall.",
      };
    }
    if (activePathProgress >= 0.65) {
      return {
        loop: "mastery_check" as LearningLoopType,
        title: "Mastery Check",
        tag: "RECOMMENDED",
        reason: `You're at ${pct(activePathProgress)} mastery! A quick diagnostic sprint will push you over the 80% milestone.`,
      };
    }

    const masteredCount = activePackage.curriculum.filter((ku) => {
      const kuSkills = ku.skills.map((sId) => skills[sId]).filter(Boolean);
      if (kuSkills.length === 0) return false;
      return kuSkills.reduce((acc, s) => acc + s.mastery, 0) / kuSkills.length >= masteryThreshold;
    }).length;

    if (masteredCount >= 2 && latestAffect?.zone === "Immersed") {
      return {
        loop: "revision" as LearningLoopType,
        title: "Revision",
        tag: "RECOMMENDED",
        reason: "Spaced retrieval is recommended to keep earlier mastered units fresh in memory.",
      };
    }

    return {
      loop: "guided_learning" as LearningLoopType,
      title: "Guided Learning",
      tag: "RECOMMENDED",
      reason: `Scaffolded practice with progressive clues is recommended for your active frontier (${activePathNode.ku}).`,
    };
  }, [courseComplete, activePathProgress, activePackage, skills, masteryThreshold, latestAffect, activePathNode.ku]);

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------
  function switchSubject(pkgId: string) {
    const pkg = AVAILABLE_PACKAGES.find((p) => p.id === pkgId) ?? SEC3_GEOG_TOURISM;
    const freshSkills = Object.fromEntries(
      pkg.skills.map((s) => [s.id, { ...s }])
    ) as Record<SkillId, SkillDefinition>;

    setSelectedPackageId(pkg.id);
    setSkills(freshSkills);
    const rec = recommendNextItem(pkg, freshSkills, [], undefined, undefined, learningLoop);
    setCurrentId(rec.item.id);
    setAnswer("");
    setHintCount(0);
    setAttemptedIds([]);
    setFeedback(null);
    setShowWorkedExample(false);
    setShowCoachModal(false);
    setShowKnowledgeUnits(false);
    setItemStartedAt(Date.now());
  }

  function launchPractice(loop: LearningLoopType = recommendedLoopInfo.loop) {
    setLearningLoop(loop);
    const rec = recommendNextItem(activePackage, skills, attemptedIds, currentId, affectRecords[0], loop);
    setCurrentId(rec.item.id);
    setAnswer("");
    setHintCount(0);
    setFeedback(null);
    setShowWorkedExample(false);
    setShowCoachModal(false);
    setItemStartedAt(Date.now());
    setActiveView("practice");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleAnswerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim()) return;

    const isCorrect = normalizeAnswer(answer) === normalizeAnswer(current.answer);
    const calculation = calculateBkt(activeSkill, isCorrect);
    const updatedMastery = calculation.afterLearning;
    const timeSeconds = Math.max(1, Math.round((Date.now() - itemStartedAt) / 1000));
    const attempt = itemAttemptCount + 1;

    const zone = inferFlowZone(current.difficulty, {
      correct: isCorrect,
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
    setFeedback(isCorrect ? "correct" : "incorrect");
    setItemAttemptCount(attempt);

    if (isCorrect) {
      setConceptsActual((prev) => prev + 1);
      const wasRepaired = savedMistakes.some((m) => m.id === current.id) || attempt > 1 || hintCount > 0;
      if (wasRepaired) {
        setMistakesConqueredToday((prev) => prev + 1);
        setTotalMistakesConquered((prev) => prev + 1);
        setSavedMistakes((prev) => prev.filter((m) => m.id !== current.id));
      }
    } else {
      setSavedMistakes((prev) => (prev.some((m) => m.id === current.id) ? prev : [current, ...prev]));
    }

    setSubjectMasteries((prev) => ({
      ...prev,
      [activePackage.id]: Math.min(1, Math.max(0.1, updatedMastery)),
    }));

    setAffectRecords((records) => [
      {
        problemTitle: current.title,
        skillLabel: activeSkill.label,
        correct: isCorrect,
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
  }

  function proceedToNextQuestion() {
    const nextRec = recommendNextItem(
      activePackage,
      skills,
      attemptedIds,
      currentId,
      affectRecords[0],
      learningLoop
    );
    setCurrentId(nextRec.item.id);
    setAnswer("");
    setFeedback(null);
    setHintCount(0);
    setAnswerChangeCount(0);
    setItemAttemptCount(0);
    setShowWorkedExample(false);
    setShowCoachModal(false);
    setItemStartedAt(Date.now());
  }

  function handleNextQuestion() {
    if (feedback && latestAffect) {
      setShowCoachModal(true);
      return;
    }

    proceedToNextQuestion();
  }

  function jumpToKu(targetKu: KnowledgeUnit) {
    const kuItem = activePackage.items.find((it) => it.ku === targetKu.ku) ?? activePackage.items[0];
    setCurrentId(kuItem.id);
    setAnswer("");
    setHintCount(0);
    setFeedback(null);
    setShowWorkedExample(false);
    setShowCoachModal(false);
    setItemStartedAt(Date.now());
  }

  // Target Editing Modals
  function openTargetEditor(type: "concepts" | "time") {
    setEditingTargetType(type);
    setTempTargetValue(type === "concepts" ? conceptsTarget : learningTargetMinutes);
  }

  function saveTarget() {
    if (editingTargetType === "concepts") {
      setConceptsTarget(Math.max(1, tempTargetValue));
    } else if (editingTargetType === "time") {
      setLearningTargetMinutes(Math.max(5, tempTargetValue));
    }
    setEditingTargetType(null);
  }

  return (
    <div className={`min-h-screen bg-[#fafbfc] text-[#1c2430] font-sans pb-16 ${darkMode ? "student-dark" : ""}`}>
      {/* ------------------------------------------------------------- */}
      {/* 1. Official SLS Top Header (Preserved) */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#e2e8f0] shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo Branding */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col leading-none">
              <span className="text-[0.62rem] font-black tracking-widest text-[#d9381e] uppercase">
                SINGAPORE
              </span>
              <span className="text-base font-extrabold text-[#002f6c] tracking-tight">
                <span className="text-[#e05b1c]">Student</span> Learning Space
              </span>
            </div>
          </div>

          {/* Top Right User Actions */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <button
              type="button"
              className="relative p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#1854cb]" />
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((enabled) => !enabled)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-xs font-bold text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-[#1854cb] transition"
              aria-pressed={darkMode}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              <span className="hidden sm:inline">{darkMode ? "Light" : "Dark"}</span>
            </button>

            {/* Student Avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full bg-[#fef08a] border border-[#fde047] flex items-center justify-center text-sm font-bold text-[#854d0e] shadow-xs">
                👤
              </div>
            </div>

            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="More options"
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. Original SLS Warm Orange Hero Banner (Preserved) */}
      {/* ------------------------------------------------------------- */}
      <section className="bg-gradient-to-r from-[#9a3412] via-[#c2410c] to-[#b45309] text-white shadow-inner">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs sm:text-sm font-semibold text-white/85 tracking-wide block">
              Start learning today!
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white m-0">
              Adaptive Learning
            </h1>
          </div>

          {/* Decorative Map, Lightbulb & Stars Illustration Badge */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/15 backdrop-blur-xs border border-white/25 flex items-center justify-center shadow-lg shrink-0">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#ffd480] flex items-center justify-center text-[#9a3412] shadow-inner">
              <Sparkles size={24} className="fill-[#e05b1c] text-[#e05b1c]" />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN DASHBOARD: Targets, Streaks, Focus Topic, Recommended Mode */}
      {/* ------------------------------------------------------------- */}
      {activeView === "dashboard" ? (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-7">
          {/* SECTION: 🙂 My Learning Goals & Streaks */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
                <span className="text-xl">🙂</span>
                <span>My Learning Goals</span>
              </h2>
              <span className="text-xs text-gray-500 hidden sm:inline">
                Click <Pencil size={12} className="inline text-gray-400 mx-0.5" /> to set personal targets
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* CARD 1: Concepts */}
              <div className="relative overflow-hidden bg-blue-50 rounded-xl p-4 pl-5 shadow-xs border border-blue-200 flex flex-col justify-between hover:border-blue-400 transition">
                <span className="absolute left-0 top-0 h-full w-1.5 bg-[#2563eb]" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">Concepts</span>
                    <button
                      type="button"
                      onClick={() => openTargetEditor("concepts")}
                      className="p-1 text-gray-400 hover:text-[#1854cb] hover:bg-blue-50 rounded transition cursor-pointer"
                      title="Edit Concepts Target"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <span className="text-[0.68rem] text-gray-500 font-medium flex items-center gap-1 justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" /> Actual
                      </span>
                      <strong className="text-xl font-black text-[#2563eb] block mt-0.5">
                        {conceptsActual}
                      </strong>
                    </div>
                    <div className="text-center">
                      <span className="text-[0.68rem] text-gray-500 font-medium flex items-center gap-1 justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" /> Target
                      </span>
                      <strong className="text-xl font-black text-[#92400e] block mt-0.5">
                        {conceptsTarget}
                      </strong>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-[#2563eb] rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.round((conceptsActual / conceptsTarget) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* CARD 2: Learning Time */}
              <div className="relative overflow-hidden bg-amber-50 rounded-xl p-4 pl-5 shadow-xs border border-amber-200 flex flex-col justify-between hover:border-amber-400 transition">
                <span className="absolute left-0 top-0 h-full w-1.5 bg-[#f59e0b]" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">Learning Time</span>
                    <button
                      type="button"
                      onClick={() => openTargetEditor("time")}
                      className="p-1 text-gray-400 hover:text-[#1854cb] hover:bg-blue-50 rounded transition cursor-pointer"
                      title="Edit Learning Time Target"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="text-center">
                      <span className="text-[0.68rem] text-gray-500 font-medium flex items-center gap-1 justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" /> Actual
                      </span>
                      <strong className="text-lg font-black text-[#2563eb] block mt-0.5">
                        {formattedLearningTime}
                      </strong>
                      <span className="text-[0.62rem] text-gray-400 block -mt-0.5">HH:MM</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[0.68rem] text-gray-500 font-medium flex items-center gap-1 justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" /> Target
                      </span>
                      <strong className="text-lg font-black text-[#92400e] block mt-0.5">
                        {formattedTargetTime}
                      </strong>
                      <span className="text-[0.62rem] text-gray-400 block -mt-0.5">HH:MM</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-[#b45309] rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((learningSeconds / (learningTargetMinutes * 60)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* CARD 3: Daily Streak */}
              <div className="relative overflow-hidden bg-orange-50 rounded-xl p-4 pl-5 shadow-xs border border-orange-200 flex flex-col justify-between hover:border-orange-400 transition">
                <span className="absolute left-0 top-0 h-full w-1.5 bg-[#e05b1c]" />
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Flame size={18} className="fill-amber-500" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-800 block">Daily Streak</span>
                      <span className="text-[0.68rem] text-gray-500">3 Days Strong</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[0.68rem] text-gray-500 font-medium block">Best</span>
                    <strong className="text-base font-black text-[#9a3412]">7 Days</strong>
                  </div>
                </div>

                {/* Weekly Streak Days */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  {weeklyStreak.map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.62rem] font-bold ${
                          d.completed
                            ? "bg-[#b45309] text-white shadow-xs"
                            : d.isToday
                            ? "border-2 border-amber-500 text-amber-700 bg-amber-50"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {d.completed ? "✓" : d.day}
                      </div>
                      <span className="text-[0.58rem] text-gray-400">{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CARD 4: Mistakes Conquered (Resilience / Comeback Score) */}
              <button
                type="button"
                onClick={() => setShowRepairDetails((shown) => !shown)}
                aria-expanded={showRepairDetails}
                className="relative overflow-hidden bg-emerald-50 rounded-xl p-4 pl-5 shadow-xs border border-emerald-200 flex flex-col justify-between hover:border-emerald-400 transition text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <span className="absolute left-0 top-0 h-full w-1.5 bg-emerald-500" />
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Sparkles size={18} className="fill-emerald-500 text-emerald-500" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-800 block">Comeback Score</span>
                      <span className="text-[0.68rem] text-emerald-600 font-semibold">Repair progress</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[0.68rem] text-gray-500 font-medium block">Total</span>
                    <strong className="text-base font-black text-emerald-600">{totalMistakesConquered}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-600">Fixed Today:</span>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    +{mistakesConqueredToday} Repaired 🎉
                  </span>
                </div>
              </button>
            </div>

            {showRepairDetails && (
              <div className="bg-white rounded-xl border border-emerald-200 shadow-xs p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-black text-[#0f172a]">Areas Being Repaired</h3>
                    <p className="text-xs text-gray-500">Mistakes and low-mastery skills that feed the Comeback Score.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRepairDetails(false)}
                    className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    aria-label="Close repair details"
                  >
                    <X size={16} />
                  </button>
                </div>

                {repairAreas.length === 0 ? (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-800">
                    No active repairs yet. When you correct a previous mistake, it will appear here.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {repairAreas.map((area) => (
                      <div key={area.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <strong className="text-xs text-gray-900">{area.title}</strong>
                          <span className="text-[0.62rem] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            {area.source}
                          </span>
                        </div>
                        <p className="text-[0.72rem] text-gray-600 leading-snug">{area.skill}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ------------------------------------------------------------- */}
          {/* 4. HERO FOCUS CARD: "Continue Where You Left Off" */}
          {/* ------------------------------------------------------------- */}
          <section
            className={`relative overflow-hidden rounded-2xl border shadow-xs p-6 hover:shadow-md transition ${
              darkMode
                ? "bg-slate-900 border-blue-700"
                : "bg-gradient-to-br from-blue-50 via-white to-sky-50 border-blue-200"
            }`}
          >
            <span className="absolute left-0 top-0 h-full w-2 bg-[#2563eb]" />
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className="text-[0.65rem] font-extrabold px-2.5 py-1 rounded-md bg-[#2563eb] text-white uppercase tracking-wider">
                  LAST ACCESSED · ACTIVE TOPIC
                </span>
                <span className="text-xs font-semibold text-gray-600">
                  {activePackage.level} · {activePackage.subject}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => launchPractice(recommendedLoopInfo.loop)}
                  className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-[#2563eb] hover:bg-[#1d4ed8] transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>CONTINUE LEARNING</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-2 space-y-2">
                <h3 className="text-xl font-bold text-[#0f172a]">
                  {activePathNode.title}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed max-w-xl">
                  {activePathNode.goal}
                </p>

                {/* Overall Mastery Bar */}
                <div className="pt-2 max-w-md">
                  <div className="flex items-center justify-between text-[0.68rem] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    <span>OVERALL MASTERY</span>
                    <span className="text-[#2563eb] font-extrabold">
                      {pct(subjectMasteries[activePackage.id] ?? activePathProgress)}
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#60a5fa] to-[#2563eb] rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round(
                          (subjectMasteries[activePackage.id] ?? activePathProgress) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Recommended Focus Info Box */}
              <div className="bg-white/85 rounded-xl p-4 border border-blue-200 text-xs space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#1854cb] font-bold text-[0.72rem] uppercase flex items-center gap-1">
                    <Sparkles size={13} className="fill-[#1854cb]" />
                    AI Recommended Mode
                  </span>
                  <span className="text-[0.62rem] font-extrabold px-1.5 py-0.5 rounded bg-[#c2410c] text-white">
                    BEST NEXT STEP
                  </span>
                </div>
                <strong className="text-[#0f172a] block text-sm font-bold">
                  {recommendedLoopInfo.title}
                </strong>
                <p className="text-gray-600 text-[0.72rem] leading-snug">
                  {recommendedLoopInfo.reason}
                </p>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------------- */}
          {/* 5. TODAY'S MISSIONS: CLEARLY HIGHLIGHTING RECOMMENDED MODE */}
          {/* ------------------------------------------------------------- */}
          <section className="bg-white rounded-2xl p-5 shadow-xs border border-gray-200 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                  <Compass size={16} className="text-[#1854cb]" />
                  <span>Today&apos;s Missions</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Choose the learning mode that fits what you want to do next
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* AI Recommendation Indicator */}
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1854cb] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  <Sparkles size={13} className="fill-[#1854cb]" />
                  <span>Recommended: {recommendedLoopInfo.title}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMissionsBlock((shown) => !shown)}
                  aria-expanded={showMissionsBlock}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-[#1854cb] transition"
                >
                  <span>{showMissionsBlock ? "Hide" : "Show"}</span>
                  <ChevronRight
                    size={14}
                    className={`transition-transform ${showMissionsBlock ? "rotate-90" : ""}`}
                  />
                </button>
              </div>
            </div>

            {showMissionsBlock && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {[
                {
                  loop: "guided_learning",
                  title: "Guided Learning",
                  desc: "Scaffolded practice with progressive clues and worked examples.",
                  tag: "STANDARD",
                  btnColor: "bg-[#2563eb] hover:bg-[#1d4ed8]",
                  cardColor: "bg-blue-50 border-blue-200 hover:border-blue-400",
                  stripColor: "bg-[#2563eb]",
                  tagColor: "bg-blue-100 text-blue-700",
                  darkTagColor: "bg-[#1d4ed8] text-white",
                },
                {
                  loop: "mastery_check",
                  title: "Mastery Check",
                  desc: "Quick diagnostic sprint on new and emerging skills.",
                  tag: "QUICK",
                  btnColor: "bg-[#7c3aed] hover:bg-[#6d28d9]",
                  cardColor: "bg-violet-50 border-violet-200 hover:border-violet-400",
                  stripColor: "bg-[#7c3aed]",
                  tagColor: "bg-violet-100 text-violet-700",
                  darkTagColor: "bg-[#6d28d9] text-white",
                },
                {
                  loop: "revision",
                  title: "Revision",
                  desc: "Spaced retrieval on earlier topics to reinforce memory.",
                  tag: "SPACED REVIEW",
                  btnColor: "bg-[#d97706] hover:bg-[#b45309]",
                  cardColor: "bg-amber-50 border-amber-200 hover:border-amber-400",
                  stripColor: "bg-[#d97706]",
                  tagColor: "bg-amber-100 text-amber-700",
                  darkTagColor: "bg-[#92400e] text-white",
                },
                {
                  loop: "test_myself",
                  title: "Test Myself",
                  desc: "Interleaved challenge without hints. Test your true mastery!",
                  tag: "CHALLENGE",
                  btnColor: "bg-[#475569] hover:bg-[#334155]",
                  cardColor: "bg-slate-50 border-slate-300 hover:border-slate-500",
                  stripColor: "bg-[#475569]",
                  tagColor: "bg-slate-200 text-slate-700",
                  darkTagColor: "bg-[#475569] text-white",
                },
              ].map((m) => {
                const isRecommended = m.loop === recommendedLoopInfo.loop;
                return (
                  <div
                    key={m.loop}
                    className={`relative overflow-hidden rounded-2xl p-4.5 pl-5 border transition shadow-xs flex flex-col justify-between ${
                      isRecommended
                        ? darkMode
                          ? "border-2 border-blue-500 bg-slate-900 ring-2 ring-blue-500/20 shadow-md"
                          : "border-2 border-[#1854cb] bg-gradient-to-b from-blue-50 to-white ring-2 ring-blue-500/10 shadow-md"
                        : m.cardColor
                    }`}
                  >
                    <span className={`absolute left-0 top-0 h-full w-1.5 ${isRecommended ? "bg-[#1854cb]" : m.stripColor}`} />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        {isRecommended ? (
                          <span className="text-[0.65rem] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#c2410c] text-white shadow-xs flex items-center gap-1">
                            <Sparkles size={11} className="fill-white" />
                            <span>RECOMMENDED</span>
                          </span>
                        ) : (
                          <span
                            className={`text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              darkMode ? m.darkTagColor : m.tagColor
                            }`}
                          >
                            {m.tag}
                          </span>
                        )}

                        {isRecommended && (
                          <span className="text-[0.68rem] font-bold text-[#1854cb]">
                            Adaptive Pick
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-sm text-[#0f172a]">{m.title}</h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{m.desc}</p>

                      {/* Rationale Callout for Recommended Mode */}
                      {isRecommended && (
                        <div
                          className={`mt-2.5 p-2 rounded-lg border text-[0.7rem] leading-snug ${
                            darkMode
                              ? "bg-slate-800 border-blue-500/50 text-slate-100"
                              : "bg-blue-50/90 border-blue-100 text-blue-950"
                          }`}
                        >
                          <strong className={`${darkMode ? "text-blue-200" : "text-[#1854cb]"} block mb-0.5`}>
                            Why this mode?
                          </strong>
                          {recommendedLoopInfo.reason}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => launchPractice(m.loop as LearningLoopType)}
                      className={`mt-4 w-full py-2.5 text-xs font-bold text-white rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                        isRecommended
                          ? "bg-[#1854cb] hover:bg-[#1241a3] ring-1 ring-blue-700/30"
                          : m.btnColor
                      }`}
                    >
                      <span>{isRecommended ? "Start Recommended Mode" : "Start Mode"}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
            )}
          </section>

          {/* ------------------------------------------------------------- */}
          {/* 6. COMPACT SUBJECT QUICK-SWITCHER */}
          {/* ------------------------------------------------------------- */}
          <section className="bg-white rounded-2xl p-5 shadow-xs border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                  <BookOpen size={16} className="text-[#1854cb]" />
                  <span>My Active Subjects</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Switch active subject in 1-click without scrolling through dozens of cards
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSubjectsBlock((shown) => !shown)}
                aria-expanded={showSubjectsBlock}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-[#1854cb] transition"
              >
                <span>{showSubjectsBlock ? "Hide" : "Show"}</span>
                <ChevronRight
                  size={14}
                  className={`transition-transform ${showSubjectsBlock ? "rotate-90" : ""}`}
                />
              </button>
            </div>

            {showSubjectsBlock && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: SEC3_GEOG_TOURISM.id,
                  title: "Upper Sec Geography",
                  cluster: "Tourism Cluster",
                  mastery: subjectMasteries[SEC3_GEOG_TOURISM.id] ?? 0.42,
                  level: "Sec 3",
                  cardColor: "bg-sky-50 border-sky-200 hover:border-sky-400",
                  stripColor: "bg-sky-500",
                  progressColor: "from-sky-400 to-blue-600",
                },
                {
                  id: P5_MATH_DECIMALS.id,
                  title: "Secondary Mathematics",
                  cluster: "Decimals & Operations",
                  mastery: subjectMasteries[P5_MATH_DECIMALS.id] ?? 0.35,
                  level: "Primary 5",
                  cardColor: "bg-violet-50 border-violet-200 hover:border-violet-400",
                  stripColor: "bg-violet-500",
                  progressColor: "from-violet-400 to-purple-600",
                },
                {
                  id: P4_ENGLISH_SVA.id,
                  title: "English Language",
                  cluster: "Subject-Verb Agreement",
                  mastery: subjectMasteries[P4_ENGLISH_SVA.id] ?? 0.55,
                  level: "Primary 4",
                  cardColor: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
                  stripColor: "bg-emerald-500",
                  progressColor: "from-emerald-400 to-teal-600",
                },
              ].map((subj) => {
                const isSelected = selectedPackageId === subj.id;
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => switchSubject(subj.id)}
                    className={`relative overflow-hidden p-4 pl-5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-[#eef4ff] border-[#2563eb] ring-2 ring-[#2563eb]/20 shadow-xs"
                        : subj.cardColor
                    }`}
                  >
                    <span className={`absolute left-0 top-0 h-full w-1.5 ${isSelected ? "bg-[#2563eb]" : subj.stripColor}`} />
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[0.68rem] font-bold px-2 py-0.5 rounded-full bg-white border text-gray-600">
                          {subj.level}
                        </span>
                        {isSelected && (
                          <span className="text-[0.65rem] font-extrabold text-[#2563eb] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" /> Current
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-[#0f172a]">{subj.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{subj.cluster}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-200/60">
                      <div className="flex items-center justify-between text-[0.68rem] font-bold text-gray-600 mb-1">
                        <span>OVERALL MASTERY</span>
                        <strong className="text-[#2563eb]">{pct(subj.mastery)}</strong>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${isSelected ? "from-[#60a5fa] to-[#2563eb]" : subj.progressColor} rounded-full`}
                          style={{ width: `${Math.round(subj.mastery * 100)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            )}
          </section>

          {/* ------------------------------------------------------------- */}
          {/* 7. TARGET SETTING MODAL (Interactive) */}
          {/* ------------------------------------------------------------- */}
          {editingTargetType && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-200 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <h3 className="font-bold text-base text-[#0f172a] flex items-center gap-2">
                    <Pencil size={16} className="text-[#2563eb]" />
                    <span>
                      {editingTargetType === "concepts"
                        ? "Set Daily Concepts Goal"
                        : "Set Daily Learning Time Goal"}
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingTargetType(null)}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <X size={16} />
                  </button>
                </div>

                <p className="text-xs text-gray-600">
                  {editingTargetType === "concepts"
                    ? "How many concepts would you like to master each day?"
                    : "How many minutes of active practice would you like to target today?"}
                </p>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-2">
                  {(editingTargetType === "concepts" ? [2, 4, 6, 8] : [15, 30, 45, 60]).map(
                    (val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setTempTargetValue(val)}
                        className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          tempTargetValue === val
                            ? "bg-[#2563eb] text-white border-[#2563eb]"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700"
                        }`}
                      >
                        {val} {editingTargetType === "concepts" ? "" : "m"}
                      </button>
                    )
                  )}
                </div>

                {/* Manual Number Input */}
                <div className="pt-2">
                  <label className="text-[0.72rem] font-bold text-gray-500 uppercase block mb-1">
                    Custom Target
                  </label>
                  <input
                    type="number"
                    min={editingTargetType === "concepts" ? 1 : 5}
                    max={editingTargetType === "concepts" ? 20 : 180}
                    value={tempTargetValue}
                    onChange={(e) => setTempTargetValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingTargetType(null)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 text-gray-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveTarget}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white transition shadow-xs"
                  >
                    Save Target
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      ) : (
        /* ========================================================= */
        /* PRACTICE WORKSPACE (Active Question Surface)             */
        /* ========================================================= */
        <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 space-y-5">
          {/* Breadcrumb & Exit */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-2xl border border-gray-200 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveView("dashboard")}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#1854cb] hover:text-[#0c2f74] transition cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>← Back to Dashboard</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                {activePackage.subject}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Mode: {recommendation.loopName}
              </span>
              <button
                type="button"
                onClick={() => setShowKnowledgeUnits((shown) => !shown)}
                aria-expanded={showKnowledgeUnits}
                className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white text-[#1854cb] border border-blue-200 hover:bg-blue-50 transition cursor-pointer"
              >
                {showKnowledgeUnits ? "Hide learning path" : "Learning path"}
              </button>
            </div>
          </div>

          {showKnowledgeUnits && (
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a] flex items-center gap-1.5">
                  <Target size={15} className="text-[#1854cb]" />
                  Learning Path
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[0.68rem] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {pct(activePathProgress)} Mastered
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowKnowledgeUnits(false)}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    aria-label="Hide learning path"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div
                className={`rounded-xl border overflow-x-auto overflow-y-hidden ${
                  darkMode
                    ? "bg-slate-950 border-slate-700"
                    : "bg-gradient-to-br from-sky-50 via-white to-amber-50/60 border-blue-100"
                }`}
              >
                <div
                  className="relative"
                  style={{
                    width: `${learningPathMap.width}px`,
                    height: `${learningPathMap.height}px`,
                  }}
                >
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    width={learningPathMap.width}
                    height={learningPathMap.height}
                    viewBox={`0 0 ${learningPathMap.width} ${learningPathMap.height}`}
                    aria-hidden="true"
                  >
                    {learningPathMap.sequenceLinks.map((link) => (
                      <line
                        key={`${link.from.id}-${link.to.id}-shadow`}
                        x1={link.from.x}
                        y1={link.from.y}
                        x2={link.to.x}
                        y2={link.to.y}
                        stroke="#e2e8f0"
                        strokeWidth="18"
                        strokeLinecap="round"
                      />
                    ))}
                    {learningPathMap.sequenceLinks.map((link) => (
                      <line
                        key={`${link.from.id}-${link.to.id}`}
                        x1={link.from.x}
                        y1={link.from.y}
                        x2={link.to.x}
                        y2={link.to.y}
                        stroke={link.isDone ? "#047857" : link.isActive ? "#2563eb" : "#64748b"}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={link.isDone ? undefined : link.isActive ? "10 8" : "4 10"}
                      />
                    ))}
                  </svg>

                  {learningPathMap.nodes.map((node, index) => {
                    const ku = activePackage.curriculum.find((item) => item.ku === node.id);
                    const isAbovePath = node.y > 120;

                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => ku && jumpToKu(ku)}
                        className={`absolute w-[132px] rounded-2xl border p-2.5 pl-3.5 text-left shadow-xs transition cursor-pointer overflow-hidden ${
                          node.isCurrent
                            ? "bg-blue-50 border-[#1854cb] text-[#0f3f9e] ring-2 ring-blue-500/20 shadow-blue-100"
                            : node.isMastered
                            ? "bg-emerald-50 border-emerald-400 text-emerald-950 shadow-emerald-100"
                            : node.status === "Next"
                            ? "bg-amber-50 border-[#b45309] text-amber-950 shadow-amber-100"
                            : "bg-slate-50 border-slate-300 text-slate-700 hover:border-blue-200"
                        }`}
                        style={{
                          left: `${node.x - 66}px`,
                          top: `${isAbovePath ? node.y - 96 : node.y + 20}px`,
                        }}
                        title={node.title}
                      >
                        <span
                          className={`absolute left-0 top-0 h-full w-2 ${
                            node.isMastered
                              ? "bg-emerald-500"
                              : node.isCurrent
                              ? "bg-[#1854cb]"
                              : node.status === "Next"
                              ? "bg-[#b45309]"
                              : "bg-slate-300"
                          }`}
                        />
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className={`text-[0.58rem] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                              node.isMastered
                                ? "bg-emerald-600 text-white"
                                : node.isCurrent
                                ? "bg-[#1854cb] text-white"
                                : node.status === "Next"
                                ? "bg-[#b45309] text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {node.status}
                          </span>
                          <span
                            className={`text-[0.62rem] font-black px-1.5 py-0.5 rounded-full ${
                              node.isMastered
                                ? "bg-emerald-100 text-emerald-800"
                                : node.isCurrent
                                ? "bg-blue-100 text-blue-800"
                                : node.status === "Next"
                                ? "bg-amber-100 text-[#92400e]"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {pct(node.mastery)}
                          </span>
                        </div>
                        <span
                          className={`block text-[0.62rem] font-black uppercase tracking-wider ${
                            node.isMastered
                              ? "text-emerald-700"
                              : node.isCurrent
                              ? "text-blue-700"
                              : node.status === "Next"
                              ? "text-[#92400e]"
                              : "text-slate-500"
                          }`}
                        >
                          {String(index + 1).padStart(2, "0")} · {node.id}
                        </span>
                        <span className="block text-[0.72rem] font-bold leading-tight line-clamp-2">
                          {node.title}
                        </span>
                      </button>
                    );
                  })}

                  {learningPathMap.nodes.map((node, index) => (
                    <div
                      key={`${node.id}-pin`}
                      className={`absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white shadow-md flex items-center justify-center text-xs font-black ${
                        node.isMastered
                          ? "bg-emerald-600 text-white"
                          : node.isCurrent
                          ? "bg-[#1854cb] text-white"
                          : node.status === "Next"
                          ? "bg-[#b45309] text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                      style={{ left: `${node.x}px`, top: `${node.y}px` }}
                    >
                      {node.isMastered ? <Check size={17} /> : index + 1}
                    </div>
                  ))}

                  <div className="absolute left-4 top-3 text-[0.62rem] font-black uppercase tracking-wider text-slate-400">
                    Start
                  </div>
                  <div className="absolute right-4 bottom-3 text-[0.62rem] font-black uppercase tracking-wider text-slate-400">
                    Finish
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-3 text-[0.68rem] font-bold text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <span className="w-4 h-2 rounded-full bg-emerald-600" />
                  Done
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-4 h-2 rounded-full bg-[#1854cb]" />
                  Now
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-4 h-2 rounded-full bg-[#b45309]" />
                  Next
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-5 border-t-2 border-dashed border-slate-300" />
                  Upcoming
                </span>
              </div>
            </div>
          )}

          {/* Question Surface */}
          <div className="space-y-4">
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-200">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                  <div>
                    <span className="text-[0.72rem] font-bold text-[#1854cb] uppercase tracking-wider block">
                      {activePathNode.ku} · {current.difficulty} Item
                    </span>
                    <h2 className="text-lg font-bold text-[#0f172a] mt-0.5">{current.title}</h2>
                  </div>

                  <span className="text-[0.68rem] font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                    Skill: {activeSkill.label}
                  </span>
                </div>

                {/* Worked Example Guide */}
                {showWorkedExample ? (
                  <div className="bg-[#f8faff] rounded-xl p-5 border border-[#d6e4ff] space-y-4 mb-4">
                    <div className="flex items-center gap-2.5 text-[#1854cb]">
                      <BookOpenCheck size={22} />
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider block">
                          Step-by-Step Worked Example
                        </span>
                        <strong className="text-base font-bold text-[#092b6b]">
                          Study the steps below, then try solving it yourself!
                        </strong>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-blue-100 text-sm font-medium text-gray-800">
                      {current.prompt}
                    </div>

                    <div className="space-y-2">
                      {workedExampleSteps.map((step, idx) => (
                        <div
                          key={step.label}
                          className="flex items-start gap-3 text-xs bg-white p-2.5 rounded-lg border border-gray-100"
                        >
                          <span className="w-5 h-5 rounded-full bg-[#1854cb] text-white font-bold flex items-center justify-center text-[0.68rem] shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <strong className="text-[#092b6b] block">{step.label}</strong>
                            <p className="mt-0.5 text-gray-600 leading-relaxed">{step.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowWorkedExample(false)}
                      className="w-full py-2 bg-[#1854cb] hover:bg-[#1241a3] text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>Got it! Let me solve it now</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Prompt Box */}
                    <div className="p-5 rounded-xl bg-[#f8fafc] border border-gray-100 text-base font-semibold text-gray-800 leading-relaxed mb-5">
                      {current.prompt}
                    </div>

                    {/* Options */}
                    {current.options && current.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
                        {current.options.map((option) => {
                          const isSelected = answer === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                if (answer !== option) setAnswerChangeCount((c) => c + 1);
                                setAnswer(option);
                              }}
                              className={`p-3.5 rounded-xl border text-sm font-semibold transition cursor-pointer text-left flex items-center justify-between ${
                                isSelected
                                  ? "bg-[#eef4ff] border-[#2563eb] text-[#1854cb] shadow-xs"
                                  : "bg-white border-gray-200 hover:border-blue-200 text-gray-800"
                              }`}
                            >
                              <span>{option}</span>
                              <span
                                className={`w-5 h-5 rounded-full border flex items-center justify-center text-[0.65rem] ${
                                  isSelected
                                    ? "border-[#2563eb] bg-[#2563eb] text-white"
                                    : "border-gray-300 text-transparent"
                                }`}
                              >
                                ✓
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Submit Answer */}
                    <form onSubmit={handleAnswerSubmit} className="flex gap-2.5 mb-4">
                      <input
                        type="text"
                        value={answer}
                        onChange={(e) => {
                          setAnswerChangeCount((c) => c + 1);
                          setAnswer(e.target.value);
                        }}
                        placeholder="Choose an option above or type your answer..."
                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1854cb]/30 focus:border-[#1854cb]"
                      />
                      <button
                        type="submit"
                        disabled={!answer.trim()}
                        className="px-5 py-2.5 bg-[#1854cb] hover:bg-[#1241a3] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-sm rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-xs"
                      >
                        <span>Submit</span>
                        <Send size={15} />
                      </button>
                    </form>

                    {/* Feedback */}
                    {feedback && (
                      <div
                        className={`p-4 rounded-xl border mb-4 flex items-start gap-3 ${
                          feedback === "correct"
                            ? "bg-[#edfbf1] border-[#a3e8b6] text-[#0f5132]"
                            : "bg-[#fff5f5] border-[#fecaca] text-[#991b1b]"
                        }`}
                      >
                        {feedback === "correct" ? (
                          <CheckCircle2 size={20} className="shrink-0 text-emerald-600 mt-0.5" />
                        ) : (
                          <XCircle size={20} className="shrink-0 text-rose-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <strong className="text-sm block font-bold">
                            {feedback === "correct" ? "Excellent work! 🎉" : "Good effort! Let's check this:"}
                          </strong>
                          <p className="text-xs mt-0.5 leading-relaxed">
                            {feedbackCopy(current, answer, feedback === "correct", activeSkill)}
                          </p>
                          {feedback === "correct" && (itemAttemptCount > 1 || hintCount > 0) && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-md border border-emerald-300">
                              <Sparkles size={13} className="fill-emerald-600 text-emerald-600" />
                              <span>Mistake Conquered! +1 to your Comeback Score 🎉</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setHintCount((prev) => Math.min(current.hints?.length ?? 0, prev + 1))}
                          disabled={hintCount >= (current.hints?.length ?? 0)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold text-xs rounded-lg transition cursor-pointer"
                        >
                          <Lightbulb size={14} className="text-amber-500" />
                          <span>
                            {hintCount === 0
                              ? "Need a hint?"
                              : `Hint (${hintCount}/${current.hints?.length ?? 0})`}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowWorkedExample(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1854cb] font-semibold text-xs rounded-lg transition cursor-pointer"
                        >
                          <BookOpenCheck size={14} />
                          <span>Worked Example</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleNextQuestion}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0f172a] hover:bg-gray-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs ml-auto"
                      >
                        <span>Next Question</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>

                    {/* Hints Box */}
                    {hintCount > 0 && current.hints && (
                      <div className="mt-4 p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                          <Sparkles size={14} className="text-amber-600" />
                          <span>Guided Clues ({hintCount} revealed)</span>
                        </div>
                        <div className="space-y-1.5 text-xs text-amber-950">
                          {current.hints.slice(0, hintCount).map((hint, i) => (
                            <div
                              key={hint}
                              className="flex items-start gap-2 bg-white/80 p-2 rounded-lg border border-amber-100"
                            >
                              <span className="font-bold text-amber-700">Clue {i + 1}:</span>
                              <span>{hint}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            {showCoachModal && latestAffect && (
              <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-blue-100">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#eef4ff] text-[#1854cb] flex items-center justify-center">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <span className="text-[0.7rem] font-bold uppercase tracking-wider text-gray-500 block">
                          Adaptive Coach
                        </span>
                        <strong className="text-base font-extrabold text-[#0f172a] block">
                          {latestAffect.zone} Flow
                        </strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCoachModal(false)}
                      className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                      aria-label="Close coach message"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <p className="my-4 p-4 rounded-xl bg-[#f8fafc] border border-gray-100 text-sm text-gray-700 leading-relaxed">
                    {ableStudentMessage(latestAffect)}
                  </p>

                  <div className="flex items-center justify-between text-[0.72rem] text-gray-500 pb-4">
                    <span>Unit: <strong>{activePathNode.ku}</strong></span>
                    <span>Target: <strong>80% Mastery</strong></span>
                  </div>

                  <button
                    type="button"
                    onClick={proceedToNextQuestion}
                    className="w-full py-2.5 rounded-xl bg-[#1854cb] hover:bg-[#1241a3] text-white text-sm font-bold transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Continue to next question</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
