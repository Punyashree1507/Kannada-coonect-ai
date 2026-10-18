const defaultProgress = {
    points: 0,
    completedChallenges: [],
    completedQuizzes: [],
    learnedLessons: []
};

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
    const voiceButton = document.getElementById("voice-button");
    const voiceStatus = document.getElementById("voice-status");
    const speakAnswerButton = document.getElementById("speak-answer");

    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    function speakKannada(text) {
        if (!text || !("speechSynthesis" in window)) {
            voiceStatus.textContent = "Voice output is not supported.";
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "kn-IN";
        utterance.rate = 0.85;

        utterance.onstart = function () {
            voiceStatus.textContent = "AI is speaking in Kannada 🔊";
        };

        utterance.onend = function () {
            voiceStatus.textContent = "Done! Ask another question 🎉";
        };

        utterance.onerror = function () {
            voiceStatus.textContent =
                "Kannada voice unavailable. Check your device's speech voices.";
        };

        window.speechSynthesis.speak(utterance);
    }

    if (!voiceButton) return;

    if (!SpeechRecognition) {
        voiceButton.disabled = true;
        voiceStatus.textContent =
            "Voice recognition is unavailable. Try Chrome or Edge.";
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    voiceButton.addEventListener("click", function () {
        try {
            speakAfterAIReply = true;
            voiceButton.disabled = true;
            voiceStatus.textContent = "Listening... Speak in English 🎤";
            recognition.start();
        } catch (error) {
            voiceButton.disabled = false;
            voiceStatus.textContent =
                "Please wait a moment and try the microphone again.";
        }
    });

    recognition.onresult = function (event) {
        const question = event.results[0][0].transcript;
        const chatInput = document.getElementById("chat-input");
        const chatForm = document.getElementById("chat-form");

        voiceStatus.textContent = "You said: " + question;

        if (chatInput && chatForm) {
            chatInput.value = question;
            chatForm.requestSubmit();
        }
    };

    recognition.onerror = function (event) {
        speakAfterAIReply = false;
        voiceStatus.textContent =
            "Microphone error: " + event.error +
            ". Check microphone permission.";
    };

    recognition.onend = function () {
        voiceButton.disabled = false;
    };

    if (speakAnswerButton) {
        speakAnswerButton.addEventListener("click", function () {
            if (!latestKannadaAnswer) {
                voiceStatus.textContent =
                    "First ask a question using the microphone.";
                return;
            }

            speakKannada(latestKannadaAnswer);
        });
    }

    window.speakAIKannada = speakKannada;
});
document.addEventListener("DOMContentLoaded", function () {

    // CHATBOT
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const chatMessages = document.getElementById("chat-messages");

    function addChatMessage(message, type) {
        if (!chatMessages) return;

        const div = document.createElement("div");
        div.className = "message " + type;
        div.textContent = message;

        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }


    // AI CHATBOT
    if (chatForm && chatInput && chatMessages) {
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
                console.log("Sending message to AI server...");
                const response = await fetch("http://localhost:3000/api/chat", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        message: message
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.reply || "AI request failed");
                }
                const cleanReply = data.reply
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^#+\s*/gm, "");


addChatMessage(cleanReply, "bot-message");

// Save the Kannada answer for voice output
const lines = cleanReply.split("\n");
const kannadaLine = lines.find(line => /[\u0C80-\u0CFF]/.test(line));

if (kannadaLine) {
    const match = kannadaLine.match(
        /[\u0C80-\u0CFF][\u0C80-\u0CFF\s.,!?।-]*/
    );

    latestKannadaAnswer = match ? match[0].trim() : kannadaLine.trim();
} else {
    latestKannadaAnswer = cleanReply;
}

const speakButton = document.getElementById("speak-answer");

if (speakButton) {
    speakButton.disabled = !latestKannadaAnswer;
}

if (speakAfterAIReply && latestKannadaAnswer) {
    speakAfterAIReply = false;

    if (window.speakAIKannada) {
        window.speakAIKannada(latestKannadaAnswer);
    }
}


            } catch (error) {
                console.error("AI Chat Error:", error);

                addChatMessage(
                    "Sorry bro! AI connect ಆಗಿಲ್ಲ. Server running ಇದೆಯಾ ಅಂತ check ಮಾಡು.",
                    "bot-message"
                );
            } finally {
                if (sendButton) {
                    sendButton.disabled = false;
                    sendButton.textContent = "Send ➤";
                }
            }
        });
    }


    // PRACTICE QUIZ
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

            if (questions.length === 0) {
                showMessage(quizResult, "No quiz questions found.");
                return;
            }

            if (answered < questions.length) {
                showMessage(quizResult, "Please answer all questions before submitting.");
                return;
            }

            const progress = getProgress();
            const quizId = quizForm.dataset.quizId || location.pathname;

            if (!progress.completedQuizzes.includes(quizId)) {
                progress.completedQuizzes.push(quizId);
                progress.points += score * 5;
                saveProgress(progress);
            }

            const percentage = Math.round((score / questions.length) * 100);

            showMessage(
                quizResult,
                "Your score: " + score + "/" + questions.length +
                " (" + percentage + "%). " +
                (score === questions.length ? "Excellent work! 🎉" : "Good effort! Keep practising! 💪") +
                " You earned " + score * 5 +
                " points on your first attempt, if not already completed."
            );

            quizForm.querySelectorAll('input[type="radio"]').forEach(function (input) {
                input.disabled = true;
            });

            const submitButton = quizForm.querySelector('button[type="submit"]');

            if (submitButton) {
                submitButton.disabled = true;
            }
        });
    }

    // DAILY CHALLENGE
    const challengeButton = document.getElementById("complete-challenge");
    const challengeResult = document.getElementById("challenge-result");

    if (challengeButton) {
        const challengeId = challengeButton.dataset.challengeId ||
            new Date().toISOString().slice(0, 10);

        const progress = getProgress();

        if (progress.completedChallenges.includes(challengeId)) {
            challengeButton.disabled = true;
            challengeButton.textContent = "Challenge Completed ✓";

            showMessage(
                challengeResult,
                "You have already completed today's challenge! 🎉"
            );
        }

        challengeButton.addEventListener("click", function () {
            const currentProgress = getProgress();

            if (currentProgress.completedChallenges.includes(challengeId)) {
                showMessage(challengeResult, "Challenge already completed!");
                return;
            }

            currentProgress.completedChallenges.push(challengeId);
            currentProgress.points += 10;

            saveProgress(currentProgress);

            challengeButton.disabled = true;
            challengeButton.textContent = "Challenge Completed ✓";

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
    const pointsDisplay = document.getElementById("total-points");
    const challengeDisplay = document.getElementById("completed-challenges");
    const quizDisplay = document.getElementById("completed-quizzes");
    const lessonDisplay = document.getElementById("completed-lessons");
    const progressFill = document.getElementById("progress-fill");

    function updateProgressDashboard() {
        const progress = getProgress();

        if (pointsDisplay) {
            pointsDisplay.textContent = progress.points;
        }

        if (challengeDisplay) {
            challengeDisplay.textContent = progress.completedChallenges.length;
        }

        if (quizDisplay) {
            quizDisplay.textContent = progress.completedQuizzes.length;
        }

        if (lessonDisplay) {
            lessonDisplay.textContent = progress.learnedLessons.length;
        }

        if (progressFill) {
            const percentage = Math.min(progress.points, 100);
            progressFill.style.width = percentage + "%";
        }
    }
    updateProgressDashboard();

});