# Backend Documentation: Auth Module

## Feature Overview
The Auth module manages authentication, session issuance, token refresh, password reset, and rate-limited login workflows. It supports secure access for administrators, instructors, students, and super admins.

## Authentication Workflow
- Login credentials are validated against stored user records.
- Successful authentication issues an access token and a refresh token.
- Access tokens are used for most resource requests.
- Refresh tokens are used to obtain a new access token after expiry.

## Password Reset Workflow
1. User submits a forget-password request with their identifier.
2. The system issues a short-lived reset token backed by JWT.
3. A secure email link is sent to the user's registered address.
4. The reset endpoint validates the token and updates the password.

## Security Rules
- Invalid or blocked users are rejected during login and token refresh.
- Rate limiting is applied to login, socket token issuance, and forgot-password endpoints.
- Password reset tokens are intentionally short-lived (`10m`).
- Password change requests require the user to be authenticated.

## API Design
| Method | Path | Description | Access |
|---|---|---|---|
| POST | `/login` | Authenticate and obtain JWT tokens | Public |
| POST | `/change-password` | Update password for authenticated user | Authenticated |
| POST | `/refresh-token` | Refresh access token using refresh token | Public |
| GET | `/socket-token` | Issue socket auth token for web socket connections | Rate-limited |
| POST | `/logout` | Invalidate client session (stateless logout) | Public |
| POST | `/forget-password` | Start password reset workflow | Rate-limited |
| POST | `/reset-password` | Complete password reset with token | Public |

## Request / Response Examples
### Login
Request
```json
{
  "id": "student-1001",
  "password": "SecureP@ssw0rd"
}
```
Response
```json
{
  "refreshToken": "...",
  "accessToken": "...",
  "role": "student",
  "needsPasswordChange": false
}
```

### Refresh Token
Request
```json
{
  "refreshToken": "..."
}
```
Response
```json
{
  "accessToken": "...",
  "role": "student"
}
```

### Password Reset Request
Request
```json
{
  "id": "student-1001"
}
```
Response
```json
{
  "message": "Password reset email sent if user exists."
}
```

### Reset Password
Request
```json
{
  "id": "student-1001",
  "newPassword": "NewSecureP@ss"
}
```
Response
```json
{
  "message": "Password reset successful."
}
```

## Error Handling
- `401 Unauthorized` for invalid credentials, invalid sessions, or expired tokens.
- `403 Forbidden` for blocked or deleted user accounts.
- `400 Bad Request` for malformed payloads.
- `429 Too Many Requests` when rate limiting is triggered.

## Technical Implementation Notes
- Passwords are compared using bcrypt.
- JWT tokens are created via `createToken` and verified with `verifyToken`.
- Refresh token flow checks password change timestamps to invalidate older refresh tokens after a password update.
- Password reset emails use a templated HTML payload with secure UI links.
- The service layer returns minimal semantic payloads to decouple from HTTP response formatting.

## Maintainability & Scalability
- Auth logic is separated into route, controller, service, and utility layers.
- Rate limiting is configurable via `config/auth_rate_limit_*`.
- New auth capabilities (OAuth, multi-factor) can be introduced by extending the service and adding dedicated routes.
- Exception handling is centralized using `AppError`, which helps maintain consistent responses across auth operations.
