# Curriculum Module

## Feature Overview
The Curriculum module is a core component of the Polytechnic Management System (PMS). It manages the academic structure for a specific department and semester, linking subjects, instructors, and schedules into a cohesive academic plan. It ensures that students within a department have a clear set of subjects to follow for a given semester registration.

## Module Purpose
The primary purpose of this module is to:
- Define the set of subjects offered to a specific academic department for a particular semester registration.
- Enforce academic regulations and credit requirements.
- Provide a centralized source for routine generation and class scheduling.
- Validate that the total credits of selected subjects match the requirements set in the semester registration.

## Curriculum Workflow
1. **Semester Registration**: An admin creates a semester registration for a specific shift and semester.
2. **Subject Offering**: Individual subjects are "offered" (scheduled with instructors and rooms).
3. **Curriculum Creation**: Admin selects multiple offered subjects to form a curriculum for a specific department.
4. **Validation**: The system validates that all subjects belong to the same regulation and that the total credits align with the semester registration.
5. **Persistence**: The curriculum is saved and becomes the basis for student enrollment and class schedules.

## Architecture
The module follows a standard Layered Architecture:
- **Interface**: Defines the TypeScript types for Curriculum data.
- **Model**: Mongoose schema definition with validation and indexing.
- **Controller**: Handles HTTP requests, extracts parameters, and calls service methods.
- **Service**: Contains business logic and interacts with the database.
- **Routes**: Defines the API endpoints and applies authentication/validation middlewares.
- **Validation**: Zod schemas for request body validation.
- **Utils**: Helper functions for credit calculation and specialized validations.

## Business Logic
- **Credit Validation**: Total credits of selected `offeredSubjects` must exactly match `semesterRegistration.totalCredit`.
- **Regulation Enforcement**: All subjects in a curriculum must belong to the same academic regulation (e.g., 2022 regulation).
- **Duplicate Prevention**: Unique index on `academicDepartment`, `academicSemester`, `session`, and `semisterRegistration`.
- **Status Check**: Curriculums can only be created or updated for registrations with `UPCOMING` or `ONGOING` status.

## Schema Relationship Explanation
- `academicDepartment`: Refers to the `AcademicDepartment` model.
- `academicSemester`: Refers to the `AcademicSemester` model (derived from semester registration).
- `semisterRegistration`: Refers to the `SemesterRegistration` model (links shift and registration status).
- `offeredSubjects`: An array of ObjectIds referring to the `OfferedSubject` model. Each offered subject contains its own schedule blocks (day, time, room).

## API Design
### Endpoint List
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/create-curriculum` | Admin/SuperAdmin | Create a new curriculum |
| GET | `/` | All | Retrieve all curriculums (filtered by role) |
| GET | `/:id` | All | Retrieve a single curriculum |
| PATCH | `/:id` | Admin/SuperAdmin | Update an existing curriculum |
| DELETE | `/:id` | Admin/SuperAdmin | Delete a curriculum |

### Request/Response Examples
#### Create Curriculum (POST)
**Request Body:**
```json
{
  "academicDepartment": "65f1a...",
  "semisterRegistration": "65f2b...",
  "regulation": 2022,
  "session": "2023-24",
  "offeredSubjects": ["65f3c...", "65f4d..."]
}
```
**Response:**
```json
{
  "success": true,
  "message": "Curriculum is created successfully!",
  "data": { ... }
}
```

## Error Handling
- `404 Not Found`: If department, registration, or subjects do not exist.
- `409 Conflict`: If a duplicate curriculum is detected.
- `400 Bad Request`: If credits don't match or regulation is inconsistent.

## Routine Generation Logic
The routine is not stored as a single object but is dynamically rendered on the frontend by aggregating the `scheduleBlocks` from all `offeredSubjects` linked to the curriculum. The backend ensures that the linked `offeredSubjects` are valid and populated with their respective schedule data.

## Impacted Modules & Dependency Impact
- **OfferedSubject**: The curriculum is highly dependent on `OfferedSubject`. Any changes to the `OfferedSubject` schema or scheduling logic directly impact how the curriculum is rendered and validated.
- **SemesterRegistration**: Defines the core constraints. The curriculum cannot exist without an active or upcoming registration.
- **EnrolledSubject**: Student enrollment is driven by the curriculum. A deleted or modified curriculum will affect student academic records.
- **AcademicDepartment**: Curriculums are siloed by department, ensuring that students only see relevant subjects.

## Maintainability & Scalability
- **Maintainability**: 
  - Centralized validation logic in `curriculum.utils.ts` ensures that business rules are consistent across create and update operations.
  - Consistent use of TypeScript interfaces across all layers (`interface -> model -> service`).
  - Standardized response format using the `sendResponse` utility.
- **Scalability**:
  - The use of `QueryBuilder` allows for efficient filtering, sorting, and pagination as the dataset grows.
  - The decoupled nature of `OfferedSubject` and `Curriculum` allows the scheduling system to scale independently of the academic planning system.
  - Use of Mongoose `populate` with specific field selections prevents over-fetching of data.
