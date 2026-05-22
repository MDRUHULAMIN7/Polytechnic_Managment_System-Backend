# Backend Documentation: ClassSession Module

## Feature Overview
The ClassSession module provides centralized scheduling, rescheduling, and runtime status management for academic class meetings. It is designed for curriculum-driven timetables, instructor assignments, room management, and student attendance tracking.

## Class Scheduling Workflow
1. Administrator triggers class synchronization for a curriculum or offered subject.
2. The module resolves the target curriculum, related offered subjects, and current semester registration.
3. It builds class session seeds using schedule blocks, academic days, and period metadata.
4. Pre-validation checks run before saving any schedule:
   - Past-date restriction
   - Curriculum conflicts
   - Instructor conflicts
   - Room conflicts
   - Chronological consistency within the same subject
5. Valid sessions are written to `ClassSession` with reference links to `Curriculum`, `OfferedSubject`, `Room`, and `Instructor`.

## Class Reschedule Workflow
1. Admin requests available reschedule options for a target class session.
2. The module evaluates the session's current status and reschedule eligibility.
3. It collects available rooms, time slots, and the session's existing academic context.
4. The reschedule request is validated against the same conflict rules used for initial scheduling.
5. If valid, the session is updated and associated notifications are dispatched.

## Business Rules
- Classes cannot be scheduled for dates before the current UTC date.
- Classes may only be scheduled while the linked semester registration is `ONGOING`.
- Started classes (`STARTED`, `COMPLETED`) cannot be modified or rescheduled.
- Curriculum-level scheduling is only allowed when the curriculum contains offered subjects.
- Same inbound subject sessions must maintain chronological ordering to avoid out-of-order weekly sessions.
- Scheduling decisions must preserve room and instructor exclusivity for overlapping periods.

## Validation Architecture
Validation is centralized in the class session service and utility layer.

### Key Validation Layers
- Request validation: `classSession.validation.ts` validates request payload shape.
- Domain validation: service methods enforce business rules and conflict detection before persisting.
- Utility validation: helpers such as `doClockTimesOverlap`, `isBeforeTodayUtc`, and `normalizeUtcDate` encode repeatable rules.

## Conflict Detection
### Curriculum Conflict Detection
Curriculum conflict detection ensures that no two sessions within the same curriculum overlap in a way that would violate the student's expected class load. It evaluates:
- Same date collisions
- Overlapping times within 30-minute blocks
- Duplicate sessions for the same subject on the same date

### Instructor Conflict Detection
Instructor scheduling is validated by checking the instructor's active class sessions on the requested date and time range. The module rejects:
- Multiple classroom commitments for one instructor in the same UTC time window
- Reschedules that would create back-to-back impossible gaps

### Room Conflict Detection
Room conflicts are detected by searching sessions in the same room and date range, ensuring that the requested start/end time does not overlap an existing booking.

## Date Validation Logic
### Past-Date Scheduling Restriction
The module prohibits scheduling on a date earlier than today in UTC. This avoids inconsistencies caused by time-zone drift and prevents scheduling historical sessions after attendance or grading has already been established.

### Started Class Restriction Logic
A class session moves into a protected state once it is marked as `STARTED` or `COMPLETED`. At that point:
- The course content is in progress or finished.
- Attendance and student expectations are already established.
- Rescheduling or editing would violate auditing, attendance, and academic integrity requirements.

## Monthly Scheduling Strategy
The module is optimized for monthly seeding by grouping schedule generation into date ranges.

### Strategy
- Build UTC month ranges with `buildUtcMonthRanges`.
- Seed sessions in batches for contiguous calendar segments.
- Use identity keys based on date, start time, and room to reduce duplicates.

### Benefits
- Reduces repeated conflict checks for contiguous session batches.
- Enables efficient `bulk` scheduling without recreating the same time slots multiple times.
- Makes it easy to align schedules to semester registration windows.

## API Design
The API is designed for administrative workflow, instructor interactions, and student read access.

