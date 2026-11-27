# AGENTS.md — GATEOPS Autonomous Engineering Contract

> **Authority:** This file is the repository-wide engineering contract for every human and AI agent working in GATEOPS. Read it before planning, editing, generating files, running commands, or opening a pull request.
>
> **Product source of truth:** `PRD.md`. This file governs how the product is implemented and verified; it does not silently change product requirements.
>
> **Core rule:** A feature is not complete because code exists, a page renders, a build passes, or a mock looks convincing. It is complete only when the real user flow works through the UI, authorization, application logic, persistence, and automated tests.

---

## 1. Mission and non-negotiable outcome

Build GATEOPS as a usable, secure, role-aware personnel presence and movement monitoring web application.

The agent is expected to work autonomously: inspect the repository, understand the product contract, plan a bounded vertical slice, implement it, run the local toolchain, fix failures, verify the user journey, document evidence, and continue to the next unblocked slice.

**Never report success without evidence. Never claim a feature is verified when only its code, typecheck, lint, or build has been checked.**

### Absolute prohibitions

Do not introduce or leave behind:

- Stub, placeholder, scaffold-only, fake, mock-only, demo-only, or hardcoded implementations in production paths.
- Buttons, links, menu items, forms, filters, tabs, dialogs, or actions that appear functional but do nothing or only show a toast without completing the operation.
- Fake success responses, fabricated records, fixed dashboard metrics, simulated authentication, or local arrays masquerading as persisted application data.
- TODO/FIXME comments used as a substitute for required implementation.
- Disabled controls used to conceal unfinished functionality.
- In-memory persistence as a substitute for the actual persistence layer.
- Direct database edits, SQL console manipulation, or manual row insertion as the way to complete or verify an application workflow.
- Tests that only assert that a component renders while omitting the actual user interaction and resulting state.
- Broad catch blocks that swallow failures, false-positive tests, skipped tests, or weakened assertions to make CI green.
- Silent changes to product requirements, role permissions, data retention, transaction semantics, or security policy.
- Unrelated rewrites or dependency churn without a concrete need.

Mocks and fakes are permitted **only inside isolated automated tests** when they are the correct test boundary. They must never be wired into a user-facing production route or presented as real persisted behavior. Use real local database integration tests for persistence and transaction-critical behavior.

If a required external integration is unavailable, implement and verify the feature against a real local adapter or local service with the same application contract. Clearly record what has and has not been verified. Do not claim production-provider verification.

---

## 2. Authority, requirement traceability, and pending decisions

Before implementation:

1. Read all of `PRD.md`, this file, existing documentation, source code, migrations, tests, package manifests, and CI configuration that exist.
2. Inspect the current branch, working tree, recent commits, and existing feature behavior.
3. Map each requirement to UI route/component, application service/API, persistence model, authorization rule, and test.
4. Preserve existing working behavior. Establish a baseline before modifying it.

### Requirement precedence

1. Explicit Owner decisions recorded in the repository.
2. Approved PRD requirements and acceptance criteria.
3. Existing documented decisions that do not conflict with higher authority.
4. Engineering judgment for implementation details only.

Engineering judgment must not invent product policy.

### Pending requirements

PRD section **25 — ITEMS NOT YET DEFINED** is explicitly unresolved. Every item there remains **PENDING** until the Owner decides it. Do not quietly convert it into a final product decision.

For each pending item:

- Search the repository for a later explicit decision before asking.
- If it is not decided, record it in a Decision Register as `PENDING_OWNER_DECISION`.
- Continue work that does not depend on that decision.
- If it blocks a user-visible behavior or data contract, isolate the dependency and stop only that slice; proceed with other independent work.
- Ask the Owner one concise, specific question when a decision is genuinely blocking.
- Never invent deletion semantics, account lifecycle rules, QR security policy, report period/layout, concurrency behavior, GPS thresholds, or Persit edge-case policy.

Implementation details such as component boundaries, code organization, test framework, and local developer tooling may be chosen autonomously if they preserve the product contract and are documented.

---

## 3. Autonomous execution loop

For every task or vertical slice, follow this loop without waiting for step-by-step direction:

