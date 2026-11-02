
const defaultProgress = {
    points: 0,
    completedChallenges: [],
    completedQuizzes: [],
    learnedLessons: []
};

// Local testing uses localhost:3000.
// Deployed website uses the Render backend.
const API_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
        ? "http://localhost:3000"
        : "https://kannada-coonect-ai.onrender.com";

function getProgress() {
    try {
        const saved = JSON.parse(localStorage.getItem("kannadaProgress"));

        if (saved && typeof saved === "object") {
            return {
                ...defaultProgress,
                ...saved,
                completedChallenges: Array.isArray(saved.completedChallenges)
                    ? saved.completedChallenges : [],
                completedQuizzes: Array.isArray(saved.completedQuizzes)
                    ? saved.completedQuizzes : [],
                learnedLessons: Array.isArray(saved.learnedLessons)
                    ? saved.learnedLessons : []
            };
        }
    } catch (error) {
        console.error("Could not load progress:", error);
    }

    return { ...defaultProgress };
}

function saveProgress(progress) {
    localStorage.setItem("kannadaProgress", JSON.stringify(progress));
}

function awardPoints(points) {
    const progress = getProgress();
    progress.points += points;
    saveProgress(progress);
}

function showMessage(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = "block";
    }
}

let latestKannadaAnswer = "";
let speakAfterAIReply = false;

