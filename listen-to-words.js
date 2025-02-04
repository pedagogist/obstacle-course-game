const googleCloudApiKey = "YOUR_GOOGLE_CLOUD_API_KEY";
const speechRecognitionApiUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${googleCloudApiKey}`;

const audioInputStream = await navigator.mediaDevices.getUserMedia({
	audio: { channelCount: 1, sampleRate: 16000, sampleSize: 16 },
});

const speakingThreshold = -15;
const silenceThreshold = -20;
const silenceDuration = 0.5;

export default function listenToWords(words) {
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
