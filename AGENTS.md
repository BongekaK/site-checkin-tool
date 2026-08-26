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