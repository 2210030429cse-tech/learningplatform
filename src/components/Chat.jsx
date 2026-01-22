import { useState, useEffect, useRef } from "react";
import Message from "./Message";
import "../styles/chat.css";

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const MODEL = "xiaomi/mimo-v2-flash:free";

// LocalStorage keys
const THEME_KEY = "edumate-theme";
const PROGRESS_KEY = "edumate_learning_progress";

const Chat = () => {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hi 👋 I'm EduMate AI — your personalized tutor. I adjust explanations to your level and chosen subject. What would you like to learn today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [level, setLevel] = useState("Beginner");
  const [subject, setSubject] = useState("General");

  const [quiz, setQuiz] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Progress Tracker
  const [progress, setProgress] = useState(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    return saved ? JSON.parse(saved) : { totalQuizzes: 0, totalCorrect: 0 };
  });

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progress]);

  const updateProgress = (correctCount) => {
    setProgress((prev) => ({
      totalQuizzes: prev.totalQuizzes + 1,
      totalCorrect: prev.totalCorrect + correctCount,
    }));
  };

  const accuracy = progress.totalQuizzes > 0
    ? Math.round((progress.totalCorrect / (progress.totalQuizzes * 5)) * 100)
    : 0;

  const getProgressMessage = () => {
    if (accuracy >= 80) return "You're on fire! 🔥 Keep pushing!";
    if (accuracy >= 60) return "Solid progress — you're getting stronger!";
    if (accuracy >= 40) return "Good effort! Let's aim higher.";
    return "Every quiz makes you better. Keep going!";
  };

  const resetAllProgress = () => {
    if (window.confirm("Reset all learning progress? This cannot be undone.")) {
      setProgress({ totalQuizzes: 0, totalCorrect: 0 });
      localStorage.removeItem(PROGRESS_KEY);
    }
  };

  // ── NEW: AI Session Summary + Revision Plan ──
  const [sessionSummary, setSessionSummary] = useState("");
  const [revisionPlan, setRevisionPlan] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const generateSummaryAndPlan = async (type) => {  // type: "summary" or "plan"
    const isSummary = type === "summary";
    const setter = isSummary ? setSessionSummary : setRevisionPlan;
    const loadingSetter = isSummary ? setGeneratingSummary : setGeneratingPlan;

    if (loadingSetter() || loading || messages.length <= 1) return;

    loadingSetter(true);
    setter(isSummary ? "Generating session summary..." : "Creating your revision plan...");

    const chatHistory = messages
      .slice(1)
      .map(m => `${m.role === "ai" ? "Tutor" : "You"}: ${m.text.substring(0, 280)}${m.text.length > 280 ? "..." : ""}`)
      .join("\n");

    const quizPart = quiz.length > 0 && quizSubmitted
      ? `Recent Quiz (${subject}, ${level}): Score ${calculateScore()}/${quiz.length} (${Math.round((calculateScore()/quiz.length)*100)}%)\n`
      : "";

    const progressPart = `Overall: ${progress.totalQuizzes} quizzes, ${accuracy}% accuracy\n`;

    const basePrompt = `
You are EduMate AI — friendly and encouraging tutor.

Session info:
- Level: ${level}
- Subject: ${subject}
${quizPart}${progressPart}

Conversation:
${chatHistory.substring(0, 1800)}${chatHistory.length > 1800 ? "\n[...]" : ""}

`;

    const prompt = isSummary
      ? basePrompt + `
Create a short, warm session summary (4–8 sentences).
- Highlight main topics discussed
- Mention quiz result if any
- Be positive and encouraging
- End with a motivational note
- Simple language, no code/JSON/markdown
`
      : basePrompt + `
Create a short, actionable revision plan / next steps (4–7 sentences or bullet points).
- Suggest 2–4 topics or concepts to revise based on chat & quiz
- Recommend practice or questions to ask next time
- Keep it motivating and realistic
- Use simple language, no code/JSON/markdown
`;

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": window.location.origin || "http://localhost:5173",
          "X-Title": "EduMate AI Tutor",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: "You are a supportive educational assistant." },
            { role: "user", content: prompt },
          ],
          temperature: 0.68,
          max_tokens: isSummary ? 380 : 420,
        }),
      });

      if (!res.ok) throw new Error("Generation failed");

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim() || "Could not generate content right now.";
      setter(text);
    } catch (err) {
      console.error("Generation Error:", err);
      setter("Sorry, couldn't generate it right now. Please try again.");
    } finally {
      loadingSetter(false);
    }
  };

  // ────────────────────────────────────────

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved !== null) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem(THEME_KEY, darkMode ? "dark" : "light");
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const chatRef = useRef(null);
  const quizRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (quizRef.current && quiz.length > 0) {
      quizRef.current.scrollTo({ top: quizRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [quiz, quizSubmitted, userAnswers]);

  const getCurrentSystemPrompt = () => {
    return `You are EduMate AI — a friendly, adaptive tutor.
Student level: ${level}
Focus subject: ${subject}

Adapt depth, examples, wording and pace to the student's level.
Be encouraging. Use simple analogies when helpful.
If unclear — ask clarifying questions politely.`;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || generatingSummary || generatingPlan) return;
    const userText = input.trim();
    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", text: userText }]);

    const apiMessages = [
      { role: "system", content: getCurrentSystemPrompt() },
      ...messages.map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text,
      })),
      { role: "user", content: userText },
    ];

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": window.location.origin || "http://localhost:5173",
          "X-Title": "EduMate AI Tutor",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: apiMessages,
          temperature: 0.72,
          max_tokens: 2048,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "API request failed");
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim() || "No response received.";

      setMessages((prev) => [...prev, { role: "ai", text: reply }]);
    } catch (err) {
      console.error("Chat Error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "⚠️ Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const generateQuiz = async () => {
    setQuiz([]);
    setUserAnswers({});
    setQuizSubmitted(false);
    setLoading(true);

    const prompt = `
Create **exactly 5** multiple-choice questions.

Subject: ${subject}
Level: ${level}

Rules:
- Match difficulty to level (${level.toLowerCase()})
- Exactly 4 options each (labeled A,B,C,D inside the array)
- Only **one** correct answer
- Return **ONLY** valid JSON array — no extra text, comments or markdown

Format:
[
  {
    "question": "Question text?",
    "options": ["Option text A", "Option text B", "Option text C", "Option text D"],
    "answer": "A"
  }
]
`;

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": window.location.origin || "http://localhost:5173",
          "X-Title": "EduMate AI Tutor",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: "Respond only with clean JSON array." },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1800,
        }),
      });

      if (!res.ok) throw new Error("Quiz generation failed");

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim() || "";
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed) || parsed.length !== 5) {
        throw new Error("Invalid quiz format from AI");
      }

      setQuiz(parsed);
    } catch (err) {
      console.error("Quiz Error:", err);
      alert("Failed to generate quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionIndex, optionLetter) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionLetter,
    }));
  };

  const calculateScore = () => {
    let correct = 0;
    quiz.forEach((q, i) => {
      if (userAnswers[i] === q.answer) correct++;
    });
    return correct;
  };

  const generateFeedback = (score, total) => {
    const percentage = Math.round((score / total) * 100);
    
    let emoji = "😊";
    let message = "";
    let suggestion = "";
    let toneClass = "neutral";

    if (percentage >= 80) {
      emoji = "🏆";
      message = "Outstanding performance!";
      toneClass = "excellent";
      suggestion = `You're mastering ${subject} at ${level} level. Ready for advanced challenges?`;
    } 
    else if (percentage >= 60) {
      emoji = "👍";
      message = "Great job — strong foundation!";
      toneClass = "good";
      suggestion = `Focus on the areas you missed to reach the next level.`;
    } 
    else if (percentage >= 40) {
      emoji = "🔥";
      message = "You're improving!";
      toneClass = "average";
      suggestion = `Review the missed questions — want explanations?`;
    } 
    else {
      emoji = "🤗";
      message = "Every step counts!";
      toneClass = "needs-work";
      suggestion = `Let's break down the tough parts together.`;
    }

    return { emoji, message, suggestion, percentage, toneClass };
  };

  const handleSubmitQuiz = () => {
    const score = calculateScore();
    updateProgress(score);
    setQuizSubmitted(true);
  };

  const resetQuiz = () => {
    setQuiz([]);
    setUserAnswers({});
    setQuizSubmitted(false);
  };

  return (
    <div className="chat-container">
      <div className="controls">
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>

        <select value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option>General</option>
          <option>Data Structures</option>
          <option>Web Development</option>
          <option>Machine Learning</option>
          <option>Python</option>
          <option>Mathematics</option>
        </select>

        <button onClick={generateQuiz} disabled={loading || generatingSummary || generatingPlan}>
           Generate Quiz
        </button>

        <button
          onClick={() => generateSummaryAndPlan("summary")}
          disabled={generatingSummary || generatingPlan || loading || messages.length <= 1}
          className="summary-btn"
        >
          {generatingSummary ? "Generating..." : "Session Summary"}
        </button>

        <button
          onClick={() => generateSummaryAndPlan("plan")}
          disabled={generatingSummary || generatingPlan || loading || messages.length <= 1}
          className="plan-btn"
        >
          {generatingPlan ? "Generating..." : "Revision Plan"}
        </button>

        <button
          className="prompt-toggle-btn"
          onClick={() => setShowPrompt(!showPrompt)}
        >
          {showPrompt ? "Hide Prompt" : "Show Prompt"}
        </button>

        <button
          className="theme-toggle"
          onClick={toggleDarkMode}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          title={darkMode ? "Light Mode" : "Dark Mode"}
        >
          {darkMode ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Progress Tracker */}
      <div className="progress-card">
        <div className="progress-header">
          <h3> Your Learning Progress</h3>
          
          <button 
            className="reset-progress-btn small"
            onClick={resetAllProgress}
            title="Reset progress"
          >
            Reset
          </button>
        </div>

        <div className="progress-stats">
          <div className="stat-item">
            <span className="stat-label">Quizzes</span>
            <span className="stat-value">{progress.totalQuizzes}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Correct</span>
            <span className="stat-value">{progress.totalCorrect}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Accuracy</span>
            <span className="stat-value big">{accuracy}%</span>
          </div>
        </div>

        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill"
            style={{ width: `${accuracy}%` }}
          ></div>
        </div>

        <p className="progress-motivation">{getProgressMessage()}</p>
      </div>

      {/* Session Summary Card */}
      {sessionSummary && (
        <div className="session-summary-card">
          <div className="summary-header">
            <h3>📝 Session Summary</h3>
            <button 
              className="close-card-btn"
              onClick={() => setSessionSummary("")}
            >
              ×
            </button>
          </div>
          <div className="card-content">
            {sessionSummary.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Revision Plan Card */}
      {revisionPlan && (
        <div className="revision-plan-card">
          <div className="plan-header">
            <h3>📚 Revision Plan & Next Steps</h3>
            <button 
              className="close-card-btn"
              onClick={() => setRevisionPlan("")}
            >
              ×
            </button>
          </div>
          <div className="card-content">
            {revisionPlan.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      )}

      {showPrompt && (
        <div className="system-prompt-box">
          <div className="prompt-header">
            <strong>Current System Prompt</strong>
          </div>
          <pre>{getCurrentSystemPrompt()}</pre>
        </div>
      )}

      <div className="chat-box" ref={chatRef}>
        {messages.map((msg, i) => (
          <Message key={i} role={msg.role} text={msg.text} />
        ))}
        {loading && <p className="loading">EduMate is thinking...</p>}
      </div>

      {quiz.length > 0 && (
        <div className="quiz-section" ref={quizRef}>
          {/* Your existing quiz section code remains here unchanged */}
          <div className="quiz-header">
            <h3>🧠 Quiz — {subject} ({level})</h3>
            {quizSubmitted && (
              <button onClick={resetQuiz} className="reset-btn">
                New Quiz
              </button>
            )}
          </div>

          {quizSubmitted ? (
            <div className="quiz-results">
              <h4 className="score">
                Score: {calculateScore()} / {quiz.length} (
                {Math.round((calculateScore() / quiz.length) * 100)}%)
              </h4>

              {(() => {
                const fb = generateFeedback(calculateScore(), quiz.length);
                return (
                  <div className={`performance-feedback ${fb.toneClass}`}>
                    <div className="feedback-emoji">{fb.emoji}</div>
                    <div className="feedback-content">
                      <p className="feedback-message">{fb.message}</p>
                      <p className="feedback-suggestion">{fb.suggestion}</p>
                      <div className="feedback-percentage">{fb.percentage}%</div>
                    </div>
                  </div>
                );
              })()}

              {quiz.map((q, i) => {
                const userChoice = userAnswers[i];
                const isCorrect = userChoice === q.answer;

                return (
                  <div key={i} className="quiz-question result">
                    <b>{i + 1}. {q.question}</b>
                    <ul>
                      {q.options.map((opt, idx) => {
                        const letter = String.fromCharCode(65 + idx);
                        const isUserChoice = letter === userChoice;
                        const isRight = letter === q.answer;

                        let liClass = isRight
                          ? "correct"
                          : isUserChoice && !isCorrect
                          ? "wrong"
                          : "";

                        return (
                          <li key={idx} className={liClass}>
                            {letter}) {opt}
                            {isRight && " ✓ Correct"}
                            {isUserChoice && !isCorrect && " ✗ Wrong"}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}

              <p className="next-action-hint">
                Ready for more? Generate a new quiz or ask about any topic!
              </p>
            </div>
          ) : (
            <>
              {quiz.map((q, i) => (
                <div key={i} className="quiz-question">
                  <b>{i + 1}. {q.question}</b>
                  <ul className="options-list">
                    {q.options.map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isSelected = userAnswers[i] === letter;

                      return (
                        <li key={idx}>
                          <label className={`option-label ${isSelected ? "selected" : ""}`}>
                            <input
                              type="radio"
                              name={`q-${i}`}
                              checked={isSelected}
                              onChange={() => handleSelectOption(i, letter)}
                            />
                            <span>{letter}) {opt}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              {Object.keys(userAnswers).length === quiz.length && (
                <button
                  className="submit-quiz-btn"
                  onClick={handleSubmitQuiz}
                >
                  Submit Quiz & See Results
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="input-box">
        

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
          onKeyDown={(e) => e.key === "Enter" && !loading && !generatingSummary && !generatingPlan && sendMessage()}
          disabled={loading || generatingSummary || generatingPlan}
        />
         <button
          onClick={sendMessage}
          disabled={loading || !input.trim() || generatingSummary || generatingPlan}
        >
          Send
        </button>

      </div>
    </div>
  );
};

export default Chat;