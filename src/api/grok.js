// api.js – example usage (e.g. in Node or testing)
async function callOpenRouter(prompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:5173", // change to your domain
      "X-Title": "EduMate AI Tutor",
    },
    body: JSON.stringify({
      model: "xiaomi/mimo-v2-flash:free",
      messages: [
        { role: "system", content: "You are a helpful tutor." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenRouter API Error:", response.status, errorText);
    throw new Error(`OpenRouter failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const aiReply = data.choices?.[0]?.message?.content?.trim() || "";
  console.log("AI reply:", aiReply);
  console.log("Usage:", data.usage);

  return aiReply;
}

// Example call
// callOpenRouter("Explain photosynthesis in simple terms");