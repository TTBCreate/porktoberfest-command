// Starting content, loaded once from the dashboard ("Load starting content").
// Posts come from the client brief's November plan. Alerts are the real items found by hand on Nov 7, 2026.

export const SEED_POSTS = [
  { id: 'p-1110', date: '2026-11-10', platform: 'Instagram Reel', campaign: 'Reignite', series: '80s action-movie parodies', format: 'Reel 12–18s', title: 'Some Things Never Leave You', concept: 'Quiet nostalgic opening, then rapid archival clips of smoke, mustaches, cooking, dancing and team celebrations.', hook: 'Quiet open, then the cut.', script: '', caption: '', footage: 'Archive: smokers, costumes, dancing, celebrations', audio: '', editing: 'Closing card: "Porktoberfest. It’s a condition."', cta: 'Follow along', prod: 'Idea', pub: 'Not scheduled', url: '', results: '' },
  { id: 'p-1117', date: '2026-11-17', platform: 'Instagram Reel', campaign: 'Reignite', series: 'Meet the Meatheads', format: 'Reel 18–25s', title: 'The Usual Suspects', concept: 'Real team members introduced as characters in an exaggerated 1980s action-movie trailer: Nick the Smoke Commander, Director of Hydration, Chief Morale Officer, Minister of Propaganda.', hook: 'Freeze-frame title cards', script: '', caption: '', footage: 'Archive: one clip per team member', audio: 'Dramatic trailer narration', editing: 'Freeze frames, VHS effects', cta: 'Tag your favorite suspect', prod: 'Idea', pub: 'Not scheduled', url: '', results: '' },
  { id: 'p-1120', date: '2026-11-20', platform: 'Instagram Reel', campaign: 'Reignite', series: 'The Pitmaster Files', format: 'Reel 12–20s', title: 'Classified: The Pitmaster Files', concept: 'A fictional government investigation into the secrets of Porktoberfest barbecue, using real footage of Nick cooking.', hook: '"The following footage has been classified by the United States Department of Pork."', script: '', caption: '', footage: 'Archive: Nick cooking, smoker close-ups', audio: '', editing: 'Redaction bars, case-file overlays', cta: 'Follow for the next file', prod: 'Idea', pub: 'Not scheduled', url: '', results: '' },
  { id: 'p-1124', date: '2026-11-24', platform: 'Instagram Reel', campaign: 'Reignite', series: 'Holiday comedy', format: 'Reel 15–20s', title: 'Thankful for This Crew', concept: 'Genuine team and supporter footage highlighting gratitude, friendship and the mission.', hook: '', script: '', caption: '', footage: 'Archive: team and supporters', audio: '', editing: '', cta: 'Thank a teammate in the comments', prod: 'Idea', pub: 'Not scheduled', url: '', results: '' },
  { id: 'p-1126', date: '2026-11-26', platform: 'Instagram Story', campaign: 'Reignite', series: 'Holiday comedy', format: 'Story 10–15s', title: 'Thanksgiving Dispatch', concept: 'The social media manager in full Oktoberfest costume delivers an absurdly serious Thanksgiving greeting.', hook: '', script: '', caption: '', footage: 'New: self-filmed in costume', audio: '', editing: '', cta: '', prod: 'Idea', pub: 'Not scheduled', url: '', results: '' },
  { id: 'p-1129', date: '2026-11-29', platform: 'Instagram Reel', campaign: 'Entertain & Fundraise', series: 'More Than Meat', format: 'Reel 15–20s', title: 'Behind the Mustaches', concept: 'Funny team footage transitions into the serious mission, teasing Giving Tuesday.', hook: '"Behind every mustache is a mission."', script: '', caption: '', footage: 'Archive: antics plus mission moments', audio: '', editing: '', cta: 'Giving Tuesday is Dec 1', prod: 'Idea', pub: 'Not scheduled', url: '', results: '' },
  { id: 'p-1201', date: '2026-12-01', platform: 'Instagram Reel', campaign: 'Entertain & Fundraise', series: 'More Than Meat', format: 'Reel 35–45s (hero)', title: 'More Than Meat — Giving Tuesday', concept: 'Begins with absurd Oktoberfest humor, moves to real teamwork and fundraising, ends with an emotional appeal.', hook: '"We know what this looks like."', script: '0–8s funny archive ("We know what this looks like.") · 8–18s cooking, prep, volunteers ("But there’s a reason we do it.") · 18–32s fundraising and mission · 32–45s donation appeal. Close: "Help us make the ridiculous mean something."', caption: 'MEAT. MUSTACHES. MAYHEM. FOR A MISSION.', footage: 'Archive: funny, cooking, volunteers, fundraising', audio: 'Cinematic build', editing: '', cta: 'Donate (verified 2027 link required)', prod: 'Idea', pub: 'Not scheduled', url: '', results: '', hero: true },
];

