# FTI Stock Count

Lightweight stock counting app for **From This Island**, using Google Sheets as the database and deployed on Vercel.

## Features

- **Per-device sessions** — pick a stock count session, identify yourself via counter QR, then count.
- **Scan or type** — QR scanner for counter, location, and SKU; manual entry supported.
- **Google Sheets backend** — indexes and counts live in your spreadsheet.
- **Dashboard** — locations scanned, SKUs counted, totals, top locations/counters, recent lines.
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

### Locations

| name |
|------|
| Rack A1 |
| Bay 2 |

One column only. Scan or type the **location name** (QR codes should encode the name).

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

| gudang | sku | expected_qty | counted_qty | gap_qty | last_updated |
|--------|-----|--------------|-------------|---------|--------------|

- `gudang`: from Excel column header **Lokasi**.
- `expected_qty`: sum of each unique SKU+Gudang pair from Excel column header **Tersedia**.
- `counted_qty`: live sum from the `Counts` tab for the same session and SKU+Gudang pair.
- `gap_qty`: `counted_qty - expected_qty` (positive = over, negative = short).
- Rows are excluded from baseline import when `Lokasi` is empty or SKU starts with `BND-`.

This sheet is refreshed automatically every time a count is added, edited, or deleted.

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
