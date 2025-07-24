// Import game data and speech recognition functionality
import example from "./data/example.json" with { type: "json" };
import listenToWords from "./listen-to-words.js";

// Game configuration constants
const sectionDepth = 120;
const slowMovingSpeed = 0.2;
const fastMovingSpeed = 1;

// Get CSS custom property values for game dimensions
const rootElementStyle = getComputedStyle(document.documentElement);
const obstacleDepth = parseFloat(rootElementStyle.getPropertyValue("--obstacle-depth"));
const playerDepth = parseFloat(rootElementStyle.getPropertyValue("--player-depth"));

// Get references to page elements
const topPage = document.getElementById("top-page");
const gamePage = document.getElementById("game-page");
const levelsPage = document.getElementById("levels-page");

// Get references to navigation buttons
const btnStart = document.getElementById("btn-start");
const btnLevels = document.getElementById("btn-levels");
const btnExit = document.getElementById("btn-exit");
const btnBack = document.getElementById("btn-back");

// Navigation event handlers - Show the corresponding game page when each button is clicked
btnStart.addEventListener("click", () => {
	topPage.hidden = true;
	gamePage.hidden = false;
	setupStageAndStart();
});

btnLevels.addEventListener("click", () => {
	topPage.hidden = true;
	levelsPage.hidden = false;
	loadLevels();
});

btnExit.addEventListener("click", () => {
	// Abort any ongoing speech recognition
	speechRecognitionAbortController?.abort();

	gamePage.hidden = true;
	topPage.hidden = false;
});

btnBack.addEventListener("click", () => {
	levelsPage.hidden = true;
	topPage.hidden = false;
});

// Get references to level completion modal elements
const btnRetry = document.getElementById("btn-retry");
const btnNextLevel = document.getElementById("btn-next-level");
const btnBackToTop = document.getElementById("btn-back-to-top");
const levelCompletedModal = document.getElementById("level-completed-modal");
const levelCompletedTitle = document.getElementById("level-completed-title");

// Level completion modal event handlers - Perform the corresponding action when each button is clicked
btnRetry.addEventListener("click", () => {
	levelCompletedModal.hidden = true;
	setupStageAndStart();
});

btnNextLevel.addEventListener("click", () => {
	levelCompletedModal.hidden = true;
	currentLevel++;
	setupStageAndStart();
});

btnBackToTop.addEventListener("click", () => {
	// Abort any ongoing speech recognition
	speechRecognitionAbortController?.abort();

	levelCompletedModal.hidden = true;
	topPage.hidden = false;
	gamePage.hidden = true;
});

// Get references to game UI elements
const levelElement = document.getElementById("level");

let score = 0;
const scoreElement = document.getElementById("score");

const platform = document.getElementById("platform");
const player = document.getElementById("player");

// Game state variables
let unlockedLevel = parseInt(localStorage.getItem("unlockedLevel") || "1", 10);
let currentLevel = unlockedLevel;
let currentLevelData;
let currentSection = 0;
let currentNLanes = 0;
let currentCorrectIndices = [];
let speechRecognitionAbortController;

/**
 * Initializes the game stage and starts a new level
 */
function setupStageAndStart() {
	// Abort any ongoing speech recognition
	speechRecognitionAbortController?.abort();
	speechRecognitionAbortController = new AbortController();

	levelElement.textContent = currentLevel;
	score = 0;
	scoreElement.textContent = 0;
	platform.textContent = "";
	platformY = 0;
	currentSectionCorrect = false;
	player.classList.remove("blink");

	currentLevelData = example[currentLevel - 1].map((wordList, sectionIndex) => {
		const words = wordList.slice();
		const correctWordIndex = shuffleAndReturnFirstIndex(words);
		currentCorrectIndices[sectionIndex] = correctWordIndex;

		// Create 3D obstacles for each word in the section
		for (const [wordIndex, word] of words.entries()) {
			const obstacle = document.createElement("div");
			obstacle.classList.add("obstacle");
			obstacle.classList.toggle("correct-word", wordIndex === correctWordIndex);
			obstacle.style.bottom = (sectionIndex + 1) * sectionDepth + "rem";
			obstacle.style.setProperty("--lane-index", wordIndex);
			obstacle.style.setProperty("--n-lanes", words.length);
			platform.appendChild(obstacle);

			// Create all six faces of the 3D obstacle
			const faces = ["front", "back", "left", "right", "top", "bottom"];
			for (const faceName of faces) {
				const face = document.createElement("div");
				face.classList.add("obstacle-face", `obstacle-face-${faceName}`);
				face.textContent = word;
				obstacle.appendChild(face);
			}
		}

		return words;
	});

	currentSection = 0;
	positionPlayer();

	requestAnimationFrame(updateGameState);
	startSpeechRecognition();
}

/**
 * Positions the player in a random lane that is not the correct answer
 */
