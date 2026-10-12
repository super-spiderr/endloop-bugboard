# Endloop test board

Bugs, tester suggestions and the roast-line review for [Endloop](https://super-spiderr.github.io/endloop-site/).
A React app (Vite) served by GitHub Pages at **https://super-spiderr.github.io/endloop-bugboard/**,
with its data in a free Supabase database.

Nobody needs an account. People open the link and enter a passcode:

| Passcode | Can do |
|---|---|
| Tester | See everything, report bugs, add suggestions, suggest changes to roast lines |
| Admin  | Everything: change status, edit and delete items, review and edit roast lines |

Testers' bugs and suggestions always start as **New**. Only the admin passcode can change or delete
anything after it's been added.

## One-time setup (about 10 minutes)

1. **Create the database.** Sign in at [supabase.com](https://supabase.com), create a new project
   (the free plan is enough; pick the Mumbai region) and wait for it to finish setting up.
2. **Create the tables.** Open **SQL Editor > New query**, paste all of `supabase/schema.sql`
   and click **Run**.
3. **Load the current data.** New query, paste `supabase/seed.sql`, Run. This adds the bugs
   from the old claude.ai board and all 356 roast lines (221 English, 135 Tanglish).
4. **Set the passcodes.** New query, paste `supabase/set-codes.sql`, replace the two example
   codes with your own, Run. Don't save your real codes in the repo.
5. **Give the site its Supabase keys.** In Supabase open **Project Settings > API Keys** (or **API**)
   and copy the project URL and the **anon** / **publishable** key. In GitHub open the repo's
   **Settings > Secrets and variables > Actions > Variables** and add two repository variables:
   * `VITE_SUPABASE_URL` = the project URL
   * `VITE_SUPABASE_ANON_KEY` = the anon / publishable key

   This key is meant to be public: the database only answers through the passcode-checked
   functions, so the key alone can't read or change anything.
6. **Turn on GitHub Pages.** Repo **Settings > Pages > Build and deployment > Source:
   GitHub Actions**.
7. **Deploy.** Push to `main`, or run the **Deploy to GitHub Pages** workflow from the **Actions**
   tab. The board is live at the link above when it finishes (about a minute).
8. **Share it.** Send testers the link and the tester passcode.

## Working on it locally

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev                  # http://localhost:5173/endloop-bugboard/
```

`npm run build` writes the static site to `dist/`. Every push to `main` builds and deploys it.

## Code map

| Path | What it is |
|---|---|
| `src/App.jsx` | Passcode state, data loading (every 30 s), tabs, saving, CSV export |
| `src/views/` | Dashboard, Bugs, Suggestions and Roasts tabs |
| `src/components/ItemSheet.jsx` | The add/edit sheet and every form, plus what gets saved |
| `src/components/Gate.jsx` | Passcode screen |
| `src/lib/api.js` | Calls to the Supabase functions |
| `src/lib/constants.js` | Screens, severities, statuses, roast moments and placeholders |
| `src/styles.css` | All styles (Endloop tokens: Roast Red, Clash Display, Satoshi) |
| `supabase/schema.sql` | Tables and the four passcode-checked functions |
| `supabase/seed.sql` | Data moved from the claude.ai board |
| `supabase/set-codes.sql` | Sets the tester and admin passcodes |
| `.github/workflows/deploy.yml` | Builds and deploys to GitHub Pages |

## Day to day

* **Change a passcode:** run `supabase/set-codes.sql` again with the new code. Everyone using the
  old one is asked for the new one on their next refresh.
* **Lock the board on a device:** the lock icon in the header.
* **Back up or analyse:** Export CSV on any tab, or Supabase **Table Editor**.
* **Apply roast decisions to the app:** export the Roasts tab, then update
  `src/roasts/core.en.json` and `core.ta-Latn.json` in the app repo.
* **New screens or roast moments:** edit `src/lib/constants.js`.

## How it's protected

* All tables have row-level security on and no policies, and the public roles have no table
  privileges, so the Supabase API can't read or write them directly.
* The site calls four functions: `board_read`, `board_save`, `board_save_roast` and
  `board_delete`. Each one checks the passcode against a bcrypt hash before doing anything.
  A wrong code waits one second before failing, to slow guessing.
* The page is marked `noindex`, so search engines won't list it.

Use long passcodes (four or more random words). Anyone who has the tester passcode can read
everything on the board.
