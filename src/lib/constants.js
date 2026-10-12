// Labels and colours shared across the board. Each entry is [value, label, colour?].

export const SCREENS = [
  ["S01", "Welcome"], ["S02", "Usage Access"], ["S03", "Pick apps"], ["S04", "Intensity"],
  ["S05", "Limits"], ["S06", "Permissions"], ["S07", "Home"], ["S08", "Notifications"],
  ["S09", "Roast screen"], ["S10", "Snooze friction"], ["S11", "App detail"], ["S12", "Stats"],
  ["S13", "Weekly roast"], ["S14", "Settings"], ["S15", "Paywall"], ["S16", "Edge cases"],
  ["S17", "App icon"], ["BG", "Background / native"], ["OTHER", "Other / whole app"],
];

export const SEV = [
  ["crash", "Crash", "var(--sev-crash)"],
  ["major", "Major", "var(--sev-major)"],
  ["minor", "Minor", "var(--sev-minor)"],
  ["polish", "Polish", "var(--sev-polish)"],
];

export const STATUS = [
  ["new", "New", "var(--red)"],
  ["confirmed", "Confirmed", "var(--heads)"],
  ["progress", "In progress", "var(--blue)"],
  ["fixed", "Fixed", "var(--chill)"],
  ["wontfix", "Won't fix", "var(--sev-polish)"],
];

export const ROASTER = [["", "Not specific"], ["loop", "Loop"], ["lupe", "Lupe"], ["both", "Both"]];

export const KINDS = [
  ["roast", "Roast", "var(--red)"],
  ["ui", "UI and design", "var(--violet)"],
  ["feature", "Feature", "var(--blue)"],
  ["other", "Other", "var(--sev-polish)"],
];

export const SSTATUS = [
  ["new", "New", "var(--red)"],
  ["considering", "Considering", "var(--heads)"],
  ["planned", "Planned", "var(--blue)"],
  ["done", "Done", "var(--chill)"],
  ["declined", "Not doing", "var(--sev-polish)"],
];

export const INTENSITY = [
  ["", "Any level"], ["polite", "Polite"], ["honest", "Honest"], ["savage", "Savage"], ["unhinged", "Unhinged"],
];

export const REVIEW = [
  ["unreviewed", "Not reviewed", "var(--sev-polish)"],
  ["keep", "Keep", "var(--chill)"],
  ["change", "Change", "var(--blue)"],
  ["remove", "Remove", "var(--red)"],
  ["new", "New line", "var(--violet)"],
];

export const LANGS = [["en", "English"], ["ta-Latn", "Tanglish"]];

export const CAT_LABEL = {
  limit_hit: "Limit hit", heads_up: "Heads up (75%)", last_call: "Last call (90%)", late_night: "Late night",
  snooze_ask: "Snooze: ask", snooze_sentence_1: "Snooze: sentence 1", snooze_sentence_2: "Snooze: sentence 2",
  after_snooze: "After snooze", snoozes_used_up: "Snoozes used up", snooze_backout: "Snooze: backed out",
  comparison: "Comparison", win_streak: "Win: streak", win_streak_7: "Win: 7-day streak",
  win_first_roast: "Win: first roast", win_perfect_day: "Win: perfect day", win_lowered_limit: "Win: lowered limit",
  weekly_good: "Weekly: good", weekly_bad: "Weekly: bad", weekly_mixed: "Weekly: mixed", weekly_first: "Weekly: first",
  home_under: "Home: under", home_close: "Home: close", home_over: "Home: over", home_day1: "Home: day one",
};

export const PLACEHOLDERS = [
  "app", "clock", "left", "limit", "opens", "over", "streak", "time", "week_total", "won_back", "worst_app", "worst_time",
];
/** What the Kotlin watcher can fill in native notifications. */
export const NATIVE_PLACEHOLDERS = ["app", "time", "limit", "left", "over", "clock", "opens"];
export const NATIVE_CATEGORIES = ["heads_up", "last_call", "limit_hit"];