### A. Inspect

- Read the relevant product requirements and existing implementation.
- Identify dependencies, affected routes, data entities, role boundaries, and side effects.
- Run the existing relevant tests before changes when practical.
- Record existing failures separately; do not attribute pre-existing failures to the new work.

### B. Plan

- Define a small but complete vertical slice.
- List the user-visible outcome, data changes, authorization rules, failure paths, and tests.
- Add an `IN_PROGRESS` entry to `progres.md` **before implementation**. Include goal, scope, acceptance criteria, risks, and branch.
- Do not start a second overlapping implementation that could conflict with the first.

### C. Implement

- Implement the complete user journey, not disconnected layers.
- Connect UI to real application services and persistence.
- Implement server-side validation and authorization; never rely on hidden UI controls alone.
- Implement loading, empty, error, success, and confirmation behavior.
- Add migrations, constraints, indexes, seed fixtures, and rollback strategy as needed.
- Keep local development reproducible from documented commands.
- Update `progres.md` immediately if scope, risks, decisions, or blockers change.

### D. Verify

- Run formatting, lint, typecheck, unit tests, integration tests, end-to-end tests, accessibility checks, and production build where configured and relevant.
- Run the application locally and exercise the real UI flow using browser automation.
- Verify the persisted result through application read paths and automated database assertions. Do not manually edit database rows to make the test pass.
- Test both allowed and denied roles, including direct URL/API access.
- Test success and failure paths, including network/server failures.
- Fix failures at their source. Do not suppress, skip, or weaken tests to obtain a green result.

### E. Close the slice

- Review the diff for accidental changes, secrets, dead code, placeholders, and incomplete interactions.
- Update tests and documentation.
- Append a completion entry to `progres.md`; never overwrite previous entries.
- Report exact commands and outcomes, test counts, known limitations, branch, commit SHA, PR number, or CI run when available.
- Use status `VERIFIED` only when relevant automated tests and UI journey evidence pass. Use `IMPLEMENTED` when code is implemented but verification is incomplete. Use `BLOCKED` when a real dependency prevents progress. Never label unmerged work as merged; mark it `UNMERGED`.

### Continue autonomously

After closing a slice, choose the next highest-priority unblocked slice from the PRD and traceability matrix. Do not stop after creating a plan, skeleton, design, or first screen. Continue until all authorized, testable requirements are implemented and verified, or a genuine Owner decision/external blocker remains.

---

## 4. Vertical-slice definition of done

A feature is not done until all applicable layers below are complete:

1. **Navigation and UI:** reachable from the correct role's navigation and usable on supported screen sizes.
2. **Interaction:** every visible control performs its documented action; forms have validation and feedback.
3. **Application logic:** business rules live in the appropriate trusted application/server layer.
4. **Authorization:** server-side permission and record-scope enforcement is present for every read and write.
5. **Persistence:** data is stored and retrieved through the real repository/database layer; constraints protect invariants.
6. **Failure handling:** expected validation, permission, network, server, conflict, and not-found failures are handled explicitly.
7. **UI states:** relevant loading, empty, error, success, and confirmation states exist and are tested.
8. **Automated tests:** unit + integration + end-to-end coverage appropriate to risk, including negative authorization cases.
9. **Local runtime:** the feature works in a running local application, not merely in isolated component tests.
10. **Documentation:** setup, behavior, decisions, and progress evidence are current.

A feature that is missing one applicable layer remains incomplete and must not be reported as verified.

---

## 5. UI quality and complete state coverage

Every data-driven page and interactive workflow must define and test the following states where applicable:

| State | Required behavior |
|---|---|
| Initial/loading | Clear progress indication; prevent duplicate submission; maintain layout stability. |
| Empty | Explain that no data exists and provide a valid next action when one is allowed. |
| Validation error | Identify the invalid field and explain how to correct it; preserve safe user input. |
| Network error | Explain that the request could not reach the server; provide a retry path where safe. |
| Server error | Show a safe, actionable message and correlation/reference ID where available; do not expose stack traces or secrets. |
| Unauthorized/forbidden | Redirect or render the correct access-denied behavior without leaking protected data. |
| Not found | Render a deliberate not-found state, not a blank screen or raw exception. |
| Conflict | Explain that the operation conflicts with current data and guide the user to refresh/retry safely. |
| Success | Confirm the completed operation and show authoritative server-returned state. |
| Confirmation | Require explicit confirmation for destructive or consequential actions; state what will happen. |

