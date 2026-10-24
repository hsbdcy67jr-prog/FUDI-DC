/* Joins deterministic practice with a question-linked drawable notebook. */
(function () {
  const apiBase = String(window.FUDI_API_BASE || "").replace(/\/+$/, "");
  let notebookPromise = null;
  let practiceNotebook = null;
  let activeRequestId = "";
  let notebookDisposal = Promise.resolve();

  function buildStableQuestion(topic, difficulty) {
    const question = buildQuestion(topic, difficulty);
    if (!question.id) question.id = topic + "-" + difficulty + "-" + state.problemSequence;
    return question;
  }

  function extractLivePrompt(html) {
    try {
      const parsed = new DOMParser().parseFromString(String(html || ""), "text/html");
      parsed.querySelectorAll("script, style, button, input, textarea").forEach(node => node.remove());
      return String(parsed.body?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 500);
    } catch { return ""; }
  }

  function text(node, value) {
    if (node) node.textContent = String(value || "");
  }

  function setWorkbenchQuestion(question) {
    currentQuestion = question;
    questionHasCorrectAnswer = Boolean(state.currentPracticeSolved);
    setQuestion(question, {
      prompt: "practice-prompt",
      topic: "practice-topic-full",
      input: "practice-answer-input",
      feedback: "practice-feedback",
      solution: "practice-solution",
      hint: "practice-hint",
      count: "practice-footer-count",
    });
    questionHasCorrectAnswer = Boolean(state.currentPracticeSolved);
    text(document.getElementById("practice-detail"), "Work through each step beside your notebook. Your page stays saved with this question.");
    if (practiceNotebook) practiceNotebook.openQuestion(question);
    else if (notebookPromise) notebookPromise.then(controller => controller.openQuestion(currentQuestion));
  }

  function renderPracticeWorkbench() {
    const view = document.getElementById("view-practice");
    if (practiceNotebook) notebookDisposal = Promise.resolve(practiceNotebook.dispose());
    practiceNotebook = null;
    const topicOptions = Object.entries(topicNames).map(([id, name]) =>
      '<option value="' + id + '"' + (state.selectedTopic === id ? " selected" : "") + ">" + escapeHtml(name) + "</option>"
    ).join("");
    const difficultyOptions = Object.entries(difficultyNames).map(([id, name]) =>
      '<option value="' + id + '"' + (state.selectedDifficulty === id ? " selected" : "") + ">" + escapeHtml(name) + "</option>"
    ).join("");
    view.innerHTML = [
      '<div class="subpage-header workbench-header"><div><div class="eyebrow"><span class="eyebrow-dot"></span>YOUR PRACTICE WORKSPACE</div><h1>Question + notebook<span class="period">.</span></h1><p>See the problem, work it out by hand, then check your answer.</p></div><span class="pill pill-lilac" id="practice-total-correct">' + state.correct + " CORRECT SO FAR</span></div>",
      '<div class="workbench-controls"><label class="field-control">TOPIC<select id="practice-topic-select">' + topicOptions + '</select></label><label class="field-control">DIFFICULTY<select id="practice-difficulty-select">' + difficultyOptions + '</select></label><label class="field-control">QUESTION SOURCE<select id="question-source-select"><option value="curated">Curated practice</option><option value="live">Live WeBWorK</option></select></label><button class="button button-primary" id="generate-question">New problem <span>↻</span></button></div>',
      '<div class="workbench-grid">',
      '<section class="panel answer-card workbench-question" aria-labelledby="workbench-question-title"><div class="question-toolbar"><span class="question-count" id="practice-topic-full"></span><div class="question-actions"><button class="text-link" id="practice-hint-button">Need a hint?</button><button class="text-link" id="practice-solution-button">Show solution</button></div></div><h2 class="workbench-card-title" id="workbench-question-title">Today’s problem</h2><div class="question-prompt" id="practice-prompt"></div><div class="question-detail" id="practice-detail"></div><form class="answer-large" id="practice-form"><input id="practice-answer-input" type="text" inputmode="decimal" placeholder="Enter a number or vector (e.g. 4, 3)" aria-label="Your answer" autocomplete="off" /><button class="button button-primary" type="submit">Check answer <span>→</span></button></form><div class="feedback-large" id="practice-feedback" aria-live="polite"></div><p class="hint-text" id="practice-hint" hidden></p><div class="solution-block" id="practice-solution" hidden></div><div id="live-question-frame" class="live-question-frame" hidden></div><div id="live-question-credit" class="live-question-credit" hidden></div><div id="live-question-status" class="live-question-status" role="status"></div><button class="button button-primary live-complete-button" id="mark-live-complete" hidden>Checked in WeBWorK · mark complete</button><div class="practice-footer"><span id="practice-footer-count">A fresh problem for you</span><span id="practice-source-label">Curated · answer checked on this device</span></div></section>',
      '<section class="panel workbench-notebook" aria-labelledby="workbench-notebook-title"><div class="workbench-notebook-heading"><div><div class="eyebrow">YOUR QUESTION PAGE</div><h2 class="workbench-card-title" id="workbench-notebook-title">Show your steps</h2><p>Saved on this device and linked to the current question.</p></div><span class="notebook-save-badge" id="notebook-save-status">Opening…</span></div>',
      '<div class="notebook-toolbar workbench-toolbar" role="toolbar" aria-label="Notebook drawing tools"><div class="notebook-tool-group"><button class="tool-button" data-tool="pen" aria-pressed="true">✎ Pen</button><button class="tool-button" data-tool="highlighter" aria-pressed="false">▰ Highlight</button><button class="tool-button" data-tool="eraser" aria-pressed="false">⌫ Eraser</button><button class="tool-button" id="undo-stroke" aria-label="Undo stroke">↶</button><button class="tool-button" id="redo-stroke" aria-label="Redo stroke">↷</button></div><div class="notebook-tool-group"><button class="swatch" data-color="#34463b" aria-label="Dark green ink" aria-pressed="true"></button><button class="swatch" data-color="#5576a5" aria-label="Blue ink" aria-pressed="false"></button><button class="swatch" data-color="#b86d54" aria-label="Terracotta ink" aria-pressed="false"></button><input type="color" class="color-native" id="custom-color" value="#34463b" aria-label="Choose a custom ink color" /><label class="width-control">SIZE <input id="stroke-size" type="range" min="1" max="12" value="3" /><i class="width-sample" id="width-sample"></i></label></div></div>',
      '<div class="notebook-pagebar"><div class="page-tabs" id="notebook-pages" role="tablist" aria-label="Question notebook pages"></div><button class="page-tab-add" id="add-notebook-page" aria-label="Add page">+</button><div class="page-actions"><button class="page-action" id="rename-notebook-page">Rename</button><button class="page-action" id="delete-notebook-page">Delete</button><button class="page-action" id="export-notebook-png">PNG</button><button class="page-action" id="export-notebook-pdf">PDF</button></div></div>',
      '<div class="drawing-surface workbench-drawing-surface"><canvas id="notebook-canvas" aria-label="Drawable question notebook page. Use a mouse, stylus, or finger to write." role="img"></canvas><div class="canvas-tip">Draw your working here · mouse, stylus, or finger</div></div>',
      '<div class="notebook-footer"><span id="notebook-save-status-secondary">Pages stay in this browser.</span><span id="notebook-page-count">0 pages</span></div>',
      '<div class="ai-feedback-bar"><div><b>AI step feedback</b><span id="ai-feedback-status">On-device feedback is available in the Mac app. Web feedback is off until a service is configured.</span></div><div class="ai-feedback-actions"><button class="button button-dark" id="analyze-notebook">Review my steps</button><button class="page-action" id="edit-ai-feedback">Edit last note</button><button class="page-action" id="move-ai-feedback">Move last note</button><button class="page-action" id="remove-ai-feedback">Remove last note</button></div></div>',
      '<div class="notebook-footer"><span>Question pages and practice history are stored locally.</span><button class="text-link" data-view="notebook">Open general notebook →</button></div>',
      "</section></div>",
    ].join("");

    const savedQuestion = state.currentPracticeQuestion;
    const validSavedQuestion = savedQuestion && topicNames[savedQuestion.topic] && difficultyNames[savedQuestion.difficulty];
    const question = validSavedQuestion ? savedQuestion : buildStableQuestion(state.selectedTopic, state.selectedDifficulty);
    if (!question.id) question.id = question.topic + "-" + question.difficulty + "-" + state.problemSequence;
    state.currentPracticeQuestion = question;
    state.currentPracticeSolved = Boolean(state.currentPracticeSolved && validSavedQuestion);
    setWorkbenchQuestion(question);

    view.querySelector("#practice-form").addEventListener("submit", event => {
      event.preventDefault();
      checkAnswer("practice-answer-input", "practice-feedback", "practice-solution");
      if (questionHasCorrectAnswer) {
        state.currentPracticeSolved = true;
        saveState();
      }
    });
    view.querySelector("#practice-hint-button").addEventListener("click", () => {
      const hint = view.querySelector("#practice-hint");
      hint.hidden = !hint.hidden;
    });
    view.querySelector("#practice-solution-button").addEventListener("click", () => {
      const solution = view.querySelector("#practice-solution");
      solution.hidden = !solution.hidden;
    });
    const nextQuestion = (forceCurated = false) => {
      const useLive = !forceCurated && view.querySelector("#question-source-select").value === "live";
      state.selectedTopic = view.querySelector("#practice-topic-select").value;
      state.selectedDifficulty = view.querySelector("#practice-difficulty-select").value;
      state.currentPracticeSolved = false;
      const next = buildStableQuestion(state.selectedTopic, state.selectedDifficulty);
      state.currentPracticeQuestion = next;
      saveState();
      view.querySelector("#live-question-frame").hidden = true;
      view.querySelector("#mark-live-complete").hidden = true;
      view.querySelector("#live-question-credit").hidden = true;
      view.querySelector("#live-question-status").textContent = "";
      view.querySelector("#practice-form").hidden = false;
      view.querySelector("#practice-hint-button").hidden = false;
      view.querySelector("#practice-solution-button").hidden = false;
      view.querySelector("#practice-prompt").hidden = false;
      view.querySelector("#practice-detail").hidden = false;
      view.querySelector("#practice-hint").hidden = true;
      view.querySelector("#practice-solution").hidden = true;
      view.querySelector("#practice-source-label").textContent = "Curated · answer checked on this device";
      view.querySelector("#question-source-select").value = "curated";
      setWorkbenchQuestion(next);
      if (useLive) {
        view.querySelector("#question-source-select").value = "live";
        loadLiveQuestion(view, () => nextQuestion(true));
      }
    };
    view.querySelector("#generate-question").addEventListener("click", nextQuestion);
    view.querySelector("#practice-topic-select").addEventListener("change", nextQuestion);
    view.querySelector("#practice-difficulty-select").addEventListener("change", nextQuestion);
    view.querySelector("#question-source-select").addEventListener("change", event => {
      if (event.target.value === "live") loadLiveQuestion(view, () => nextQuestion(true));
      else nextQuestion();
    });
    view.querySelector("#analyze-notebook").addEventListener("click", () => requestFeedback(view));
    view.querySelector("#mark-live-complete").addEventListener("click", () => {
      if (state.currentPracticeSolved || !currentQuestion?.isLive) return;
      questionHasCorrectAnswer = false;
      recordAnswer(true);
      state.currentPracticeSolved = true;
      saveState();
      const button = view.querySelector("#mark-live-complete");
      button.disabled = true;
      button.textContent = "Recorded in local progress";
      text(view.querySelector("#practice-total-correct"), state.correct + " CORRECT SO FAR");
      text(view.querySelector("#live-question-status"), "Your completion is saved in this browser. The answer check stayed with WeBWorK.");
    });
    view.querySelector("#practice-answer-input").addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); view.querySelector("#practice-form").requestSubmit(); }
    });

    if (validSavedQuestion && savedQuestion.isLive) view.querySelector("#question-source-select").value = "live";
    notebookPromise = notebookDisposal.then(() => window.FudiNotebook.mount(view, { scope: "practice" }));
    notebookPromise.then(controller => {
      practiceNotebook = controller;
      controller.openQuestion(currentQuestion);
      view.querySelector("#notebook-save-status-secondary").textContent = "Saved on this device";
      if (validSavedQuestion && savedQuestion.isLive) loadLiveQuestion(view, nextQuestion, savedQuestion);
    }).catch(() => text(view.querySelector("#notebook-save-status"), "Notebook storage unavailable"));
    return notebookPromise;
  }

  async function loadLiveQuestion(view, fallback, restoreQuestion = null) {
    const status = view.querySelector("#live-question-status");
    const frameHost = view.querySelector("#live-question-frame");
    const credit = view.querySelector("#live-question-credit");
    const complete = view.querySelector("#mark-live-complete");
    complete.hidden = true;
    complete.disabled = false;
    complete.textContent = "Checked in WeBWorK · mark complete";
    view.querySelector("#practice-form").hidden = true;
    view.querySelector("#practice-hint-button").hidden = true;
    view.querySelector("#practice-solution-button").hidden = true;
    view.querySelector("#practice-prompt").hidden = true;
    view.querySelector("#practice-detail").hidden = true;
    frameHost.hidden = false;
    text(status, "Connecting to the live WeBWorK library…");

    function returnToCurated(message) {
      frameHost.hidden = true;
      credit.hidden = true;
      complete.hidden = true;
      view.querySelector("#question-source-select").value = "curated";
      fallback();
      text(status, message + " Curated practice is ready to use.");
    }

    if (!apiBase) {
      returnToCurated("The live question service is not configured yet.");
      return;
    }
    try {
      const topic = restoreQuestion?.topic || view.querySelector("#practice-topic-select").value;
      const difficulty = restoreQuestion?.difficulty || view.querySelector("#practice-difficulty-select").value;
      const params = new URLSearchParams({ topic, difficulty });
      if (restoreQuestion?.sourcePath) params.set("sourcePath", restoreQuestion.sourcePath);
      if (restoreQuestion?.seed) params.set("seed", String(restoreQuestion.seed));
      const response = await fetch(apiBase + "/api/live/question?" + params.toString(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(35_000) });
      if (!response.ok) throw new Error("The live library is unavailable.");
      const result = await response.json();
      if (!result.html) throw new Error("The live service returned no rendered question.");
      const frame = document.createElement("iframe");
      frame.title = "Live WeBWorK math problem";
      frame.setAttribute("sandbox", "allow-forms allow-scripts");
      frame.referrerPolicy = "no-referrer";
      let rendererBase = apiBase + "/";
      try {
        const candidate = new URL(result.rendererBase || rendererBase, apiBase);
        if (candidate.protocol === "https:" || (candidate.protocol === "http:" && ["localhost", "127.0.0.1"].includes(candidate.hostname))) rendererBase = candidate.href;
      } catch { /* Keep the configured FUDI service as the base URL. */ }
      frame.srcdoc = '<!doctype html><meta charset="utf-8"><base href="' + escapeAttribute(rendererBase) + '">' + result.html;
      frameHost.replaceChildren(frame);
      text(status, "Live problem · answers are checked by the WeBWorK renderer. Mark complete after the renderer confirms your work.");
      credit.replaceChildren(document.createTextNode("Source: "));
      const sourceLink = document.createElement("a");
      let sourceHref = "https://github.com/openwebwork/webwork-open-problem-library";
      try {
        const candidate = new URL(result.sourceUrl || sourceHref);
        if (candidate.origin === "https://github.com" && candidate.pathname.startsWith("/openwebwork/webwork-open-problem-library/")) sourceHref = candidate.href;
      } catch { /* Use the official library landing page. */ }
      sourceLink.href = sourceHref;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.textContent = "WeBWorK Open Problem Library";
      credit.append(sourceLink, document.createTextNode(" · CC BY-NC-SA 3.0 · noncommercial attribution"));
      credit.hidden = false;
      view.querySelector("#practice-source-label").textContent = "Live WeBWorK · external answer check";
      const liveQuestion = {
        id: restoreQuestion?.id || ("webwork-" + String(result.problemId || result.seed || Date.now())),
        topic,
        difficulty,
        prompt: extractLivePrompt(result.html) || result.title || "Live WeBWorK question",
        solution: "",
        hint: "",
        sourcePath: result.sourcePath || restoreQuestion?.sourcePath || "",
        seed: Number(result.seed || restoreQuestion?.seed || 0),
        isLive: true,
      };
      currentQuestion = liveQuestion;
      state.currentPracticeQuestion = liveQuestion;
      state.currentPracticeSolved = Boolean(restoreQuestion && state.currentPracticeSolved);
      questionHasCorrectAnswer = state.currentPracticeSolved;
      saveState();
      if (practiceNotebook) practiceNotebook.openQuestion(liveQuestion);
      complete.hidden = false;
      if (state.currentPracticeSolved) {
        complete.disabled = true;
        complete.textContent = "Recorded in local progress";
      }
    } catch (error) {
      returnToCurated((error && error.message ? error.message + " " : "") + "Switching to the curated question bank.");
    }
  }

  async function requestFeedback(view) {
    const status = view.querySelector("#ai-feedback-status");
    if (!practiceNotebook) {
      text(status, "Wait for the notebook page to finish opening, then try again.");
      return;
    }
    const image = practiceNotebook.exportImage();
    const prompt = currentQuestion ? currentQuestion.prompt : "";
    const localBridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.fudiLocalAI;
    if (localBridge) {
      activeRequestId = "fudi-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      window.FudiAIResult = function (requestId, result) {
        if (requestId !== activeRequestId) return;
        if (!result || !Array.isArray(result.marks)) {
          text(status, result && result.error ? result.error : "The local model could not review this page.");
          return;
        }
        const marks = result.marks.length ? result.marks : (result.summary ? [{ type: "note", x: 0.68, y: 0.08, text: result.summary }] : []);
        practiceNotebook.addAIMarks(marks, result.summary || "");
        text(status, (result.summary || "Feedback added to the notebook.") + " Experimental feedback · verify each note before using it.");
      };
      text(status, "Reviewing on this Mac. The notebook image stays on this device.");
      localBridge.postMessage({ requestId: activeRequestId, imageDataURL: image, question: prompt });
      return;
    }
    if (!apiBase) {
      text(status, "Web feedback is disabled until the paid cloud service is configured. Notebook work stays on this device.");
      return;
    }
    const approved = window.confirm("Send a snapshot of this notebook page and its question to the configured Gemini service for this request? The FUDI-DC service will not save the image.");
    if (!approved) return;
    text(status, "Sending this page for one-time cloud analysis…");
    try {
      const response = await fetch(apiBase + "/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ consent: true, imageDataURL: image, question: prompt }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error("Cloud feedback is unavailable or not configured.");
      const result = await response.json();
      if (!Array.isArray(result.marks)) throw new Error("The AI response was not in the expected format.");
      const marks = result.marks.length ? result.marks : (result.summary ? [{ type: "note", x: 0.68, y: 0.08, text: result.summary }] : []);
      await practiceNotebook.addAIMarks(marks, result.summary || "");
      text(status, (result.summary || "Feedback added to the notebook.") + " Experimental feedback · verify each note before using it.");
    } catch (error) {
      text(status, error.message || "Could not get feedback. Your notebook page is unchanged.");
    }
  }

  function escapeAttribute(value) {
    return String(value || "").replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
  }

  const originalRenderPractice = renderPractice;
  renderPractice = renderPracticeWorkbench;
  const originalRenderNotebook = renderNotebook;
  renderNotebook = function () {
    originalRenderNotebook();
  };
  Object.assign(topicNames, window.FudiQuestionCatalog ? window.FudiQuestionCatalog.topics : {});
  if (location.hash === "#practice") renderPracticeWorkbench();
  window.FudiWorkbench = { renderPractice: renderPracticeWorkbench, loadLiveQuestion };
})();
