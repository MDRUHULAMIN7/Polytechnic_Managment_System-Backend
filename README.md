# RPI Polytechnic Management System - Backend

Comprehensive backend for the Polytechnic Management System (PMS). Built with Express + TypeScript and designed for academic operations, role-based dashboards, realtime notifications, and a public chatbot.

## Key Features

- Authentication with JWT (access + refresh) and password reset flow.
- Role-based access for admin, super admin, instructor, and student.
- User management for students, instructors, and admins.
- Academic management for semesters, departments, instructors, subjects, and curriculums.
- Semester operations: registrations, offered subjects, enrollments, and enrolled subjects.
- Class sessions and student attendance tracking.
- Notices with targeting, read/acknowledge tracking, and publish flow.
- Notifications API + realtime updates via Socket.IO.
- Chatbot API powered by OpenRouter.
- Media uploads via Cloudinary.

## Tech Stack

- Node.js + Express 5
- TypeScript
- MongoDB + Mongoose
- Zod + Joi validation
- JWT + bcrypt
- Socket.IO
- Nodemailer
- Cloudinary

## Project Structure

- `src/app/routes` — route registrations
- `src/app/modules` — feature modules (auth, notices, notifications, chatbot, etc.)
- `src/app/socket` — realtime event types and Socket.IO wiring
- `src/server.ts` — app bootstrap + server start

## Environment

Required environment variables:

```
NODE_ENV=production
PORT=5000
DATABASE_URL=
BCRYPT_SALT_ROUNDS=12
DEFAULT_PASS=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=30d
RESET_PASS_UI_LINK=https://your-frontend-domain/reset-password
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SUPER_ADMIN_PASSWORD=
CORS_ORIGINS=https://your-frontend-domain
```

Optional (required if you enable chatbot):

```
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_SITE_URL=
```

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```

## Scripts

- `npm run start:dev` — dev server with hot reload
- `npm run build` — compile TypeScript
- `npm run start` — start compiled server
- `npm run lint` — lint
- `npm run lint:fix` — lint and fix

## API Routes (Overview)

Base prefix: `/api/v1`

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

## Realtime Events

Socket.IO emits notification events for key actions, including:

- notice published
- class started / completed / cancelled
- attendance marked
- offered subject assigned / removed

Clients can also fetch, mark read, and clear notifications via the REST API.

## Render Deploy

This backend uses `src/server.ts` to start the HTTP server and initialize Socket.IO. For production realtime notifications, deploy it as a persistent Node web service.

### Included deploy files

- Blueprint: `render.yaml`
- Example env file: `.env.example`
- Health check endpoint: `GET /health`

### Render service settings

- Root directory: `backend`
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Health check path: `/health`

### Frontend environment after backend deploy

If Render gives you a backend URL like `https://pms-backend.onrender.com`, set:

```
NEXT_PUBLIC_API_BASE_URL=https://pms-backend.onrender.com/api/v1
NEXT_PUBLIC_SOCKET_URL=https://pms-backend.onrender.com
```

Set backend `CORS_ORIGINS` to include your frontend URL, for example:

```
CORS_ORIGINS=https://your-frontend-domain.vercel.app,http://localhost:3000
```

Set `RESET_PASS_UI_LINK` to your deployed frontend reset page:

```
RESET_PASS_UI_LINK=https://your-frontend-domain.vercel.app/reset-password
```

## Users Credentials

Use the following accounts for testing:

- SuperAdmin
  - ID: 0001
  - Password: admin12345
- Admin
  - ID: A-0001
  - Password: admin1234
- Instructor
  - ID: I-0003
  - Password: Instructor@123
- Student
  - ID: 2027010001
  - Password: ruhul1234