Requirements:

- Do not display success before the server confirms persistence.
- Disable or guard repeated submissions while a request is pending.
- Preserve idempotency or prevent duplicate transactions where required.
- Use accessible labels, keyboard navigation, focus management, contrast, and semantic controls.
- Avoid browser-native alert/confirm as the only designed interaction for important flows.
- Tables must have deliberate empty, loading, error, and pagination behavior when pagination is implemented.
- Responsive layouts must be exercised at mobile and desktop widths.
- Use the PRD's Apple Style, Light Mode, and sidebar direction consistently.
- No decorative action controls that have no implemented behavior.

---

## 6. Roles, authorization, and privacy

The four product roles are:

- `SUPER_ADMIN`
- `KOMANDAN`
- `PERSONEL`
- `PERSIT`

Use one centralized, typed authorization policy as the source of truth. Navigation visibility is a convenience only; it is not security.

For every protected operation:

- Authenticate the actor on the server.
- Authorize the role and the specific action on the server.
- Enforce ownership/record scope in the query or service layer.
- Deny by default.
- Return safe 401/403 behavior.
- Add tests for allowed and denied cases.
- Ensure unauthorized users cannot infer protected data from counts, search results, exports, API responses, error messages, or related records.

### PRD role boundaries

- **Super Admin:** full operational visibility and system management as specified in the PRD.
- **Komandan:** operational monitoring, personnel read access, GPS, activity history, PDF reporting, and own password change; no management mutations.
- **Personel:** own presence transactions, own activity history/details, and own password change only.
- **Persit:** self-registration, link request, and only the verified linked personnel identity/presence fields permitted by PRD. No GPS, last location, destination, purpose, timestamps, activity history, or other personnel data.

Create automated role-matrix tests. Test UI navigation and direct API/server actions for every role. Do not depend on client-side route guards alone.

---

## 7. Data integrity and business-critical workflows

Presence and activity transitions are business-critical. They must be implemented as trusted server-side operations with database-enforced invariants and transactional behavior.

### Presence and activity

- Presence states are only `DI_DALAM` and `DI_LUAR`.
- Initial presence is `DI_DALAM`.
- Activity states are only `AKTIF` and `SELESAI`.
- A successful exit records the exit time, gate, destination, and purpose; sets presence to `DI_LUAR`; creates an `AKTIF` activity.
- A successful return records return time; sets presence to `DI_DALAM`; completes the active activity; calculates duration.
- A disabled gate rejects both exit and return without changing presence or creating a successful transaction.
- GPS availability must never cancel a valid exit or change presence state.
- GPS stores only the latest location per personnel; do not create route history.
- Persist and display timestamps consistently; display timezone follows the device as specified by PRD.

### Transaction safety

- Never implement a read-then-write state transition in a way that permits two concurrent requests to corrupt presence/activity state.
- Use database transactions, row locks, unique/partial constraints, or equivalent concurrency-safe mechanisms.
- Define idempotency and duplicate-scan handling in the application design.
- The PRD's scan-concurrency wording must be reconciled carefully: do not assume that two simultaneous scans should both succeed. Record the exact concurrency policy as pending if not explicitly decided by the Owner.
- A failed transaction must not leave presence and activity inconsistent.
- A successful transaction must be durable before UI success is shown.
- Test simultaneous requests, duplicate submissions, invalid QR, unknown QR, inactive gate, expired session, and persistence failure.

### Sensitive data

- Passwords must never be stored or logged in plaintext. Hash passwords using a maintained password-hashing algorithm appropriate to the selected stack.
- Never expose password hashes, reset secrets, session tokens, or raw secrets to the browser.
- Treat GPS coordinates and movement records as sensitive operational data.
- Apply least privilege and safe logging. Do not log full credentials, reset tokens, or unnecessary location payloads.
- Apply the PRD's exact Persit visibility boundary at the query/API layer, not merely by hiding UI fields.

