# PMS Backend

Production-ready Express and TypeScript backend for the Polytechnic Management System. This service powers authentication, academic workflows, realtime notifications, media uploads, public data delivery, and chatbot-assisted experiences for the PMS platform.

## Project Overview

| Item | Details |
| --- | --- |
| Live API Service | [https://pms-backend-3yl3.onrender.com/](https://pms-backend-3yl3.onrender.com/) |
| API Base URL | [https://pms-backend-3yl3.onrender.com/api/v1](https://pms-backend-3yl3.onrender.com/api/v1) |
| Health Check | [https://pms-backend-3yl3.onrender.com/health](https://pms-backend-3yl3.onrender.com/health) |
| Connected Frontend | [https://polytechnic-managment.vercel.app/](https://polytechnic-managment.vercel.app/) |
| Deployment | Render web service |
| Main Goal | Centralize secure academic operations, public content delivery, and realtime institutional communication |

This backend was built to solve the operational side of the project. Instead of keeping authentication, academic data, notices, attendance, notifications, and media handling in separate disconnected services, PMS Backend brings them together in one structured API layer that both the public website and dashboard can rely on.

## Backend Architecture

This backend is implemented as a **modular monolith** with a layered (N-tier) organization and a RESTful API surface augmented by a partial event-driven layer using Socket.IO. The modular monolith pattern groups related features into module folders and enforces clear boundaries between layers while running as a single deployable Node process that shares configuration and a single database instance.

### Architectural Pillars
- Modular Monolith: feature modules live under `src/app/modules/*`, each exposing route, controller, service, model, and validation boundaries. Modules are isolated by code ownership and interface, not by process.
- Layered / N-Tier Architecture: responsibilities are separated into presentation (`routes`), orchestration (`controllers`), domain (`services`), persistence (`models`), and cross-cutting helpers (`utils`, `validation`).
- RESTful API Architecture: the primary integration surface is a consistent `/api/v1` RESTful API with clear resource-oriented routes and predictable HTTP semantics.
- Partial Event-Driven: Socket.IO provides realtime push for notifications and session events; event emission is driven by service-layer state changes and designed to be idempotent and resilient.

### Why a Modular Monolith instead of Microservices
- Reduced operational complexity: single runtime, one deployment pipeline, and simplified observability for an academic product targeting institutional adopters.
- Transactional integrity: single-database transactions and multi-document operations remain straightforward without distributed transaction coordination.
- Faster iteration: feature teams can make cross-cutting changes (UX + API + domain) without coordinating multiple service owners.
- Practical cost and ROI: lower hosting and engineering overhead for mid-sized deployments where strict isolation and independent scaling are not yet necessary.

That said, the codebase is organized to allow future extraction of services if scale, organizational needs, or separate team ownership justify a move to microservices.

### Layer Responsibilities (Where to look in the code)
- `src/app/routes/` — central route registration, route-level middleware and versioning.
- `src/app/modules/*/` — feature module folders containing `*.route.ts`, `*.controller.ts`, `*.service.ts`, `*.model.ts`, and `README.md` where module-specific documentation lives.
- `src/app/controllers/` (implicit within modules) — validate auth context and shape controller responses.
- `src/app/services/` (module-local services) — implement domain logic, orchestrate transactions, call models and utils.
- `src/app/models/` — Mongoose schema definitions and low-level DB helpers.
- `src/app/validation/` — `zod` schemas and request validators used by `validateRequest` middleware.
- `src/app/socket/` — authentication middleware for sockets, event naming, and broadcast helpers.
- `src/app/utils/` — date helpers, conflict detection utilities, email and Cloudinary wrappers, and notification formatting.

### REST + Realtime Flow (simplified)
```text
Client → HTTP REST → Route → Controller → Service → Model (MongoDB)
                     ↓
                  NotificationService → Socket.IO → Clients
```

### Documentation & Services (current and planned)
The project documents each feature module with an internal `README.md` at `backend/src/app/modules/<module>/README.md`. These module-level docs contain API details, business rules, validation notes, and implementation hints so maintainers can find authoritative information next to the code.

Current backend services/modules (examples):
- `Auth` — login, refresh, password flows, and socket token issuance.
- `User`, `Student`, `Instructor`, `Admin` — user lifecycle and role-aware access.
- `Academic Semester`, `Academic Department`, `Academic Instructor` — academic metadata.
- `Subject`, `Curriculum`, `Semester Registration`, `Offered Subject`, `Semester Enrollment`, `Enrolled Subject` — curriculum and enrollment workflows.
- `PeriodConfig` — shift-aware period definitions and active configuration per shift.
- `Class Session`, `Student Attendance` — schedule seeding, rescheduling, and attendance tracking.
- `Notice`, `Notification` — publish/subscribe communication and unread-state support.
- `Chatbot` — validated public assistant integration.
- `Socket Service` / `NotificationService` — realtime event dispatch and user/role room management.

Planned and in-progress items:
- AI-assisted curriculum planning (planned)
- Payment and registration integrations (planned)
- Advanced operational monitoring and admin control plane (in progress)
- Additional decoupling or service extraction is planned only if justified by scale.

### How documentation is organized
- Module READMEs: `backend/src/app/modules/<module>/README.md` — domain-specific API design and business constraints.
- Top-level README (this file): product overview, architecture, deployment guidance, and high-level design decisions.
- Inline code comments and util docs: where complex algorithms (e.g., conflict detection) require deeper explanation.
- Frontend docs: complementary UI/UX and integration docs in `frontend/docs/`.

This structure helps new contributors find both the operational context and the implementation details close together, reducing knowledge friction when working across the domain.

## Problem Breakdown, Features, and Solutions

| Problem | Feature Added | Solution Outcome |
| --- | --- | --- |
| Academic and administrative data were spread across different manual or disconnected processes. | Modular REST API for students, instructors, admins, semesters, departments, subjects, curriculums, enrollments, classes, and attendance. | The frontend can manage the full academic workflow from one backend service. |
| Different users needed different levels of access to the same platform. | JWT authentication, refresh-token flow, role-based authorization, and status checks for `student`, `instructor`, `admin`, and `superAdmin`. | Sensitive operations stay protected while each user gets the right level of visibility. |
| Public visitors and authenticated users needed different data access patterns. | Public-friendly endpoints for notices, instructors, and chatbot access, plus protected dashboard APIs. | One backend can serve both the public website and secured institutional dashboards. |
| Important events needed to reach users quickly without constant page refresh. | Socket.IO-based realtime notification delivery with user rooms, role rooms, unread counters, and read/clear flows. | Users receive operational updates faster and the frontend stays more responsive. |
| Backend cold starts on free hosting could make the system feel unreliable. | Root route and `/health` endpoint for service visibility, monitoring, and frontend wake-up checks. | The platform can detect service readiness and communicate delays more gracefully. |
| Profile and media updates required reliable file handling. | Multer-based upload parsing and Cloudinary image delivery. | Profile image workflows stay manageable without storing heavy files directly in the app server. |
| Password recovery and account lifecycle handling needed to be production-aware. | Forget-password, reset-password, change-password, and seeded super-admin bootstrap flow. | Account access can be recovered safely and the system can initialize privileged access cleanly. |
| Public discovery needed AI-assisted help without building a separate service. | Chatbot module with validated `/chatbot/ask` API integration. | The frontend can provide quick academic Q&A from the same backend platform. |

## Development Challenges We Overcame

The backend grew into more than a CRUD API. Several engineering challenges had to be solved to keep it usable and scalable:

1. Role-safe access had to stay consistent across many modules.
   Shared auth middleware, user role constants, and route-level protection were used so sensitive endpoints behave predictably.
2. Academic data relationships are naturally complex.
   The project was split into focused modules for semesters, subjects, offered subjects, class sessions, enrollments, and attendance to keep business logic organized.
3. REST responses and realtime events needed to stay aligned.
   Socket rooms, notification services, and API unread-state endpoints were combined so the dashboard can reflect both stored and live status.
4. Free-tier deployment created first-request delays.
   A dedicated health endpoint was added so the frontend can detect backend readiness and soften the cold-start experience.
5. Media, email, and auth flows all introduce operational risk.
   Cloudinary uploads, email helpers, token-based password recovery, and config-driven environment handling were introduced to make these flows production-friendly.

## Project Screenshots and Architecture

The following assets show the deployed backend and the data structure behind it:

| Live API Root | Health Endpoint |
| --- | --- |
| <img src="./docs/screenshots/api-root.jpg" alt="PMS backend root endpoint preview" width="100%" /> | <img src="./docs/screenshots/health-endpoint.jpg" alt="PMS backend health endpoint preview" width="100%" /> |

| Latest Notices API Preview | Entity Relationship Diagram |
| --- | --- |
| <img src="./docs/screenshots/latest-notices-endpoint.jpg" alt="PMS backend latest notices endpoint preview" width="100%" /> | <img src="./docs/screenshots/Polytechnic Management System ER Diagram.png" alt="PMS backend entity relationship diagram" width="100%" /> |

## Features by User Type

### Public Visitors and Frontend Guests

- Fetch public notices, latest notices, and notice details without requiring full dashboard access.
- Read public academic instructor data for the institutional website.
- Use the chatbot endpoint for quick public-facing academic queries.
- Hit root and health endpoints for availability checks and deployment monitoring.

### Students

- Authenticate, refresh sessions, change password, and recover access.
- Access semester enrollments, enrolled subjects, class sessions, attendance, notices, notifications, and self-profile support.
- Mark notices as read or acknowledged and manage notification read state.

### Instructors

- Authenticate and access instructor-facing class, subject, curriculum, semester, notice, and notification workflows.
- Work with assigned academic data and classroom delivery records.
- Use protected APIs for teaching-related dashboard experiences.

### Admins

- Manage students, instructors, academic instructors, departments, semesters, subjects, curriculums, semester registrations, offered subjects, enrollments, notices, and class-session operations.
- Publish notices, supervise attendance-related flows, and trigger operational updates that appear in realtime on the frontend.

### Super Admins

- Access all admin-level backend capabilities.
- Bootstrap privileged control through seeded super-admin creation when the system starts with an empty database.
- Supervise admin-level access and high-privilege operational workflows.

## Core Backend Modules

- `Auth` - login, refresh token, logout, password change, forget-password, and reset-password flows.
- `User`, `Student`, `Instructor`, `Admin` - user lifecycle and role-aware account operations.
- `Academic Semester`, `Academic Department`, `Academic Instructor` - academic structure management.
- `Subject`, `Curriculum`, `Semester Registration`, `Offered Subject`, `Semester Enrollment`, `Enrolled Subject` - core academic delivery workflow.
- `PeriodConfig` - shift-aware period configuration for morning/day schedules and classroom period structure.
- `Class Session`, `Student Attendance` - schedule and attendance tracking.
- `Notice`, `Notification` - communication, visibility, and realtime update support.
- `Chatbot` - validated public assistant endpoint.
- `Socket Service` - role rooms, user rooms, and event broadcasting.

`PeriodConfig` enables:
- separate Morning and Day shift definitions,
- unique active configuration per shift,
- flexible period duration and label mapping,
- a scalable scheduling foundation for offered subjects and sessions.

## System Design Highlights

- Modular feature-based backend structure organized by domain module.
- Realtime communication system built on Socket.IO for event-driven updates.
- Role-based access control enforced consistently across routes and controllers.
- Academic workflow management for curriculum, registration, offerings, scheduling, and attendance.
- Scheduling conflict detection for curriculum, instructor, and room collisions.
- Scalable validation flow with centralized request and domain validation.
- Centralized error handling via `AppError` and consistent response semantics.
- Health monitoring support through `/health` and root endpoint status checks.

## Performance Optimization

- Month-based class scheduling reduces repeated schedule generation and validation overhead.
- Optimized conflict validation limits checks to targeted curriculum, instructor, and room windows.
- Reusable utility abstractions keep shared logic consistent and reduce duplication.
- Minimized unnecessary API pressure by consolidating related operations and using targeted cache-friendly flows.
- Realtime updates reduce polling and keep dashboard state synchronized without extra requests.
- Maintainable modular structure makes it easier to optimize individual features over time.

## Complex Academic Business Logic

- Curriculum conflict validation prevents students from getting overlapping class sessions in the same academic plan.
- Instructor conflict detection avoids double-booking instructors for overlapping class times.
- Room conflict detection ensures no two sessions reserve the same physical room at the same time.
- Optional group-aware semester registration allows curriculum and enrollment workflows to respect grouped student cohorts.
- Class reschedule validation checks session status, room availability, instructor availability, and schedule chronology.
- Past-date scheduling restriction protects academic records by blocking history edits after the UTC current date.
- Started-class protection prevents changes once a class is marked as started or completed.
- Shift-based period configuration supports both Morning and Day shift layouts.
- Semester registration validation ensures scheduling only occurs when the registration status is valid and ongoing.

## Engineering Decisions

- Chose a modular monolith over microservices to reduce deployment complexity and keep feature boundaries clear.
- Mapped academic workflows around offered subjects and curriculum planning to keep schedule logic aligned with real-world course delivery.
- Adopted Socket.IO for realtime workflows because it provides low-latency event delivery for notifications and session updates.
- Extracted utility logic out of services where shared helpers are needed for conflict checks, date normalization, and notification formatting.
- Centralized validation in the service layer and request schema validation layer to enforce business rules consistently.
- Added a health endpoint strategy so the frontend and deployment platform can monitor service readiness and UX fallback conditions.

## Tech Stack

- Node.js
- Express 5
- TypeScript
- MongoDB
- Mongoose
- JWT
- bcrypt
- Zod
- Joi
- Socket.IO
- Nodemailer
- Cloudinary
- Multer

## Repository Layout

- `src/server.ts` - connects MongoDB, seeds the super admin, initializes Socket.IO, and starts the HTTP server.
- `src/app.ts` - configures Express, CORS, parsers, routes, root response, and health endpoint.
- `src/app/routes/` - central API route registration.
- `src/app/modules/` - feature modules for auth, academics, classes, notices, notifications, chatbot, and user roles.
- `src/app/socket/` - socket middleware, types, and event delivery logic.
- `src/app/utils/` - shared helpers such as Cloudinary upload, email sending, and response wrappers.
- `src/app/config/` - environment and CORS configuration.
- `src/app/DB/` - startup database bootstrap logic, including seeded super-admin creation.
- `docs/screenshots/` - README preview assets captured from the deployed backend and ER diagram.

## API Surface Overview

Major route groups currently include:

- `/auth`
- `/users`
- `/students`
- `/instructors`
- `/admins`
- `/academic-semester`
- `/academic-instructor`
- `/academic-department`
- `/subjects`
- `/curriculums`
- `/semester-registrations`
- `/offered-subject`
- `/enrolled-subjects`
- `/semester-enrollments`
- `/class-sessions`
- `/student-attendance`
- `/notices`
- `/notifications`
- `/chatbot`

Base prefix:

```txt
/api/v1
```

Health endpoint:

```txt
GET /health
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env`, then configure the following values:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=
BCRYPT_SALT_ROUNDS=12
DEFAULT_PASS=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=30d
RESET_PASS_UI_LINK=https://polytechnic-managment.vercel.app/reset-password
PASSWORD_RESET_EMAIL_OVERRIDE=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SUPER_ADMIN_PASSWORD=
CORS_ORIGINS=https://polytechnic-managment.vercel.app,http://localhost:3000
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_SITE_URL=https://polytechnic-managment.vercel.app
```

Notes:

- `CORS_ORIGINS` accepts a comma-separated list.
- `RESET_PASS_UI_LINK` should point to the deployed frontend reset-password route.
- `PASSWORD_RESET_EMAIL_OVERRIDE` is optional and useful for redirecting password-reset messages during controlled demo or testing flows.
- `SMTP_USER`, `SMTP_PASS`, and optional `SMTP_FROM` should come from your secret manager or deployment environment, never from source code.
- `OPENROUTER_*` values are only required if chatbot features are enabled.
- `SUPER_ADMIN_PASSWORD` is used during the initial super-admin seed flow.

## Local Development

```bash
cd backend
npm install
npm run start:dev
```

Default local API host:

```txt
http://localhost:5000
```

With the default API prefix:

```txt
http://localhost:5000/api/v1
```

## Available Scripts

- `npm run start:dev` starts the development server with automatic reload.
- `npm run build` compiles TypeScript to `dist/`.
- `npm run start` runs the compiled server.
- `npm run start:prod` runs the compiled server in production-style mode.
- `npm run lint` runs ESLint on `src`.
- `npm run lint:fix` runs ESLint with auto-fix.
- `npm run prettier` formats supported source files.
- `npm run prettier:fix` formats the `src` directory.
- `npm test` is currently a placeholder script and not yet configured with automated backend tests.

## Realtime Notes

Socket.IO is initialized during server startup and supports role-based or user-based delivery. This is used for events such as:

- notice publication
- class started, completed, cancelled, or missed updates
- attendance-related updates
- offered-subject assignment notifications

Because of this realtime layer, the backend is best deployed as a persistent Node service instead of a purely serverless API.

## Deployment Guidance

This backend is suitable for Render, Railway, VPS, or any persistent Node hosting environment.

### Recommended production settings

- Root directory: `backend`
- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm run start`
- Health check path: `/health`

### Frontend integration

If the backend host is `https://your-backend-host.onrender.com`, set the frontend environment like this:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend-host.onrender.com/api/v1
NEXT_PUBLIC_SOCKET_URL=https://your-backend-host.onrender.com
NEXT_PUBLIC_SITE_URL=https://polytechnic-managment.vercel.app
```

### Free-tier hosting note

This project is currently deployed on a Render free plan. After inactivity, the first request may be slower. The frontend already includes a wake-up modal that uses the backend health check to explain that delay more clearly to users.

## Quality and Maintenance

This backend is structured for ongoing growth:

- modular feature-based folders
- central route registration
- shared validation and error handling
- reusable auth and response helpers
- realtime delivery support through Socket.IO
- deployable health-check support for monitoring and UX coordination

## Current Engineering Priorities

- add meaningful backend test coverage instead of leaving `npm test` as a placeholder
- document request and response examples for the highest-traffic API workflows
- keep improving naming consistency and deployment polish as the system grows

## Demo Access

If you are using seeded local or controlled demo data, the following sample accounts may be available:

- Super Admin
  ID: `0001`
  Password: `admin12345`
- Admin
  ID: `A-0001`
  Password: `admin1234`
- Instructor
  ID: `I-0004`
  Password: `ruhul1234`
- Student
  ID: `2026070001`
  Password: `ruhul1234`
