# Obstacle Course Game

This is a template of a simple web application written in HTML, CSS and JavaScript without requiring external libraries or a build process (“vanilla”). It is an interactive game where players navigate through word-based challenges using speech recognition. You are expected to modify and expand upon this template to suit the needs of your project.

Although this template is designed for undergraduate students of a capstone project course in the Education University of Hong Kong, it can also be used by anyone for other projects.

[Try out the template](https://pedagogist.github.io/obstacle-course-game/) to see how it works.

## Getting Started

> [!NOTE]
> This section is intended for our undergraduate students.
> 
> If you are not new to programming, feel free to use your favourite code editor, the `serve` command, or whatever tools you feel comfortable with.

1. Make sure you are logged in to GitHub. Click “Use this template” → “Create a new repository” at the top right of this page.
2. Pick a name for your project, then click “Create repository”. You may rename it anytime later by clicking the Settings tab on your project page.
3. Launch [Visual Studio Code](https://code.visualstudio.com).
4. Click “Clone Git repository” on the Welcome page.
5. Type in your GitHub username, followed by `/` and the project name you just chose, and press <kbd>Enter</kbd>.
6. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension.
7. Click the “Go Live” button from the status bar at the bottom to view the app.

## How It Works

- The game loads level data from a JSON file, creating 3D obstacles with words that players must navigate through.
- Players use speech recognition to speak the correct word and move to the corresponding lane, avoiding collision with obstacles.
- The game supports both browser-based Web Speech API and Google Cloud Speech-to-Text API for word recognition.
- Players progress through multiple levels with increasing difficulty, and their progress is saved locally.
- A 3D perspective view creates an immersive obstacle course experience with CSS transforms and animations.

## Your Next Steps

1. Change the level data by adding new JSON files within the `data` folder and remove `data/example.json`.
2. Update the `import` statement at the top of `index.js` to reference your new data file.
3. Modify the game’s visual elements in `index.css` to match your learning theme – change colours, fonts and styling to create the appropriate atmosphere for your target learners.
4. Adjust the scoring system and difficulty progression in `index.js` by modifying the speed constants and point values to suit your pedagogical approach.
5. Customise the user interface text and labels in `index.html` to reflect your app’s purpose and provide clear instructions for your target audience.
6. Test your speech recognition with your chosen vocabulary to ensure accurate word detection.

If you encounter any technical problems or have questions, don’t hesitate to reach out for help! We’re always here for advice and support. <sub>[Only applicable for students at EdUHK.]</sub>