---

## 8. Local-first toolchain — Supabase and Vercel are not prerequisites

**The initial development and verification workflow must run locally.** Do not block implementation waiting for Supabase projects, Vercel projects, cloud credentials, or deployment.

Choose a maintainable stack that satisfies the PRD and can later be integrated with the intended production providers. If the repository has no implementation yet, make the smallest defensible architecture decision, document it, and proceed. Do not add unnecessary infrastructure.

### Local requirements

The repository must provide reproducible commands for:

- Installing dependencies using the committed package manager and lockfile.
- Starting the application locally.
- Starting the local database/service dependencies.
- Applying schema migrations from an empty database.
- Resetting the local test database safely.
- Loading deterministic test fixtures through a documented seed command.
- Running unit, integration, and end-to-end tests.
- Running lint, formatting, typecheck, and production build.
- Running browser automation against the local app.

Prefer a real local relational database for persistence and integration tests. A local PostgreSQL instance via Docker or another reproducible local service is acceptable. If a different database is selected, document why it meets transaction, constraint, and future migration requirements.

### Database discipline

- Schema changes must be versioned migration files.
- A clean database must be buildable by applying migrations in order.
- Seed data must be deterministic, safe, and repeatable.
- Tests must create/clean their own fixtures through migrations, seed scripts, test helpers, or application APIs.
- Never use ad hoc manual SQL/DB console changes as a substitute for migrations or application workflows.
- Verify writes through application read paths and automated assertions.
- Do not make local tests depend on a remote Supabase project.

### Supabase and Vercel

- Supabase integration is optional during early local development.
- Vercel deployment is optional during early local development.
- Do not add cloud credentials or secrets to the repository.
- Keep provider-specific code behind clear adapters where appropriate.
- Do not claim Supabase or Vercel integration/deployment is verified until it has actually been configured and tested.
- When the Owner authorizes provider integration, validate migrations, auth, authorization, storage/realtime needs, environment configuration, and deployment behavior against the real provider. Local success is not proof of cloud success.

---

## 9. Authentication and session behavior

Implement real authentication and persistent session handling; do not fake login state in production.

- Enforce unique usernames across all roles.
- Follow the PRD's password policy while still hashing securely.
- Implement session expiry and logout safely.
- Implement own-password change for all roles.
- Implement Super Admin password reset and mandatory password change after temporary-password login.
- Do not expose temporary passwords in logs, URLs, analytics, or persisted plaintext.
- Protect every server route and data operation.
- Test login success, invalid credentials, disabled/invalid session behavior where defined, logout, password change, reset flow, forced password change, and cross-role access denial.
- PRD account activation/deactivation and some account deletion semantics remain pending; do not invent them.

---

## 10. QR scanning and browser device permissions

The QR workflow must work in a real browser using the device camera, not a fake scanner screen.

- Request camera permission only when the user has completed the required exit form and explicitly starts scanning.
- For return, open the scanner directly as specified by the PRD.
- Handle permission denied, no camera, camera unavailable, malformed QR, unknown gate, inactive gate, camera stream failure, and scan cancellation.
- Stop camera tracks when leaving the scanner, completing a scan, or unmounting the component.
- Do not accept a user-editable gate identifier as proof of a valid QR.
- QR payload validation must be server-side.
- Keep QR authenticity/anti-forgery design pending until the Owner decides the unresolved PRD policy; use a secure implementation only after documenting the chosen technical approach and its assumptions.

Browser camera APIs generally require a secure context. Document localhost behavior and test on supported browsers.

---

## 11. GPS lifecycle and browser limitations

Implement the PRD's latest-location-only model.

- Start tracking after a successful exit, not before.
- Attempt location permission without making exit success depend on GPS permission.
- Send location updates at the specified 30-second interval while the session is active and the person is outside.
- Stop tracking after a successful return and when the relevant session ends.
- Detect online/offline and permission changes; recover automatically when connectivity/permission returns, within browser capabilities.
- Preserve the last successfully received location and timestamp when updates fail.
- GPS status must not alter presence status.
- Do not claim background tracking after browser closure; the PRD explicitly does not require it.
- Test permission granted/denied/revoked/restored, unavailable location, network interruption/recovery, session end, and return.
- Do not store route history or extra location points.

