# FTI Stock Count

Lightweight stock counting app for **From This Island**, using Google Sheets as the database and deployed on Vercel.

## Features

- **Per-device sessions** — pick a stock count session, identify yourself via counter QR, then count.
- **Scan or type** — QR scanner for counter, location, and SKU; manual entry supported.
- **Google Sheets backend** — indexes and counts live in your spreadsheet.
- **Dashboard** — locations scanned, SKUs counted, totals, stock gap, SKU × gudang variance, top locations/counters, recent lines.
- **Staff assignments** — per-session locations and required SKUs with progress tracking on the count screen.
- **Admin stock import** — upload Excel baseline by session, auto-create a `SO_<sessionId>` tab, and monitor real-time stock gap.

## Google Sheet layout

Create tabs with a **header row** (row 1), data from row 2.

### Sessions

| id | name | status | pin |
|----|------|--------|-----|
| 2026-05-full-so | End May - SO | open | 4821 |

`status`: `open`, `planned`, or `closed` (closed sessions are hidden from counters).

`pin`: shared PIN counters must enter before counting. Leave blank to skip PIN for that session. The PIN is verified on the server and is never sent to the browser in the session list.

### Counters

| name |
|------|
| Nurul |
| Sonny |

One column only. Counters type or scan their **name** (QR codes should encode the name, e.g. `Nurul`).

### LocationMap (locations, gudang, required SKUs)

| location | gudang | sku |
|----------|--------|-----|
| Rack A1 | Gudang Utama | FTI-001 |
| Rack A1 | Gudang Utama | FTI-002 |
| Bay 2 | Gudang Retail | |

- **location** (A) — scan location name (master list; QR codes should encode this name).
- **gudang** (B) — warehouse for dashboard **SKU × gudang** rollup. Repeat the same gudang on each SKU row for that location.
- **sku** (C) — optional. One row per required SKU at that location (shared by all staff assigned there). Leave blank to allow any SKU from the **SKUs** tab.

The **Locations** tab is optional: if you maintain it, names are merged with column A here. You can use **LocationMap** alone.

When counters scan SKUs at a location, quantities are stored per location on **Counts**. The dashboard rolls physical totals up to **SKU × gudang** using column B. Locations counted but missing a gudang on **LocationMap** are listed on the dashboard and excluded from gudang totals.

### SystemStock (system qty by SKU × gudang)

| session_id | sku | gudang | quantity |
|------------|-----|--------|----------|
| 2026-05-full-so | FTI-001 | Gudang Utama | 120 |

Create this tab before uploading. On the dashboard, upload a CSV with `sku`, `gudang`, and `quantity` columns (header row recommended). Upload replaces all system stock rows for that session. The dashboard compares aggregated physical counts (via LocationMap) to system stock and shows variance per SKU × gudang.

### Assignments (staff → locations)

| session_id | location | name |
|------------|----------|------|
| 2026-05-full-so | Rack A1 | Nurul |
| 2026-05-full-so | Bay 2 | Nurul |
| 2026-05-full-so | Rack B3 | Sonny |

- **session_id** (A), **location** (B), **name** (C) — same values as **Sessions**, **LocationMap** (column A), and **Counters**.
- One row per staff member per location they may count.
- Required SKUs per location come from **LocationMap** column C, not this tab.

**How assignments work:**

- If **Assignments** is empty, any counter can use any location and any SKU (backward compatible).
- If a session has assignment rows, staff only see and can lock **their** locations; other locations are rejected.
- After they enter their name, their location list appears (gray until complete, **green** when every required SKU at that location has a saved count).
- If **LocationMap** column C is blank for a location, any SKU is allowed there; the location turns green after the first saved count.

**Legacy:** column D on **Assignments** (`sku`) still works if column C on **LocationMap** is empty for that location.

### SKUs

| sku | name | barcode |
|-----|------|---------|
| FTI-001 | Coconut Soap | 1234567890123 |

If `barcode` is empty, the `sku` column is used for matching.

### Counts (append-only)

| timestamp | session_id | counter | location | sku | quantity | device_id | count_id |
|-----------|------------|---------|----------|-----|----------|-----------|----------|

The app appends one row per saved count. Column **count_id** (H) is auto-generated for edit/delete. Existing rows without `count_id` can still be edited by row.

Counters can view, edit, and delete **only their own** lines for the active session (by `count_id`). Duplicate lines for the same counter + location + SKU in one session are blocked; another counter may count the same SKU at the same location for double-checks.

The **dashboard** uses the same session PIN as counting.

### Session stock sheet (`SO_<sessionId>`)

Generated from Admin import (`/admin/opname`) using the uploaded Excel file:

| gudang | sku | expected_qty | counted_qty | gap_qty | variance_pct | last_updated |
|--------|-----|--------------|-------------|---------|--------------|--------------|

- `gudang`: from Excel column header **Lokasi**.
- `expected_qty`: sum of each unique SKU+Gudang pair from Excel column header **Tersedia**.
- `counted_qty`: live sum from the `Counts` tab for the same session and SKU+Gudang pair.
- `gap_qty`: `counted_qty - expected_qty` (positive = over, negative = short).
- `variance_pct`: `(gap_qty / expected_qty) * 100`, rounded to 2 decimals (0 when expected is 0).
- Rows are excluded from baseline import when `Lokasi` is empty or SKU starts with `BND-`.

This sheet is refreshed automatically every time a count is added, edited, or deleted.

Counts are aggregated into the session stock sheet only when a `location` has a **LocationMap** entry. Unmapped count locations are ignored for opname gap totals (and listed on the dashboard).

## Google Cloud setup

1. Create a service account and download the JSON key.
2. Enable **Google Sheets API** and **Google Drive API**.
3. Share the spreadsheet with the service account email (Editor).
4. Copy the spreadsheet ID from the URL.

## Environment variables

Copy `.env.example` to `.env.local` for local dev:

```bash
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
```

On Vercel, add the same variables in Project → Settings → Environment Variables. Paste the full JSON on one line for `GOOGLE_SERVICE_ACCOUNT_JSON`.

Set `SESSION_AUTH_SECRET` to a long random string (e.g. 32+ characters) so unlock tokens cannot be forged.

Optional: rename tabs or column indexes via env vars (see `.env.example`).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

```bash
npx vercel
```

Or connect the GitHub repo in the Vercel dashboard. Set the environment variables for Production and Preview.

## App routes

| Route | Purpose |
|-------|---------|
| `/` | Home |
| `/count` | Counting flow |
| `/dashboard` | Progress metrics |
| `/admin/opname` | Admin Excel import + baseline session stock sheet |

## Custom column layout

If your index tabs use different column order, set zero-based indexes:

```
COL_SESSION_ID=0
COL_SESSION_NAME=1
COL_SESSION_STATUS=2
```

Same pattern for counters, locations, and SKUs (`COL_SKU_CODE`, etc.).
