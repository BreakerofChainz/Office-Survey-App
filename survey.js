/**
 * Sky Forged Labs – survey.js
 * Handles all survey logic, state, and submission to Azure Functions → Cosmos DB.
 */

// ── Azure Function endpoint ──────────────────────────────────
// This points to your deployed Azure Function App.
// If you ever redeploy to a different URL, update this one line.
const API_ENDPOINT = "https://officesurveyappfunctions-auhgezd0ggauctg9.eastus-01.azurewebsites.net/api/submit";

// ── Questions Data ───────────────────────────────────────────
const QUESTIONS = [
  {
    id: "q1",
    text: "How do you like your coffee?",
    options: [
      "Hot coffee",
      "Iced coffee",
      "Tea or non-coffee drink",
      "I don't drink caffeine"
    ]
  },
  {
    id: "q2",
    text: "What is your preferred meeting time?",
    options: [
      "Early morning",
      "Late morning",
      "Afternoon",
      "No preference"
    ]
  },
  {
    id: "q3",
    text: "What is your least favorite workday?",
    options: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday"
    ]
  },
  {
    id: "q4",
    text: "How do you prefer to work on projects?",
    options: [
      "Mostly alone",
      "Small groups",
      "Large groups",
      "Depends on the task"
    ]
  },
  {
    id: "q5",
    text: "When do you feel most productive?",
    options: [
      "Early morning",
      "Late morning",
      "Afternoon",
      "Evening"
    ]
  },
  {
    id: "q6",
    text: "How do you feel about meetings in general?",
    options: [
      "Necessary and useful",
      "Useful but too many",
      "Mostly a distraction",
      "Avoid whenever possible"
    ]
  },
  {
    id: "q7",
    text: "How do you prefer to receive information?",
    options: [
      "Written documentation",
      "Chat or instant message",
      "Meetings or calls",
      "Visuals or diagrams"
    ]
  },
  {
    id: "q8",
    text: "Where do you prefer to work?",
    options: [
      "Office",
      "Home",
      "Hybrid",
      "No strong preference"
    ]
  },
  {
    id: "q9",
    text: "What helps you focus the most?",
    options: [
      "Quiet environment",
      "Background noise",
      "Music",
      "Complete silence"
    ]
  },
  {
    id: "q10",
    text: "How do you usually start your workday?",
    options: [
      "Check email first",
      "Review tasks or plans",
      "Dive straight into work",
      "Grab coffee first"
    ]
  }
];

// ── State ────────────────────────────────────────────────────
let currentIndex  = 0;
let selectedOption = null;
const answers     = {};

// ── DOM Refs ─────────────────────────────────────────────────
const questionCounter = document.getElementById("questionCounter");
const progressFill    = document.getElementById("progressFill");
const qNumber         = document.getElementById("qNumber");
const qText           = document.getElementById("qText");
const optionsGrid     = document.getElementById("optionsGrid");
const submitBtn       = document.getElementById("submitBtn");
const submitLabel     = document.getElementById("submitLabel");
const backBtn         = document.getElementById("backBtn");
const progressHeader  = document.getElementById("progressHeader");
const questionCard    = document.getElementById("questionCard");
const thankyouCard    = document.getElementById("thankyouCard");

// ── Render Question ──────────────────────────────────────────
function renderQuestion(index) {
  const q = QUESTIONS[index];
  selectedOption = null;

  // Update progress
  const progress = Math.round(((index + 1) / QUESTIONS.length) * 100);
  questionCounter.textContent = `Question ${index + 1} of ${QUESTIONS.length}`;
  progressFill.style.width    = `${progress}%`;

  // Update question text
  qNumber.textContent = String(index + 1).padStart(2, "0");
  qText.textContent   = q.text;

  // Update submit button label
  submitLabel.textContent = index < QUESTIONS.length - 1 ? "Next Question" : "Submit Survey";

  // Show/hide back button
  backBtn.style.display = index > 0 ? "inline-flex" : "none";

  // Rebuild options
  optionsGrid.innerHTML = "";
  const savedAnswer = answers[q.id] || null;

  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.setAttribute("aria-label", opt);
    btn.setAttribute("role", "radio");

    const isSelected = opt === savedAnswer;
    if (isSelected) {
      btn.classList.add("selected");
      btn.setAttribute("aria-checked", "true");
      selectedOption = opt;
    } else {
      btn.setAttribute("aria-checked", "false");
    }

    btn.innerHTML = `
      <span class="option-indicator"></span>
      <span class="option-text">${opt}</span>
    `;
    btn.addEventListener("click", () => selectOption(btn, opt));
    optionsGrid.appendChild(btn);
  });

  // Enable Next/Submit if a prior answer exists for this question
  submitBtn.disabled = !savedAnswer;

  // Animate card in
  questionCard.style.animation = "none";
  void questionCard.offsetHeight; // force reflow
  questionCard.style.animation = "cardIn 0.35s ease both";
}