### Endpoint List
| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/dashboard-summary` | Retrieve summary metrics for class sessions | Admin, SuperAdmin, Instructor, Student |
| GET | `/filter-options` | Fetch filter metadata for class session lists | Admin, SuperAdmin, Instructor, Student |
| POST | `/sync` | Sync class sessions for a curriculum or offered subject | Admin, SuperAdmin |
| GET | `/curriculum/:curriculumId/status` | Get scheduling status for a curriculum | Admin, SuperAdmin |
| GET | `/my` | Get instructor class sessions | Instructor |
| GET | `/my-classes` | Get student class sessions | Student |
| GET | `/:id/instructor-details` | Get instructor-specific session details | Instructor |
| PATCH | `/:id/start` | Start a class session | Instructor |
| PATCH | `/:id/complete` | Complete a class session | Instructor |
| GET | `/:id/reschedule-availability` | Fetch available reschedule options | Admin, SuperAdmin |
| PATCH | `/:id/reschedule` | Reschedule a class session | Admin, SuperAdmin |
| PATCH | `/:id/cancel` | Cancel a class session | Admin, SuperAdmin |
| GET | `/:id/student-details` | Get student-specific session details | Student |
| GET | `/:id` | Get a single class session | Admin, SuperAdmin |
| GET | `/` | List all class sessions | Admin, SuperAdmin |

## Request / Response Examples
### Sync Classes
Request
```json
{
  "offeredSubjectId": "64f5a4f2d227d9b3ae4b9877",
  "curriculumId": "650eacdfa0f5a7a61a8d9032",
  "replaceScheduled": true
}
```
Response
```json
{
  "synced": 18,
  "skipped": 2,
  "errors": []
}
```

### Reschedule Class
Request
```json
{
  "date": "2026-09-12",
  "startPeriod": 4,
  "room": "Room-204"
}
```
Response
```json
{
  "id": "6510bb63d2f8f1001d9c4a2b",
  "status": "RESCHEDULED",
  "date": "2026-09-12T00:00:00.000Z",
  "startPeriod": 4,
  "room": "Room-204"
}
```

## Error Handling
The module uses structured HTTP errors via `AppError`.

Common error cases:
- `400 Bad Request` for validation failures and conflict detections.
- `401 Unauthorized` when auth is missing or invalid.
- `404 Not Found` when referenced curriculum, offered subject, or session does not exist.
- `409 Conflict` for duplicate scheduling or invalid reschedules.
- `500 Internal Server Error` for unhandled exceptions.

## Schema Relationship Explanation
The `ClassSession` model is tightly coupled with curriculum and schedule entities:
- `Curriculum` owns the academic program and offered subject list.
- `OfferedSubject` contains subject metadata, instructor assignment, semester, and schedule blocks.
- `Room` is the physical location for each session.
- `Instructor` is linked through the offered subject and session reference.
- `StudentAttendance` references `ClassSession` once a session is started.

## Technical Implementation Notes
- Uses MongoDB models and `mongoose` for the persistence layer.
- Stores UTC-normalized dates to avoid cross-timezone scheduling errors.
- Dependency injection is achieved via import orchestration instead of an IOC container.
- Notification dispatch is non-blocking and errors are logged to stderr to avoid failing the schedule transaction.
- Session identity keys are built from date, start time, and room to avoid duplicate saves.

## Refactor Summary
Recent improvements focused on:
- Centralized validation logic.
- Stronger business rule enforcement at the service layer.
- Clear separation between request validation and domain validation.
- Improved schedule seed generation for curriculum sync operations.
- Optimized reschedule eligibility checks.

## Performance Optimization Notes
- Queries are scoped to relevant semester registrations and curricula.
- Availability checks use selective projections instead of full document loads.
- Batch scheduling uses date range builders to limit repeated queries.
- Notification errors are handled asynchronously to keep scheduling fast.

## Why Past-Date Scheduling is Restricted
Past-date scheduling is disallowed to preserve academic record integrity. Once the date has passed, student attendance, grade entry, and audit logs become anchored to that day. Allowing backward changes would introduce stale or invalid historical state.

## Why Started Classes Cannot Be Modified
A started class marks the transition from planning to execution. At that point, attendance and classroom activity have become authoritative. Modifications are restricted to avoid inconsistent records, invalid attendance, and unexpected instructor or room assignments.

## How Curriculum Conflict Validation Works
Curriculum conflict validation checks that courses within the same curriculum do not overlap in time and date. It rejects schedule seeds that create conflicting session windows for students, ensuring academic load remains contiguous and conflict-free.

## Same-Subject Chronological Validation
The system enforces chronological ordering for repeat sessions of the same subject to maintain sensible weekly progression. This avoids situations where a later lesson is scheduled before an earlier one in the same subject sequence.

## Monthly Scheduling Optimization Approach
Monthly scheduling is resolved in sequential calendar segments rather than individual dates. This reduces redundant validation passes and provides a stable seed strategy across multi-week timetables.

## Centralized Validation Strategy
Validation is centralized in the service layer rather than dispersed across controllers. This improves maintainability and makes it easier to extend new business rules without duplicating logic.

## Scalability Considerations
- Query scopes limit candidate sessions by curriculum, registration, and date range.
- Conflict detection runs on concise projections and uses indexed fields for dates, rooms, and instructor IDs.
- Validation helpers are stateless and reusable across seed generation and reschedule flows.
- The module can scale to more curricula or instructors with minimal additional complexity.

## Maintainability Improvements
- Clear separation between route definitions, controllers, services, and validation schemas.
- Consistent naming for `get*`, `build*`, `resolve*`, and `validate*` helpers.
- Documentation for expected payloads, responses, and business constraints.
- Readable module-level architecture that future developers can extend without changing the core scheduling engine.
