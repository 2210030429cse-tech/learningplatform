import { useState, useEffect, useRef } from "react";
import Message from "./Message";
import "../styles/chat.css";

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const MODEL = "xiaomi/mimo-v2-flash:free";

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

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("edumate-theme");
    if (saved !== null) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("edumate-theme", darkMode ? "dark" : "light");
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
    if (!input.trim() || loading) return;
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
        { role: "ai", text: "⚠️ Sorry, something went wrong connecting to the AI. Try again?" },
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

      if (!res.ok) throw new Error("Quiz API error");

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim() || "";
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed) || parsed.length !== 5) {
        throw new Error("Invalid quiz format");
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

        <button onClick={generateQuiz} disabled={loading}>
          📝 Generate Quiz
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

      {showPrompt && (
        <div className="system-prompt-box">
          <div className="prompt-header">
            <strong>Current System Prompt (sent with every message)</strong>
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

                        let liClass = isRight ? "correct" : isUserChoice && !isCorrect ? "wrong" : "";

                        return (
                          <li key={idx} className={liClass}>
                            {letter}) {opt}
                            {isRight && " ✓ Correct"}
                            {isUserChoice && !isCorrect && " ✗"}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
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
                  onClick={() => setQuizSubmitted(true)}
                >
                  Submit Quiz & See Results
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="input-box">
        <button 
          onClick={sendMessage} 
          disabled={loading || !input.trim()}
        >
          Send
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
          onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage()}
          disabled={loading}
        />
      </div>
    </div>
  );
};

export default Chat;