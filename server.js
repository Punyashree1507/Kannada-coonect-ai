require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Kannada Connect AI Server is Running!");
});

app.post("/api/chat", async (req, res) => {
    try {
        const message =
            req.body.message ||
            req.body.prompt ||
            req.body.question;

        if (!message) {
            return res.status(400).json({
                reply: "Please enter a message."
            });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({
                reply: "AI setup is incomplete. Please check the server configuration."
            });
        }

        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: "openai/gpt-oss-20b",
                    messages: [
                        {
                            role: "system",
                            content: `You are Kannada Connect AI, a friendly Kannada learning assistant.

Help users learn Kannada and English.

Rules:
1. Explain in simple Kannada or English based on the user's question.
2. You can use Kannada-English transliteration when helpful.
3. Help with Kannada vocabulary, grammar, pronunciation and sentence formation.
4. Give short examples suitable for beginners.
5. Be friendly, encouraging and respectful.
6. If the user asks in Kannada, try to answer in Kannada.
7. If the user asks in English, use simple English and explain difficult words.
8. Do not invent translations when unsure.`
                        },
                        {
                            role: "user",
                            content: String(message)
                        }
                    ],
                    max_completion_tokens: 700
                }),
                signal: AbortSignal.timeout(30000)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "Groq API error:",
                response.status,
                data
            );

            return res.status(502).json({
                reply: response.status === 429
                    ? "AI usage limit reached. Please try again later."
                    : "AI is temporarily unavailable. Please try again."
            });
        }

        const reply =
            data.choices?.[0]?.message?.content?.trim();

        if (!reply) {
            return res.status(502).json({
                reply: "I couldn't generate an answer. Please try again."
            });
        }

        return res.json({ reply });

    } catch (error) {
        console.error("Chat error:", error.message);

        return res.status(500).json({
            reply: "Unable to connect to AI right now. Please try again."
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `Kannada Connect AI server running on port ${PORT}`
    );
});