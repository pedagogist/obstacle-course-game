addEventListener("message", ({ data: buffer }) => {
	const nChannels = buffer.numberOfChannels;
	const sampleRate = buffer.sampleRate;
	const length = buffer.length * nChannels * 2 + 44;
	const bufferArray = new ArrayBuffer(length);
	const view = new DataView(bufferArray);
	const channels = [];
	let pos = 0;

	function setUint16(data) {
		view.setUint16(pos, data, true);
		pos += 2;
	}

	function setUint32(data) {
		view.setUint32(pos, data, true);
		pos += 4;
	}

	setUint32(0x46464952); // "RIFF"
	setUint32(length - 8); // file length - 8
	setUint32(0x45564157); // "WAVE"

	setUint32(0x20746d66); // "fmt " chunk
	setUint32(16); // length = 16
	setUint16(1); // PCM (uncompressed)
	setUint16(nChannels);
	setUint32(sampleRate);
	setUint32(sampleRate * 2 * nChannels); // avg. bytes/sec
	setUint16(nChannels * 2); // block-align
	setUint16(16); // 16-bit (hardcoded in this demo)

	setUint32(0x61746164); // "data" - chunk
	setUint32(length - pos - 4); // chunk length

	for (let i = 0; i < nChannels; i++) {
		channels.push(buffer.getChannelData(i));
	}

	for (let i = 0; i < buffer.length; i++) {
		for (let j = 0; j < nChannels; j++) {
			const sample = Math.max(-1, Math.min(1, channels[j][i]));
			view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
			pos += 2;
		}
	}

	postMessage(new Blob([view], { type: "audio/wav" }));
});
