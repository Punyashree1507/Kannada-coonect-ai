
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve all frontend files from the main project folder
app.use(express.static(__dirname));

// File upload configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// NEXUS AI system instructions
const SYSTEM_PROMPT = `
You are NEXUS, a friendly AI assistant for Kannada Connect AI.

Your responsibilities:
1. Understand Kannada, Kanglish and English.
2. Reply in the same language the user uses.
3. If the user writes in Kanglish, reply in natural Kanglish.
4. If the user writes in Kannada, reply in Kannada.
5. If the user writes in English, reply in simple English.
6. Help users learn Kannada vocabulary, grammar and pronunciation.
7. Support Mysuru, North Karnataka and Coastal Kannada dialects.
8. Keep answers clear, friendly and easy to understand.
9. Explain difficult concepts step by step.
10. Be helpful and conversational.

Do not unnecessarily switch languages.
`;

// Ask Groq AI
async function askNexus(message, dialect = "standard", mode = "chat") {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        throw new Error("GROQ_API_KEY is missing from your .env file.");
    }

    const dialectInstructions = {
        standard: "Use Standard Kannada when Kannada is appropriate.",
        mysuru: "Use natural Mysuru Kannada when Kannada is appropriate.",
        north: "Use North Karnataka Kannada when Kannada is appropriate.",
        coastal: "Use Coastal Karnataka Kannada when Kannada is appropriate."
    };

    const selectedDialect =
        dialectInstructions[dialect] || dialectInstructions.standard;

    const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-120b",
                messages: [
                    {
                        role: "system",
                        content: SYSTEM_PROMPT + "\n" + selectedDialect
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                temperature: 0.7,
                max_completion_tokens: 1500
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error("Groq API error:", data);
        throw new Error(
            data.error?.message || "AI service request failed."
        );
    }

    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
        throw new Error("No reply received from AI.");
    }

    return reply;
}

// Home route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "NEXUS server is running!"
    });
});

// Chat API
app.post("/api/chat", async (req, res) => {
    try {
        const { message, dialect = "standard", mode = "chat" } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                error: "Please enter a message."
            });
        }

        const reply = await askNexus(message, dialect, mode);

        res.json({
            success: true,
            reply: reply
        });

    } catch (error) {
        console.error("Chat error:", error);

        res.status(500).json({
            error: error.message || "Unable to get AI response."
        });
    }
});

// Document upload API
app.post("/api/document", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: "Please upload a PDF or DOCX file."
            });
        }

        const fileName = req.file.originalname.toLowerCase();
        let extractedText = "";

        if (fileName.endsWith(".pdf")) {
            const pdfData = await pdfParse(req.file.buffer);
            extractedText = pdfData.text;

        } else if (fileName.endsWith(".docx")) {
            const docData = await mammoth.extractRawText({
                buffer: req.file.buffer
            });
            extractedText = docData.value;

        } else {
            return res.status(400).json({
                error: "Only PDF and DOCX files are supported."
            });
        }

        if (!extractedText.trim()) {
            return res.status(400).json({
                error: "No readable text found in this document."
            });
        }

        const question =
            req.body.question ||
            "Summarize this document in simple language.";

        const prompt = `
        User question: ${question}

        Document content:
        ${extractedText.slice(0, 12000)}
        `;

        const reply = await askNexus(prompt);

        res.json({
            success: true,
            fileName: req.file.originalname,
            reply: reply
        });

    } catch (error) {
        console.error("Document error:", error);

        res.status(500).json({
            error: error.message || "Unable to process the document."
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`NEXUS - Kannada Connect AI server running on port ${PORT}`);
});
