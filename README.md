# Porktoberfest Command Center

Alerts and campaign planning for Porktoberfest at Hogs for the Cause 2027 (March 19–20, UNO Lakefront).

- `site/`: the dashboard (GitHub Pages). Opens in demo mode until `site/firebase-config.js` is filled in.
- `monitor/`: scheduled checks of official Hogs sources, with ntfy push and Gmail alerts (GitHub Actions).
- `firestore.rules`: who can read and edit what.
- `.github/workflows/`: monitor schedule, dashboard publishing, access management, monthly heartbeat.

Setup: see **SETUP.md**.

Data rules: only monitored, entered or AI-drafted information appears, each labeled. No sample data is presented as real.
