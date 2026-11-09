# Porktoberfest Command Center: setup

About 1–2 hours, done once. You need: the client's Google account, a new Porktoberfest GitHub account, the social media manager's phone, and admin access to the Facebook Page linked to @porktoberfest_.

What runs where:

| Part | Where | Cost |
|---|---|---|
| Dashboard | GitHub Pages (`site/`) | Free |
| Data + sign-in | Firebase (Firestore + Google sign-in), Spark plan | Free |
| Monitor | GitHub Actions (`monitor/`), 7:40 am + 4:40 pm CT | Free |
| Phone push | ntfy app | Free |
| Email | The client's Gmail | Free |
| Weekly trend ideas + AI summaries | Claude API key (client's own) | Pay as you go, likely a few dollars a month |

---

## 1. GitHub

1. Create the Porktoberfest GitHub account (use the client's Google email).
2. Create a **public** repository named `porktoberfest-command-center`. It has to be public for free GitHub Pages. No secrets are in the code; all data sits behind sign-in.
3. Upload everything in this folder **except** `monitor/node_modules`. Keep the `.github` folder; it holds the schedules.
4. Settings → Pages → Source: **GitHub Actions**.

## 2. Firebase (on the client's Google account)

1. console.firebase.google.com → **Add project** → name it `porktoberfest-command-center`. Google Analytics: off.
2. **Build → Firestore Database → Create database** → Standard edition, location `nam5 (United States)`, **production mode**.
3. **Rules** tab → paste all of `firestore.rules` → **Publish**.
4. **Build → Authentication → Get started → Google** → Enable, pick the support email → Save.
5. Authentication → **Settings → Authorized domains → Add domain** → `<github-username>.github.io`.
6. Project settings (gear) → **Your apps → Web (</>)** → nickname "Command Center" → Register (no Hosting). Copy the `firebaseConfig` values into `site/firebase-config.js` and commit.
7. Project settings → **Service accounts → Generate new private key**. Keep the downloaded JSON file; it goes into GitHub in step 5. Don't email it or commit it.

## 3. Phone push (ntfy)

1. Make up a channel name that's hard to guess, for example `porktoberfest-` plus 12 random letters and numbers. Anyone with the name can read the alerts, so treat it like a password.
2. On the social media manager's phone: install **ntfy** (App Store / Google Play) → **+** → type the channel name → Subscribe.
3. Captains who should also get push can subscribe to the same name. To cut someone off later, pick a new name and update the secret.

## 4. Email (the client's Gmail)

1. myaccount.google.com → Security → turn on **2-Step Verification** (required for app passwords).
2. Search the account settings for **App passwords** → create one named "Command Center" → copy the 16-character password.

## 5. Instagram (official API)

@porktoberfest_ is a professional account linked to a Facebook Page, so it can read @hogsforthecause's public posts.

1. developers.facebook.com, logged in as a Facebook Page admin → **My Apps → Create app** → use case "Other" → type **Business** → name it "Porktoberfest Monitor".
2. Add the **Instagram Graph API** product.
3. **Tools → Graph API Explorer** → choose the app → **Get User Access Token** with permissions `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `business_management` → Generate, approve.
4. In the Explorer, run `me/accounts?fields=name,access_token,instagram_business_account`. Find the Porktoberfest Page:
   - its `instagram_business_account.id` is **IG_USER_ID**
   - its `access_token` is a Page token. Exchange it for a long-lived one with the **Access Token Debugger → Extend Access Token** before copying it. A Page token made from a long-lived user token doesn't expire. That is **IG_ACCESS_TOKEN**.
5. Test it in the Explorer: `<IG_USER_ID>?fields=business_discovery.username(hogsforthecause){media.limit(3){caption,timestamp}}` should list recent Hogs posts.

If this step isn't done, the monitor still tries Instagram's public profile, which often fails from GitHub's servers. The dashboard and a push say so; the site checks keep working.

## 6. GitHub secrets

Repository → Settings → **Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | The whole service account JSON file from Firebase step 7 |
| `NTFY_TOPIC` | The ntfy channel name |
| `GMAIL_USER` | The client's Gmail address |
| `GMAIL_APP_PASSWORD` | The 16-character app password |
| `IG_USER_ID` | From Instagram step 4 |
| `IG_ACCESS_TOKEN` | From Instagram step 4 |
| `ALERT_EMAIL_TO` | Optional. Extra addresses for alert emails, comma-separated |
| `ANTHROPIC_API_KEY` | Turns on the Monday trend ideas, plus AI-drafted alert summaries (see step 6a) |

### 6a. Claude API key (for trend ideas)

1. console.anthropic.com → sign up with the client's Google account → **Billing**: add a card and a small credit (for example $10) and set a monthly spend limit.
2. **Settings → Privacy** (or Organization settings): turn on **Web search**. Trend research can't run without it.
3. **API keys → Create key** → name it "Porktoberfest monitor" → copy it into the `ANTHROPIC_API_KEY` secret.
4. Test: Actions → Hogs monitor → Run workflow → mode `trends`. Three ideas should appear in the Idea Bank within a few minutes, with a push.

Then edit `monitor/config.json` → set `dashboardUrl` to `https://<github-username>.github.io/porktoberfest-command-center/`.

## 7. Add the first admins

1. Actions → **Dashboard access** → Run workflow → `add-member`, your Google email, role `admin`, alerts on.
2. Run it again for the social media manager's Google email, role `admin`, alerts on.

Everyone after that is invited from the dashboard's **Team access** page:

- **Admin**: edits everything and manages access
- **Full access** (captains): sees everything, can get alert emails, can update fundraising details only
- **Dashboard only**: view only, no alerts

## 8. Go live

1. Actions → **Publish dashboard** → Run workflow. The link appears on the run (and under Settings → Pages).
2. Open the dashboard, sign in with Google, click **Load starting content** (November plan, idea bank, deadlines, and the alerts found during setup).
3. Actions → **Hogs monitor** → Run workflow → mode `test`. A push and an email should arrive within a minute.
4. Run it again with mode `check`. The first check only saves a baseline of each source; alerts start with the next change.
5. Edit fundraising and deadlines from the Overview, and verify the 2027 donation URL before Giving Tuesday (Dec 1).

## What runs automatically

- **7:40 am and 4:40 pm CT** (8:40 am / 5:40 pm after Mar 14, 2027): checks the Hog Blog, hogsfest.org home, Team Registration 2027, FAQs, and @hogsforthecause.
- **Critical**: push at urgent priority plus its own email, right away.
- **Content opportunity**: normal push (held overnight 9 pm–7 am) plus one digest email per check.
- **Informational**: dashboard and the Monday brief only.
- **Every morning**: a push if any post is due within 48 hours and isn't marked Ready.
- **Monday morning**: Claude researches current Instagram/TikTok trends and adds 3 trend ideas to the Idea Bank, each with the trend, source links, a brief, a shot list and a suggested post date. Then the weekly brief goes out by email (with the new ideas in it) plus a push.
  - A trend only counts as verified if its source link came from the actual search. Anything else is labeled a creative suggestion.
  - Trends the team logs with "Log a trend I spotted" get their brief in the same Monday batch.
  - Ideas never go onto the calendar by themselves; "Put on calendar" creates the post with the brief filled in.
- **Health**: if a source fails 3 checks in a row, one "Monitor needs attention" push; another when it recovers.
- **Monthly**: a tiny heartbeat commit, so GitHub doesn't pause the schedule after 60 quiet days.

## Tuning

- Keywords that decide Critical / Opportunity: `monitor/rules.json`
- Pages watched: `monitor/config.json` → `sources`. To watch another page, copy a `"type": "page"` entry and change the id, name and URL. Add `"alwaysCritical": true` to make any change on it Critical.
- Run the tests after changes: `cd monitor && npm install && npm test`