// ── Select Option ────────────────────────────────────────────
function selectOption(btn, value) {
  document.querySelectorAll(".option-btn").forEach(b => {
    b.classList.remove("selected");
    b.setAttribute("aria-checked", "false");
  });
  btn.classList.add("selected");
  btn.setAttribute("aria-checked", "true");
  selectedOption = value;
  submitBtn.disabled = false;
}

// ── Submit / Advance ─────────────────────────────────────────
submitBtn.addEventListener("click", () => {
  if (!selectedOption) return;

  const q = QUESTIONS[currentIndex];
  answers[q.id] = selectedOption;

  currentIndex++;

  if (currentIndex < QUESTIONS.length) {
    renderQuestion(currentIndex);
  } else {
    submitSurvey();
  }
});

// ── Back Button ───────────────────────────────────────────────
backBtn.addEventListener("click", () => {
  if (currentIndex <= 0) return;

  // Save current selection before going back (even if none chosen)
  if (selectedOption) {
    answers[QUESTIONS[currentIndex].id] = selectedOption;
  }

  currentIndex--;
  renderQuestion(currentIndex);
});
// ── Persona Definitions ───────────────────────────────────────
const ARCHETYPES = [
  { id: "early_riser",   name: "The Early Riser",   tagline: "Driven by momentum from the first hour",          color: "#f5a623" },
  { id: "catalyst",      name: "The Catalyst",      tagline: "Energizes rooms and kick-starts ideas",           color: "#4fc3f7" },
  { id: "independent",   name: "The Independent",   tagline: "Does their best work alone, on their terms",      color: "#a78bfa" },
  { id: "strategist",    name: "The Strategist",    tagline: "Plans before acting, always",                     color: "#34d399" },
  { id: "generalist",    name: "The Generalist",    tagline: "Adapts to anything, thrives anywhere",            color: "#fb923c" },
  { id: "collaborator",  name: "The Collaborator",  tagline: "Stronger in a team than alone",                   color: "#38bdf8" },
  { id: "operator",      name: "The Operator",      tagline: "Executes relentlessly, no fluff",                 color: "#f87171" },
  { id: "creative",      name: "The Creative",      tagline: "Thinks sideways, works differently",              color: "#e879f9" },
  { id: "pragmatist",    name: "The Pragmatist",    tagline: "Gets it done; perfect is the enemy of done",      color: "#a3e635" },
  { id: "networker",     name: "The Networker",     tagline: "Relationships are the real work",                 color: "#fbbf24" }
];

