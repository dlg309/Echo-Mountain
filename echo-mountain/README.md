# Echo Mountain

A top-down snowboarding game where you carve through generated courses, dodge obstacles, and take ramps toward the finish. Choose a downhill run, a practice run, a ramps-only trick run, or a halfpipe; pick a difficulty and time of day; and land aerial tricks for points. Live statistics, saved run markers, an optional expert fog setting, and a post-run summary keep track of the ride.

## What you need

- A modern web browser such as Chrome, Edge, or Firefox.
- Visual Studio Code to view and edit the project.
- Python 3 to start a local web server. The game does not need any packages installed.
- Optional: Node.js 18 or later to run the automated tests, and Git to upload the project to GitHub.

The game is written in JavaScript, HTML, and CSS. There is no build step or backend. Google Fonts is used when available; the game falls back to system fonts if it cannot be reached.

## Open and run in VS Code

1. Extract the ZIP file and open the extracted **echo-mountain** folder in VS Code using **File > Open Folder**. Open the folder containing this README and the `dist` and `tests` folders.
2. Open the terminal using **Terminal > New Terminal**. The terminal should start in the `echo-mountain` folder.
3. On Windows, run:

   ```powershell
   py -m http.server 8000 --bind 127.0.0.1 --directory dist
   ```

   If `py` is unavailable but `python` runs Python 3, replace `py` with `python`. On macOS, Linux, or WSL, use:

   ```bash
   python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
   ```

4. Open **http://localhost:8000** in your browser. Keep the terminal open while playing. Press **Ctrl+C** in the terminal to stop the server.

Serve the game through the local server instead of opening `dist/index.html` directly: the browser needs the server to load the JavaScript modules. If port 8000 is already in use, replace `8000` in the command with another port, such as `8001`, and open the matching address.

## Controls and gameplay

- Press **Left/Right** or **A/D** to steer. Narrow screens show touch buttons.
- Choose **Downhill** for the original obstacle course, **Trick run** for a course with ramps only, or **Halfpipe** for automatic runs between the two lips. In the halfpipe, steering changes your speed across the pipe; each lip launches you, and you land in the transition heading toward the opposite side.
- Choose **Practice** to ride the same kind of course as Downhill without ending the run on a collision. A fall briefly stops the rider, resets the score to zero and the multiplier to 1.00×, then lets you continue from the same position. Descent and elapsed time are retained; time continues during recovery unless paused. The obstacle that caused the fall cannot immediately trigger it again, while other obstacles remain active.
- Press **P** or **Escape**, or use **Pause**, to pause and resume. From pause you can resume or start a fresh run.
- The first-run guide explains the basics; dismiss it with **Got it**, or reopen it using **How to ride**.
- Choose Beginner, Intermediate, or Expert and a time of day above the game. Lighting choices include day, sunrise, sunset, twilight, and a starry night. Changing difficulty starts a fresh run.
- Expert fog can be toggled during a run.
- In Downhill and Practice, ramps appear on Intermediate and Expert courses and activate automatically. Small ramps clear small rocks and fences; large ramps can also clear larger rocks and trees. A collision ends a Downhill run but starts recovery in Practice. Trick runs have ramps at every difficulty and no obstacles.
- While airborne, press **Z / X / C / V / B** (arrow-key players) or **G / H / J / K / L** (A/D players) for a **180 / 360 / 720 / front flip / backflip**, respectively. Touch players can use the on-screen trick buttons. Small ramps allow one trick; large ramps and halfpipe lips allow up to two, including the same trick twice. Finish the first before starting the second, and start early enough to finish before landing. Release and press again to repeat a trick. Points are awarded on a safe landing. Use **Trick motion** above the game to turn the animation on or off; it starts off when your device requests reduced motion.
- Time on the slope raises your score; close calls and ramps raise the multiplier.
- Intermediate and Expert downhill courses reshuffle each run. Previous and longest-run markers retain their distance and position for each difficulty, although the obstacles around them may change.

Records are stored separately by mode and difficulty in the current browser's local storage. Existing downhill records remain available. The local game starts with its own records: records from a hosted version do not automatically transfer, and clearing browser data may delete local records.

## Run the tests

With Node.js 18 or newer installed, run this from the project folder:

```bash
node --test
```

The tests cover game rules, practice recovery, trick modes, pause and resume, randomly generated courses, jumps and landings, fog visibility, and saved records.

## Put the project on GitHub

1. Create a **new, empty repository** on GitHub. Do not add a README, license, or `.gitignore` during creation because this project already contains files.
2. Copy the repository's HTTPS URL from GitHub.
3. In the VS Code terminal, inside the `echo-mountain` folder, run:

   ```bash
   git init
   git add .
   git commit -m "Add Echo Mountain prototype"
   git branch -M main
   git remote add origin YOUR_REPOSITORY_URL
   git push -u origin main
   ```

   Replace `YOUR_REPOSITORY_URL` with the HTTPS URL you copied. Git may ask you to sign in. If this is your first commit on this computer, Git may first ask you to configure your name and email.

## Project files

- `dist/index.html` and `dist/style.css`: the page and styling.
- `dist/game.mjs`: game loop, controls, and interface.
- `dist/course.mjs`: difficulties and course generation.
- `dist/engine.mjs`: movement, collisions, scoring, and jumps.
- `dist/renderer.mjs` and `dist/fog.mjs`: drawing and fog.
- `dist/records.mjs`: browser-local run records.
- `tests/`: automated tests for the engine, trick modes, renderer, and interface logic.

The `dist` folder is the actual editable source for this prototype; you do not need to compile it.
