"use client";

import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileJson,
  Flame,
  Lightbulb,
  ListChecks,
  Menu,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import curriculumData from "@/content/grammar-sva/curriculum.json";
import itemData from "@/content/grammar-sva/items.json";
import skillData from "@/content/grammar-sva/skills.json";

type SkillId = string;

type Skill = {
  id: SkillId;
  label: string;
  description: string;
  mastery: number;
  learn: number;
  guess: number;
  slip: number;
};

type Problem = {
  id: string;
  ku: string;
  sourcePage: number;
  title: string;
  prompt: string;
  skill: SkillId;
  difficulty: "Core" | "Stretch" | "Repair";
  answer: string;
  options: string[];
  hints: string[];
  scaffold: string;
  answerStatus: string;
};

type CurriculumNode = {
  ku: string;
  title: string;
  goal: string;
  skills: SkillId[];
};

type EventLog = {
  label: string;
  detail: string;
  correct?: boolean;
};

type BktCalculation = {
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
};

const curriculumMap = curriculumData as CurriculumNode[];
const problems = itemData as Problem[];
const initialSkills = Object.fromEntries((skillData as Skill[]).map((skill) => [skill.id, skill])) as Record<SkillId, Skill>;

function normalizeAnswer(value: string) {
  return value.toLowerCase().trim().replace(/[.!?]/g, "").replace(/\s+/g, " ");
}

