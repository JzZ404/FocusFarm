## FocusFarm — Gamified Pixel Farm for Focus

## Project Owner
Joyce Zhou

## Developer
Murphy Wei

## Agreed Development Fee
30 GIX Bucks (Negotiable based on scope changes)

---

## Problem

Students and knowledge workers often struggle to maintain focus, and traditional productivity tools rely heavily on timers or self-discipline, which are easy to ignore. These tools also lack engaging feedback and long-term motivation. There is an opportunity to create a more engaging productivity experience by combining webcam-based attention detection with a gamified pixel farm that visually grows as users focus.

---

## Goal

Build a web-based gamified focus app where users earn coins by maintaining attention during focus sessions and spend those coins to build a pixelated animal farm that grows over time.

---

## Target User

- Primary user: Students and knowledge workers who want help staying focused
- Secondary user: Gamified productivity enthusiasts and "study-with-me" users

---

## Core User Stories

1. As a user, I want to start a focus session so that I can earn rewards for concentrating.
2. As a user, I want the system to detect whether I am paying attention so that rewards reflect real focus.
3. As a user, I want to earn coins from focus sessions so that I feel motivated to continue working.
4. As a user, I want to buy animals and farm items so that I can visually grow my farm.
5. As a user, I want my farm progress to be saved so that I can return to it later.

---

## Functional Requirements

- The app must allow users to start and stop focus sessions.
- The app must allow webcam-based attention detection during focus sessions.
- The app must display a pixel farm homepage with animals and decorations.
- The app must handle cases where webcam permission is denied.
- The app must persist user coins and purchased farm items using local storage (MVP).
- The app must support responsive desktop-first web layout.

---

## Non-Functional Requirements

- Clear and usable UI
- Reasonable performance for normal usage
- Clean, maintainable code structure
- Basic error handling
- README with setup instructions
- Architecture documented in initial PR

---

## Desired Tech Stack

- Frontend: Next.js or React
- Backend: None required for MVP (optional Node.js if needed)
- Database: LocalStorage (MVP), Supabase optional
- AI/API: MediaPipe or TensorFlow.js for webcam attention detection

---

## Out of Scope

- Multiplayer features
- Mobile app
- Advanced animation system
- Complex farm placement system
- Cloud sync (optional future)

---

## Acceptance Criteria

- [ ] Users can complete the main workflow end-to-end
- [ ] User can start focus session
- [ ] Webcam attention detection works
- [ ] Coins awarded after focus session
- [ ] User can purchase farm animals/items
- [ ] Farm visually updates after purchase
- [ ] Data is stored/retrieved correctly
- [ ] Developer submits initial architecture PR
- [ ] Developer resolves feedback on architecture
- [ ] README is updated with setup/run instructions

---

## Notes for Developer

### Core MVP Priority

Focus on the following core loop first:

Open app  
→ Start focus session  
→ Detect attention  
→ Earn coins  
→ Buy farm items  
→ Farm grows  

---

### Farm Visual Style

- Pixelated farm environment
- Grass background
- Small animals (chickens, sheep, etc.)
- Simple decorative items

Pixel assets can be:

- Open-source assets
- Placeholder assets
- Simple pixel shapes

---

### Attention Detection MVP


- Detect Eyes on screen = focused
- Detect Eyes not on screen  = distracted

---

### Reward System (Placeholder)

Reward logic can be adjusted later:

Example placeholder:

- 10 min focus = 100 coins
- 20 min focus = 250 coins
- 30 min focus = 500 coins

Exact algorithm can be decided during development.

---

### Future Extensions (Optional)

- More animals
- Farm upgrades
- Animation
- Streak rewards
- Leaderboard

These are NOT required for MVP.

---

### Development Priorities

Priority Order:

1. Project setup
2. Farm homepage
3. Focus session + webcam
4. Reward system
5. Shop system
6. Farm rendering
7. Persistence
8. UI polish

---

### GitHub Issues (To Be Created)

1. Project setup and architecture
2. Farm homepage UI
3. Webcam attention detection
4. Focus session timer and reward logic
5. Coin system
6. Shop system
7. Farm rendering and persistence
8. UI polish and final integration

---
