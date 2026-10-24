const FUDI_STATE_KEY = "fudi-dc-progress-v1";

const topicNames = {
  foundations: "Foundations",
  limits: "Limits",
  derivatives: "Derivatives",
  integrals: "Integrals",
  multivariable: "Multivariable calculus",
  "linear-algebra": "Linear algebra",
};
const difficultyNames = { easy: "Easy", medium: "Medium", challenge: "Challenge" };
const topicList = Object.keys(topicNames);
function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyState() {
  return {
    version: 1,
    attempts: 0,
    correct: 0,
    practiceDays: [],
    completedLessons: [],
    history: [],
    selectedTopic: "derivatives",
    selectedDifficulty: "easy",
  };
}

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(FUDI_STATE_KEY) || "null");
    if (!saved || saved.version !== 1) return emptyState();
    const restored = { ...emptyState(), ...saved };
    for (const field of ["practiceDays", "completedLessons", "history"]) {
      if (!Array.isArray(restored[field])) restored[field] = [];
    }
    return restored;
  } catch {
    return emptyState();
  }
}

let state = readState();
let activeView = "overview";
let selectedLearnTopic = "all";
let currentQuestion = null;
let questionHasCorrectAnswer = false;
let toastTimer;

function saveState() {
  try { localStorage.setItem(FUDI_STATE_KEY, JSON.stringify(state)); } catch { /* Browser storage may be disabled. */ }
  updateStats();
}

function showToast(message) {
  const node = document.getElementById("toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("is-visible"), 2600);
}

function startOfWeek(date = new Date()) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  return result;
}

function addDays(date, count) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + count);
  return result;
}

