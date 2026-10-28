// Determine API base URL dynamically so fetch works whether served by Express (port 3000),
// VS Code Live Server (e.g. port 5500), or opened as a local file
function getApiBase() {
  if (typeof window !== "undefined" && window.location) {
    const port = window.location.port;
    const protocol = window.location.protocol;
    // If served directly by the backend on port 3000
    if (protocol.startsWith("http") && port === "3000") {
      return "/api";
    }
  }
  // If served by Live Server, Vite, or file://, target local backend server
  return "http://localhost:3000/api";
}

const API_BASE = getApiBase();
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const enquiryForm = document.getElementById("enquiryForm");
const enquiryStatus = document.getElementById("enquiryStatus");

document.getElementById("menuToggle").addEventListener("click", () => {
  const nav = document.getElementById("mainNav");
  const open = nav.classList.toggle("open");
  document.getElementById("menuToggle").setAttribute("aria-expanded", String(open));
});
document.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", () => {
  document.getElementById("mainNav").classList.remove("open");
  document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
}));
document.querySelectorAll(".topic-question, .quick-prompts button").forEach(button => {
  button.addEventListener("click", () => {
    const question = button.dataset.question || "";
    chatInput.value = question;
    document.getElementById("chatbot").scrollIntoView({ behavior: "smooth" });
    chatInput.focus();
    if (button.classList.contains("quick-prompt-send")) sendChat(question);
  });
});

function addMessage(text, who) {
  const row = document.createElement("div");
  row.className = `message ${who === "user" ? "user-message" : "bot-message"}`;
  if (who !== "user") {
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    avatar.textContent = "✦";
    row.appendChild(avatar);
  }
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const small = document.createElement("small");
  small.textContent = who === "user" ? "You" : "Campus assistant";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  bubble.append(small, paragraph);
  row.appendChild(bubble);
  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChat(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) return;
  addMessage(cleanQuestion, "user");
  chatInput.value = "";
  const loading = document.createElement("div");
  loading.className = "message bot-message";
  loading.id = "chatLoading";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = "Let me check that for you…";
  loading.appendChild(bubble);
  chatMessages.appendChild(loading);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: cleanQuestion })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The assistant is unavailable.");
    addMessage(data.answer, "bot");
  } catch (error) {
    console.error("Chat fetch error:", error);
    const msg = error.message && error.message.includes("Failed to fetch")
      ? "Cannot connect to server. Please check that the backend is running at http://localhost:3000."
      : `${error.message}. Please check that the backend is running.`;
    addMessage(msg, "bot");
  } finally {
    document.getElementById("chatLoading")?.remove();
  }
}

chatForm.addEventListener("submit", event => {
  event.preventDefault();
  sendChat(chatInput.value);
});

enquiryForm.addEventListener("submit", async event => {
  event.preventDefault();
  enquiryStatus.className = "form-status";
  enquiryStatus.textContent = "Sending your enquiry…";
  const form = new FormData(enquiryForm);
  const payload = Object.fromEntries(form.entries());
  try {
    const response = await fetch(`${API_BASE}/enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not submit your enquiry.");
    enquiryStatus.className = "form-status success";
    enquiryStatus.textContent = `Thanks! Your enquiry was submitted. Reference: ${data.enquiry?.id || "Saved"}`;
    enquiryForm.reset();
  } catch (error) {
    console.error("Enquiry fetch error:", error);
    enquiryStatus.className = "form-status error";
    enquiryStatus.textContent = error.message && error.message.includes("Failed to fetch")
      ? "Cannot connect to backend server. Make sure it is running at http://localhost:3000."
      : error.message;
  }
});
