# AGENTS.md - Site Check-In Tool Context & Rules

## Project Mission
Lightweight full-stack site visit logging tool for field technicians.
Assessment Goal: Autonomous AI agent execution, clean code architecture, automated testing, and single-container deployment.

## Technology Stack
- Runtime: Node.js 20+ with TypeScript
- Web Framework: Express.js (serves REST API and static frontend)
- Database: SQLite (via `better-sqlite3`)
- Frontend: Vanilla HTML5 / CSS3 / JavaScript (no complex bundlers)
- Deployment Target: Google Cloud Run (Single Docker container on port 8080)

## Phase 1 Requirements
1. Database Entity: `visits` table (`id`, `site_name`, `technician_name`, `visit_datetime`, `status`, `notes`, `created_at`).
2. API Endpoints:
   - `POST /api/visits`: Log a visit (`site_name`, `technician_name`, `visit_datetime`, `status` ['completed', 'issue found'], `notes`).
   - `GET /api/visits`: Return visits with optional filters (`site`, `startDate`, `endDate`).
3. Frontend: Simple check-in form and responsive table listing all visits with filter inputs.
4. Database initialization must be idempotent (`CREATE TABLE IF NOT EXISTS`).

## Operational Rules for the Agent
- Self-contained builds: Single container deployment.
- Never write destructive migrations that break previous data.
- Run integration tests (`npm test`) to verify all endpoints before finishing.



# AGENTS.md - Site Check-In Tool Context & Rules

## Phase 1 Requirements (Completed & Deployed v1.0)
- Log site visits (`site_name`, `technician_name`, `visit_datetime`, `status`, `notes`).
- Filter visits by site name, start date, and end date.
- Persistent SQLite storage and unit/integration tests.

## Operational Rules for the Agent
- Self-contained builds: Single container deployment.
- Never write destructive migrations that wipe previous data.
- Run integration tests (`npm test`) to verify all endpoints before finishing.

## Phase 2 Requirements (The Change Request)
1. Offline Deduplication:
   - Handle repeated submissions gracefully when offline technicians reconnect.
   - Prevent duplicate records on matching compound fields: `site_name` + `technician_name` + `visit_datetime`.
   - Use `INSERT OR IGNORE` or unique constraint handling so duplicate payloads do not increase visit counts.

2. Weekly Summary View:
   - Aggregated metrics per site grouped by week (e.g. `strftime('%Y-%W', visit_datetime)` or ISO week).
   - Display: Site Name, Week/Date Range, Total Visits, and Total with status 'issue found'.
   - Endpoint: `GET /api/visits/summary`.
   - UI: Dedicated "Weekly Summary" section/table.

3. Non-Destructive Visit Corrections & Audit Log:
   - Allow technicians to edit existing visits: `PUT /api/visits/:id` (updating `status` and `notes`).
   - Create `visit_history` table: `(id INTEGER PRIMARY KEY AUTOINCREMENT, visit_id INTEGER NOT NULL, previous_status TEXT NOT NULL, previous_notes TEXT, changed_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (visit_id) REFERENCES visits(id))`.
   - Before executing the update on `visits`, archive the prior record in `visit_history` within an atomic transaction.
   - UI: Provide an "Edit / Correct" modal or inline form on each visit row, displaying audit history.
   - CRITICAL: All Phase 1 data in `visits` must remain completely intact. Never drop or recreate existing tables.

4. Testing & Integrity:
   - Maintain 100% passing tests in `tests/visits.test.ts` covering duplicate prevention, weekly aggregation, and audit trails.

## Phase 2 Data Integrity & Migration Rules
1. Zero Data Loss:
   - Never run `DROP TABLE` or recreate the `visits` table.
   - All existing rows in `visits` must be preserved.

2. Full Backward Compatibility:
   - Existing Phase 1 visits must support `PUT /api/visits/:id` and have an active "Edit / Correct" button in the UI.
   - Editing an existing Phase 1 visit for the first time will create its first entry in `visit_history` with the timestamp of the edit.
   - Existing Phase 1 visits must immediately aggregate into `GET /api/visits/summary` metrics (total visits and issues found count).
   - The unique index (`site_name`, `technician_name`, `visit_datetime`) must apply to prevent duplicates going forward without altering existing data.

3. Offline Deduplication:
   - Prevent duplicate visits when the same site, technician name, calendar date (ignoring exact time), and notes are submitted.
   - Extract the calendar date (`date(visit_datetime)`) when checking for existing entries.
   - Return 200/201 without creating an additional row if a record with the same site, technician, calendar date, and notes already exists.