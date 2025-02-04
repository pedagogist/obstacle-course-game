import example from "./data/example.json" with { type: "json" };
// import listenToWords from "./listen-to-words.js";

const sectionDepth = 120;
const slowMovingSpeed = 0.2;
const fastMovingSpeed = 1;

const rootElementStyle = getComputedStyle(document.documentElement);
const obstacleDepth = parseFloat(rootElementStyle.getPropertyValue("--obstacle-depth"));
const playerDepth = parseFloat(rootElementStyle.getPropertyValue("--player-depth"));

const topPage = document.getElementById("top-page");
const gamePage = document.getElementById("game-page");
const levelsPage = document.getElementById("levels-page");

const btnStart = document.getElementById("btn-start");
const btnLevels = document.getElementById("btn-levels");
const btnExit = document.getElementById("btn-exit");
const btnBack = document.getElementById("btn-back");

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
	gamePage.hidden = true;
	topPage.hidden = false;
});

btnBack.addEventListener("click", () => {
	levelsPage.hidden = true;
	topPage.hidden = false;
});

const btnRetry = document.getElementById("btn-retry");
const btnNextLevel = document.getElementById("btn-next-level");
const btnBackToTop = document.getElementById("btn-back-to-top");
const levelCompletedModal = document.getElementById("level-completed-modal");
const levelCompletedTitle = document.getElementById("level-completed-title");

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
	levelCompletedModal.hidden = true;
	topPage.hidden = false;
	gamePage.hidden = true;
});

const levelElement = document.getElementById("level");

let score = 0;
const scoreElement = document.getElementById("score");

const platform = document.getElementById("platform");
const player = document.getElementById("player");

let unlockedLevel = parseInt(localStorage.getItem("unlockedLevel") || "1", 10);
let currentLevel = unlockedLevel;
let currentLevelData;
let currentSection = 0;
let currentNLanes = 0;
let currentCorrectIndices = [];

function setupStageAndStart() {
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

		words.forEach((word, wordIndex) => {
			const obstacle = document.createElement("div");
			obstacle.classList.add("obstacle");
			obstacle.classList.toggle("correct-word", wordIndex === correctWordIndex);
			obstacle.style.bottom = (sectionIndex + 1) * sectionDepth + "rem";
			obstacle.style.setProperty("--lane-index", wordIndex);
			obstacle.style.setProperty("--n-lanes", words.length);
			platform.appendChild(obstacle);

			const faces = ["front", "back", "left", "right", "top", "bottom"];
			faces.forEach(faceName => {
				const face = document.createElement("div");
				face.classList.add("obstacle-face", `obstacle-face-${faceName}`);
				// if (faceName === "front") {
				face.textContent = word;
				// }
				obstacle.appendChild(face);
			});
		});

		return words;
	});

	currentSection = 0;
	positionPlayer();

	requestAnimationFrame(updateGameState);
}

function positionPlayer() {
	currentNLanes = currentLevelData[currentSection].length;
	let playerLane = Math.floor(Math.random() * (currentNLanes - 1));
	if (playerLane >= currentCorrectIndices[currentSection]) playerLane += 1; // The player must not be on the correct lane
	player.style.setProperty("--lane-index", playerLane);
	player.style.setProperty("--n-lanes", currentNLanes);
}

let currentSectionCorrect = false;
let platformY = 0;

function updateGameState() {
	platformY += currentSectionCorrect ? fastMovingSpeed : slowMovingSpeed;
	platform.style.transform = `var(--platform-tilt) translateY(${platformY}rem)`;
	const nextSectionY = (currentSection + 1) * sectionDepth;
	if (currentSectionCorrect) {
		if (platformY >= nextSectionY + obstacleDepth) {
			currentSection++;
			if (currentSection < currentLevelData.length) {
				positionPlayer();
				currentSectionCorrect = false;
			} else {
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

// For debugging
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

function shuffleAndReturnFirstIndex(array) {
	let firstIndex = 0; // The first element is always the correct word
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
		if (j === firstIndex) firstIndex = i;
	}
	return firstIndex;
}

const levelsList = document.getElementById("levels-list");

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