document.addEventListener("DOMContentLoaded", function () {

    // COMMON CHAT ELEMENTS
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const chatMessages = document.getElementById("chat-messages");
    const voiceStatus = document.getElementById("voice-status");
    const dialectSelect = document.getElementById("dialect-select");

    // DISPLAY CHAT MESSAGES
    function addChatMessage(message, type) {
        if (!chatMessages) return;

        const div = document.createElement("div");
        div.className = "message " + type;
        div.textContent = message;

        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // CLEAN AI RESPONSE
    function cleanReply(reply) {
        return String(reply || "")
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/^#{1,6}\s*/gm, "")
            .trim();
    }

    // GET SELECTED DIALECT
    function getSelectedDialect() {
        return dialectSelect ? dialectSelect.value : "standard";
    }

    // SPEECH OUTPUT
    function speakKannada(text) {
        if (!text || !("speechSynthesis" in window)) {
            if (voiceStatus) {
                voiceStatus.textContent =
                    "Voice output is not supported.";
            }
            return;
        }

        window.speechSynthesis.cancel();

        const voiceLanguage =
            document.getElementById("voice-language");

        const language = voiceLanguage
            ? voiceLanguage.value
            : "kn-IN";

        const utterance = new SpeechSynthesisUtterance(text);

        utterance.lang = language;
        utterance.rate = 0.85;

        utterance.onstart = function () {
            if (voiceStatus) {
                voiceStatus.textContent = "AI is speaking 🔊";
            }
        };

        utterance.onend = function () {
            if (voiceStatus) {
                voiceStatus.textContent =
                    "Done! Ask another question 🎉";
            }
        };

        utterance.onerror = function () {
            if (voiceStatus) {
                voiceStatus.textContent =
                    "Voice unavailable. Check your device speech settings.";
            }
        };

        window.speechSynthesis.speak(utterance);
    }

    window.speakAIKannada = speakKannada;

    // CHAT API
    async function sendMessage(message, mode = "chat") {
        const response = await fetch(
            API_BASE_URL + "/api/chat",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: message,
                    dialect: getSelectedDialect(),
                    mode: mode
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.reply || "AI request failed.");
        }

        const reply = cleanReply(data.reply);

        if (!reply) {
            throw new Error("AI returned an empty answer.");
        }

        addChatMessage(reply, "bot-message");

        const lines = reply.split("\n");

        const kannadaLine = lines.find(function (line) {
            return /[\u0C80-\u0CFF]/.test(line);
        });

        latestKannadaAnswer = kannadaLine
            ? kannadaLine.trim()
            : reply;

        const speakButton =
            document.getElementById("speak-answer");

        if (speakButton) {
            speakButton.disabled = false;
        }

        if (speakAfterAIReply) {
            speakAfterAIReply = false;
            speakKannada(latestKannadaAnswer);
        }

        return reply;
    }

    // CHAT FORM
    if (chatForm && chatInput && chatMessages) {
        chatForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const message = chatInput.value.trim();
            if (!message) return;

            addChatMessage(message, "user-message");
            chatInput.value = "";

            const sendButton =
                chatForm.querySelector('button[type="submit"]');

            if (sendButton) {
                sendButton.disabled = true;
                sendButton.textContent = "Thinking...";
            }

            try {
                await sendMessage(message);

                if (voiceStatus) {
                    voiceStatus.textContent =
                        "AI replied successfully 💜";
                }

            } catch (error) {
                console.error("AI Chat Error:", error);

                speakAfterAIReply = false;

                addChatMessage(
                    "Sorry bro! AI connect ಆಗಿಲ್ಲ. Please check your internet and server.",
                    "bot-message"
                );

                if (voiceStatus) {
                    voiceStatus.textContent =
                        "AI connection failed. Please try again.";
                }

            } finally {
                if (sendButton) {
                    sendButton.disabled = false;
                    sendButton.textContent = "Send ➤";
                }
            }
        });
    }

    // VOICE ASSISTANT
    const voiceButton = document.getElementById("voice-button");
    const speakAnswerButton =
        document.getElementById("speak-answer");

    const voiceLanguage =
        document.getElementById("voice-language");

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (voiceButton) {
        if (!SpeechRecognition) {
            voiceButton.disabled = true;

            if (voiceStatus) {
                voiceStatus.textContent =
                    "Voice recognition unavailable. Try Chrome or Edge.";
            }

        } else {
            const recognition = new SpeechRecognition();

            recognition.continuous = false;
            recognition.interimResults = false;

            voiceButton.addEventListener("click", function () {
                try {
                    recognition.lang = voiceLanguage
                        ? voiceLanguage.value
                        : "kn-IN";

                    speakAfterAIReply = true;
                    voiceButton.disabled = true;

                    if (voiceStatus) {
                        voiceStatus.textContent =
                            "Listening... Speak now 🎤";
                    }

                    recognition.start();

                } catch (error) {
                    voiceButton.disabled = false;
                    speakAfterAIReply = false;

                    if (voiceStatus) {
                        voiceStatus.textContent =
                            "Please wait and try again.";
                    }
                }
            });

            recognition.onresult = function (event) {
                const question =
                    event.results[0][0].transcript;

                if (voiceStatus) {
                    voiceStatus.textContent =
                        "You said: " + question;
                }

                if (chatInput && chatForm) {
                    chatInput.value = question;
                    chatForm.requestSubmit();
                } else {
                    speakAfterAIReply = false;
                }
            };

            recognition.onerror = function (event) {
                speakAfterAIReply = false;

                if (voiceStatus) {
                    voiceStatus.textContent =
                        "Microphone error: " + event.error;
                }
            };

            recognition.onend = function () {
                voiceButton.disabled = false;
            };
        }
    }

    // LISTEN TO AI REPLY
    if (speakAnswerButton) {
        speakAnswerButton.addEventListener("click", function () {
            if (!latestKannadaAnswer) {
                if (voiceStatus) {
                    voiceStatus.textContent =
                        "First ask a question and get an AI answer.";
                }
                return;
            }

            speakKannada(latestKannadaAnswer);
        });
    }

    // PRONUNCIATION COACH
    const pronunciationButton =
        document.getElementById("pronunciation-button");

    if (pronunciationButton) {
        pronunciationButton.addEventListener("click", async function () {
            const prompt =
                "Start Kannada pronunciation practice. Give me one simple everyday Kannada sentence, its meaning and a clear pronunciation guide. Then ask me to repeat it. Do not claim to assess my actual pronunciation unless audio analysis is available.";

            pronunciationButton.disabled = true;
            pronunciationButton.textContent = "Preparing practice...";

            try {
                addChatMessage(
                    "Let's practise Kannada pronunciation! 🎯",
                    "user-message"
                );

                await sendMessage(prompt, "pronunciation");

            } catch (error) {
                console.error("Pronunciation Error:", error);

                addChatMessage(
                    "Could not start pronunciation practice. Please try again.",
                    "bot-message"
                );

            } finally {
                pronunciationButton.disabled = false;
                pronunciationButton.textContent =
                    "Start Pronunciation Practice";
            }
        });
    }

    // DOCUMENT ASSISTANT
    const documentUpload =
        document.getElementById("document-upload");

    const documentButton =
        document.getElementById("document-button");

    const documentStatus =
        document.getElementById("document-status");

    if (documentButton && documentUpload) {
        documentButton.addEventListener("click", async function () {
            const file = documentUpload.files[0];

            if (!file) {
                showMessage(
                    documentStatus,
                    "Please select a PDF or DOCX file first."
                );
                return;
            }

            const allowedTypes = [
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ];

            const extension = file.name.split(".").pop().toLowerCase();

            if (
                !allowedTypes.includes(file.type) ||
                !["pdf", "docx"].includes(extension)
            ) {
                showMessage(
                    documentStatus,
                    "Only PDF and DOCX files are supported."
                );
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showMessage(
                    documentStatus,
                    "File size must be 5 MB or less."
                );
                return;
            }

            const formData = new FormData();

            formData.append("document", file);
            formData.append(
                "message",
                "Explain this document in simple language. Summarise the important points and explain difficult terms."
            );
            formData.append("dialect", getSelectedDialect());

            documentButton.disabled = true;
            documentButton.textContent = "Reading document...";

            showMessage(
                documentStatus,
                "Uploading and analysing your document... 📄"
            );

            try {
                const response = await fetch(
                    API_BASE_URL + "/api/document",
                    {
                        method: "POST",
                        body: formData
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.reply || data.error ||
                        "Document processing failed."
                    );
                }

                const reply = cleanReply(data.reply);

                if (!reply) {
                    throw new Error("No explanation received.");
                }

                addChatMessage(
                    "📄 Document: " + file.name,
                    "user-message"
                );

                addChatMessage(reply, "bot-message");

                latestKannadaAnswer = reply;

                const speakButton =
                    document.getElementById("speak-answer");

                if (speakButton) {
                    speakButton.disabled = false;
                }

                showMessage(
                    documentStatus,
                    "Document analysed successfully! 💜"
                );

            } catch (error) {
                console.error("Document Error:", error);

                showMessage(
                    documentStatus,
                    "Document error: " + error.message
                );

            } finally {
                documentButton.disabled = false;
                documentButton.textContent =
                    "Explain My Document";
            }
        });
    }

    // PRACTICE QUIZ
    const quizForm = document.getElementById("quiz-form");
    const quizResult = document.getElementById("quiz-result");

    if (quizForm) {
        quizForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const questions = quizForm.querySelectorAll(
                ".question-card[data-answer]"
            );

            let score = 0;
            let answered = 0;

            questions.forEach(function (question) {
                const selected = question.querySelector(
                    'input[type="radio"]:checked'
                );

                if (selected) {
                    answered++;

                    if (selected.value === question.dataset.answer) {
                        score++;
                    }
                }
            });

            if (questions.length === 0) {
                showMessage(quizResult, "No quiz questions found.");
                return;
            }

            if (answered < questions.length) {
                showMessage(
                    quizResult,
                    "Please answer all questions before submitting."
                );
                return;
            }

            const progress = getProgress();
            const quizId = quizForm.dataset.quizId || location.pathname;

            const isFirstAttempt =
                !progress.completedQuizzes.includes(quizId);

            if (isFirstAttempt) {
                progress.completedQuizzes.push(quizId);
                progress.points += score * 5;
                saveProgress(progress);
            }

            const percentage = Math.round(
                (score / questions.length) * 100
            );

            showMessage(
                quizResult,
                "Your score: " + score + "/" + questions.length +
                " (" + percentage + "%). " +
                (score === questions.length
                    ? "Excellent work! 🎉"
                    : "Good effort! Keep practising! 💪") +
                (isFirstAttempt
                    ? " You earned " + (score * 5) + " points!"
                    : " Points were already awarded for this quiz.")
            );

            quizForm.querySelectorAll('input[type="radio"]').forEach(
                function (input) {
                    input.disabled = true;
                }
            );

            const submitButton =
                quizForm.querySelector('button[type="submit"]');

            if (submitButton) {
                submitButton.disabled = true;
            }
        });
    }

    // DAILY CHALLENGE
    const challengeButton =
        document.getElementById("complete-challenge");

    const challengeResult =
        document.getElementById("challenge-result");

    if (challengeButton) {
        const challengeId =
            challengeButton.dataset.challengeId ||
            new Date().toISOString().slice(0, 10);

        const progress = getProgress();

        if (progress.completedChallenges.includes(challengeId)) {
            challengeButton.disabled = true;
            challengeButton.textContent =
                "Challenge Completed ✓";

            showMessage(
                challengeResult,
                "You have already completed today's challenge! 🎉"
            );
        }

        challengeButton.addEventListener("click", function () {
            const currentProgress = getProgress();

            if (
                currentProgress.completedChallenges.includes(challengeId)
            ) {
                showMessage(
                    challengeResult,
                    "Challenge already completed!"
                );
                return;
            }

            currentProgress.completedChallenges.push(challengeId);
            currentProgress.points += 10;

            saveProgress(currentProgress);

            challengeButton.disabled = true;
            challengeButton.textContent =
                "Challenge Completed ✓";

            showMessage(
                challengeResult,
                "Awesome! You earned 10 points! 🏆"
            );
        });
    }

    // LESSON COMPLETION
    document.querySelectorAll("[data-lesson-id]").forEach(function (lesson) {
        const lessonId = lesson.dataset.lessonId;
        const button = lesson.querySelector(".complete-lesson");

        if (!button) return;

        const progress = getProgress();

        if (progress.learnedLessons.includes(lessonId)) {
            button.disabled = true;
            button.textContent = "Lesson Completed ✓";
        }

        button.addEventListener("click", function () {
            const currentProgress = getProgress();

            if (currentProgress.learnedLessons.includes(lessonId)) {
                return;
            }

            currentProgress.learnedLessons.push(lessonId);
            currentProgress.points += 5;

            saveProgress(currentProgress);

            button.disabled = true;
            button.textContent = "Lesson Completed ✓";
        });
    });

    // PROGRESS DASHBOARD
    const pointsDisplay =
        document.getElementById("total-points");

    const challengeDisplay =
        document.getElementById("completed-challenges");

    const quizDisplay =
        document.getElementById("completed-quizzes");

    const lessonDisplay =
        document.getElementById("completed-lessons");

    const progressFill =
        document.getElementById("progress-fill");

    function updateProgressDashboard() {
        const progress = getProgress();

        if (pointsDisplay) {
            pointsDisplay.textContent = progress.points;
        }

        if (challengeDisplay) {
            challengeDisplay.textContent =
                progress.completedChallenges.length;
        }

        if (quizDisplay) {
            quizDisplay.textContent =
                progress.completedQuizzes.length;
        }

        if (lessonDisplay) {
            lessonDisplay.textContent =
                progress.learnedLessons.length;
        }

        if (progressFill) {
            const percentage = Math.min(progress.points, 100);
            progressFill.style.width = percentage + "%";
        }
    }

    updateProgressDashboard();

});
