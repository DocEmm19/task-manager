# Task Manager

A tiny, single-user task manager. Static frontend (hosted on GitHub Pages) that talks to a Google Apps Script Web App backed by a single Google Sheet. Laptop + phone synced, zero running cost.

**Live site:** enable GitHub Pages for this repo (Settings → Pages → Deploy from branch → `main` / root).

## How it works
- The site is 100% static (`index.html`, `styles.css`, `app.js`, `lib/*.js`). No build step, no framework, no dependencies.
- On first open it asks for your **Web App URL** and a **passcode**. These are stored **only in your browser** (`localStorage`) and are **never** in this repository.
- All task data lives in your own Google Sheet. Writes are field-level patches, serialized with a lock, soft-deleted (never hard-deleted), and every change is logged for recovery.

## Setup (one time, ~15 min)
Follow **[docs/DEPLOY_RUNBOOK.md](docs/DEPLOY_RUNBOOK.md)**:
1. Create a Google Sheet → paste `apps-script/Code.gs` → set timezone to **Asia/Kolkata** → add a `PASSCODE` Script Property → deploy as a Web App and copy the `/exec` URL.
2. Open this site → paste the URL + passcode once (per device).

## Features
Quick capture with shorthand (`Ship deck #b2b !p1 fri`, `every weekday`, `*` to pin), projects/tags, P1–P3 priorities, due dates, notes + subtasks, recurring tasks, a **Today** view with a hand-picked Top-3 and collapsed overdue, plus Upcoming / All / Done-this-week / Trash. Works offline (writes queue and sync when back online).

## Security note
This is a personal, single-user tool. The passcode keeps casual/bot traffic out; anyone with the URL **and** passcode has full access to your task sheet. Use a long random passcode. No third-party or sensitive data is intended for this app.
