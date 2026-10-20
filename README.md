# The Haunted Studio

An interactive incident response simulator built for the **Spooky Security** cybersecurity awareness event (October 29, 2026), and phase one of a capstone project on security operations for live-service games.

Players are the newest security analyst at Graveyard Games, a fictional studio days from launch. Each case file is based on a real attack on the video game industry and runs through four stations:

1. **The Call** – spot the red flags in a phone call, email, text, or chat, then choose a response.
2. **Log Hunt** – use analyst notes to find the attacker in a sign-in, audit, or endpoint log full of red herrings. Then compare your findings with the **Auto-Analyst**, a detection script that runs on the same log.
3. **Break the Chain** – pick containment moves, separating what stops the attack now from what can wait.
4. **The Brief** – choose the accurate summary to send leadership.

The debrief shows where the attack was stopped on the Cyber Kill Chain and reveals the real incident, mapped to MITRE ATT&CK.

**Play solo or as a team.** In team mode, 2–4 players take SOC roles (Help Desk Lead, Threat Hunter, Incident Commander, Communications Lead), each leading a station. Team scores go on a local leaderboard.

## Case files

| Case | Difficulty | Based on |
|---|---|---|
| The Midnight Caller | Easy | EA (2021) |
| The Text from Beyond | Easy | Activision (2022) |
| The Cursed Launcher | Medium | 2K (2022) |
| The Stolen Shield | Hard | Riot Games (2023) |
| The Locked Crypt | Hard | CD Projekt Red (2021) |

Names, logs, and messages are invented. Incident summaries reflect public reporting.

## Detection engine

`data/rules.json` defines 15 detection rules: keyword signatures, impossible travel, lookalike domains, and volume anomalies. Each rule has a severity and a MITRE ATT&CK technique. The rules run in two places with identical results:

- **Python** (`tools/detect.py`) for analysts: it prints alerts per case, scores them against the answer key (precision and recall), and writes a report.
- **JavaScript** (`js/detect.js`) in the browser, as the game's Auto-Analyst.

```bash
python tools/detect.py                 # all cases
python tools/detect.py --case crypt    # one case
python tools/detect.py --report        # writes reports/ALERTS.md and reports/alerts.json
python -m unittest discover tests      # run the tests
```

The rules catch most attacker activity but are deliberately realistic: they raise false positives on nightly backups and legitimate users, and they miss events that need context from the analyst notes. That gap is the lesson. Automation handles volume, and analysts handle context.

## Project structure

```
index.html            the live page (built by tools/bundle.py; everything inlined)
app.html              development page that links css/ and js/
css/style.css         styles
js/game.js            game logic and UI
js/detect.js          detection engine (browser)
js/cases.js           generated from data/cases.json
js/rules.js           generated from data/rules.json
data/cases.json       all case content (source of truth)
data/rules.json       detection rules (source of truth)
tools/build_cases.py  validates the JSON and builds js/cases.js and js/rules.js
tools/detect.py       detection engine (Python CLI)
tools/bundle.py       builds dist/haunted-studio.html, a single offline file
tests/                unit tests for the detection engine
reports/              sample detection report
```

## Editing a case

1. Edit `data/cases.json` or `data/rules.json`.
2. Run `python tools/build_cases.py`. It checks every case (one best answer, three "now" moves, matching log columns) and rebuilds the JS data files.
3. Run `python tools/bundle.py` to rebuild `index.html` and the offline file.

## Run it

- **Online:** the GitHub Pages site.
- **Offline:** open `dist/haunted-studio.html` in any browser. No install or internet needed.

Python 3.8+, standard library only.