function positionPlayer() {
	currentNLanes = currentLevelData[currentSection].length;
	let playerLane = Math.floor(Math.random() * (currentNLanes - 1));
	if (playerLane >= currentCorrectIndices[currentSection]) playerLane += 1; // The player must not be on the correct lane
	player.style.setProperty("--lane-index", playerLane);
	player.style.setProperty("--n-lanes", currentNLanes);
}

// Game animation state variables
let currentSectionCorrect = false;
let platformY = 0;

/**
 * Updates the game state every frame, handling platform movement and collision detection
 */
function updateGameState() {
	platformY += currentSectionCorrect ? fastMovingSpeed : slowMovingSpeed;
	platform.style.transform = `var(--platform-tilt) translateY(${platformY}rem)`;
	const nextSectionY = (currentSection + 1) * sectionDepth;

	if (currentSectionCorrect) {
		// Move to next section when obstacle is passed
		if (platformY >= nextSectionY + obstacleDepth) {
			currentSection++;
			if (currentSection < currentLevelData.length) {
				positionPlayer();
				currentSectionCorrect = false;
				startSpeechRecognition();
			} else {
				// Level completed - abort speech recognition
				speechRecognitionAbortController?.abort();

				if (currentLevel < example.length) {
					btnNextLevel.hidden = false;
					btnBackToTop.hidden = true;
					levelCompletedTitle.textContent = `Level ${currentLevel} Completed!`;
					if (currentLevel + 1 > unlockedLevel) {
						unlockedLevel = currentLevel + 1;
						localStorage.setItem("unlockedLevel", unlockedLevel);
					}
				} else {
					btnNextLevel.hidden = true;
					btnBackToTop.hidden = false;
					levelCompletedTitle.textContent = "All Levels Completed!";
				}
				levelCompletedModal.hidden = false;
				cancelAnimationFrame(updateGameState);
				return;
			}
		}
	} else {
		// Handle collision with obstacle when player doesn't move to correct lane
		if (platformY >= nextSectionY - playerDepth) {
			platformY = currentSection * sectionDepth + obstacleDepth;
			score = Math.max(0, score - 1);
			scoreElement.textContent = score;
			player.classList.remove("blink");
			player.offsetWidth; // Trigger DOM reflow
			player.classList.add("blink");
		}
	}

	requestAnimationFrame(updateGameState);
}

/**
 * Starts speech recognition for the current section and handles player movement based on recognized words
 */
async function startSpeechRecognition() {
	if (currentSectionCorrect) return;
	try {
		const currentWords = currentLevelData[currentSection].map(word => word.trim().toLowerCase());
		let recognizedWord;
		while (!(recognizedWord = await listenToWords(currentWords, speechRecognitionAbortController.signal)));
		recognizedWord = recognizedWord.trim().toLowerCase();
		const recognizedWordIndex = currentWords.indexOf(recognizedWord);
		if (recognizedWordIndex !== -1) {
			player.style.setProperty("--lane-index", recognizedWordIndex);
			if (recognizedWordIndex === currentCorrectIndices[currentSection]) {
				score += 10;
				scoreElement.textContent = score;
				currentSectionCorrect = true;
				return;
			}
		}
		return startSpeechRecognition();
	} catch (error) {
		// Don't restart if the error is due to abortion
		if (error.name === "AbortError") {
			return;
		}
		console.error(error);
		return startSpeechRecognition();
	}
}

/*
// Allows controlling with number row keys for debugging
document.addEventListener("keydown", event => {
	if (currentSectionCorrect) return;
	const key = parseInt(event.key, 10);
	if (key >= 1 && key <= currentNLanes) {
		const playerLane = key - 1;
		player.style.setProperty("--lane-index", playerLane);
		if (playerLane === currentCorrectIndices[currentSection]) {
			score += 10;
			scoreElement.textContent = score;
			currentSectionCorrect = true;
		}
	}
});
*/

/**
 * Randomize the order of the elements of an array and returns the index of the first element after shuffling
 */
function shuffleAndReturnFirstIndex(array) {
	let firstIndex = 0; // The first element is always the correct word
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
		if (j === firstIndex) firstIndex = i;
	}
	return firstIndex;
}

// Level selection functionality
const levelsList = document.getElementById("levels-list");

/**
 * Loads and displays all available levels in the levels page
 */
function loadLevels() {
	levelsList.textContent = "";
	for (let i = 1; i <= example.length; i++) {
		const levelItem = document.createElement("button");
		levelItem.classList.add("themed-btn");
		if (i <= unlockedLevel) {
			levelItem.textContent = i;
			levelItem.addEventListener("click", () => {
				currentLevel = i;
				setupStageAndStart();
				levelsPage.hidden = true;
				gamePage.hidden = false;
			});
		} else {
			levelItem.textContent = "🔒";
			levelItem.disabled = true;
		}
		levelsList.appendChild(levelItem);
	}
}
