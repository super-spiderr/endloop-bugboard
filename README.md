# Endloop test board

Bugs, tester suggestions, the roast-line review and the roast admin for [Endloop](https://super-spiderr.github.io/endloop-site/).
A React app (Vite) served by GitHub Pages at **https://super-spiderr.github.io/endloop-bugboard/**,
with its data in a free Supabase database.

Nobody needs an account. People open the link and enter a passcode:

| Passcode | Can do |
|---|---|
| Tester | See everything, report bugs, add suggestions, suggest changes to roast lines |
| Admin  | Everything: change status, edit and delete items, review roast lines, and the **Roast admin** tab (edit, bulk edit, import, publish) |

Testers' bugs and suggestions always start as **New**. Only the admin passcode can change or delete
anything after it's been added.

## One-time setup (about 10 minutes)

1. **Create the database.** Sign in at [supabase.com](https://supabase.com), create a new project
   (the free plan is enough; pick the Mumbai region) and wait for it to finish setting up.
2. **Create the tables.** Open **SQL Editor > New query**, paste all of `supabase/schema.sql`
   and click **Run**.
3. **Load the current data.** New query, paste `supabase/seed.sql`, Run. This adds the bugs
   from the old claude.ai board and all 356 roast lines (221 English, 135 Tanglish).
4. **Turn on screenshots.** New query, paste `supabase/attachments.sql`, Run.

   **Then turn on the roast admin.** New query, paste `supabase/roast-admin.sql`, Run. Then new query,
   paste `supabase/roast-slots-migration.sql`, Run (once only). It moves the roast lines to the
   slot model and adds the new Tanglish lines; it should end by showing 223 English and 180 Tanglish.
   Don't run `seed.sql` again after this.
5. **Set the passcodes.** New query, paste `supabase/set-codes.sql`, replace the two example
   codes with your own, Run. Don't save your real codes in the repo.
6. **Give the site its Supabase keys.** In Supabase open **Project Settings > API Keys** (or **API**)
   and copy the project URL and the **anon** / **publishable** key. In GitHub open the repo's
   **Settings > Secrets and variables > Actions > Variables** and add two repository variables:
   * `VITE_SUPABASE_URL` = the project URL
   * `VITE_SUPABASE_ANON_KEY` = the anon / publishable key

   This key is meant to be public: the database only answers through the passcode-checked
   functions, so the key alone can't read or change anything.
7. **Turn on GitHub Pages.** Repo **Settings > Pages > Build and deployment > Source:
   GitHub Actions**.
8. **Deploy.** Push to `main`, or run the **Deploy to GitHub Pages** workflow from the **Actions**
   tab. The board is live at the link above when it finishes (about a minute).
9. **Share it.** Send testers the link and the tester passcode.

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
| `src/components/Attachments.jsx` | Screenshots on bugs and suggestions (pick, paste or drop) |
| `src/lib/attach.js` | Shrinks images in the browser before upload |
| `src/components/Gate.jsx` | Passcode screen |
| `src/lib/api.js` | Calls to the Supabase functions |
| `src/lib/constants.js` | Screens, severities, statuses, roast moments and placeholders |
| `src/styles.css` | All styles (Endloop tokens: Roast Red, Clash Display, Satoshi) |
| `supabase/schema.sql` | Tables and the four passcode-checked functions |
| `supabase/seed.sql` | Data moved from the claude.ai board |
| `supabase/attachments.sql` | Screenshot table and its passcode-checked functions |
| `supabase/set-codes.sql` | Sets the tester and admin passcodes |
| `supabase/roast-admin.sql` | Bulk save, published versions, rollback, and the public links the app reads |
| `supabase/roast-slots-migration.sql` | One-time move of the roast lines to slot ids (run once) |
| `src/views/RoastAdminView.jsx` | Roast admin tab: Lines (edit, bulk), Import, Publish |
| `src/components/SlotSheet.jsx` | Edit one roast slot in both languages |
| `src/lib/roastlib.js` | Slots, line checks, coverage, app pack files, CSV/JSON import (matches the app's build.py) |
| `.github/workflows/deploy.yml` | Builds and deploys to GitHub Pages |

## Day to day

* **Change a passcode:** run `supabase/set-codes.sql` again with the new code. Everyone using the
  old one is asked for the new one on their next refresh.
* **Screenshots:** anyone can add up to 8 images to a bug or suggestion (pick, paste or drop).
  They're shrunk in the browser to about 100-400 KB each. Only the admin passcode can delete them.
  The free Supabase database holds 500 MB, so roughly a couple of thousand screenshots.
* **Lock the board on a device:** the lock icon in the header.
* **Back up or analyse:** Export CSV on any tab, or Supabase **Table Editor**.
* **Roasts are managed here now.** The board is the source of truth for roast lines; the app repo's
  `design/tools/roasts/build.py` is the starting point it was loaded from.
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

## Roast admin (admin passcode only)

The **Roast admin** tab has three parts.

**Lines.** One row per slot, English and Tanglish side by side. A slot is where a line shows
(moment, level, kinds of app, roaster, optional dates); each language has its own line for it, and
the joke can differ. Click a row to edit it. Each line is **Live** (ships), **Draft** (not yet) or **Off**.
Tick rows (or "Select all shown") for bulk changes: status, level, kinds of app, roaster, show
dates, apply review decisions (a "Change" becomes the line, a "Remove" goes Off), download as
CSV, or delete. Lines testers suggested appear at the top with **Add as slot**.

**Import.** Upload CSV (download the template or all slots, edit in Sheets or Excel, upload it back)
or the app's `core.*.json` files. You see every new, changed and broken row before anything is
saved. Only columns in the file are changed, and an empty line cell leaves that line alone.

**Publish.** Checks every live line and the coverage (every language, level and kind of app needs
at least two lines), shows exactly what changes for the app, then saves a new numbered version and
makes it live. **Versions** lets you switch back to any earlier one. **Download app files** gives the
`core.*.json` and `manifest.json` to bundle inside the app (`src/roasts/`).

### What the app reads

Two public functions, no passcode, only ever the live version:

```
GET {VITE_SUPABASE_URL}/rest/v1/rpc/roast_manifest            header apikey: <publishable key>
GET {VITE_SUPABASE_URL}/rest/v1/rpc/roast_pack?p_lang=ta-Latn  header apikey: <publishable key>
```

The manifest has the live version and a checksum per language. The app should keep its bundled
pack, check the manifest at most every 12 hours, and download a pack only when its checksum changes.
Lines with `from` / `to` dates only show between those dates. When the app starts doing this,
update the privacy policy (the phone will contact the Supabase server).