// ── Scoring Matrix ────────────────────────────────────────────
// Structure: SCORES[questionId][answerText] = { archetypeId: points, ... }
// Only non-zero entries are listed.
const SCORES = {
  q1: {
    "Hot coffee":              { early_riser: 2, strategist: 1, operator: 1 },
    "Iced coffee":             { catalyst: 2, generalist: 1, creative: 1, networker: 1 },
    "Tea or non-coffee drink": { independent: 2, generalist: 1, creative: 2 },
    "I don't drink caffeine":  { independent: 1, strategist: 1, generalist: 1, pragmatist: 2 }
  },
  q2: {
    "Early morning":  { early_riser: 2, catalyst: 1, strategist: 1, operator: 2 },
    "Late morning":   { catalyst: 2, strategist: 1, generalist: 1, collaborator: 2, networker: 2 },
    "Afternoon":      { independent: 2, generalist: 1, collaborator: 1, creative: 2, pragmatist: 1, networker: 1 },
    "No preference":  { generalist: 2, pragmatist: 2 }
  },
  q3: {
    "Monday":    { independent: 2, generalist: 1, creative: 1 },
    "Tuesday":   { catalyst: 1, strategist: 2, operator: 1, pragmatist: 1 },
    "Wednesday": { generalist: 2, collaborator: 1, pragmatist: 1, strategist: 1 },
    "Thursday":  { generalist: 1, collaborator: 1, networker: 2 },
    "Friday":    { early_riser: 2, catalyst: 2, collaborator: 1, operator: 2, networker: 1 }
  },
  q4: {
    "Mostly alone":       { independent: 2, strategist: 2, operator: 1, creative: 2 },
    "Small groups":       { catalyst: 1, strategist: 1, generalist: 1, collaborator: 2, creative: 1, networker: 2 },
    "Large groups":       { catalyst: 2, generalist: 1, collaborator: 1, networker: 2 },
    "Depends on the task":{ early_riser: 1, independent: 1, generalist: 2, collaborator: 1, operator: 1, pragmatist: 2 }
  },
  q5: {
    "Early morning": { early_riser: 2, catalyst: 1, strategist: 2, operator: 2 },
    "Late morning":  { catalyst: 2, generalist: 1, collaborator: 2, pragmatist: 1, networker: 2 },
    "Afternoon":     { independent: 1, generalist: 1, collaborator: 1, creative: 2, catalyst: 1 },
    "Evening":       { independent: 2, generalist: 1, creative: 2, pragmatist: 1 }
  },
  q6: {
    "Necessary and useful":    { catalyst: 1, strategist: 2, collaborator: 1, operator: 1, networker: 2 },
    "Useful but too many":     { early_riser: 1, catalyst: 1, strategist: 1, generalist: 2, collaborator: 1, operator: 1, pragmatist: 1, networker: 1 },
    "Mostly a distraction":    { early_riser: 1, independent: 2, generalist: 1, operator: 2, creative: 2, pragmatist: 1 },
    "Avoid whenever possible": { independent: 2, operator: 2, creative: 1, pragmatist: 2 }
  },
  q7: {
    "Written documentation": { independent: 2, strategist: 2, operator: 1, pragmatist: 1 },
    "Chat or instant message":{ early_riser: 1, catalyst: 2, generalist: 1, collaborator: 2, operator: 1, pragmatist: 1, networker: 2 },
    "Meetings or calls":     { generalist: 1, collaborator: 2, networker: 2 },
    "Visuals or diagrams":   { catalyst: 1, strategist: 1, generalist: 1, creative: 2, networker: 1 }
  },
  q8: {
    "Office":            { catalyst: 2, generalist: 1, collaborator: 2, operator: 1, networker: 2 },
    "Home":              { independent: 2, strategist: 2, operator: 1, creative: 2 },
    "Hybrid":            { early_riser: 1, catalyst: 1, generalist: 2, collaborator: 1, operator: 1, pragmatist: 1, networker: 1 },
    "No strong preference": { early_riser: 1, independent: 1, generalist: 1, pragmatist: 2 }
  },
  q9: {
    "Quiet environment": { early_riser: 2, independent: 2, strategist: 2, operator: 1 },
    "Background noise":  { generalist: 2, collaborator: 2, creative: 1, pragmatist: 1, networker: 1, catalyst: 1 },
    "Music":             { independent: 1, generalist: 1, creative: 2, pragmatist: 1, catalyst: 1 },
    "Complete silence":  { early_riser: 1, independent: 2, strategist: 2, operator: 2, pragmatist: 1 }
  },
  q10: {
    "Check email first":      { strategist: 1, generalist: 1, collaborator: 2, operator: 1, networker: 2 },
    "Review tasks or plans":  { early_riser: 2, catalyst: 1, strategist: 2, operator: 2, pragmatist: 1 },
    "Dive straight into work":{ early_riser: 2, catalyst: 2, independent: 1, operator: 2, creative: 1, pragmatist: 2 },
    "Grab coffee first":      { early_riser: 1, independent: 1, generalist: 1, collaborator: 1, creative: 2, pragmatist: 1, networker: 1 }
  }
};

// ── Scoring Engine ────────────────────────────────────────────
// Tallies points for each archetype based on the respondent's answers,
// then returns the winning ARCHETYPES entry and the full score map.
function scorePersona(answersMap) {
  // Initialise all archetype totals to 0
  const totals = {};
  ARCHETYPES.forEach(a => { totals[a.id] = 0; });

  // Walk every question answer and add weights
  for (const [qid, response] of Object.entries(answersMap)) {
    const qScores = SCORES[qid];
    if (!qScores) continue;
    const optionScores = qScores[response];
    if (!optionScores) continue;
    for (const [archetypeId, pts] of Object.entries(optionScores)) {
      if (totals[archetypeId] !== undefined) {
        totals[archetypeId] += pts;
      }
    }
  }

  // Find winning archetype — first-defined wins on tie
  let winner = ARCHETYPES[0];
  let topScore = totals[ARCHETYPES[0].id];
  for (const archetype of ARCHETYPES) {
    if (totals[archetype.id] > topScore) {
      topScore  = totals[archetype.id];
      winner    = archetype;
    }
  }

  return { winner, totals };
}

