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
const tySummary       = document.getElementById("tySummary");

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
function buildPayload() {
  const answersFormatted = {};
  QUESTIONS.forEach(q => {
    answersFormatted[q.id] = {
      question: q.text,
      response: answers[q.id] || null
    };
  });

  return {
    id:            generateUUID(),
    surveyVersion: "1.0",
    submittedAt:   new Date().toISOString(),
    source:        "SkyForgedLabs-WebApp",
    answers:       answersFormatted
  };
}

// ── Submit Survey ────────────────────────────────────────────
async function submitSurvey() {
  const payload = buildPayload();

  // Disable button and show loading state while we wait for the API
  submitBtn.disabled  = true;
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

  const summaryItems = Object.entries(payload.answers)
    .map(([, val]) => `<strong>${val.question}</strong><br/>${val.response}`)
    .join("<br/><br/>");
  tySummary.innerHTML = summaryItems;
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
