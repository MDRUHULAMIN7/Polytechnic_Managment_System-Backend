# Semester Enrollment Module

## Feature Overview
The Semester Enrollment module handles the process of students registering for specific subjects within a curriculum. It ensures that students meet prerequisites, stay within credit limits, and that class capacities are respected.

## Semester Enrollment Workflow
1. **Curriculum Selection**: Students select a `Curriculum` for their department and semester.
2. **Validation**: The system performs multiple checks (Prerequisites, Credits, Schedule conflicts).
3. **Registration**: Upon successful validation, the student is enrolled in all subjects defined in the curriculum.
4. **Capacity Update**: The system atomically decrements the available seats for each `OfferedSubject`.
5. **Approval**: Enrollments are automatically `APPROVED` if all automated checks pass.

## Service Architecture
- **`semesterEnrollment.service.ts`**: The primary engine for enrollment. It uses MongoDB sessions and transactions to ensure that student records and subject capacities are updated atomically.
- **`semesterEnrollment.utils.ts`**: Contains helper functions for detailed error reporting when an enrollment is blocked (e.g., explaining exactly why a subject isn't available).

## Business Logic
- **Transactional Integrity**: Enrollment involves updating multiple collections (`SemesterEnrollment`, `EnrolledSubject`, `OfferedSubject`). This is wrapped in a Mongoose session to prevent partial registrations.
- **Prerequisite Check**: Recursively checks if the student has successfully completed (`isCompleted: true`) all required subjects for every subject in the new curriculum.
- **Credit Limit Enforcement**: Validates that the sum of credits in the selected curriculum plus any existing enrolled subjects doesn't exceed the `totalCredit` limit defined in the `SemesterRegistration`.
- **Atomic Capacity Management**: Uses MongoDB's `$inc: { maxCapacity: -1 }` with a filter `{ maxCapacity: { $gt: 0 } }` to prevent over-enrollment during concurrent requests.

## API Design
### Endpoint List
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/create-semester-enrollment` | Student | Submit enrollment for a curriculum |
| GET | `/my-semester-enrollments` | Student | View own enrollment history |
| GET | `/` | Admin/Instructor | List all enrollments with student IDs |
| GET | `/:id` | All | View detailed enrollment breakdown |

### Request/Response Examples
#### Create Enrollment (POST)
**Request Body:**
```json
{
  "curriculum": "65f3c..."
}
```
**Response (Success):**
```json
{
  "success": true,
  "message": "Semester enrollment is created successfully!",
  "data": { ... }
}
```

## Error Handling
- `403 Forbidden`: Thrown if the student attempts to enroll in a curriculum belonging to a different department.
- `400 Bad Request`: Thrown if prerequisites are not met or if the credit limit is exceeded.
- `409 Conflict`: Thrown if the student is already enrolled for the semester or if a subject becomes full during the transaction.
