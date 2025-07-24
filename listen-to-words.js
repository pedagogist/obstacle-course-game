// Use API key from URL query if available
const googleCloudApiKey = new URLSearchParams(location.search).get("apiKey");
const speechRecognitionApiUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${googleCloudApiKey}`;

let audioInputStream;

const speakingThreshold = -15;
const silenceThreshold = -20;
const silenceDuration = 0.5;

export default async function listenToWords(words, abortSignal) {
	// Check if we should use the browser's Speech Recognition API
	if (googleCloudApiKey) {
		audioInputStream ||= await navigator.mediaDevices.getUserMedia({
			audio: { channelCount: 1, sampleRate: 16000, sampleSize: 16 },
		});
		return useGoogleCloudSpeechRecognition(words, abortSignal);
	} else if (window.SpeechRecognition || window.webkitSpeechRecognition) {
		return useBrowserSpeechRecognition(words, abortSignal);
	} else {
		alert("Your browser does not support speech recognition. ");
		return Promise.reject(new Error("Speech Recognition API is not supported in this browser"));
	}
}

function useBrowserSpeechRecognition(words, abortSignal) {
	const { promise, resolve, reject } = Promise.withResolvers();
	const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
	const recognition = new SpeechRecognition();
	recognition.lang = "en-GB";
	// These lines help produce instant and more fuzzy results for higher possibility of matching words
	recognition.continuous = true;
	recognition.interimResults = true;
	recognition.maxAlternatives = 5;

	if (words?.length) {
		// Some browsers may support grammar lists in the future for better accuracy
		const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
		if (SpeechGrammarList) {
			const grammarList = new SpeechGrammarList();
			grammarList.addFromString(`#JSGF V1.0; grammar words; public <word> = ${words.join(" | ")} ;`, 1);
			recognition.grammars = grammarList;
		} else {
			console.warn("SpeechGrammarList is not supported");
		}
	}

	// Handle abort signal
	if (abortSignal) {
		abortSignal.addEventListener("abort", () => {
			recognition.stop();
			reject(new DOMException("Speech recognition was aborted", "AbortError"));
		});
	}

	recognition.addEventListener("result", event => {
		for (const result of event.results) {
			for (const alternative of result) {
				// Remove punctuation and symbols except apostrophes, only keep letters, marks and numbers
				for (const word of alternative.transcript.toLowerCase().split(/[[^\p{L}\p{M}\p{N}]--']+/v)) {
					if (words.includes(word)) {
						resolve(word);
						recognition.stop();
					}
				}
			}
		}
	});

	recognition.addEventListener("error", event => {
		reject(new Error(`Speech recognition error: ${event.error}`));
	});

	recognition.addEventListener("end", () => {
		resolve(null);
	});

	recognition.start();

	return promise;
}

function useGoogleCloudSpeechRecognition(words, abortSignal) {
	const audioContext = new AudioContext();
	const source = audioContext.createMediaStreamSource(audioInputStream);
	const analyser = audioContext.createAnalyser();
	source.connect(analyser);
	analyser.fftSize = 2048;
	const dataArray = new Uint8Array(analyser.fftSize);

	const { promise, resolve, reject } = Promise.withResolvers();
	const mediaRecorder = new MediaRecorder(audioInputStream);
	mediaRecorder.addEventListener("dataavailable", async event => {
		const trimmedAudioBlob = await trimAudio(audioContext, event.data, speakingStartTime, speakingEndTime);
		const audioBase64 = await blobToBase64(trimmedAudioBlob);
		const transcript = await sendToSpeechToTextAPI(audioBase64, words);
		resolve(transcript);
		cancelAnimationFrame(monitorVolume);
		audioContext.close();
	});
	mediaRecorder.addEventListener("error", reject);

	// Handle abort signal
	if (abortSignal) {
		abortSignal.addEventListener("abort", () => {
			mediaRecorder.stop();
			cancelAnimationFrame(monitorVolume);
			audioContext.close();
			clearTimeout(silenceTimeout);
			reject(new DOMException("Speech recognition was aborted", "AbortError"));
		});
	}

	mediaRecorder.start();
	requestAnimationFrame(monitorVolume);

	let silenceTimeout;
	let speakingStartTime;
	let speakingEndTime;
	function monitorVolume() {
		analyser.getByteTimeDomainData(dataArray);
		let sum = 0;
		for (let i = 0; i < dataArray.length; i++) {
			const sample = dataArray[i] / 128 - 1;
			sum += sample * sample;
		}
		const volume = 10 * Math.log10(sum / dataArray.length);

		if (speakingStartTime) {
			if (volume < silenceThreshold) {
				silenceTimeout ||= setTimeout(() => {
					speakingEndTime = audioContext.currentTime;
					mediaRecorder.stop();
				}, silenceDuration * 1000);
			} else {
				clearTimeout(silenceTimeout);
				silenceTimeout = null;
			}
		} else if (volume >= speakingThreshold) {
			speakingStartTime = Math.max(0, audioContext.currentTime - silenceDuration);
		}

		requestAnimationFrame(monitorVolume);
	}

	return promise;
}

function blobToBase64(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.addEventListener("loadend", () => resolve(reader.result.split(",")[1]));
		reader.addEventListener("error", reject);
		reader.readAsDataURL(blob);
	});
}

async function sendToSpeechToTextAPI(audioBase64, words) {
	const requestBody = {
		config: {
			encoding: "LINEAR16",
			sampleRateHertz: 16000,
			languageCode: "en-GB", // en-HK does not support model adaptation
			model: "latest_short",
			adaptation: {
				abnf_grammar: {
					abnf_strings: [`$words = ${words.join(" | ")} ;`]
				}
			},
		},
		audio: {
			content: audioBase64,
		},
	};

	const response = await fetch(speechRecognitionApiUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(requestBody),
	});

	const data = await response.json();
	return data?.results[0]?.alternatives[0]?.transcript;
}

async function trimAudio(audioContext, blob, startTime, endTime) {
	const arrayBuffer = await blob.arrayBuffer();
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
	const nChannels = audioBuffer.numberOfChannels;
	const sampleRate = audioBuffer.sampleRate;
	const trimmedLength = Math.floor((endTime - startTime) * sampleRate);
	const trimmedBuffer = audioContext.createBuffer(nChannels, trimmedLength, sampleRate);

	for (let i = 0; i < nChannels; i++) {
		const channelData = audioBuffer.getChannelData(i);
		trimmedBuffer.copyToChannel(channelData.subarray(audioBuffer.length - trimmedLength, i));
	}

	return bufferToWave(trimmedBuffer);
}

const worker = new Worker("./buffer-to-wave.js");
function bufferToWave(buffer) {
	return new Promise(resolve => {
		worker.addEventListener("message", ({ data }) => resolve(data), { once: true });
		worker.postMessage(buffer);
	});
}
