# Backend Documentation: Subject Module

## Feature Overview
The Subject module manages academic subjects, marking schemes, assessment structure, and instructor bindings. It is the core metadata service for curriculum planning, grade entry, and subject assignment.

## Purpose
- Author and maintain subject metadata.
- Define and enforce marking schemes and assessment components.
- Track prerequisite subject relationships.
- Manage instructor-subject assignments.

## Business Rules
- Subjects must have valid codes, prefixes, and credit values.
- Marking scheme buckets must sum to the total expected marks.
- Prerequisite subjects cannot reference the parent subject.
- Assigned instructors must exist and not be duplicated.
- Soft deletes preserve historical subject references for past records.

## Validation Architecture
### Request Validation
`subject.validation.ts` uses `zod` schemas to validate payload shapes before controller execution.

### Business Validation
Service methods enforce integrity rules such as:
- Marking bucket totals
- Prerequisite existence and uniqueness
- Instructor assignment deduplication

### Separation of Concerns
- Validation schemas handle format and required fields.
- Service layer handles persistence and cross-document business rules.
- Utility functions normalize incoming subject payloads.

## Schema Relationships
- `Subject` is the primary metadata document.
- `SubjectInstructor` links subjects to instructors.
- `OfferedSubject` and `Curriculum` consume the subject metadata for schedule planning.
- Soft deletes (`isDeleted`) preserve historical integrity across registrations and results.

## API Design
### Endpoints
| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| `POST` | `/api/v1/subjects/create-subject` | Create a new subject | Admin, SuperAdmin |
| `GET` | `/api/v1/subjects/` | List subjects with filtering, search, and pagination | All Roles |
| `GET` | `/api/v1/subjects/:id` | Get subject details | All Roles |
| `PATCH` | `/api/v1/subjects/:id` | Update a subject | Admin, SuperAdmin |
| `DELETE` | `/api/v1/subjects/:id` | Soft delete a subject | Admin, SuperAdmin |
| `PUT` | `/api/v1/subjects/:subjectId/assign-instructors` | Assign instructors | Admin, SuperAdmin |
| `DELETE` | `/api/v1/subjects/:subjectId/remove-instructors` | Remove instructors | Admin, SuperAdmin |

## Request Example: Create Subject
```json
{
  "title": "Data Structures",
  "prefix": "CSE",
  "code": 2101,
  "credits": 3,
  "regulation": 2022,
  "subjectType": "THEORY_PRACTICAL",
  "theoryPeriodsPerWeek": 3,
  "practicalPeriodsPerWeek": 3,
  "markingScheme": {
    "theoryContinuous": 40,
    "theoryFinal": 60,
    "practicalContinuous": 25,
    "practicalFinal": 25,
    "totalMarks": 150
  },
  "assessmentComponents": [
    { "title": "Class Test", "bucket": "THEORY_CONTINUOUS", "fullMarks": 20, "componentType": "class_test" },
    { "title": "Attendance", "bucket": "THEORY_CONTINUOUS", "fullMarks": 10, "componentType": "attendance" }
  ]
}
```

## Response Example
```json
{
  "id": "64f5a4f2d227d9b3ae4b9877",
  "title": "Data Structures",
  "prefix": "CSE",
  "code": 2101,
  "credits": 3,
  "subjectType": "THEORY_PRACTICAL",
  "markingScheme": {
    "theoryContinuous": 40,
    "theoryFinal": 60,
    "practicalContinuous": 25,
    "practicalFinal": 25,
    "totalMarks": 150
  }
}
```

## Error Handling
- `400 Bad Request` for invalid payload shape or mismatched marking totals.
- `404 Not Found` for missing subject or instructor references.
- `409 Conflict` for duplicate instructor assignment or invalid business state.

## Technical Implementation Notes
- Uses `zod` schemas for payload validation.
- Employs a transaction when updating subjects and prerequisites.
- QueryBuilder enables advanced list filtering and pagination.
- Marking normalization utilities keep subject data consistent across updates.

## Refactor Summary
- Consolidated subject validation logic into `subject.validation.ts`.
- Decoupled form normalization from controller persistence.
- Improved schema stability by validating references before updates.

## Performance & Maintainability
- Subject list queries use indexed fields and projection.
- Validation and normalization helpers are reusable across creation and update workflows.
- The module's separation between route, controller, service, and util improves extensibility.