function calculateBkt(skill: Skill, correct: boolean): BktCalculation {
  const { mastery, guess, slip, learn } = skill;
  const knownObservationRate = correct ? 1 - slip : slip;
  const unknownObservationRate = correct ? guess : 1 - guess;
  const knownEvidence = mastery * knownObservationRate;
  const unknownEvidence = (1 - mastery) * unknownObservationRate;
  const posterior = knownEvidence / (knownEvidence + unknownEvidence);

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
    afterLearning: Math.min(0.98, Math.max(0.02, posterior + (1 - posterior) * learn)),
    learn,
  };
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function decimal(value: number) {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function targetDifficulty(mastery: number): Problem["difficulty"] {
  if (mastery < 0.35) {
    return "Repair";
  }

  if (mastery < 0.7) {
    return "Core";
  }

  return "Stretch";
}

function skillLabels(skillIds: SkillId[]) {
  return skillIds.map((skillId) => initialSkills[skillId].label).join(", ");
}

export default function Home() {
  const [skills, setSkills] = useState(initialSkills);
  const [currentId, setCurrentId] = useState(problems[2].id);
  const [answer, setAnswer] = useState("");
  const [hintCount, setHintCount] = useState(0);
  const [attemptedIds, setAttemptedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [lastCalculation, setLastCalculation] = useState<BktCalculation | null>(null);
  const [events, setEvents] = useState<EventLog[]>([
    {
      label: "SVA module initialized",
      detail: "Subject-verb agreement content loaded from the combined SLS PDF.",
    },
  ]);

  const current = problems.find((problem) => problem.id === currentId) ?? problems[0];
  const activeSkill = skills[current.skill];
  const weakestSkill = Object.values(skills).sort((a, b) => a.mastery - b.mastery)[0];
  const desiredDifficulty = targetDifficulty(weakestSkill.mastery);
  const previewCalculation = calculateBkt(activeSkill, true);
  const displayedCalculation = lastCalculation ?? previewCalculation;
  const observationText = displayedCalculation.correct ? "correct" : "wrong";
  const observationSymbol = displayedCalculation.correct ? "Correct" : "Wrong";
  const knownRateLabel = displayedCalculation.correct ? "Correct if they know it" : "Wrong despite knowing it";
  const unknownRateLabel = displayedCalculation.correct ? "Correct by guessing" : "Wrong if not mastered";
  const knownEvidenceLabel = displayedCalculation.correct ? "Knows and correct" : "Knows but slipped";
  const unknownEvidenceLabel = displayedCalculation.correct ? "Guessed and correct" : "Not mastered and wrong";
  const observedOutcomeLabel = displayedCalculation.correct ? "Observed correct answer" : "Observed wrong answer";

  const recommended = useMemo(() => {
    const weak = Object.values(skills).sort((a, b) => a.mastery - b.mastery)[0];
    const difficulty = targetDifficulty(weak.mastery);
    const skillMatches = problems.filter((problem) => problem.skill === weak.id && problem.id !== currentId);
    const freshDifficultyMatch = skillMatches.find(
      (problem) => problem.difficulty === difficulty && !attemptedIds.includes(problem.id),
    );
    const freshSkillMatch = skillMatches.find((problem) => !attemptedIds.includes(problem.id));

    return freshDifficultyMatch ?? freshSkillMatch ?? skillMatches[0] ?? problems[0];
  }, [attemptedIds, currentId, skills]);

  function chooseAdaptiveNext(nextSkills = skills, nextAttemptedIds = attemptedIds) {
    const weak = Object.values(nextSkills).sort((a, b) => a.mastery - b.mastery)[0];
    const difficulty = targetDifficulty(weak.mastery);
    const skillMatches = problems.filter((problem) => problem.skill === weak.id && problem.id !== currentId);
    const freshDifficultyMatch = skillMatches.find(
      (problem) => problem.difficulty === difficulty && !nextAttemptedIds.includes(problem.id),
    );
    const freshSkillMatch = skillMatches.find((problem) => !nextAttemptedIds.includes(problem.id));

    return freshDifficultyMatch ?? freshSkillMatch ?? skillMatches[0] ?? problems.find((problem) => problem.id !== currentId) ?? current;
  }

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const correct = normalizeAnswer(answer) === normalizeAnswer(current.answer);
    const calculation = calculateBkt(activeSkill, correct);
    const updatedMastery = calculation.afterLearning;
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
    setEvents((items) => [
      {
        label: correct ? "Correct response" : "Needs repair",
        detail: `${activeSkill.label} moved from ${pct(activeSkill.mastery)} to ${pct(updatedMastery)} mastery.`,
        correct,
      },
      ...items,
    ]);
  }

  function showHint() {
    setHintCount((count) => Math.min(current.hints.length, count + 1));
    setEvents((items) => [
      {
        label: "Hint requested",
        detail: `${current.title}: grammar clue ${Math.min(current.hints.length, hintCount + 1)} opened.`,
      },
      ...items,
    ]);
  }

  function goNext() {
    const next = chooseAdaptiveNext();
    setCurrentId(next.id);
    setAnswer("");
    setFeedback(null);
    setLastCalculation(null);
    setHintCount(0);
    setEvents((items) => [
      {
        label: "Adaptive next",
        detail: `${next.title} selected for ${skills[next.skill].label} at ${next.difficulty.toLowerCase()} difficulty.`,
      },
      ...items,
    ]);
  }

  function resetSession() {
    setSkills(initialSkills);
    setCurrentId(problems[2].id);
    setAnswer("");
    setHintCount(0);
    setAttemptedIds([]);
    setFeedback(null);
    setLastCalculation(null);
    setEvents([{ label: "Session reset", detail: "SVA mastery estimates returned to the seed learner profile." }]);
  }

  return (
    <main className="min-h-screen bg-[#f1f3f7] text-[#20242a]">
      <header className="sls-topbar">
        <div className="sls-logo">SLS</div>
        <span className="class-chip">[ALS] Subject-Verb Agreement</span>
        <p>Primary 4 subject-verb agreement adaptive grammar practice</p>
        <div className="topbar-actions">
          <button aria-label="Menu">
            <Menu size={18} />
          </button>
          <button aria-label="Learner profile">
            <Brain size={18} />
          </button>
        </div>
      </header>
      <div className="paused-band">
        <ClipboardList size={15} />
        <span>Prototype mode. Subject-verb agreement mastery is local to this session.</span>
      </div>

      <section className="workspace-shell">
        <aside className="lesson-nav" aria-label="Lesson navigation">
          <div className="nav-tools">
            <button>Expand All</button>
            <span />
            <button>Collapse All</button>
          </div>

          <div className="module-block">
            <div className="module-heading">
              <span className="folder-icon">A</span>
              <strong>Grammar ALS: subject-verb agreement map</strong>
            </div>
            <div className="lesson-step active-step">
              <span>1</span>
              <div>
                <strong>KU1: What is a subject?</strong>
                <em>ADAPTIVE TUTOR</em>
              </div>
            </div>
            <div className="lesson-step">
              <span>2</span>
              <div>
                <strong>KU2-KU4: Verb Agreement</strong>
                <em className="purple">MASTERY REVIEW</em>
              </div>
            </div>
            <div className="lesson-step">
              <span>3</span>
              <div>
                <strong>KU5-KU9: Complex Subjects</strong>
                <em className="orange">CONTENT BUILDER</em>
              </div>
            </div>
          </div>
        </aside>

        <section className="product-frame">
          <header className="top-bar">
            <div>
              <div className="activity-title">
                <span>1</span>
                <p>Activate Learning</p>
              </div>
              <h1>Learning goal</h1>
              <p className="goal-copy">
                By the end of this activity, the learner can identify the subject, decide whether it is singular or
                plural, and choose a verb or verb phrase that agrees with that subject.
              </p>
            </div>
            <div className="session-score" aria-label="Current weakest skill">
              <Flame size={18} />
              <span>{weakestSkill.label}</span>
              <strong>{pct(weakestSkill.mastery)}</strong>
            </div>
          </header>

          <div className="learning-grid">
            <section className="tutor-surface" aria-label="Active tutoring problem">
              <div className="problem-header">
                <div>
                  <p>Q1 · {current.difficulty} grammar practice</p>
                  <h2>{current.title}</h2>
                </div>
                <span>{activeSkill.label}</span>
              </div>

              <div className="prompt-band grammar-prompt">
                <p>{current.prompt}</p>
              </div>

              <div className="option-grid" aria-label="Answer choices">
                {current.options.map((option) => (
                  <button
                    className={answer === option ? "selected-option" : ""}
                    key={option}
                    type="button"
                    onClick={() => setAnswer(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <form className="answer-row" onSubmit={submitAnswer}>
                <label htmlFor="answer">Student answer</label>
                <div>
                  <input
                    id="answer"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
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
                  <span>
                    {feedback === "correct"
                      ? "Good grammar signal. The mastery model increased confidence for this SVA skill."
                      : `Not yet. The target answer is "${current.answer}", so the tutor will bias toward repair practice.`}
                  </span>
                </div>
              )}

              <div className="action-strip">
                <button type="button" onClick={showHint} className="secondary-action">
                  <Lightbulb size={18} />
                  <span>Reveal hint</span>
                </button>
                <button type="button" onClick={goNext} className="primary-action">
                  <span>Adaptive next</span>
                  <ArrowRight size={18} />
                </button>
              </div>

              <div className="hint-stack">
                <div className="scaffold-note">
                  <Sparkles size={18} />
                  <p>{current.scaffold}</p>
                </div>
                {current.hints.slice(0, hintCount).map((hint, index) => (
                  <div className="hint-line" key={hint}>
                    <span>{index + 1}</span>
                    <p>{hint}</p>
                  </div>
                ))}
              </div>
            </section>

            <aside className="insight-column" aria-label="Adaptive insights">
              <section className="mastery-panel">
                <div className="panel-title">
                  <BarChart3 size={18} />
                  <h2>SVA mastery</h2>
                </div>
                {Object.values(skills).map((skill) => (
                  <div className="skill-row" key={skill.id}>
                    <div>
                      <strong>{skill.label}</strong>
                      <span>{skill.description}</span>
                    </div>
                    <div className="meter" aria-label={`${skill.label} mastery ${pct(skill.mastery)}`}>
                      <span style={{ width: pct(skill.mastery) }} />
                    </div>
                    <em>{pct(skill.mastery)}</em>
                  </div>
                ))}
              </section>

              <section className="recommendation-panel">
                <div className="panel-title">
                  <Target size={18} />
                  <h2>Next rationale</h2>
                </div>
                <p>
                  Recommend <strong>{recommended.title}</strong> because{" "}
                  <strong>{skills[recommended.skill].label}</strong> has the lowest estimated mastery. The target
                  band is <strong>{desiredDifficulty}</strong>.
                </p>
                <button type="button" onClick={goNext}>
                  <ChevronRight size={18} />
                  <span>Queue recommendation</span>
                </button>
              </section>
            </aside>
          </div>

          <section className="curriculum-panel">
            <div className="panel-title">
              <ListChecks size={18} />
              <h2>Subject-verb agreement curriculum map</h2>
            </div>
            <div className="curriculum-grid">
              {curriculumMap.map((node) => (
                <article className="curriculum-node" key={node.title}>
                  <strong>{node.title}</strong>
                  <p>{node.goal}</p>
                  <span>{skillLabels(node.skills)}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="builder-grid">
            <div className="schema-panel">
              <div className="panel-title">
                <FileJson size={18} />
                <h2>Reusable grammar item</h2>
              </div>
              <pre>
                {JSON.stringify(
                  {
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
                  2,
                )}
              </pre>
            </div>

            <div className="event-panel">
              <div className="panel-title">
                <ListChecks size={18} />
                <h2>Learning events</h2>
              </div>
              <div className="event-list">
                {events.slice(0, 5).map((item, index) => (
                  <article className="event-item" key={`${item.label}-${index}`}>
                    <span className={item.correct === undefined ? "" : item.correct ? "ok" : "repair"} />
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="model-panel">
              <div className="panel-title">
                <SlidersHorizontal size={18} />
                <h2>BKT parameters</h2>
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
            </div>
          </section>

          <section className="bkt-explainer" aria-label="Annotated BKT calculation">
            <div className="panel-title">
              <Brain size={18} />
              <h2>{lastCalculation ? "Last answer BKT calculation" : "Preview BKT calculation"}</h2>
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
                <span>chance learner knows this SVA skill</span>
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
                    {decimal(displayedCalculation.knownEvidence)} + {decimal(displayedCalculation.unknownEvidence)}
                  </span>
                </div>
                <strong>{pct(displayedCalculation.posterior)}</strong>
                <span>evidence-adjusted mastery</span>
              </div>
              <div className="flow-next">
                <p>Add learning</p>
                <span>
                  {pct(displayedCalculation.posterior)} + remaining gap x {decimal(displayedCalculation.learn)}
                </span>
                <strong>{pct(displayedCalculation.afterLearning)}</strong>
                <em>mastery for next question</em>
              </div>
            </div>
            <p className="formula-caption">
              Same equation underneath: P(Knows | {observationSymbol}) = {decimal(displayedCalculation.knownEvidence)} / (
              {decimal(displayedCalculation.knownEvidence)} + {decimal(displayedCalculation.unknownEvidence)}).
            </p>
            <p className="model-note">
              BKT was introduced through the knowledge tracing work of Albert Corbett and John Anderson for
              intelligent tutoring systems. This model is intentionally modifiable: parameters can vary by skill,
              learner group, problem difficulty, hint usage, or be learned from historical student data.
            </p>
          </section>
        </section>
      </section>
    </main>
  );
}
