
const startButton = document.getElementById("voice-start-button");
const stopButton = document.getElementById("voice-stop-button");
const statusText = document.getElementById("voice-status");
const voiceCircle = document.getElementById("voice-circle");
const messages = document.getElementById("chat-messages");
const dialectSelect = document.getElementById("dialect-select");

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition;
let voiceActive = false;
let isSpeaking = false;
let isListening = false;

const API_BASE_URL =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
        ? "http://localhost:3000"
        : "https://kannada-coonect-ai.onrender.com";

if (!SpeechRecognition) {
    statusText.textContent =
        "Voice recognition is not supported. Please use Google Chrome.";
    startButton.disabled = true;
} else {
    recognition = new SpeechRecognition();

    recognition.lang = "kn-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        isListening = true;
        statusText.textContent = "🎧 Listening... Speak now!";
        voiceCircle.classList.add("listening");
    };

    recognition.onresult = async (event) => {
        const transcript =
            event.results[event.results.length - 1][0].transcript.trim();

        if (transcript) {
            await sendVoiceMessage(transcript);
        }
    };

    recognition.onerror = (event) => {
        console.error("Voice recognition error:", event.error);

        if (event.error === "not-allowed") {
            statusText.textContent =
                "Microphone permission denied. Allow microphone access.";
            voiceActive = false;
        } else if (event.error === "no-speech") {
            statusText.textContent = "I didn't hear anything. Listening again...";
        } else {
            statusText.textContent = "Voice error: " + event.error;
        }
    };

    recognition.onend = () => {
        isListening = false;
        voiceCircle.classList.remove("listening");

        if (voiceActive && !isSpeaking) {
            setTimeout(startListening, 500);
        }
    };
}

function addVoiceMessage(text, type) {
    const message = document.createElement("div");

    message.className =
        type === "user" ? "message user-message" : "message bot-message";

    message.textContent = text;
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
}

async function sendVoiceMessage(message) {
    addVoiceMessage(message, "user");

    statusText.textContent = "🤖 NEXUS is thinking...";
    voiceCircle.classList.remove("listening");

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: message,
                dialect: dialectSelect ? dialectSelect.value : "standard",
                mode: "voice"
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to get a response.");
        }

        const reply = data.reply || data.response || data.message;

        if (!reply) {
            throw new Error("NEXUS returned an empty response.");
        }

        addVoiceMessage(reply, "bot");
        speakReply(reply);

    } catch (error) {
        console.error(error);
        statusText.textContent = "Sorry! Something went wrong.";
        addVoiceMessage("Sorry! I couldn't connect. Please try again.", "bot");

        if (voiceActive) {
            setTimeout(startListening, 1500);
        }
    }
}

function speakReply(text) {
    if (!("speechSynthesis" in window)) {
        statusText.textContent =
            "Speech output is not supported on this browser.";
        startListening();
        return;
    }

    isSpeaking = true;
    statusText.textContent = "🔊 NEXUS is speaking...";

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    // Kannada output voice, when available
    const voices = window.speechSynthesis.getVoices();

    const kannadaVoice = voices.find(voice =>
        voice.lang.toLowerCase().startsWith("kn")
    );

    const englishVoice = voices.find(voice =>
        voice.lang.toLowerCase().startsWith("en-in")
    );

    const containsKannada = /[\u0C80-\u0CFF]/.test(text);

    if (containsKannada && kannadaVoice) {
        speech.voice = kannadaVoice;
        speech.lang = "kn-IN";
    } else if (englishVoice) {
        speech.voice = englishVoice;
        speech.lang = "en-IN";
    } else {
        speech.lang = containsKannada ? "kn-IN" : "en-IN";
    }

    speech.rate = 1;
    speech.pitch = 1;

    speech.onend = () => {
        isSpeaking = false;

        if (voiceActive) {
            statusText.textContent = "🎧 Your turn! I'm listening...";
            startListening();
        } else {
            statusText.textContent = "Voice session ended.";
        }
    };

    speech.onerror = () => {
        isSpeaking = false;

        if (voiceActive) {
            startListening();
        }
    };

    window.speechSynthesis.speak(speech);
}

function startListening() {
    if (!voiceActive || isListening || isSpeaking || !recognition) {
        return;
    }

    try {
        recognition.start();
    } catch (error) {
        console.log("Recognition already running:", error);
    }
}

startButton.addEventListener("click", () => {
    if (!recognition) return;

    voiceActive = true;
    isSpeaking = false;

    startButton.disabled = true;
    stopButton.disabled = false;

    statusText.textContent = "Starting NEXUS Voice Assistant...";

    startListening();
});

stopButton.addEventListener("click", () => {
    voiceActive = false;
    isSpeaking = false;

    if (recognition && isListening) {
        recognition.stop();
    }

    window.speechSynthesis.cancel();

    startButton.disabled = false;
    stopButton.disabled = true;

    voiceCircle.classList.remove("listening");
    statusText.textContent = "Voice session ended. Tap Start Voice to restart.";
});