GPS status threshold details and some browser edge cases remain pending where PRD does not define them. Document the chosen implementation behavior and ask the Owner if a product-level decision is needed.

---

## 12. Reporting and PDF

- Only Super Admin and Komandan can generate/download reports.
- Report data must come from authorized, persisted application data.
- Include the fields and statistics defined in the PRD.
- Do not offer Excel or CSV export.
- Do not invent report period, layout, header/footer, or graph specifications while they remain pending.
- If report generation is blocked by those decisions, implement independent report data preparation and access-control tests, then request the required Owner decision before finalizing the user-facing report format.
- Verify the generated PDF opens and contains correct values; a download button alone is not sufficient.

---

## 13. Persit registration and linking

- Persit self-registration must create a real account and a pending link request.
- Super Admin verification must be a persisted, authorized operation.
- Only verified links may reveal the permitted linked personnel identity and presence.
- Prevent cross-personnel disclosure.
- Test registration, duplicate username, unknown NRP, already-linked NRP, pending request, verification, and access boundaries.
- PRD does not define rejection, cancellation, change, or unlink semantics. Keep those operations unavailable until the Owner decides; do not fabricate a workflow.

---

## 14. Architecture and code quality

- Use clear boundaries between presentation, application/business logic, persistence, and provider adapters.
- Keep business rules out of UI components and database access out of presentation code.
- Validate untrusted input at server boundaries with typed schemas.
- Use consistent error types and safe error responses.
- Use database constraints for uniqueness and state invariants.
- Avoid unnecessary abstraction, premature microservices, and speculative infrastructure.
- Use strict typing; do not introduce `any` or unsafe casts to bypass design problems.
- Keep functions cohesive and modules understandable.
- Add indexes for demonstrated query patterns; avoid speculative indexes.
- Keep dependencies maintained and minimize dependency count.
- Do not replace an existing working framework or architecture without inspecting it and documenting the reason.

The repository's chosen architecture and commands must be documented in `README.md` once established.

---

## 15. Testing contract

Tests must verify behavior, not merely implementation details.

### Required test layers

1. **Unit:** business rules, validation, state transitions, permission policy, formatting.
2. **Integration:** real database persistence, migrations, constraints, transactions, repositories, server handlers.
3. **End-to-end:** browser-driven journeys through the actual UI for each role.
4. **Security/authorization:** positive and negative role matrix, record ownership, direct endpoint access, data leakage.
5. **Resilience:** network/server errors, invalid inputs, conflict, duplicate requests, offline/recovery, permission denial.
6. **Build quality:** formatting, lint, typecheck, production build.

### Minimum role journeys

- Super Admin: login, dashboard, personnel management, gate/QR management, account management, Persit verification, GPS/history/report access, password reset.
- Komandan: login, monitoring dashboard, personnel read-only, GPS, activity history/filter, PDF, password change; verify management actions are denied.
- Personel: login, own dashboard, exit form validation before camera, successful QR exit, GPS lifecycle, return scan without form, activity completion, own history/detail, password change; verify other personnel data is denied.
- Persit: registration, link request, pending state, verified linked-personnel dashboard, password change; verify GPS/activity/history and unrelated personnel are inaccessible.

Do not mark a journey complete if any step is simulated or bypassed.

### Test hygiene

- No committed skipped tests for required behavior.
- No assertions that merely check non-null or HTTP 200 when meaningful state should be checked.
- Assert persisted before/after state and side effects.
- Tests must be deterministic and isolated.
- Keep test data separate from developer data.
- Capture browser console errors and failed network requests during E2E.
- When a test cannot run, record the exact reason and status as blocked; do not count it as passing.

---

## 16. Accessibility, compatibility, and responsive verification

