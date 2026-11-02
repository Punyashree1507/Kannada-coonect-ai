
const defaultProgress = {
    points: 0,
    completedChallenges: [],
    completedQuizzes: [],
    learnedLessons: []
};

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
                completedChallenges: Array.isArray(saved.completedChallenges) ? saved.completedChallenges : [],
                completedQuizzes: Array.isArray(saved.completedQuizzes) ? saved.completedQuizzes : [],
                learnedLessons: Array.isArray(saved.learnedLessons) ? saved.learnedLessons : []
            };
        }
    } catch (error) {
        console.error("Progress error:", error);
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

    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const chatMessages = document.getElementById("chat-messages");

    const voiceButton = document.getElementById("voice-button");
    const voiceStatus = document.getElementById("voice-status");
    const speakButton = document.getElementById("speak-answer");

    const dialectSelect = document.getElementById("dialect-select");
    const voiceLanguage = document.getElementById("voice-language");

    function addChatMessage(message, type) {
        if (!chatMessages) return;

        const div = document.createElement("div");
        div.className = "message " + type;
        div.textContent = message;

        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function cleanReply(reply) {
        return String(reply || "")
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/^#{1,6}\s*/gm, "")
            .trim();
    }

    function speakKannada(text) {
        if (!text || !window.speechSynthesis) {
            if (voiceStatus) {
                voiceStatus.textContent = "Voice output unavailable.";
            }
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = voiceLanguage ? voiceLanguage.value : "kn-IN";
        utterance.rate = 0.85;

        utterance.onstart = function () {
            if (voiceStatus) voiceStatus.textContent = "AI is speaking 🔊";
        };

        utterance.onerror = function () {
            if (voiceStatus) voiceStatus.textContent = "Voice unavailable.";
        };

        window.speechSynthesis.speak(utterance);
    }

    window.speakAIKannada = speakKannada;

    async function sendMessage(message, mode = "chat") {
        const response = await fetch(API_BASE_URL + "/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: message,
                dialect: dialectSelect ? dialectSelect.value : "standard",
                mode: mode
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.reply || data.error || "AI request failed.");
        }

        const reply = cleanReply(data.reply);

        if (!reply) {
            throw new Error("AI returned an empty reply.");
        }

        addChatMessage(reply, "bot-message");

        latestKannadaAnswer = reply;

        if (speakButton) {
            speakButton.disabled = false;
        }

        if (speakAfterAIReply) {
            speakAfterAIReply = false;
            speakKannada(latestKannadaAnswer);
        }

        return reply;
    }

    // CHAT
    if (chatForm && chatInput) {
        chatForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const message = chatInput.value.trim();
            if (!message) return;

            addChatMessage(message, "user-message");
            chatInput.value = "";

            const sendButton = chatForm.querySelector('button[type="submit"]');

            if (sendButton) {
                sendButton.disabled = true;
                sendButton.textContent = "Thinking...";
            }

            try {
                await sendMessage(message);

                if (voiceStatus) {
                    voiceStatus.textContent = "AI replied successfully 💜";
                }

            } catch (error) {
                console.error("Chat error:", error);

                speakAfterAIReply = false;

                addChatMessage(
                    "Sorry! NEXUS could not connect. Please check your server and internet connection.",
                    "bot-message"
                );

                if (voiceStatus) {
                    voiceStatus.textContent = "AI connection failed.";
                }

            } finally {
                if (sendButton) {
                    sendButton.disabled = false;
                    sendButton.textContent = "Send ➤";
                }
            }
        });
    }

    // VOICE INPUT
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (voiceButton) {
        if (!SpeechRecognition) {
            voiceButton.disabled = true;

            if (voiceStatus) {
                voiceStatus.textContent = "Use Chrome or Edge for voice input.";
            }
        } else {
            const recognition = new SpeechRecognition();

            recognition.continuous = false;
            recognition.interimResults = false;

            voiceButton.addEventListener("click", function () {
                recognition.lang = voiceLanguage ? voiceLanguage.value : "kn-IN";

                try {
                    speakAfterAIReply = true;
                    voiceButton.disabled = true;

                    if (voiceStatus) {
                        voiceStatus.textContent = "Listening... 🎤";
                    }

                    recognition.start();
                } catch (error) {
                    voiceButton.disabled = false;
                    speakAfterAIReply = false;
                }
            });

            recognition.onresult = function (event) {
                const question = event.results[0][0].transcript;

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
                    voiceStatus.textContent = "Microphone error: " + event.error;
                }
            };

            recognition.onend = function () {
                voiceButton.disabled = false;
            };
        }
    }

    // LISTEN TO AI
    if (speakButton) {
        speakButton.addEventListener("click", function () {
            speakKannada(latestKannadaAnswer);
        });
    }

    // PRONUNCIATION PRACTICE
    const pronunciationButton =
        document.getElementById("pronunciation-button");

    if (pronunciationButton) {
        pronunciationButton.addEventListener("click", async function () {
            const prompt =
                "Teach me one simple Kannada sentence. Give its meaning and pronunciation guide, then ask me to repeat it.";

            pronunciationButton.disabled = true;

            try {
                addChatMessage("Let's practise Kannada! 🎯", "user-message");
                await sendMessage(prompt, "pronunciation");
            } catch (error) {
                console.error(error);
                addChatMessage("Could not start practice. Try again.", "bot-message");
            } finally {
                pronunciationButton.disabled = false;
            }
        });
    }

    // DOCUMENT ASSISTANT
    const documentUpload = document.getElementById("document-upload");
    const documentButton = document.getElementById("document-button");
    const documentStatus = document.getElementById("document-status");

    if (documentButton && documentUpload) {
        documentButton.addEventListener("click", async function () {
            const file = documentUpload.files[0];

            if (!file) {
                showMessage(documentStatus, "Please select a PDF or DOCX file.");
                return;
            }

            const extension = file.name.split(".").pop().toLowerCase();

            if (!["pdf", "docx"].includes(extension)) {
                showMessage(documentStatus, "Only PDF and DOCX are supported.");
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showMessage(documentStatus, "Maximum file size is 5 MB.");
                return;
            }

            const formData = new FormData();
            formData.append("document", file);
            formData.append("message", "Explain this document in simple language and summarise its important points.");
            formData.append("dialect", dialectSelect ? dialectSelect.value : "standard");

            documentButton.disabled = true;
            documentButton.textContent = "Analysing...";

            showMessage(documentStatus, "Uploading your document... 📄");

            try {
                const response = await fetch(API_BASE_URL + "/api/document", {
                    method: "POST",
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.reply || data.error || "Document processing failed.");
                }

                const reply = cleanReply(data.reply);

                addChatMessage("Document: " + file.name, "user-message");
                addChatMessage(reply, "bot-message");

                latestKannadaAnswer = reply;

                if (speakButton) speakButton.disabled = false;

                showMessage(documentStatus, "Document analysed successfully! 💜");

            } catch (error) {
                console.error("Document error:", error);
                showMessage(documentStatus, "Error: " + error.message);
            } finally {
                documentButton.disabled = false;
                documentButton.textContent = "Explain My Document";
            }
        });
    }

    // QUIZ
    const quizForm = document.getElementById("quiz-form");
    const quizResult = document.getElementById("quiz-result");

    if (quizForm) {
        quizForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const questions = quizForm.querySelectorAll(".question-card[data-answer]");
            let score = 0;
            let answered = 0;

            questions.forEach(function (question) {
                const selected = question.querySelector('input[type="radio"]:checked');

                if (selected) {
                    answered++;

                    if (selected.value === question.dataset.answer) {
                        score++;
                    }
                }
            });

            if (!questions.length) {
                showMessage(quizResult, "No quiz questions found.");
                return;
            }

            if (answered < questions.length) {
                showMessage(quizResult, "Please answer all questions.");
                return;
            }

            const progress = getProgress();
            const quizId = quizForm.dataset.quizId || location.pathname;
            const firstAttempt = !progress.completedQuizzes.includes(quizId);

            if (firstAttempt) {
                progress.completedQuizzes.push(quizId);
                progress.points += score * 5;
                saveProgress(progress);
            }

            const percentage = Math.round((score / questions.length) * 100);

            showMessage(
                quizResult,
                "Your score: " + score + "/" + questions.length +
                " (" + percentage + "%). " +
                (firstAttempt ? "Points earned: " + (score * 5) : "Points already awarded.")
            );

            quizForm.querySelectorAll('input[type="radio"]').forEach(function (input) {
                input.disabled = true;
            });

            const button = quizForm.querySelector('button[type="submit"]');
            if (button) button.disabled = true;
        });
    }

    // DAILY CHALLENGE
    const challengeButton = document.getElementById("complete-challenge");
    const challengeResult = document.getElementById("challenge-result");

    if (challengeButton) {
        const challengeId = challengeButton.dataset.challengeId ||
            new Date().toISOString().slice(0, 10);

        if (getProgress().completedChallenges.includes(challengeId)) {
            challengeButton.disabled = true;
            challengeButton.textContent = "Challenge Completed ✓";
            showMessage(challengeResult, "Challenge already completed! 🎉");
        }

        challengeButton.addEventListener("click", function () {
            const progress = getProgress();

            if (progress.completedChallenges.includes(challengeId)) return;

            progress.completedChallenges.push(challengeId);
            progress.points += 10;
            saveProgress(progress);

            challengeButton.disabled = true;
            challengeButton.textContent = "Challenge Completed ✓";

            showMessage(challengeResult, "You earned 10 points! 🏆");
        });
    }

    // LESSON COMPLETION
    document.querySelectorAll("[data-lesson-id]").forEach(function (lesson) {
        const lessonId = lesson.dataset.lessonId;
        const button = lesson.querySelector(".complete-lesson");

        if (!button) return;

        if (getProgress().learnedLessons.includes(lessonId)) {
            button.disabled = true;
            button.textContent = "Lesson Completed ✓";
        }

        button.addEventListener("click", function () {
            const progress = getProgress();

            if (progress.learnedLessons.includes(lessonId)) return;

            progress.learnedLessons.push(lessonId);
            progress.points += 5;
            saveProgress(progress);

            button.disabled = true;
            button.textContent = "Lesson Completed ✓";
        });
    });

    // PROGRESS DASHBOARD
    const pointsDisplay = document.getElementById("total-points");
    const challengeDisplay = document.getElementById("completed-challenges");
    const quizDisplay = document.getElementById("completed-quizzes");
    const lessonDisplay = document.getElementById("completed-lessons");
    const progressFill = document.getElementById("progress-fill");

    function updateProgressDashboard() {
        const progress = getProgress();

        if (pointsDisplay) pointsDisplay.textContent = progress.points;
        if (challengeDisplay) challengeDisplay.textContent = progress.completedChallenges.length;
        if (quizDisplay) quizDisplay.textContent = progress.completedQuizzes.length;
        if (lessonDisplay) lessonDisplay.textContent = progress.learnedLessons.length;

        if (progressFill) {
            progressFill.style.width = Math.min(progress.points, 100) + "%";
        }
    }

    updateProgressDashboard();
});
