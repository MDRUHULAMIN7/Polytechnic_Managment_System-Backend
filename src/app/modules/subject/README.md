# Subject Module

## Overview
The Subject module is a core component of the Polytechnic Management System (PMS). It manages the curriculum data, including subject details, marking schemes, assessment components, and instructor assignments. This module serves as the foundation for academic planning, marks entry, and result generation.

## Purpose
- Maintain a centralized repository of all subjects offered by the polytechnic.
- Define flexible marking schemes (Theory/Practical) and detailed assessment components (CT, Attendance, Viva, etc.).
- Manage pre-requisite relationships between subjects.
- Handle instructor assignments to specific subjects.

## Business Logic
### 1. Marking Scheme Normalization
The system ensures that the sum of all individual assessment components matches the total marks defined in the official marking scheme buckets:
- **THEORY_CONTINUOUS**
- **THEORY_FINAL**
- **PRACTICAL_CONTINUOUS**
- **PRACTICAL_FINAL**

### 2. Instructor Assignment
- Only valid instructors can be assigned to a subject.
- Prevents duplicate assignments using `$addToSet`.
- Supports bulk assignment and individual removal.

### 3. Subject Integrity
- Supports soft delete (`isDeleted: true`) to preserve historical data in results and registrations.
- Validates pre-requisite subjects to ensure they exist and are not the subject itself.

---

## Schema Design

### Subject Model
| Field | Type | Description |
| :--- | :--- | :--- |
| `title` | String | Full name of the subject. |
| `prefix` | String | Department/Category prefix (e.g., CSE). |
| `code` | Number | Unique numeric code. |
| `credits` | Number | Academic credits (e.g., 3.0). |
| `subjectType` | Enum | THEORY, THEORY_PRACTICAL, PRACTICAL_ONLY, etc. |
| `markingScheme` | Object | Nested totals for theory and practical buckets. |
| `assessmentComponents` | Array | List of specific items for marks entry. |
| `preRequisiteSubjects` | Array | References to other Subject IDs. |

---

## API Design

### Endpoints

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/subjects/create-subject` | Create a new subject. | Admin, SuperAdmin |
| `GET` | `/api/v1/subjects/` | List all subjects (supports pagination/search). | All Roles |
| `GET` | `/api/v1/subjects/:id` | Get details of a single subject. | All Roles |
| `PATCH` | `/api/v1/subjects/:id` | Update subject details. | Admin, SuperAdmin |
| `DELETE` | `/api/v1/subjects/:id` | Soft delete a subject. | Admin, SuperAdmin |
| `PUT` | `/api/v1/subjects/:subjectId/assign-instructors` | Assign instructors. | Admin, SuperAdmin |
| `DELETE` | `/api/v1/subjects/:subjectId/remove-instructors` | Remove assigned instructors. | Admin, SuperAdmin |

### Request Payload Example (Create Subject)
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

### Error Responses
- `400 Bad Request`: Validation failure (e.g., component totals don't match bucket total).
- `404 Not Found`: Subject or Instructor ID does not exist.
- `409 Conflict`: Instructor already assigned to the subject.

---

## Technical Notes
- **Transactions**: Subject updates use MongoDB sessions/transactions to ensure atomicity when updating basic info and pre-requisites simultaneously.
- **Normalization**: The `subject.marking.ts` utility handles automatic cleanup and normalization of payloads before they hit the database.
- **QueryBuilder**: The list endpoint uses a custom `QueryBuilder` for advanced filtering, sorting, and pagination.
