/**
 * OfficePulse – survey.js
 * Handles all survey logic, state, and Cosmos DB-ready submission formatting.
 */

// ── Questions Data ──────────────────────────────────────────
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

// ── State ───────────────────────────────────────────────────
let currentIndex = 0;
let selectedOption = null;
const answers = {};

// ── DOM Refs ────────────────────────────────────────────────
const questionCounter = document.getElementById("questionCounter");
const progressFill    = document.getElementById("progressFill");
const qNumber         = document.getElementById("qNumber");
const qText           = document.getElementById("qText");
const optionsGrid     = document.getElementById("optionsGrid");
const submitBtn       = document.getElementById("submitBtn");
const submitLabel     = document.getElementById("submitLabel");
const progressHeader  = document.getElementById("progressHeader");
const questionCard    = document.getElementById("questionCard");
const thankyouCard    = document.getElementById("thankyouCard");
const tySummary       = document.getElementById("tySummary");

// ── Render Question ─────────────────────────────────────────
function renderQuestion(index) {
  const q = QUESTIONS[index];
  selectedOption = null;

  // Update progress
  const progress = Math.round(((index + 1) / QUESTIONS.length) * 100);
  questionCounter.textContent = `Question ${index + 1} of ${QUESTIONS.length}`;
  progressFill.style.width = `${progress}%`;

  // Update question text
  qNumber.textContent = String(index + 1).padStart(2, "0");
  qText.textContent   = q.text;

  // Update submit button label
  submitLabel.textContent = index < QUESTIONS.length - 1 ? "Next Question" : "Submit Survey";
  submitBtn.disabled = true;

  // Rebuild options
  optionsGrid.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.setAttribute("aria-label", opt);
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", "false");
    btn.innerHTML = `
      <span class="option-indicator"></span>
      <span class="option-text">${opt}</span>
    `;
    btn.addEventListener("click", () => selectOption(btn, opt));
    optionsGrid.appendChild(btn);
  });

  // Animate card in
  questionCard.style.animation = "none";
  void questionCard.offsetHeight; // reflow
  questionCard.style.animation = "cardIn 0.35s ease both";
}

// ── Select Option ───────────────────────────────────────────
function selectOption(btn, value) {
  // Deselect all
  document.querySelectorAll(".option-btn").forEach(b => {
    b.classList.remove("selected");
    b.setAttribute("aria-checked", "false");
  });

  // Select clicked
  btn.classList.add("selected");
  btn.setAttribute("aria-checked", "true");
  selectedOption = value;
  submitBtn.disabled = false;
}

// ── Submit / Advance ────────────────────────────────────────
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

// ── Build Cosmos DB-Ready Payload ───────────────────────────
function buildPayload() {
  return {
    id: generateUUID(),
    surveyVersion: "1.0",
    submittedAt: new Date().toISOString(),
    source: "OfficePulse-WebApp",
    answers: {
      q1:  { question: QUESTIONS[0].text, response: answers.q1  || null },
      q2:  { question: QUESTIONS[1].text, response: answers.q2  || null },
      q3:  { question: QUESTIONS[2].text, response: answers.q3  || null },
      q4:  { question: QUESTIONS[3].text, response: answers.q4  || null },
      q5:  { question: QUESTIONS[4].text, response: answers.q5  || null },
      q6:  { question: QUESTIONS[5].text, response: answers.q6  || null },
      q7:  { question: QUESTIONS[6].text, response: answers.q7  || null },
      q8:  { question: QUESTIONS[7].text, response: answers.q8  || null },
      q9:  { question: QUESTIONS[8].text, response: answers.q9  || null },
      q10: { question: QUESTIONS[9].text, response: answers.q10 || null }
    }
  };
}

// ── Submit Survey ───────────────────────────────────────────
async function submitSurvey() {
  const payload = buildPayload();
  console.log("Survey payload (Cosmos DB ready):", JSON.stringify(payload, null, 2));

  /**
   * ── TODO: Wire up Azure API ──────────────────────────────
   * When your Azure Function / API Management endpoint is ready,
   * uncomment and update the block below:
   *
   * const API_ENDPOINT = "https://<your-function>.azurewebsites.net/api/submitSurvey";
   *
   * try {
   *   const response = await fetch(API_ENDPOINT, {
   *     method: "POST",
   *     headers: { "Content-Type": "application/json" },
   *     body: JSON.stringify(payload)
   *   });
   *   if (!response.ok) throw new Error(`HTTP ${response.status}`);
   *   const result = await response.json();
   *   console.log("Cosmos DB response:", result);
   * } catch (err) {
   *   console.error("Submission error:", err);
   * }
   * ────────────────────────────────────────────────────────
   */

  // Show thank-you screen
  progressHeader.style.display = "none";
  questionCard.style.display   = "none";
  thankyouCard.style.display   = "block";

  // Build summary display
  const summaryItems = Object.entries(payload.answers)
    .map(([key, val]) => `<strong>${val.question}</strong><br/>${val.response}`)
    .join("<br/><br/>");
  tySummary.innerHTML = summaryItems;
}

// ── UUID Generator ──────────────────────────────────────────
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Init ─────────────────────────────────────────────────────
renderQuestion(0);
