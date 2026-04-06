# PMS Backend

Express and TypeScript backend for the Polytechnic Management System. This service powers authentication, role-based academic operations, realtime notifications, media uploads, and chatbot-assisted public experiences.

Connected frontend: [https://polytechnic-managment.vercel.app/](https://polytechnic-managment.vercel.app/)

## Overview

The backend acts as the operational core of the platform:

- authenticates users and maintains role-safe access
- manages students, instructors, admins, and super admin capabilities
- drives semester, subject, curriculum, class-session, and attendance workflows
- serves notices, notifications, and chatbot endpoints
- supports Cloudinary-based image uploads
- exposes a health endpoint for deployment monitoring and wake-up checks

## Main Capabilities

### Identity and access

- JWT-based access and refresh token flow
- password reset support
- role-based authorization for `student`, `instructor`, `admin`, and `superAdmin`
- account status control, including blocked user handling

### Academic operations

- academic semesters
- academic departments
- academic instructors
- subjects
- curriculums
- semester registrations
- offered subjects
- semester enrollments
- enrolled subjects
- class sessions
- attendance tracking

### Communication systems

- notices with publish and targeting flows
- in-app notifications
- Socket.IO realtime delivery for important academic events
- public chatbot integration

### Media and profile support

- Cloudinary upload flow for user profile images
- multipart file upload handling through multer
- editable self-profile support for student, instructor, and admin accounts

## Tech Stack

- Node.js
- Express 5
- TypeScript
- MongoDB
- Mongoose
- Zod
- Joi
- JWT
- bcrypt
- Socket.IO
- Nodemailer
- Cloudinary

## Repository Layout

- `src/server.ts`
  Bootstraps MongoDB, seeds the super admin, and starts the HTTP server.
- `src/app.ts`
  Express app setup, CORS, parsers, routes, and health endpoint.
- `src/app/routes`
  Central route registration layer.
- `src/app/modules`
  Feature-focused modules for auth, users, academics, classes, notices, notifications, chatbot, and more.
- `src/app/socket`
  Realtime socket setup, middleware, and event delivery.
- `src/app/utils`
  Shared utilities such as Cloudinary upload, response helpers, and async wrappers.

## API Base and Health Check

Base prefix:

```txt
/api/v1
```

Health endpoint:

```txt
GET /health
```

The frontend uses this health endpoint to detect cold starts and present a professional wake-up message when free hosting delays the first request.

## Environment Variables

Create `backend/.env` and configure the following values:

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
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SUPER_ADMIN_PASSWORD=
CORS_ORIGINS=https://polytechnic-managment.vercel.app,http://localhost:3000
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_SITE_URL=https://polytechnic-managment.vercel.app
```

Notes:

- `OPENROUTER_*` values are only required if chatbot features are enabled.
- `CORS_ORIGINS` accepts a comma-separated list.
- `RESET_PASS_UI_LINK` should point to the deployed frontend reset-password route.

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

With the default API prefix, frontend requests typically target:

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

## Realtime Notes

Socket.IO is initialized during server startup and is used for important events such as:

- notice publication
- class started, completed, or cancelled
- attendance updates
- assigned or removed offered-subject notifications

This backend is therefore best deployed as a persistent Node service rather than a purely serverless API.

## Deployment Guidance

This backend is suitable for Render, Railway, VPS, or any persistent Node hosting environment.

### Recommended production settings

- Root directory: `backend`
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Health check path: `/health`

### Frontend integration

If the backend is deployed to a host such as `https://your-backend-host.onrender.com`, set the frontend environment like this:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend-host.onrender.com/api/v1
NEXT_PUBLIC_SOCKET_URL=https://your-backend-host.onrender.com
NEXT_PUBLIC_SITE_URL=https://polytechnic-managment.vercel.app
```

### Free-tier hosting note

If the backend is deployed on a free service that sleeps after inactivity, the first request may be slower. The frontend already includes a wake-up modal to explain that delay professionally to visitors while the backend becomes responsive.

## Demo Access

If you are using seeded local/demo data, these sample accounts may exist:

- Super Admin
  ID: `0001`
  Password: `admin12345`
- Admin
  ID: `A-0001`
  Password: `admin1234`
- Instructor
  ID: `I-0003`
  Password: `Instructor@123`
- Student
  ID: `2027010001`
  Password: `ruhul1234`

Use demo credentials only for local or controlled environments.
