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

type SkillId = "linear-equations" | "distributive-property" | "combine-like-terms";

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
  title: string;
  prompt: string;
  skill: SkillId;
  difficulty: "Core" | "Stretch" | "Repair";
  answer: string;
  hints: string[];
  scaffold: string;
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

const initialSkills: Record<SkillId, Skill> = {
  "linear-equations": {
    id: "linear-equations",
    label: "Linear equations",
    description: "Solve one-variable equations with inverse operations.",
    mastery: 0.42,
    learn: 0.16,
    guess: 0.22,
    slip: 0.12,
  },
  "distributive-property": {
    id: "distributive-property",
    label: "Distributive property",
    description: "Expand expressions before simplifying or solving.",
    mastery: 0.31,
    learn: 0.18,
    guess: 0.2,
    slip: 0.14,
  },
  "combine-like-terms": {
    id: "combine-like-terms",
    label: "Combine like terms",
    description: "Collect matching variables and constants accurately.",
    mastery: 0.58,
    learn: 0.12,
    guess: 0.18,
    slip: 0.1,
  },
};

const problems: Problem[] = [
  {
    id: "p-101",
    title: "Balance the equation",
    prompt: "Solve for x: 3x + 4 = 19",
    skill: "linear-equations",
    difficulty: "Core",
    answer: "5",
    hints: ["Undo the +4 first.", "3x = 15", "Divide both sides by 3."],
    scaffold: "Subtract 4 from both sides, then divide the remaining coefficient.",
  },
  {
    id: "p-102",
    title: "Expand before solving",
    prompt: "Solve for x: 2(x + 6) = 26",
    skill: "distributive-property",
    difficulty: "Core",
    answer: "7",
    hints: ["Distribute the 2 across both terms.", "2x + 12 = 26", "Subtract 12, then divide by 2."],
    scaffold: "The tutor first checks whether the student expands correctly before solving.",
  },
  {
    id: "p-103",
    title: "Collect terms",
    prompt: "Simplify: 4x + 7 + 2x - 3",
    skill: "combine-like-terms",
    difficulty: "Repair",
    answer: "6x+4",
    hints: ["Group variable terms and number terms.", "4x + 2x = 6x", "7 - 3 = 4"],
    scaffold: "Drag or mentally group matching terms, then combine each group.",
  },
  {
    id: "p-104",
    title: "Two-step equation",
    prompt: "Solve for x: 5x - 8 = 27",
    skill: "linear-equations",
    difficulty: "Stretch",
    answer: "7",
    hints: ["Undo the -8 with +8.", "5x = 35", "Divide by 5."],
    scaffold: "Use inverse operations in reverse order of the expression.",
  },
  {
    id: "p-105",
    title: "Distribute and collect",
    prompt: "Simplify: 3(2x + 5) - x",
    skill: "distributive-property",
    difficulty: "Stretch",
    answer: "5x+15",
    hints: ["Start by distributing 3.", "3(2x + 5) becomes 6x + 15.", "Now subtract x from 6x."],
    scaffold: "Expansion creates terms that can be combined in a second step.",
  },
];

function normalizeAnswer(value: string) {
  return value.toLowerCase().replace(/\s/g, "").replace(/\*/g, "");
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

export default function Home() {
  const [skills, setSkills] = useState(initialSkills);
  const [currentId, setCurrentId] = useState(problems[1].id);
  const [answer, setAnswer] = useState("");
  const [hintCount, setHintCount] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [lastCalculation, setLastCalculation] = useState<BktCalculation | null>(null);
  const [events, setEvents] = useState<EventLog[]>([
    {
      label: "Lesson initialized",
      detail: "Adaptive queue seeded with algebra readiness data.",
    },
  ]);

  const current = problems.find((problem) => problem.id === currentId) ?? problems[0];
  const activeSkill = skills[current.skill];
  const weakestSkill = Object.values(skills).sort((a, b) => a.mastery - b.mastery)[0];
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
    return problems.find((problem) => problem.skill === weak.id && problem.id !== currentId) ?? problems[0];
  }, [currentId, skills]);

  function chooseAdaptiveNext(nextSkills = skills) {
    const rankedSkills = Object.values(nextSkills).sort((a, b) => a.mastery - b.mastery);
    const targetSkill = rankedSkills[0];
    return (
      problems.find((problem) => problem.skill === targetSkill.id && problem.id !== currentId) ??
      problems.find((problem) => problem.id !== currentId) ??
      current
    );
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

    setSkills(nextSkills);
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
        detail: `${current.title}: scaffold step ${Math.min(current.hints.length, hintCount + 1)} opened.`,
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
        detail: `${next.title} selected because ${skills[next.skill].label} is currently ${pct(skills[next.skill].mastery)} mastered.`,
      },
      ...items,
    ]);
  }

  function resetSession() {
    setSkills(initialSkills);
    setCurrentId(problems[1].id);
    setAnswer("");
    setHintCount(0);
    setFeedback(null);
    setLastCalculation(null);
    setEvents([{ label: "Session reset", detail: "Mastery estimates returned to the seed learner profile." }]);
  }

  return (
    <main className="min-h-screen bg-[#f1f3f7] text-[#20242a]">
      <header className="sls-topbar">
        <div className="sls-logo">SLS</div>
        <span className="class-chip">[ALS] Adaptive Algebra</span>
        <p>2.2.1 Linear equations and algebra readiness</p>
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
        <span>Prototype mode. Learner progress is local to this session.</span>
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
              <strong>2.2.1 Adaptive algebra pathway</strong>
            </div>
            <div className="lesson-step active-step">
              <span>1</span>
              <div>
                <strong>Activate Learning</strong>
                <em>ADAPTIVE TUTOR</em>
              </div>
            </div>
            <div className="lesson-step">
              <span>2</span>
              <div>
                <strong>Promote Thinking</strong>
                <em className="purple">MASTERY REVIEW</em>
              </div>
            </div>
            <div className="lesson-step">
              <span>3</span>
              <div>
                <strong>Facilitate Practice</strong>
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
                By the end of this activity, the learner can solve linear equations, explain each inverse operation,
                and use feedback from hints to repair weaker algebra skills.
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
                  <p>Q1 · {current.difficulty} practice</p>
                  <h2>{current.title}</h2>
                </div>
                <span>{activeSkill.label}</span>
              </div>

              <div className="prompt-band">
                <p>{current.prompt}</p>
              </div>

              <form className="answer-row" onSubmit={submitAnswer}>
                <label htmlFor="answer">Student answer</label>
                <div>
                  <input
                    id="answer"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Type the simplified answer"
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
                      ? "Nice. The mastery model increased confidence for this skill."
                      : "Useful signal. The tutor will bias toward repair practice."}
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
                  <h2>Mastery</h2>
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
                  <strong>{skills[recommended.skill].label}</strong> is the lowest-confidence skill.
                </p>
                <button type="button" onClick={goNext}>
                  <ChevronRight size={18} />
                  <span>Queue recommendation</span>
                </button>
              </section>
            </aside>
          </div>

          <section className="builder-grid">
            <div className="schema-panel">
              <div className="panel-title">
                <FileJson size={18} />
                <h2>Reusable content object</h2>
              </div>
              <pre>{JSON.stringify({ skill: current.skill, answer: current.answer, hints: current.hints }, null, 2)}</pre>
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
                : "No answer has been submitted for this problem yet, so this previews the correct-answer path."}
            </p>
            <div className="bkt-flow">
              <div className="flow-source">
                <p>Before answer</p>
                <strong>{pct(displayedCalculation.masteryBefore)}</strong>
                <span>chance learner knows this skill</span>
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
