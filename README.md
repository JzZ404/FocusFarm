# FocusFarm

**Live App:** [https://focus-farm.vercel.app](https://focus-farm-nine.vercel.app/)

FocusFarm is a gamified productivity web app where users earn coins by maintaining attention during webcam-based focus sessions. Users can spend coins to build a pixelated animal farm with animals, houses, and decorations. Over time, the farm grows as a visual representation of productivity and focus.

The goal of FocusFarm is to transform traditional focus timers into an engaging and rewarding experience by combining attention detection with a pixel-style farm game.

---

# Local Setup

**Requirements:** Node.js 18+

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

**Production build:**
```bash
npm run build
npm start
```

## Environment Variables

No environment variables are required for the MVP. All data is stored in browser `localStorage`.

See [`.env.example`](.env.example) for optional future Supabase configuration.

---

# Deployment

The app is deployed on **Vercel** with automatic deployments on every push to `main`.

To deploy your own instance:
1. Fork this repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import your fork
3. Vercel auto-detects Next.js — click **Deploy**
4. Every push to `main` will trigger a new production deployment automatically

CI runs on every PR via **GitHub Actions** (`.github/workflows/ci.yml`) — linting and build must pass before merging.

---

# Features

## Core Features (MVP)

- Webcam-based attention detection
- Focus session timer
- Coin reward system
- Pixel farm homepage
- Shop system to purchase animals and items
- Persistent farm progress

## Future Features (Optional)

- More animals and decorations
- Farm upgrades
- Streak rewards
- Animations
- Leaderboard
- Sound effects

---

# Core Gameplay Loop

Open FocusFarm  
→ Start Focus Session  
→ Webcam detects attention  
→ Earn coins  
→ Buy animals / farm items  
→ Farm grows visually  

---

# Tech Stack

Frontend  
- React / Next.js

AI / Computer Vision  
- MediaPipe or TensorFlow.js

Storage  
- LocalStorage (MVP)

Optional  
- Supabase / Firebase

---

# Developer

Developer: **Murphy Wei**  
Project Owner: **Joyce Zhou**  
Development Fee: **30 GIX Bucks**

---

# Timeline & Check-Ins

This project will be developed in three major phases with structured progress check-ins.

---

## ✅ Check-In 1 — Architecture + Eye Tracking Setup

### Phase 1 Goals
- Project setup and architecture  
- Eye tracking open-source model setup  

### Expected Progress

- Project initialized and running locally  
- Tech stack finalized (React / Next.js + CV library)  
- Folder structure created  
- Base homepage scaffold created  
- Webcam access successfully enabled  
- Open-source eye/face detection model integrated  
- Basic attention detection signal working (focused vs not focused)  

### Deliverables

- Initial Architecture Pull Request  
- Webcam detection demo  
- Basic attention detection working  

### Success Criteria

- ✅ App runs locally  
- ✅ Webcam detection initializes  
- ✅ Face detection returns usable signal  

---

## Check-In 2 — Focus Detection + Farm Homepage + Reward System

### Phase 2 Goals
- Focus detection application  
- Farm homepage UI  
- Reward system  

### Expected Progress

- Focus session start/stop functionality  
- Timer working during focus session  
- Attention detection connected to focus timer  
- Coin reward logic implemented  
- Farm homepage UI built  
- Coin balance displayed  
- Focus session completion feedback  

### Deliverables

- Working focus session demo  
- Coins awarded after session  
- Farm homepage UI visible  

### Success Criteria

- User can start focus session  
- Timer runs correctly  
- Coins awarded after focus session  
- Farm homepage displays coin balance  

---

## Check-In 3 — Farm Rendering + Shop + Persistence (MVP Complete)

### Phase 3 Goals
- Farm rendering  
- Shop system  
- Persistence  

### Expected Progress

- Shop UI implemented  
- Purchasable farm items added  
- Purchase logic implemented  
- Coins deducted after purchase  
- Purchased items render on farm  
- Farm progress saved locally  
- End-to-end workflow working  

### Deliverables

Full MVP Demo:

Open app  
→ Start focus session  
→ Earn coins  
→ Buy animal  
→ Farm grows  
→ Refresh page  
→ Progress persists  

### Success Criteria

- Shop system works  
- Farm updates after purchase  
- Data persists after refresh  
- MVP demo ready  

---

# Development Timeline Overview

## ✅ Phase 1
- Project Setup + Architecture  
- Eye Tracking Open Source Model Set Up  

## （WIP）Phase 2
- Focus Detection Application  
- Farm Homepage UI  
- Reward System  

## Phase 3
- Farm Rendering  
- Shop  
- Persistence  