function calculateStreak(days) {
  const uniqueDays = new Set(days);
  const today = new Date();
  const todayKey = localDateKey(today);
  const yesterdayKey = localDateKey(addDays(today, -1));
  let cursor = uniqueDays.has(todayKey) ? today : (uniqueDays.has(yesterdayKey) ? addDays(today, -1) : null);
  if (!cursor) return 0;
  let count = 0;
  while (uniqueDays.has(localDateKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function weekLog() {
  const monday = startOfWeek();
  const mondayKey = localDateKey(monday);
  const keys = Array.from({ length: 7 }, (_, index) => localDateKey(addDays(monday, index)));
  const log = state.history.filter(item => item.date >= mondayKey && item.date <= keys[6]);
  return { monday, keys, log };
}

function updateStats() {
  const { monday, keys, log } = weekLog();
  const weeklyCorrect = log.filter(item => item.correct).length;
  const accuracy = state.attempts ? Math.round(state.correct / state.attempts * 100) : null;
  const streak = calculateStreak(state.practiceDays);
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
  setText("overview-streak", streak);
  setText("streak-count", streak);
  setText("solved-count", weeklyCorrect);
  setText("weekly-correct", `${state.correct} total`);
  setText("practice-total-correct", `${state.correct} CORRECT SO FAR`);
  setText("lessons-count", state.completedLessons.length);
  const topics = new Set(state.history.map(item => item.topic));
  setText("topics-count", `${topics.size} topic${topics.size === 1 ? "" : "s"}`);
  setText("accuracy-value", accuracy === null ? "—" : `${accuracy}%`);
  const accuracyTrack = document.getElementById("accuracy-track");
  if (accuracyTrack) accuracyTrack.style.width = `${accuracy || 0}%`;
  setText("week-total", weeklyCorrect);
  setText("week-subtitle", weeklyCorrect ? "Correct answers, day by day." : "Your practice will appear here.");
  setText("week-label", `${monday.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(monday, 6).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);

  const chart = document.getElementById("week-chart");
  if (chart) {
    const counts = keys.map(key => log.filter(item => item.date === key && item.correct).length);
    const peak = Math.max(3, ...counts);
    chart.innerHTML = counts.map((count, index) => {
      const day = addDays(monday, index);
      const height = count ? Math.max(9, count / peak * 72) : 3;
      const todayClass = index === ((new Date().getDay() + 6) % 7) ? "bar-today" : "";
      return `<div class="${todayClass}" title="${count} correct answer${count === 1 ? "" : "s"}"><i style="height:${height}%"></i><small>${day.toLocaleDateString(undefined, { weekday: "narrow" })}</small></div>`;
    }).join("");
  }

  const streakWeek = document.getElementById("streak-week");
  if (streakWeek) {
    streakWeek.innerHTML = keys.map((key, index) => {
      const day = addDays(monday, index);
      const classes = [state.practiceDays.includes(key) ? "done" : "", key === localDateKey() ? "today" : ""].filter(Boolean).join(" ");
      return `<i class="${classes}" title="${day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}">${day.toLocaleDateString(undefined, { weekday: "narrow" })}</i>`;
    }).join("");
  }

  const miniWeek = document.getElementById("mini-week-bars");
  if (miniWeek) {
    const counts = keys.map(key => log.filter(item => item.date === key && item.correct).length);
    const peak = Math.max(1, ...counts);
    miniWeek.innerHTML = counts.map(count => `<i style="height:${count ? Math.max(4, count / peak * 13) : 3}px"></i>`).join("");
  }

  const lessonCount = Math.min(100, Math.round(state.completedLessons.length / 8 * 100));
  const progress = document.getElementById("current-lesson-progress");
  const progressTrack = document.getElementById("current-lesson-track");
  if (progress) progress.textContent = `${lessonCount}%`;
  if (progressTrack) progressTrack.style.width = `${lessonCount}%`;
  const courseProgress = [
    ["course-progress-calc", "course-label-calc", Math.min(100, Math.round(state.completedLessons.length / 5 * 100))],
    ["course-progress-algebra", "course-label-algebra", topicProgress("linear-algebra")],
    ["course-progress-multivar", "course-label-multivar", topicProgress("multivariable")],
  ];
  for (const [barId, labelId, value] of courseProgress) {
    const bar = document.getElementById(barId);
    const label = document.getElementById(labelId);
    if (bar) bar.style.width = `${value}%`;
    if (label) label.textContent = value ? `${value}% practiced` : "Start here";
  }
}

function topicProgress(topic) {
  const logs = state.history.filter(item => item.topic === topic);
  return logs.length ? Math.min(100, Math.round(logs.filter(item => item.correct).length / 5 * 100)) : 0;
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function numberText(value) { return String(Number.isInteger(value) ? value : Number(value.toFixed(2))); }

function buildQuestion(topic, difficulty) {
  const level = difficulty;
  let q;
  if (topic === "foundations") {
    if (level === "easy") {
      const a = rand(2, 8), x = rand(2, 9), b = rand(1, 12), c = a * x + b;
      q = { prompt: `Solve for x: ${a}x + ${b} = ${c}.`, answer: x, hint: `Subtract ${b} from both sides, then divide by ${a}.`, solution: `${c} − ${b} = ${a}x, so ${a}x = ${a * x}. Divide by ${a}: x = ${x}.` };
    } else if (level === "medium") {
      const a = rand(2, 6), inside = rand(2, 7), x = rand(1, 8), c = a * (x + inside);
      q = { prompt: `Solve for x: ${a}(x + ${inside}) = ${c}.`, answer: x, hint: `First divide both sides by ${a}, then isolate x.`, solution: `${c} ÷ ${a} = x + ${inside}. Subtract ${inside}: x = ${x}.` };
    } else {
      const right = rand(1, 5), left = right + rand(2, 5), x = rand(1, 8), b = rand(2, 9), d = (left - right) * x + b;
      q = { prompt: `Solve for x: ${left}x + ${b} = ${right}x + ${d}.`, answer: x, hint: `Move the x terms to one side and the constants to the other.`, solution: `${left - right}x = ${d - b}. Divide both sides by ${left - right}: x = ${x}.` };
    }
  } else if (topic === "limits") {
    if (level === "challenge") {
      const a = rand(2, 8), p = rand(-4, 6), c = -(a * a + p * a), ans = 2 * a + p;
      q = { prompt: `Evaluate the limit as x → ${a}: (x² ${p < 0 ? "−" : "+"} ${Math.abs(p)}x ${c < 0 ? "−" : "+"} ${Math.abs(c)}) / (x − ${a}).`, answer: ans, hint: `The numerator equals zero at x = ${a}, so factor it by (x − ${a}).`, solution: `After factoring and cancelling (x − ${a}), the remaining expression approaches 2x + ${p}. At x = ${a}, the limit is ${ans}.` };
    } else {
      const a = level === "easy" ? rand(1, 5) : rand(4, 12);
      q = { prompt: `Evaluate the limit as x → ${a}: (x² − ${a * a}) / (x − ${a}).`, answer: 2 * a, hint: `Factor the difference of squares: x² − ${a * a} = (x − ${a})(x + ${a}).`, solution: `Cancel (x − ${a}) to get x + ${a}. As x approaches ${a}, the limit is ${2 * a}.` };
    }
  } else if (topic === "derivatives") {
    if (level === "easy") {
      const a = rand(1, 5), b = rand(1, 8), x = rand(1, 5), ans = 2 * a * x + b;
      q = { prompt: `Find f′(${x}) if f(x) = ${a}x² + ${b}x.`, answer: ans, hint: `Differentiate term by term: the derivative is ${2 * a}x + ${b}.`, solution: `f′(x) = ${2 * a}x + ${b}. Substitute x = ${x}: f′(${x}) = ${ans}.` };
    } else if (level === "medium") {
      const a = rand(1, 3), b = rand(1, 5), c = rand(-4, 6), x = rand(1, 4), ans = 3 * a * x * x + 2 * b * x + c;
      q = { prompt: `Find f′(${x}) if f(x) = ${a}x³ + ${b}x² ${c < 0 ? "−" : "+"} ${Math.abs(c)}x.`, answer: ans, hint: `Use the power rule on each term. The derivative is ${3 * a}x² + ${2 * b}x ${c < 0 ? "−" : "+"} ${Math.abs(c)}.`, solution: `Substitute x = ${x} into ${3 * a}x² + ${2 * b}x ${c < 0 ? "−" : "+"} ${Math.abs(c)}. The result is ${ans}.` };
    } else {
      const a = rand(2, 5), b = rand(1, 6), x = rand(1, 4), inner = a * x + b, ans = 2 * a * inner;
      q = { prompt: `Find f′(${x}) if f(x) = (${a}x + ${b})².`, answer: ans, hint: `Use the chain rule: 2(${a}x + ${b}) · ${a}.`, solution: `f′(x) = 2(${a}x + ${b}) · ${a}. At x = ${x}, this is 2(${inner}) · ${a} = ${ans}.` };
    }
  } else if (topic === "integrals") {
    if (level === "easy") {
      const a = rand(2, 9), b = rand(2, 6), ans = a * b;
      q = { prompt: `Evaluate ∫₀^${b} ${a} dx.`, answer: ans, hint: `The area is a constant height (${a}) times a width of ${b}.`, solution: `∫ ${a} dx = ${a}x. Evaluate from 0 to ${b}: ${a} · ${b} = ${ans}.` };
    } else if (level === "medium") {
      const a = 2 * rand(1, 4), b = rand(1, 8), upper = rand(1, 4), ans = a * upper * upper / 2 + b * upper;
      q = { prompt: `Evaluate ∫₀^${upper} (${a}x + ${b}) dx.`, answer: ans, hint: `An antiderivative is ${a / 2}x² + ${b}x.`, solution: `Evaluate ${a / 2}x² + ${b}x at ${upper} and subtract its value at 0. The result is ${ans}.` };
    } else {
      const lower = rand(0, 2), upper = lower + rand(2, 4), ans = upper ** 3 - lower ** 3;
      q = { prompt: `Evaluate ∫${lower}^${upper} 3x² dx.`, answer: ans, hint: `An antiderivative of 3x² is x³.`, solution: `Evaluate x³ at the bounds: ${upper}³ − ${lower}³ = ${ans}.` };
    }
  } else if (topic === "multivariable") {
    if (level === "easy") {
      const a = rand(1, 4), b = rand(2, 7), x = rand(1, 4), ansX = 2 * a * x;
      q = { prompt: `Find ∇f at (${x}, 1) if f(x, y) = ${a}x² + ${b}y. Enter (∂f/∂x, ∂f/∂y).`, answer: [ansX, b], hint: `Differentiate with respect to x and y separately.`, solution: `∂f/∂x = ${2 * a}x and ∂f/∂y = ${b}. At (${x}, 1), the gradient is (${ansX}, ${b}).` };
    } else if (level === "medium") {
      const a = rand(1, 3), b = rand(1, 4), c = rand(1, 3), x = rand(1, 3), y = rand(1, 3), gx = 2 * a * x + b * y, gy = b * x + 2 * c * y;
      q = { prompt: `Find ∇f(${x}, ${y}) if f(x, y) = ${a}x² + ${b}xy + ${c}y². Enter (∂f/∂x, ∂f/∂y).`, answer: [gx, gy], hint: `∂f/∂x = 2${a}x + ${b}y; ∂f/∂y = ${b}x + 2${c}y.`, solution: `Substitute (${x}, ${y}) into both partial derivatives. The gradient is (${gx}, ${gy}).` };
    } else {
      const gx = rand(2, 8), gy = rand(2, 8), vx = rand(1, 4), vy = rand(1, 4), ans = gx * vx + gy * vy;
      q = { prompt: `At a point, ∇f = (${gx}, ${gy}). Find ∇f · v for v = (${vx}, ${vy}).`, answer: ans, hint: `Take the dot product: multiply matching components and add.`, solution: `(${gx}, ${gy}) · (${vx}, ${vy}) = ${gx}·${vx} + ${gy}·${vy} = ${ans}.` };
    }
  } else {
    if (level === "easy") {
      const a = rand(1, 5), b = rand(-4, 5), c = rand(1, 5), d = rand(-4, 5), ans = a * c + b * d;
      q = { prompt: `Find the dot product of (${a}, ${b}) and (${c}, ${d}).`, answer: ans, hint: `Multiply matching entries, then add the products.`, solution: `${a}·${c} + ${b}·${d} = ${a * c} + ${b * d} = ${ans}.` };
    } else if (level === "medium") {
      const u = [rand(1, 5), rand(-4, 4), rand(1, 5)], v = [rand(-3, 5), rand(1, 5), rand(-3, 4)];
      const ans = u.reduce((sum, value, index) => sum + value * v[index], 0);
      q = { prompt: `Find the dot product of (${u.join(", ")}) and (${v.join(", ")}).`, answer: ans, hint: `Multiply all three matching components and add the results.`, solution: `${u.map((value, index) => `${value}·${v[index]}`).join(" + ")} = ${ans}.` };
    } else {
      const matrix = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => rand(1, 5)));
      const vector = Array.from({ length: 3 }, () => rand(1, 4));
      const ans = matrix.map(row => row.reduce((sum, value, index) => sum + value * vector[index], 0));
      q = { prompt: `Multiply the matrix by vector v: [[${matrix.map(row => row.join(", ")).join("], [")}]] · (${vector.join(", ")}). Enter the result as three numbers.`, answer: ans, hint: `Take the dot product of each matrix row with the vector.`, solution: `Row products give (${ans.join(", ")}).` };
    }
  }
  return { ...q, topic, difficulty, id: `${topic}-${Date.now()}-${Math.random().toString(16).slice(2)}` };
}

function formatPrompt(question) { return escapeHtml(question.prompt).replace(/∫/g, "∫").replace(/∇/g, "∇"); }

function normalizeText(value) {
  return String(value).toLowerCase().replace(/[−–]/g, "-").replace(/[()[\]{}]/g, "").replace(/\s+/g, "");
}

function parseNumber(value) {
  const normalized = String(value).replace(/[−–]/g, "-").replace(/,/g, ".").trim();
  if (!normalized || !/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function isCorrectAnswer(input, expected) {
  if (Array.isArray(expected)) {
    const parts = String(input).replace(/[()[\]{}]/g, "").split(/[;,]/).map(part => parseNumber(part.trim()));
    return parts.length === expected.length && parts.every((part, index) => part !== null && Math.abs(part - expected[index]) < 1e-7);
  }
  const parsed = parseNumber(input);
  return parsed !== null && Math.abs(parsed - expected) < 1e-7;
}

function recordAnswer(isCorrect) {
  if (!currentQuestion) return;
  state.attempts += 1;
  const today = localDateKey();
  state.history.push({ date: today, topic: currentQuestion.topic, difficulty: currentQuestion.difficulty, correct: isCorrect });
  state.history = state.history.slice(-500);
  if (isCorrect && !questionHasCorrectAnswer) {
    state.correct += 1;
    questionHasCorrectAnswer = true;
    if (!state.practiceDays.includes(today)) state.practiceDays.push(today);
  }
  saveState();
}

function setQuestion(question, targets = {}) {
  currentQuestion = question;
  questionHasCorrectAnswer = false;
  const prompt = document.getElementById(targets.prompt || "dashboard-question");
  const topicLabel = document.getElementById(targets.topic || "dashboard-topic");
  const input = document.getElementById(targets.input || "answer-input");
  const feedback = document.getElementById(targets.feedback || "answer-feedback");
  const solution = document.getElementById(targets.solution || "");
  const hintText = document.getElementById(targets.hint || "");
  const count = document.getElementById(targets.count || "question-order");
  if (prompt) prompt.innerHTML = formatPrompt(question);
  if (topicLabel) topicLabel.textContent = `${topicNames[question.topic]} · ${difficultyNames[question.difficulty]}`.toUpperCase();
  if (input) { input.value = ""; input.classList.remove("is-correct", "is-incorrect"); }
  if (feedback) { feedback.textContent = ""; feedback.classList.remove("is-wrong"); }
  if (solution) { solution.hidden = true; solution.innerHTML = `<b>Worked answer</b>${escapeHtml(question.solution)}`; }
  if (hintText) { hintText.textContent = question.hint; hintText.hidden = true; }
  if (count) count.textContent = "Ready when you are";
}

function checkAnswer(inputId, feedbackId, solutionId) {
  const input = document.getElementById(inputId);
  const feedback = document.getElementById(feedbackId);
  if (!input || !feedback || !currentQuestion) return;
  const value = input.value.trim();
  feedback.classList.remove("is-wrong");
  input.classList.remove("is-correct", "is-incorrect");
  if (!value) {
    feedback.textContent = "Try an answer first. You can use a comma to separate vector components.";
    feedback.classList.add("is-wrong");
    input.focus();
    return;
  }
  if (questionHasCorrectAnswer) {
    feedback.textContent = "You already solved this one. Generate a new problem when you are ready.";
    return;
  }
  const correct = isCorrectAnswer(value, currentQuestion.answer);
  recordAnswer(correct);
  if (correct) {
    input.classList.add("is-correct");
    feedback.textContent = `Correct. ${currentQuestion.solution}`;
    const count = document.getElementById("question-order");
    if (count) count.textContent = "Answer checked";
    const solution = document.getElementById(solutionId);
    if (solution) solution.hidden = false;
  } else {
    input.classList.add("is-incorrect");
    feedback.textContent = "Not quite. Check the hint, then give it another try.";
    feedback.classList.add("is-wrong");
    const hint = document.getElementById("practice-hint") || document.getElementById("hint-text");
    if (hint) hint.hidden = false;
  }
}

function setView(view, options = {}) {
  const known = ["overview", "learn", "practice", "notebook", "progress"];
  if (!known.includes(view)) view = "overview";
  activeView = view;
  document.querySelectorAll(".page-view").forEach(node => node.classList.remove("is-visible"));
  const selected = document.getElementById(`view-${view}`);
  if (selected) selected.classList.add("is-visible");
  document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("is-active", button.dataset.view === view));
  const title = { overview: "Overview", learn: "Learn", practice: "Daily practice", notebook: "Notebook", progress: "Progress" }[view];
  document.getElementById("crumb-current").textContent = options.title || title;
  document.getElementById("sidebar").classList.remove("is-open");
  if (options.updateHash !== false) history.replaceState(null, "", `#${view}`);
  if (view === "learn") renderLearn(options.topic || selectedLearnTopic);
  if (view === "practice") renderPractice();
  if (view === "notebook") renderNotebook();
  if (view === "progress") renderProgress();
  updateStats();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const lessons = [
  { id: "functions", topic: "foundations", title: "Functions as input and output", time: "8 min", text: "A function is a rule that turns each allowed input into one output. Think of it like a small machine: put in x, follow the rule, and get f(x).", formula: "f(x) = 2x + 3", audio: "A function is a rule that pairs each input with one output. For f of x equals two x plus three, if we put in four, the function returns eleven." },
  { id: "limits", topic: "limits", title: "A feel for limits", time: "9 min", text: "A limit asks what value a function approaches as x gets close to a point. The function does not always need to be defined at that exact point for the limit to exist.", formula: "limₓ→ₐ f(x) = L", audio: "A limit asks what value a function gets close to near a point. We study the approach, not just the exact point." },
  { id: "power-rule", topic: "derivatives", title: "The power rule", time: "10 min", text: "The power rule makes polynomial derivatives quick. Bring the exponent down as a multiplier, then reduce the exponent by one.", formula: "d/dx (xⁿ) = n · xⁿ⁻¹", audio: "For x to the n, the power rule brings n down and lowers the exponent by one. For x cubed, the derivative is three x squared." },
  { id: "chain-rule", topic: "derivatives", title: "The chain rule", time: "12 min", text: "When one function sits inside another, multiply the outside rate by the inside rate. Follow each layer of change from the outside back in.", formula: "d/dx f(g(x)) = f′(g(x)) · g′(x)", audio: "The chain rule helps when one function sits inside another. Find the outside derivative, keep the inside, then multiply by the derivative of the inside." },
  { id: "definite-integral", topic: "integrals", title: "Your first definite integral", time: "11 min", text: "A definite integral adds up signed area across an interval. Find an antiderivative, evaluate it at the top bound, and subtract its value at the bottom bound.", formula: "∫ₐᵇ f(x) dx = F(b) − F(a)", audio: "A definite integral measures accumulated change across an interval. Use an antiderivative and subtract the value at the lower bound from the value at the upper bound." },
  { id: "gradient", topic: "multivariable", title: "Partial derivatives and the gradient", time: "13 min", text: "A partial derivative measures change in one direction while the other inputs stay fixed. The gradient collects these partial derivatives into a vector that points toward fastest increase.", formula: "∇f = (∂f/∂x, ∂f/∂y)", audio: "A partial derivative measures change along one axis while holding the other coordinates fixed. The gradient collects all those rates into one vector." },
  { id: "dot-product", topic: "linear-algebra", title: "The dot product", time: "9 min", text: "The dot product multiplies matching vector components and adds them. It gives a single number that captures how two vectors align.", formula: "u · v = u₁v₁ + u₂v₂ + …", audio: "The dot product multiplies each matching pair of vector entries and adds the products. It is one way to measure how strongly two directions align." },
  { id: "matrix-vector", topic: "linear-algebra", title: "A matrix transforms a vector", time: "12 min", text: "A matrix can transform a vector by combining its components. Each row produces one output component through a dot product.", formula: "A · v = transformed vector", audio: "A matrix transforms a vector. Each row of the matrix takes a dot product with the input vector, and those results form the output." },
];

function renderLearn(filter = "all") {
  selectedLearnTopic = filter;
  const view = document.getElementById("view-learn");
  const visible = lessons.filter(lesson => filter === "all" || lesson.topic === filter);
  view.innerHTML = `
    <div class="subpage-header"><div><div class="eyebrow"><span class="eyebrow-dot"></span>YOUR LEARNING PATH</div><h1>Learn, one idea at a time<span class="period">.</span></h1><p>Clear explanations and helpful examples, from foundations through advanced math.</p></div><button class="button button-primary" data-action="open-practice">Practice a question <span class="button-arrow">→</span></button></div>
    <div class="topic-filter" aria-label="Filter lessons">${[["all", "Everything"], ...Object.entries(topicNames)].map(([id, name]) => `<button class="filter-chip ${filter === id ? "is-active" : ""}" data-learn-topic="${id}">${escapeHtml(name)}</button>`).join("")}</div>
    <div class="subpage-layout"><div class="panel"><div class="eyebrow">${filter === "all" ? "YOUR COURSE MAP" : escapeHtml(topicNames[filter]).toUpperCase()}</div><h2>${filter === "all" ? "Build the foundations, then go further" : escapeHtml(topicNames[filter])}</h2><p class="panel-lead">Lessons are written to make each idea clear before you move to the next.</p><div class="lesson-list">${visible.map((lesson, index) => {
      const done = state.completedLessons.includes(lesson.id);
      return `<div class="lesson-row ${done ? "done" : ""}"><span class="lesson-number">${done ? "✓" : String(index + 1).padStart(2, "0")}</span><div><b>${escapeHtml(lesson.title)}</b><small>${escapeHtml(topicNames[lesson.topic])} · ${lesson.time}</small></div><button class="text-link" data-lesson="${lesson.id}">${done ? "Review →" : "Start →"}</button></div>`;
    }).join("") || `<div class="empty-state">No lessons found for this topic yet.</div>`}</div></div>
    <div><div class="panel"><div class="eyebrow">YOUR TOOLKIT</div><h2>Learn by listening or drawing</h2><p class="panel-lead">Every lesson includes a spoken explanation. Open your notebook at any point and work it through by hand.</p><button class="button button-dark" data-view="notebook">Open notebook <span>↗</span></button></div><div class="outline-card"><div class="eyebrow">UP NEXT</div><b>Practice makes the ideas stick</b><p>Try a generated question in your current topic and see a hint or worked answer when you need one.</p><button class="text-link" data-action="open-practice">Go to practice →</button></div></div></div>`;
}

function openLesson(id) {
  const lesson = lessons.find(item => item.id === id);
  if (!lesson) return;
  const view = document.getElementById("view-learn");
  const completed = state.completedLessons.includes(id);
  view.innerHTML = `
    <div class="subpage-header"><div><div class="eyebrow"><span class="eyebrow-dot"></span>${escapeHtml(topicNames[lesson.topic]).toUpperCase()} · ${lesson.time.toUpperCase()}</div><h1>${escapeHtml(lesson.title)}<span class="period">.</span></h1><p>Take your time. Work through the idea in your own way.</p></div><button class="text-link" data-action="back-to-learn">← All lessons</button></div>
    <div class="lesson-hero"><div><span class="pill pill-lilac">A SHORT LESSON</span><h2>Start with the idea.<br />Then make it yours.</h2><p>${escapeHtml(lesson.text)}</p><button class="button button-dark" data-action="speak-lesson" data-lesson-id="${lesson.id}"><span>▶</span> Listen to this idea</button></div><div class="lesson-art-mini" aria-hidden="true"><svg viewBox="0 0 260 150"><path class="mini-axis" d="M15 125H248M28 12V135"/><path d="M28 110C68 108 89 96 113 91S156 65 178 61 218 35 240 29"/><circle cx="113" cy="91" r="6"/><circle cx="178" cy="61" r="6"/></svg></div></div>
    <div class="subpage-layout"><div class="panel"><div class="eyebrow">THE IDEA</div><h2>${escapeHtml(lesson.title)}</h2><p class="panel-lead">${escapeHtml(lesson.text)}</p><div class="equation">${escapeHtml(lesson.formula)}</div><div class="concept-block"><h3>Make a quick note</h3><p>Try drawing a worked example in your notebook, or write down one question you want to return to.</p><button class="button button-primary" data-view="notebook">Open drawable notebook <span class="button-arrow">↗</span></button></div><div class="concept-block"><button class="button ${completed ? "button-dark" : "button-primary"}" data-action="complete-lesson" data-lesson-id="${lesson.id}">${completed ? "Lesson completed ✓" : "Mark lesson complete ✓"}</button></div></div>
    <div><div class="panel voice-panel"><div class="eyebrow">HEAR IT ANOTHER WAY</div><h2>A spoken explanation</h2><p class="panel-lead">Listen while you follow along. The explanation is also written above.</p><button class="button button-dark" data-action="speak-lesson" data-lesson-id="${lesson.id}">▶ Play explanation</button></div><div class="outline-card"><div class="eyebrow">KEEP PRACTICING</div><b>Try it with a new example</b><p>Generate a problem in this topic and check your answer.</p><button class="text-link" data-action="practice-topic" data-topic="${lesson.topic}">Practice ${escapeHtml(topicNames[lesson.topic])} →</button></div></div></div>`;
  activeView = "learn";
  document.getElementById("crumb-current").textContent = lesson.title;
  document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("is-active", button.dataset.view === "learn"));
}

function renderPractice() {
  const view = document.getElementById("view-practice");
  view.innerHTML = `
    <div class="subpage-header"><div><div class="eyebrow"><span class="eyebrow-dot"></span>YOUR DAILY PRACTICE</div><h1>Practice makes progress<span class="period">.</span></h1><p>Choose a topic and level, then work it through at your own pace.</p></div><span class="pill pill-lilac" id="practice-total-correct">${state.correct} CORRECT SO FAR</span></div>
    <div class="subpage-layout"><div class="panel answer-card"><div class="question-toolbar"><span class="question-count" id="practice-topic-full"></span><div class="question-actions"><button class="text-link" id="practice-hint-button">Need a hint?</button><button class="text-link" id="practice-solution-button">Show solution</button></div></div>
      <div class="practice-controls"><label class="field-control">TOPIC<select id="practice-topic-select">${Object.entries(topicNames).map(([id, name]) => `<option value="${id}" ${state.selectedTopic === id ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select></label><label class="field-control">DIFFICULTY<select id="practice-difficulty-select">${Object.entries(difficultyNames).map(([id, name]) => `<option value="${id}" ${state.selectedDifficulty === id ? "selected" : ""}>${name}</option>`).join("")}</select></label><button class="button button-primary" id="generate-question">New problem <span>↻</span></button></div>
      <div class="question-prompt" id="practice-prompt"></div><div class="question-detail" id="practice-detail"></div><form class="answer-large" id="practice-form"><input id="practice-answer-input" type="text" inputmode="decimal" placeholder="Enter a number or vector (e.g. 4, 3)" aria-label="Your answer" autocomplete="off" /><button class="button button-primary" type="submit">Check answer <span>→</span></button></form><div class="feedback-large" id="practice-feedback" aria-live="polite"></div><p class="hint-text" id="practice-hint" hidden></p><div class="solution-block" id="practice-solution" hidden></div><div class="practice-footer"><span id="practice-footer-count">A fresh problem for you</span><button class="text-link" data-view="notebook">Open notebook to work it out →</button></div></div>
      <div><div class="score-card"><div class="eyebrow">YOUR STREAK</div><b id="practice-streak">${calculateStreak(state.practiceDays)} days</b><span>Practice regularly to build a rhythm.</span></div><div class="outline-card"><div class="eyebrow">TOPICS TO EXPLORE</div><b>Connected ideas</b><p>Move between limits, derivatives, integrals, multivariable calculus, and linear algebra.</p></div><div class="outline-card"><div class="eyebrow">YOUR WORK</div><b>Show your steps</b><p>Use the drawable notebook for rough work. V1 checks the typed final answer.</p><button class="text-link" data-view="notebook">Open notebook →</button></div></div></div>`;
  document.getElementById("practice-form").addEventListener("submit", event => {
    event.preventDefault();
    checkAnswer("practice-answer-input", "practice-feedback", "practice-solution");
  });
  const generate = () => {
    state.selectedTopic = document.getElementById("practice-topic-select").value;
    state.selectedDifficulty = document.getElementById("practice-difficulty-select").value;
    saveState();
    const q = buildQuestion(state.selectedTopic, state.selectedDifficulty);
    const names = `${topicNames[q.topic]} · ${difficultyNames[q.difficulty]}`.toUpperCase();
    document.getElementById("practice-topic-full").textContent = names;
    document.getElementById("practice-prompt").innerHTML = formatPrompt(q);
    document.getElementById("practice-detail").textContent = "Take a moment to work it out. You can use the notebook for your steps.";
    document.getElementById("practice-hint").textContent = q.hint;
    document.getElementById("practice-hint").hidden = true;
    document.getElementById("practice-solution").innerHTML = `<b>Worked answer</b>${escapeHtml(q.solution)}`;
    document.getElementById("practice-solution").hidden = true;
    document.getElementById("practice-answer-input").value = "";
    document.getElementById("practice-answer-input").classList.remove("is-correct", "is-incorrect");
    document.getElementById("practice-feedback").textContent = "";
    document.getElementById("practice-feedback").classList.remove("is-wrong");
    document.getElementById("practice-footer-count").textContent = "A fresh problem for you";
    currentQuestion = q;
    questionHasCorrectAnswer = false;
  };
  document.getElementById("generate-question").addEventListener("click", generate);
  document.getElementById("practice-hint-button").addEventListener("click", () => {
    const hint = document.getElementById("practice-hint");
    hint.hidden = !hint.hidden;
    if (currentQuestion) hint.textContent = currentQuestion.hint;
  });
  document.getElementById("practice-solution-button").addEventListener("click", () => {
    const solution = document.getElementById("practice-solution");
    if (currentQuestion) solution.innerHTML = `<b>Worked answer</b>${escapeHtml(currentQuestion.solution)}`;
    solution.hidden = !solution.hidden;
  });
  document.getElementById("practice-topic-select").addEventListener("change", () => { state.selectedTopic = document.getElementById("practice-topic-select").value; saveState(); generate(); });
  document.getElementById("practice-difficulty-select").addEventListener("change", () => { state.selectedDifficulty = document.getElementById("practice-difficulty-select").value; saveState(); generate(); });
  document.getElementById("practice-streak").textContent = `${calculateStreak(state.practiceDays)} day${calculateStreak(state.practiceDays) === 1 ? "" : "s"}`;
  generate();
}

function renderNotebook() {
  const view = document.getElementById("view-notebook");
  if (view.querySelector("#notebook-canvas")) return;
  view.innerHTML = `
    <div class="subpage-header notebook-heading"><div><div class="eyebrow"><span class="eyebrow-dot"></span>YOUR SPACE TO THINK</div><h1>My notebook<span class="period">.</span></h1><p>Draw your working. Pages save in this browser on this device.</p></div><div class="question-actions"><button class="button button-primary" id="export-notebook-pdf">Export PDF <span>↓</span></button></div></div>
    <div class="panel notebook-toolbar" role="toolbar" aria-label="Notebook drawing tools"><div class="notebook-tool-group"><button class="tool-button" data-tool="pen" aria-pressed="true"><span class="tool-glyph">✎</span> Pen</button><button class="tool-button" data-tool="highlighter" aria-pressed="false"><span class="tool-glyph">▰</span> Highlight</button><button class="tool-button" data-tool="eraser" aria-pressed="false"><span class="tool-glyph">⌫</span> Eraser</button><span class="tool-divider"></span><button class="tool-button" id="undo-stroke" aria-label="Undo stroke" title="Undo">↶ Undo</button><button class="tool-button" id="redo-stroke" aria-label="Redo stroke" title="Redo">↷ Redo</button></div><div class="notebook-tool-group"><button class="swatch" data-color="#34463b" aria-label="Dark green ink" aria-pressed="true"></button><button class="swatch" data-color="#5576a5" aria-label="Blue ink" aria-pressed="false"></button><button class="swatch" data-color="#b86d54" aria-label="Terracotta ink" aria-pressed="false"></button><button class="swatch" data-color="#795b9e" aria-label="Purple ink" aria-pressed="false"></button><input type="color" class="color-native" id="custom-color" value="#34463b" aria-label="Choose a custom ink color" /><span class="tool-divider"></span><label class="width-control">SIZE <input id="stroke-size" type="range" min="1" max="12" value="3" /><i class="width-sample" id="width-sample"></i></label></div></div>
    <div class="notebook-pagebar"><div class="page-tabs" id="notebook-pages" role="tablist" aria-label="Notebook pages"></div><button class="page-tab-add" id="add-notebook-page" aria-label="Add notebook page" title="Add page">+</button><div class="page-actions"><button class="page-action" id="rename-notebook-page">Rename page</button><button class="page-action" id="delete-notebook-page">Delete page</button><button class="page-action" id="export-notebook-png">Export PNG</button></div></div>
    <div class="drawing-surface"><canvas id="notebook-canvas" aria-label="Drawable math notebook page. Use a mouse, stylus, or finger to write." role="img"></canvas><div class="canvas-tip">Draw with your mouse, stylus, or finger</div></div>
    <div class="notebook-footer"><span><strong id="notebook-save-status">Opening your notebook…</strong> · Pages are stored locally in this browser.</span><span id="notebook-page-count">0 pages</span></div>
    <div class="panel" style="margin-top:16px"><div class="eyebrow">A LITTLE NOTE</div><p class="notebook-help">This first web version stores your drawings on this device only. There are no accounts or cloud sync. PDF export saves a copy for printing; the later Mac notebook will start separately.</p></div>`;
  if (window.FudiNotebook) window.FudiNotebook.mount(view);
}

function renderProgress() {
  const view = document.getElementById("view-progress");
  const total = state.attempts;
  const percent = total ? Math.round(state.correct / total * 100) : 0;
  const groups = Object.entries(topicNames).map(([id, name]) => {
    const attempts = state.history.filter(item => item.topic === id);
    const correct = attempts.filter(item => item.correct).length;
    const accuracy = attempts.length ? Math.round(correct / attempts.length * 100) : 0;
    return `<article class="progress-topic-card"><b>${escapeHtml(name)}</b><span>${correct} correct · ${attempts.length} attempt${attempts.length === 1 ? "" : "s"}${attempts.length ? ` · ${accuracy}% accuracy` : " · Not tried yet"}</span><div class="progress-track"><i style="width:${accuracy}%"></i></div></article>`;
  }).join("");
  view.innerHTML = `
    <div class="subpage-header"><div><div class="eyebrow"><span class="eyebrow-dot"></span>NOTICE THE PROGRESS</div><h1>Look how far you've come<span class="period">.</span></h1><p>Your practice history is saved only in this browser.</p></div><button class="button clear-progress" id="clear-progress">Clear progress</button></div>
    <div class="summary-grid"><div class="summary-tile"><b>${state.correct}</b><span>correct answers</span></div><div class="summary-tile"><b>${total}</b><span>answer checks</span></div><div class="summary-tile"><b>${total ? `${percent}%` : "—"}</b><span>overall accuracy</span></div></div>
    <div class="subpage-layout"><div class="panel"><div class="eyebrow">TOPIC PRACTICE</div><h2>A connected picture</h2><p class="panel-lead">Each topic gets easier to read as you practice. Empty bars just mean you have not tried that topic yet.</p><div class="progress-topic-grid">${groups}</div></div><div><div class="panel"><div class="eyebrow">YOUR ROUTINE</div><h2>${calculateStreak(state.practiceDays) ? "A rhythm is taking shape" : "Start with one question"}</h2><p class="panel-lead">${calculateStreak(state.practiceDays) ? `You have practiced ${calculateStreak(state.practiceDays)} day${calculateStreak(state.practiceDays) === 1 ? "" : "s"} in a row.` : "One thoughtful attempt is enough to start building momentum."}</p><button class="button button-primary" data-view="practice">Go to daily practice <span>→</span></button></div><div class="outline-card"><div class="eyebrow">LESSONS</div><b>${state.completedLessons.length} of ${lessons.length} lessons completed</b><p>Explore a topic, listen to the idea, then use the notebook to work it through.</p><button class="text-link" data-view="learn">Browse lessons →</button></div></div></div>`;
  document.getElementById("clear-progress").addEventListener("click", () => {
    if (!window.confirm("Clear your practice history and progress from this browser? Your notebook pages will stay saved.")) return;
    state = emptyState();
    saveState();
    renderProgress();
    showToast("Practice progress cleared. Notebook pages are unchanged.");
  });
}

function speak(text) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    showToast("Spoken playback is unavailable here. The written explanation is still on the page.");
    return;
  }
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    document.querySelectorAll(".voice-wave").forEach(wave => wave.classList.remove("is-playing"));
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = .94;
  utterance.onstart = () => document.querySelectorAll(".voice-wave").forEach(wave => wave.classList.add("is-playing"));
  utterance.onend = () => document.querySelectorAll(".voice-wave").forEach(wave => wave.classList.remove("is-playing"));
  utterance.onerror = () => document.querySelectorAll(".voice-wave").forEach(wave => wave.classList.remove("is-playing"));
  window.speechSynthesis.speak(utterance);
}

function openPractice(topic = state.selectedTopic) {
  state.selectedTopic = topic;
  saveState();
  setView("practice");
}

function renderDashboardQuestion() {
  const q = buildQuestion("derivatives", "easy");
  setQuestion(q);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function filterSearch(query) {
  const search = query.trim().toLowerCase();
  document.querySelectorAll("[data-topic-card]").forEach(card => {
    const topic = topicNames[card.dataset.topicCard] || "";
    card.hidden = Boolean(search) && !card.textContent.toLowerCase().includes(search) && !topic.toLowerCase().includes(search);
  });
  if (activeView === "learn" && !lessonMode()) {
    const filter = topicList.find(topic => topicNames[topic].toLowerCase().includes(search)) || selectedLearnTopic;
    renderLearn(filter);
    if (search && !topicNames[filter]?.toLowerCase().includes(search)) {
      document.querySelectorAll("#view-learn .lesson-row").forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(search); });
    }
  }
  if (search && activeView === "overview" && topicList.some(topic => topicNames[topic].toLowerCase().includes(search))) {
    const hit = topicList.find(topic => topicNames[topic].toLowerCase().includes(search));
    document.querySelectorAll("[data-topic-card]").forEach(card => { card.hidden = false; });
    setTimeout(() => document.querySelector(`[data-topic-card="${hit}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 10);
  }
}

function lessonMode() { return Boolean(document.querySelector("#view-learn .lesson-hero")); }

document.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    const topic = viewButton.dataset.topic;
    if (topic) selectedLearnTopic = topic;
    setView(viewButton.dataset.view, { topic });
    return;
  }

  const topicCard = event.target.closest("[data-topic-card]");
  if (topicCard) {
    openPractice(topicCard.dataset.topicCard);
    return;
  }

  const lessonButton = event.target.closest("[data-lesson]");
  if (lessonButton) { openLesson(lessonButton.dataset.lesson); return; }

  const topicFilter = event.target.closest("[data-learn-topic]");
  if (topicFilter) { renderLearn(topicFilter.dataset.learnTopic); return; }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === "resume") openLesson("chain-rule");
  if (action === "open-practice") openPractice();
  if (action === "back-to-learn") { setView("learn", { topic: selectedLearnTopic }); }
  if (action === "complete-lesson") {
    const id = actionButton.dataset.lessonId;
    if (!state.completedLessons.includes(id)) state.completedLessons.push(id);
    saveState();
    openLesson(id);
    showToast("Lesson complete. Nice work.");
  }
  if (action === "practice-topic") openPractice(actionButton.dataset.topic);
  if (action === "speak-lesson") {
    const item = lessons.find(lesson => lesson.id === actionButton.dataset.lessonId);
    if (item) speak(item.audio);
  }
});

document.getElementById("check-answer").addEventListener("click", () => checkAnswer("answer-input", "answer-feedback"));
document.getElementById("answer-input").addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); checkAnswer("answer-input", "answer-feedback"); }
});
document.getElementById("new-question").addEventListener("click", renderDashboardQuestion);
document.getElementById("voice-button").addEventListener("click", () => speak("A derivative tells us how quickly a function changes at one point. For example, the derivative of two x squared plus three x is four x plus three. The written practice gives you a chance to find a slope and check your work."));
document.querySelector(".help-button").addEventListener("click", () => showToast("Choose a topic, try a problem, or open your notebook to draw your working."));
document.getElementById("global-search").addEventListener("input", event => filterSearch(event.target.value));
document.getElementById("global-search").addEventListener("focus", () => document.querySelector(".search-box").classList.add("is-open"));
document.getElementById("global-search").addEventListener("blur", () => { if (!document.getElementById("global-search").value) document.querySelector(".search-box").classList.remove("is-open"); });
document.getElementById("mobile-menu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("is-open"));
document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.getElementById("global-search").focus();
  }
  if (event.key === "Escape") {
    document.getElementById("sidebar").classList.remove("is-open");
    document.getElementById("global-search").blur();
  }
});

renderDashboardQuestion();
updateStats();
const firstView = location.hash.slice(1);
if (["overview", "learn", "practice", "notebook", "progress"].includes(firstView) && firstView !== "overview") setView(firstView, { updateHash: false });