export const SEED_IDEAS = [
  { id: 'i-nog', series: 'Hog on the Nog', title: 'Hog Elf returns', note: 'Recurring holiday series with real props and the real team. No AI-generated scenes.', type: 'Reel', effort: 'Medium', footage: 'New + archive' },
  { id: 'i-file2', series: 'The Pitmaster Files', title: 'File #2: The Rub', note: 'Continue the Department of Pork investigation with new cooking footage.', type: 'Reel', effort: 'Low', footage: 'Nick cooking' },
  { id: 'i-cutdowns', series: 'More Than Meat', title: 'Giving Tuesday cut-downs', note: '15s and 6s edits of the Dec 1 hero Reel for Stories.', type: 'Story', effort: 'Low', footage: 'Hero Reel' },
  { id: 'i-solo', series: 'Meet the Meatheads', title: 'One-member trailers', note: 'Spin each Usual Suspects character into a solo 10s trailer.', type: 'Reel', effort: 'Low', footage: 'Archive per member' },
  { id: 'i-countdown', series: 'Event countdowns', title: 'Dramatic countdown narrator', note: 'Self-filmed in costume, weekly from February.', type: 'Reel', effort: 'Low', footage: 'New: self-filmed' },
  { id: 'i-sponsor', series: 'Sponsor spotlights', title: 'Sponsor "mission briefing"', note: 'Real sponsor interaction framed as a spy briefing. Needs confirmed sponsors.', type: 'Reel', effort: 'Medium', footage: 'New: sponsor visit' },
  { id: 'i-brat', series: 'Behind the Brat', title: 'Menu development diaries', note: 'Cooking trials in January.', type: 'Reel', effort: 'Medium', footage: 'New: cooking trials' },
  { id: 'i-milestone', series: 'Fundraising milestones', title: 'Milestone freeze-frames', note: 'Short celebration each time a verified total crosses a goal line.', type: 'Reel', effort: 'Low', footage: 'Archive celebrations' },
];

const found = '2026-11-07', createdAt = Date.parse('2026-11-07T18:00:00Z');
export const SEED_ALERTS = [
  { id: 'manual-registration', tier: 'crit', title: 'Team Registration 2027 is open', source: 'hogsfest.org', url: 'https://hogsfest.org/team-registration-2027/', pub: 'Not stated', found, createdAt, via: 'manual', done: false, summary: 'Page says "Team Registration is now open!" 10x10 plot $700 (10 bracelets), 20x20 $1,150 (15 bracelets). 40x40, 60x40 and 100x40 plots are sold out. No deadline posted.', action: 'Confirm Porktoberfest is registered and which plot size. Ask organizers about Tent A5 and the 2027 site assignment.' },
  { id: 'manual-minimum', tier: 'crit', title: 'Fundraising minimum needs confirming', source: 'hogsfest.org FAQs', url: 'https://hogsfest.org/faqs/', pub: 'Page updated 2025-12-09', found, createdAt, via: 'manual', done: false, summary: 'The FAQ says a team must raise at least $4,000. That page was last updated December 2025 and the 2027 registration page does not repeat it.', action: 'Confirm the 2027 minimum with organizers before setting the public fundraising goal.' },
  { id: 'manual-earlybird', tier: 'opp', title: 'Early Bird Tickets for Hogs 2027 are on sale', source: 'Hog Blog', url: 'https://hogsforthecause.org/early-bird-tickets-for-hogs-2027-are-on-sale-now/', pub: '2026-10-14', found, createdAt, via: 'manual', done: false, summary: 'Limited early bird tickets for March 19–20, 2027 at UNO Lakefront, a few weeks earlier than the usual April date. The post asks fans to tag @hogsforthecause.', action: 'Story or Reel nudging followers to grab early bird tickets and tag @hogsforthecause, using real tent footage from past years.' },
  { id: 'manual-plano', tier: 'opp', title: 'Outpatient unit coming to Children’s Medical Center Plano', source: 'Hog Blog', url: 'https://hogsforthecause.org/hogs-for-the-cause-outpatient-unit-coming-to-childrens-medical-center-plano/', pub: '2026-09-30', found, createdAt, via: 'manual', done: false, summary: 'Hogs for the Cause announced a new outpatient unit at Children’s Medical Center Plano.', action: 'Use as a mission proof point in "Behind the Mustaches" (Nov 29) or the More Than Meat Giving Tuesday Reel.' },
  { id: 'manual-dates', tier: 'info', title: 'Festival dates confirmed: March 19–20, 2027', source: 'hogsfest.org FAQs', url: 'https://hogsfest.org/faqs/', pub: 'Not stated', found, createdAt, via: 'manual', done: false, summary: 'UNO Lakefront Arena Festival Grounds, 6801 Franklin Ave. Gates 3:30 pm Friday, 11:00 am Saturday.', action: 'No action. The dates in the brief are verified.' },
];

export const SEED_SETTINGS = {
  eventStart: '2027-03-19T15:30:00-05:00',
  eventLabel: 'March 19–20 · UNO Lakefront',
  tent: '',
  goal: null, verifiedTotal: null, totalAsOf: '', donationUrl: '',
  history: '2025 final: $76,576. 2026 Reel showed $80,000+ (exact final not yet verified).',
  deadlines: [
    { date: '2026-11-30', title: 'Verify the 2027 donation URL', note: 'Required before the More Than Meat Reel goes out.' },
    { date: '2026-12-01', title: 'Giving Tuesday', note: 'Hero Reel: More Than Meat.' },
    { date: '2027-03-19', title: 'Hogs for the Cause, Day 1', note: 'Gates 3:30 pm, UNO Lakefront.' },
  ],
  events: [
    { date: '2026-12-01', title: 'Giving Tuesday' },
    { date: '2027-02-09', title: 'Mardi Gras' },
    { date: '2027-03-19', title: 'Hogs Day 1' },
    { date: '2027-03-20', title: 'Hogs Day 2' },
  ],
};