- Use semantic HTML and accessible names for interactive controls.
- All key flows must be keyboard operable.
- Manage focus in dialogs and after navigation/errors.
- Ensure validation errors are announced and associated with fields.
- Check contrast in the Apple Style Light Mode palette.
- Test narrow mobile, tablet, and desktop viewports.
- Verify camera and GPS workflows on the actual browser environment used for testing; use browser permission controls in automated tests where supported.
- Do not claim compatibility with untested browsers/devices.

---

## 17. Security, privacy, and operational hygiene

- Validate all client input on the server.
- Protect against injection, XSS, CSRF where applicable, insecure direct object references, brute-force login, session fixation, and unsafe file generation.
- Use secure cookie/session settings appropriate to the local and production environment.
- Apply rate limits to authentication and sensitive operations where supported by the selected architecture.
- Never commit secrets, credentials, real personnel data, or production location data.
- Provide safe example environment files with dummy values only.
- Use least privilege for local and production service credentials.
- Log operational events without exposing secrets or unnecessary sensitive data.
- Do not add analytics/third-party trackers that disclose personnel or GPS information without explicit approval.
- Destructive actions require explicit confirmation and server-side validation.

---

## 18. Documentation and progress ledger

`progres.md` is mandatory, append-only project history.

### Status definitions

- `NOT_STARTED`: not begun.
- `IN_PROGRESS`: work is active.
- `IMPLEMENTED`: code exists but required verification is incomplete.
- `VERIFIED`: applicable automated tests and real local UI journey passed with evidence.
- `BLOCKED`: progress cannot continue because of a specific external dependency or Owner decision.
- Add `UNMERGED` when a change is not yet merged into `main`.

### Every entry must include

- Date.
- Feature/slice and status.
- Goal and scope.
- Acceptance criteria.
- Files changed.
- Migrations/data impact, if any.
- Commands executed and exact results.
- Unit/integration/E2E test results.
- Browser/UI verification performed.
- Known failures and blockers.
- Branch and commit SHA; PR number and CI run when available.
- Whether merged into `main`.

Never fabricate a test, count, commit, PR, CI run, deployment, or verification. Never delete or rewrite historical entries. Append corrections as a new entry.

Keep `README.md`, decision register, architecture notes, and requirement traceability synchronized with actual repository state.

---

## 19. Git and change management

- Work on a dedicated feature branch unless the Owner explicitly directs otherwise.
- Never force-push or rewrite shared history.
- Keep commits focused and descriptive.
- Do not commit generated build artifacts, secrets, local databases, or personal data.
- Review the diff before committing.
- Do not merge into `main` unless explicitly authorized and repository checks are satisfied.
- A pull request is not a merge. Report its actual state.
- Preserve all existing working features and tests.

---

## 20. Definition of project completion

GATEOPS may be reported as complete only when:

- Every approved functional requirement is traced to implementation and tests.
- Every role's end-to-end journey is verified through the UI.
- All relevant UI states are implemented and tested.
- Authorization and privacy boundaries pass positive and negative tests.
- Database migrations build a clean local database from scratch.
- Critical transactions are concurrency-safe and tested.
- No production-path stub, placeholder, fake data source, dead control, or incomplete feature remains.
- Local setup and verification are reproducible from documented commands.
- Lint, typecheck, tests, and production build pass.
- Known limitations and unresolved Owner decisions are explicitly listed.
- `progres.md` contains accurate evidence and the final repository state.

Cloud integration and deployment are separate verification milestones. Local completion must not be represented as successful Supabase/Vercel production deployment.

---

## 21. Agent final report format

At the end of each work session, report concisely:

1. **Status:** VERIFIED / IMPLEMENTED / BLOCKED / IN_PROGRESS, and UNMERGED when applicable.
2. **Delivered:** actual user-visible behavior completed.
3. **Changed files:** exact paths.
4. **Verification:** exact commands and pass/fail counts; UI journeys actually exercised.
5. **Evidence:** branch, commit SHA, PR, CI run, where available.
6. **Not verified / blockers:** explicit list; never hide gaps.
7. **Next autonomous slice:** the next unblocked requirement.

Do not use phrases such as “fully functional”, “production-ready”, or “complete” without the corresponding evidence required above.