function buildPayload() {
  const answersFormatted = {};
  // Build a flat map of qid → response for the scoring engine
  const rawAnswers = {};
  QUESTIONS.forEach(q => {
    answersFormatted[q.id] = {
      question: q.text,
      response: answers[q.id] || null
    };
    rawAnswers[q.id] = answers[q.id] || null;
  });

  // Score the persona before building the payload so the archetype
  // can be stored in Cosmos alongside the raw answers.
  const { winner } = scorePersona(rawAnswers);

  return {
    id:            generateUUID(),
    surveyVersion: "1.0",
    submittedAt:   new Date().toISOString(),
    source:        "SkyForgedLabs-WebApp",
    archetype:     winner.id,
    answers:       answersFormatted
  };
}

// ── Submit Survey ────────────────────────────────────────────
async function submitSurvey() {
  const payload = buildPayload();

  // Disable button and show loading state while we wait for the API
  submitBtn.disabled      = true;
  submitLabel.textContent = "Submitting…";

  try {
    const response = await fetch(API_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log("Submission accepted, Cosmos ID:", result.id);

  } catch (err) {
    console.error("Submission failed:", err.message);
    // Show a user-friendly error without blocking the thank-you screen.
    // In a production app you would surface this in the UI.
  }

  // Always show thank-you screen regardless of API outcome
  // so a transient network error doesn't strand the user.
  showThankYou(payload);
}

// ── Thank-You Screen ─────────────────────────────────────────
function showThankYou(payload) {
  progressHeader.style.display = "none";
  questionCard.style.display   = "none";
  thankyouCard.style.display   = "block";

  // Re-derive raw answers map and score for card rendering
  const rawAnswers = {};
  QUESTIONS.forEach(q => {
    rawAnswers[q.id] = payload.answers[q.id]?.response || null;
  });

  const { winner, totals } = scorePersona(rawAnswers);

  // ── Render persona card into #personaCard ──────────────────
  const card = document.getElementById("personaCard");
  if (!card) return;

  // Sort archetypes by score descending for the score breakdown
  const ranked = [...ARCHETYPES]
    .map(a => ({ ...a, score: totals[a.id] }))
    .sort((a, b) => b.score - a.score);

  // Top 3 runner-ups (excluding winner which is ranked[0])
  const runnerUps = ranked.slice(1, 4);

  // Max score across all archetypes — used to normalise the bars
  const maxScore = ranked[0].score || 1;

  card.innerHTML = `
    <div class="persona-header" style="--persona-color: ${winner.color};">
      <div class="persona-glyph" aria-hidden="true">✦</div>
      <div class="persona-label">Your Work Persona</div>
      <h3 class="persona-name">${winner.name}</h3>
      <p class="persona-tagline">${winner.tagline}</p>
    </div>
    <div class="persona-breakdown">
      <div class="persona-breakdown-label">Score breakdown</div>
      ${ranked.map(a => `
        <div class="persona-bar-row ${a.id === winner.id ? "is-winner" : ""}">
          <span class="persona-bar-name">${a.name.replace("The ", "")}</span>
          <div class="persona-bar-track">
            <div class="persona-bar-fill" style="width: ${Math.round((a.score / maxScore) * 100)}%; background: ${a.id === winner.id ? winner.color : "var(--surface2)"}"></div>
          </div>
          <span class="persona-bar-score">${a.score}</span>
        </div>
      `).join("")}
    </div>
    <div class="persona-runners">
      <span class="persona-runners-label">Also in you:</span>
      ${runnerUps.map(a => `<span class="persona-runner-chip" style="--chip-color: ${a.color};">${a.name.replace("The ", "")}</span>`).join("")}
    </div>
  `;

  card.style.display = "block";
}

// ── UUID Helper ───────────────────────────────────────────────
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Init ──────────────────────────────────────────────────────
renderQuestion(0);