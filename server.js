
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "20kb" }));

app.get("/", (req, res) => {
    res.send("Kannada Connect AI Server is Running! 💜");
});

app.post("/api/chat", async (req, res) => {
    try {
        console.log("AI chat request received!");

        const { message } = req.body || {};

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                reply: "ದಯವಿಟ್ಟು ಒಂದು ಪ್ರಶ್ನೆ ಕೇಳಿ."
            });
        }

        if (!process.env.GEMINI_API_KEY) {
            console.error("GEMINI_API_KEY is missing in .env");

            return res.status(500).json({
                reply: "AI setup ಸಮಸ್ಯೆ ಇದೆ. ದಯವಿಟ್ಟು API configuration ಪರಿಶೀಲಿಸಿ."
            });
        }

        const systemInstruction = `
You are Kannada Connect AI, a helpful conversational Kannada assistant.

Your main purpose is to understand what the user means and explain it
naturally in Kannada, just like a friendly Kannada-speaking person.

LANGUAGE RULES:
1. Understand English, Kannada, and mixed English-Kannada messages.
2. Answer primarily in natural, simple Kannada using Kannada script.
3. Do not merely repeat the user's words or give only a single translated word
   when an explanation is needed.
4. If the user asks for a word's meaning, explain its meaning in Kannada.
   Give a short example when helpful.
5. If the user asks for a sentence's meaning, explain the full sentence
   in natural Kannada.
6. If the user asks a general question, answer the actual question helpfully
   in Kannada. Do not force every answer to be a translation.
7. If the user asks how to say something in Kannada, provide the Kannada
   phrase and its English-letter pronunciation.
8. If the user asks your name, say:
   ನನ್ನ ಹೆಸರು ಕನ್ನಡ ಕನೆಕ್ಟ್ AI.
9. Never introduce yourself as Gemini or Google.
10. Do not claim to be human.
11. Keep answers clear, friendly, and reasonably short. Explain more when asked.
12. Avoid unnecessary headings, repetitive greetings, and excessive formatting.
13. Put the main Kannada answer first so it can be spoken aloud.
14. Do not invent facts. If unsure, say so honestly in Kannada.

The user may speak informally, make spelling mistakes, or use Kannada
written in English letters. Try to understand the intended meaning.
Respond to the actual question, not with a fixed template.
`;

        const apiUrl =
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            "gemini-flash-latest:generateContent";

        let data;
        let lastError;

        // Retry temporary service errors up to 3 total attempts.
        for (let attempt = 1; attempt <= 3; attempt++) {
            const response = await fetch(
                `${apiUrl}?key=${process.env.GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        system_instruction: {
                            parts: [{ text: systemInstruction }]
                        },
                        contents: [
                            {
                                role: "user",
                                parts: [{ text: message.trim() }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.4,
                            maxOutputTokens: 600
                        }
                    }),
                    signal: AbortSignal.timeout(30000)
                }
            );

            data = await response.json();

            if (response.ok) {
                break;
            }

            lastError = data.error || {
                message: "Unknown Gemini API error"
            };

            console.error(
                `Gemini API attempt ${attempt} failed:`,
                lastError
            );

            const temporaryError =
                response.status === 429 ||
                response.status === 500 ||
                response.status === 502 ||
                response.status === 503 ||
                response.status === 504;

            if (!temporaryError || attempt === 3) {
                const status =
                    response.status === 429 ||
                    response.status === 503 ||
                    response.status >= 500
                        ? 503
                        : 502;

                return res.status(status).json({
                    reply:
                        "ಕ್ಷಮಿಸಿ, AI ಈಗ ಉತ್ತರಿಸಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ. " +
                        "ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
                });
            }

            await new Promise(resolve =>
                setTimeout(resolve, attempt * 1500)
            );
        }

        const reply = data?.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("\n")
            .trim();

        if (!reply) {
            console.error(
                "Gemini returned no text:",
                JSON.stringify(data?.promptFeedback || {})
            );

            return res.status(502).json({
                reply:
                    "ಕ್ಷಮಿಸಿ, ಈಗ ಉತ್ತರ ಸಿಗಲಿಲ್ಲ. " +
                    "ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಮತ್ತೊಮ್ಮೆ ಕೇಳಿ."
            });
        }

        res.json({ reply });

    } catch (error) {
        console.error("Server error:", error.message);

        res.status(500).json({
            reply:
                "ಸರ್ವರ್‌ನಲ್ಲಿ ತಾತ್ಕಾಲಿಕ ಸಮಸ್ಯೆ ಇದೆ. " +
                "ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `Kannada Connect AI running at http://localhost:${PORT}`
    );
});
