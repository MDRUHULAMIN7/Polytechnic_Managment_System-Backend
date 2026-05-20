# Semester Registration Module

## Feature Overview
The Semester Registration module manages the administrative windows during which students can register for subjects in a specific academic semester and shift. it acts as a gatekeeper for the academic cycle, defining when enrollment is open and setting constraints like credit limits and active shifts.

## Semester Registration Workflow
1. **Academic Semester Definition**: An `AcademicSemester` must exist (e.g., Spring 2024).
2. **Registration Creation**: Admin creates a registration window by selecting a semester, shift, start/end dates, and total credits allowed.
3. **Status Management**:
   - `UPCOMING`: Window is defined but not yet open for students.
   - `ONGOING`: Students can actively enroll in subjects.
   - `ENDED`: Enrollment is closed. No further changes allowed.
4. **Lifecycle Constraints**:
   - Only one registration for a specific semester/shift can be `UPCOMING` or `ONGOING` at a time.
   - Status transitions are strictly enforced (`UPCOMING` -> `ONGOING` -> `ENDED`).

## Service Architecture
The module follows a layered architecture to ensure separation of concerns:
- **`semesterRegistration.model.ts`**: Defines the schema with indexes on `academicSemester` and `shift` to prevent duplicates.
- **`semesterRegistration.service.ts`**: Houses complex business logic, including status transition state machines and duplicate checks.
- **`semesterRegistration.utils.ts`**: Contains reusable logic for timeline validation and date parsing.
- **`semesterRegistration.controller.ts`**: Standard Express controller for request handling.

## Business Logic
- **Timeline Validation**: Ensures that the registration window (startDate to endDate) falls within the actual calendar months of the associated `AcademicSemester`.
- **Status State Machine**:
  - `UPCOMING` -> `ONGOING` (Valid)
  - `ONGOING` -> `ENDED` (Valid)
  - `UPCOMING` -> `ENDED` (Invalid - must go through ONGOING)
  - `ONGOING` -> `UPCOMING` (Invalid - cannot go backward)
- **Immutability**: Once a registration reaches `ENDED` status, it cannot be modified.

## API Design
### Endpoint List
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/create-semester-registration` | Admin | Create a new registration window |
| GET | `/` | All | List all registration windows (supports search/filter) |
| GET | `/:id` | All | Get specific registration details |
| PATCH | `/:id` | Admin | Update status or timeline |
| DELETE | `/:id` | Admin | Delete an `UPCOMING` registration |

### Request/Response Examples
#### Create Registration (POST)
**Request Body:**
```json
{
  "academicSemester": "65f1a...",
  "status": "UPCOMING",
  "shift": "MORNING",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-15T23:59:59Z",
  "totalCredit": 25
}
```

## Error Handling
- `409 Conflict`: Thrown if an active registration already exists for the selected semester and shift.
- `400 Bad Request`: Thrown for invalid status transitions or if the timeline falls outside the academic semester window.
- `404 Not Found`: Thrown if the associated `AcademicSemester` does not exist.
