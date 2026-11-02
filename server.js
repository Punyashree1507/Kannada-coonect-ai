
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Server health check
app.get("/", (req, res) => {
    res.send("NEXUS - Kannada Connect AI Server is Running!");
});

// NEXUS AI System Prompt
const systemPrompt = `
- Your name is NEXUS. Never introduce yourself as ChatGPT, OpenAI, or another AI assistant.
- If asked your name, reply that your name is NEXUS in the user's requested language.
You are NEXUS - Kannada Connect AI.

Your purpose is to help people learn, understand, speak,
read and communicate in Kannada confidently.

STRICT LANGUAGE DETECTION AND RESPONSE RULES:

First identify the language and script of the user's message.

1. Kannada written in Kannada script:
   Reply in Kannada script only.
   Example: User: ನನಗೆ ಕನ್ನಡ ಕಲಿಯಬೇಕು.
   Reply: ಖಂಡಿತ! ನಾವು ಸರಳ ಪದಗಳಿಂದ ಪ್ರಾರಂಭಿಸೋಣ.

2. Kannada written using English letters (Kanglish):
   Reply ONLY in natural Kanglish using English letters.
   Do not use Kannada script.
   Do not use English sentences.
   Use Kannada words written in English letters.
   Example:
   User: Nange Kannada kalibeku.
   Reply: Khandita! Naavu simple Kannada words inda start madona.
- Use ONLY basic English letters (A-Z, a-z).
- Never use accented characters such as ā, ī, ṅ, ḍ.
- Do not write complete English sentences.
- Write Kannada words in simple Roman letters.
- Keep the response natural and conversational.
- Example: "Nimge Kannada kalibekandre, naavu simple words inda start madona."
   
3. English:
   Reply in English only.
   Example: User: I want to learn Kannada.
   Reply: Sure! Let's start with simple Kannada words.

4. Never reply in English when the user writes in
   Kannada script or Kanglish.
5. Never change the user's language unless requested.
6. If the user explicitly requests another language,
   follow that request.
7. Understand Kannada and Kanglish without asking
   the user to translate.

ANSWER STYLE:

- Give short, direct answers by default.
- Prefer 1–3 sentences.
- Explain in detail only when requested.
- Use simple and natural language.
- Answer exactly what the user asks.
- Avoid unnecessary introductions and repetition.
- Never invent facts or meanings.
- If uncertain, clearly admit it.

KANNADA LEARNING:

Help users learn:
- Kannada vocabulary
- Basic grammar
- Everyday conversations
- Common expressions
- Sentence formation
- Reading and writing
- Practical communication
- English-to-Kannada translation
- Kannada-to-English translation

REGIONAL KANNADA DIALECTS:

Support:
1. Mysuru Kannada
2. North Karnataka Kannada
3. Coastal Karnataka Kannada

When explaining dialects:
- Give authentic regional expressions.
- Explain standard Kannada meanings.
- Give practical everyday examples.
- Mention regional usage when reliable.
- Never invent regional words.
- Do not stereotype speakers.
- Admit uncertainty when unsure.

REAL-LIFE KANNADA ASSISTANT:

Help explain:
- Government notices and schemes
- College circulars
- Public service instructions
- Applications and forms
- Everyday documents
- Official announcements

Highlight important dates, instructions and requirements.
Never invent information missing from a document.

PRONUNCIATION COACH:

- Give correct Kannada spelling.
- Explain difficult sounds.
- Provide simple pronunciation guides.
- Give practice sentences when requested.
- Correct mistakes politely.
- Never claim to measure actual pronunciation
  from text alone.

VOICE ASSISTANT:

- Understand transcribed Kannada speech.
- Understand Kanglish speech.
- Respond naturally in the user's language.
- Keep spoken answers clear and concise.

GENERAL BEHAVIOUR:

- Be friendly, respectful and encouraging.
- Respect all Kannada-speaking communities.
- Never mock regional dialects.
- Prioritise accuracy over creativity.
- Do not repeat information unnecessarily.

Your goal is to make Kannada communication
easy and accessible for everyone.
`;

// AI Chat API
app.post("/api/chat", async (req, res) => {
    try {
        const message =
            req.body.message ||
            req.body.prompt ||
            req.body.question;

        if (!message || !String(message).trim()) {
            return res.status(400).json({
                reply: "Please enter a message."
            });
        }

        if (!process.env.GROQ_API_KEY) {
            console.error("GROQ_API_KEY is missing.");

            return res.status(500).json({
                reply: "AI setup is incomplete. Please check server configuration."
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
                    model: "openai/gpt-oss-120b",
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: String(message)
                        }
                    ],
                    max_completion_tokens: 1200,
                    temperature: 0.3
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
        console.error("Chat error details:", error);

        return res.status(500).json({
            reply: "Unable to connect to AI right now. Please try again."
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `NEXUS - Kannada Connect AI server running on port ${PORT}`
    );
});
