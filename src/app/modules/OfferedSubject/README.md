# Offered Subject Module

## Overview
The **Offered Subject** module is a core part of the academic management system. It manages the lifecycle of subjects being offered in a specific semester registration, including instructor assignment, room allocation, and schedule planning.

## Purpose
- To bridge the gap between static **Subjects** and active **Semester Registrations**.
- To handle complex scheduling constraints (room availability, instructor busy slots).
- To track enrollment capacity and provide automated scheduling suggestions through an AI-powered planner.

## Business Logic
1. **Uniqueness**: A subject can only be offered once per semester registration.
2. **Scheduling**: Every offered subject must have at least one schedule block (day, start period, and period count).
3. **Capacity Management**: 
   - `totalCapacity`: The initial number of seats provided when the subject was offered.
   - `maxCapacity`: The current remaining seats available for enrollment.
   - Upon enrollment, `maxCapacity` is decremented.
4. **Marking Snapshots**: At the time of offering, the subject's marking scheme and assessment components are cloned into the offered subject to ensure historical consistency even if the base subject changes later.
5. **Conflicts**: The system prevents overlapping schedules for:
   - The same **Instructor** in any room.
   - The same **Room** for any instructor.

## Schema Design
The `OfferedSubject` schema includes:
- `semesterRegistration`: Reference to the active registration.
- `academicSemester`: Derived from the registration.
- `subject`: The base subject being offered.
- `instructor`: The assigned faculty member.
- `totalCapacity`: Fixed initial capacity.
- `maxCapacity`: Dynamic remaining seats.
- `scheduleBlocks`: Array of room and time assignments.
- `markingSchemeSnapshot`: Deep copy of the subject's marking scheme.
- `markingStatus`: Enum (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`).

## API Endpoints

### Create Offered Subject
`POST /offered-subjects`
- **Body**: `semesterRegistration`, `subject`, `instructor`, `maxCapacity`, `scheduleBlocks[]`.
- **Validation**: Ensures no subject duplication and no schedule conflicts.

### Update Offered Subject
`PATCH /offered-subjects/:id`
- **Body**: `instructor`, `maxCapacity`, `scheduleBlocks[]`.
- **Note**: `totalCapacity` is updated to match the new `maxCapacity` during manual updates.

### AI Schedule Planner
`POST /offered-subjects/plan-schedule`
- **Purpose**: Generates conflict-free schedule suggestions based on credits and subject type.
- **Logic**: Uses `PLANNER_WORKING_DAYS` (Sun-Thu) and prioritizes room types (Theory vs Practical).

### Conflict Preview
`POST /offered-subjects/preview-conflicts`
- **Purpose**: Validates a potential schedule without saving it to the database.

## Capacity Calculation Logic
The frontend displays capacity as `{totalCapacity} / {maxCapacity}`. 
- `totalCapacity` = Initial Seats.
- `maxCapacity` = Remaining Seats.
- **UI Label**: `Total / Remaining`.

## Error Handling
- `404 NOT_FOUND`: If references (subject, instructor) do not exist.
- `400 BAD_REQUEST`: If the subject is already offered or if schedule blocks are not contiguous.
- `409 CONFLICT`: If there is a schedule overlap for the instructor or room.

## Performance Improvements
- **Lean Queries**: Used `.select()` to limit data transfer for comparable subject checks.
- **Service Refactoring**: Extracted common validation logic into `validateAndResolveOfferedSubject` to reduce redundant database hits and code duplication.
