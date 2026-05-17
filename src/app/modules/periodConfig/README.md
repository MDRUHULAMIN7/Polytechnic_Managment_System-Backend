# Period Configuration Module

## Overview
The Period Configuration module manages the master grid of class time slots used throughout the polytechnic. It defines the daily schedule, including teaching periods and breaks, which serves as the foundation for the automated scheduling system and room occupancy tracking.

### Key Feature: Multi-Shift Support
The system supports multiple independent configurations for different shifts (e.g., **Morning** and **Day**). Unlike previous versions that enforced a single global configuration, the current architecture allows **one active configuration per shift** to exist simultaneously. This enables the polytechnic to run different time slots for morning and day operations.

---

## Database Schema

### PeriodConfig Model
The main configuration document.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `label` | String | Yes | Human-readable name (e.g., "Standard Summer Schedule") |
| `shift` | Enum | Yes | `MORNING` or `DAY`. Defaults to `DAY`. |
| `effectiveFrom` | Date | Yes | The date from which this configuration becomes valid. |
| `isActive` | Boolean | No | Whether this is the current active config for its shift. |
| `periods` | Array | Yes | List of period items (sub-schema). |
| `createdBy` | String | No | User ID of the creator. |
| `updatedBy` | String | No | User ID of the last updater. |

### Period Item (Sub-schema)
Individual time slots within a configuration.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `periodNo` | Number | Yes | Unique sequential number for the period. |
| `title` | String | No | Optional label (e.g., "Mathematics", "Tiffin Break"). |
| `startTime` | String | Yes | Format: `HH:MM` (24-hour). |
| `endTime` | String | Yes | Format: `HH:MM` (24-hour). |
| `durationMinutes`| Number | Yes | Total minutes calculated from start/end times. |
| `isBreak` | Boolean | No | If true, this slot is ignored during subject scheduling. |
| `isActive` | Boolean | No | Whether this specific slot is available for use. |

---

## Business Logic & Validation

### 1. Shift-Based Activation
The system enforces that only one configuration can be `isActive: true` for a specific shift at any given time.
- **Logic**: When creating or updating a configuration with `isActive: true`, the service automatically deactivates all other configurations for that same `shift`.
- **Implementation**: Handled in `PeriodConfigServices.ensureOnlyOneActiveConfig`.

### 2. Period Integrity
- **No Overlaps**: Period time ranges must not overlap within the same configuration.
- **Sequential Order**: Periods must be defined in chronological order by `periodNo`.
- **Duration Match**: The `durationMinutes` must exactly match the difference between `startTime` and `endTime`.
- **Unique Period Numbers**: Duplicate `periodNo` values are strictly prohibited.

---

## API Endpoints

### Get Active Configuration
Retrieves the currently active period grid.

- **Endpoint**: `GET /api/v1/period-configs/active`
- **Query Params**: 
  - `shift` (optional): Filter by specific shift (`MORNING` | `DAY`).
  - `semesterRegistrationId` (optional): Automatically determines the correct shift based on the registration details.
- **Access**: Admin, SuperAdmin.

### List All Configurations
- **Endpoint**: `GET /api/v1/period-configs`
- **Features**: Pagination, Searching (by label/shift), Filtering (by isActive).
- **Access**: Admin, SuperAdmin.

### Create Configuration
- **Endpoint**: `POST /api/v1/period-configs`
- **Body**: See `PeriodConfigInput` type.
- **Access**: SuperAdmin.

---

## Impacted Modules

| Module | Dependency Type | Description |
| :--- | :--- | :--- |
| **OfferedSubject** | **Critical** | The automated planner and manual scheduling validation both rely on the active period config for the specific shift of the `SemesterRegistration`. |
| **Room** | **Functional** | Room occupancy snapshots are calculated based on the active period grid. |
| **ClassSession** | **Data** | Individual class sessions are linked to period numbers defined in the config. |

---

## Migration & Backward Compatibility
- **Data Preservation**: Existing period configurations without a `shift` field are automatically treated as `DAY` shift by the database default.
- **API Stability**: The `/active` endpoint remains backward compatible; if no `shift` is provided, it retrieves the latest active configuration (typically the Day shift).
- **Scalability**: The `shift` field is an enum, allowing for future expansion (e.g., "Evening" shift) with minimal code changes.

---

## Error Handling Examples

| Status Code | Scenario | Message Example |
| :--- | :--- | :--- |
| `400 Bad Request` | Overlapping periods | "Period 2 overlaps with period 1." |
| `400 Bad Request` | Invalid duration | "Period 1 duration does not match the selected time range." |
| `404 Not Found` | No active config | "No active period configuration found for MORNING shift." |
| `403 Forbidden` | Permission denied | "You do not have permission to perform this action." |
