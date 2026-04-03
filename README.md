# Archon

A browser-based strategic combat game built with Vite + React.

## Repositories

| Repo | Path | Purpose |
|---|---|---|
| **archon-workshop** | `./archon-workshop` | Asset factory — generates, reviews, and exports game assets via Gemini |
| **archon-game** | `./archon-game` | Vite + React game client — board shell, combat slice, bridge |
| **archon-ops** | `./` (root) | Shared CLI scripts for import, export, QA, manifest management |

Each repo is a standalone git repository. They share a parent directory for path-relative scripting convenience.

## Current Milestone

`board-combat-alpha-0.2` — visual board→combat→board round-trip proven.

## Quick Start

```bash
# Start Workshop (asset factory)
cd archon-workshop
npm install
npm run dev
# → http://localhost:5174

# Start Game (combat + board client)
cd archon-game
npm install
npm run dev
# → http://localhost:5173

# Adjacent contest test (board→combat→board round-trip)
# http://localhost:5173?setup=adjacent
```

## Environment

Copy `archon-workshop/.env.example` to `archon-workshop/.env` and fill in `GEMINI_API_KEY`.

## Tags (archon-game)

| Tag | Description |
|---|---|
| `combat-slice-v1.1` | Part 1 — VFX pass complete |
| `combat-slice-v1.1.1` | Part 1 stabilization gate |
| `board-combat-alpha-0.1` | Part 2 — board shell, combat bridge |
| `board-combat-alpha-0.2` | Part 2 — state persistence + round-trip proven |

## Stack

- **Game:** Vite 5 + React 18 + TypeScript + Vanilla CSS
- **Workshop:** Vite 5 + React 18 + TypeScript + Express backend + Gemini API
- **Assets:** PNG images + WAV/MP3 audio, served from `public/assets/`
- **Agent config:** `.agents/` in each repo (rules, skills, workflows)
