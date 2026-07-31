"use client";

import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  ChevronRight,
  CircleHelp,
  FileJson,
  Flame,
  Lightbulb,
  ListChecks,
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

function updateMastery(skill: Skill, correct: boolean) {
  const { mastery, guess, slip, learn } = skill;
  const posterior = correct
    ? (mastery * (1 - slip)) / (mastery * (1 - slip) + (1 - mastery) * guess)
    : (mastery * slip) / (mastery * slip + (1 - mastery) * (1 - guess));

  return Math.min(0.98, Math.max(0.02, posterior + (1 - posterior) * learn));
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function Home() {
  const [skills, setSkills] = useState(initialSkills);
  const [currentId, setCurrentId] = useState(problems[1].id);
  const [answer, setAnswer] = useState("");
  const [hintCount, setHintCount] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [events, setEvents] = useState<EventLog[]>([
    {
      label: "Lesson initialized",
      detail: "Adaptive queue seeded with algebra readiness data.",
    },
  ]);

  const current = problems.find((problem) => problem.id === currentId) ?? problems[0];
  const activeSkill = skills[current.skill];
  const weakestSkill = Object.values(skills).sort((a, b) => a.mastery - b.mastery)[0];

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
    const updatedMastery = updateMastery(activeSkill, correct);
    const nextSkills = {
      ...skills,
      [activeSkill.id]: {
        ...activeSkill,
        mastery: updatedMastery,
      },
    };

    setSkills(nextSkills);
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
    setEvents([{ label: "Session reset", detail: "Mastery estimates returned to the seed learner profile." }]);
  }

  return (
    <main className="min-h-screen bg-[#f6f5ef] text-[#1d2626]">
      <section className="workspace-shell">
        <aside className="side-rail" aria-label="Product navigation">
          <div className="brand-mark">
            <Brain size={22} aria-hidden="true" />
          </div>
          <button className="rail-button active" aria-label="Tutor">
            <Target size={20} />
          </button>
          <button className="rail-button" aria-label="Mastery analytics">
            <BarChart3 size={20} />
          </button>
          <button className="rail-button" aria-label="Content schema">
            <FileJson size={20} />
          </button>
          <button className="rail-button" aria-label="Tuning">
            <SlidersHorizontal size={20} />
          </button>
        </aside>

        <section className="product-frame">
          <header className="top-bar">
            <div>
              <p className="eyebrow">Adaptive Algebra Studio</p>
              <h1>Learn by solving. Adapt every step.</h1>
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
                  <p>{current.difficulty} practice</p>
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
        </section>
      </section>
    </main>
  );
}
