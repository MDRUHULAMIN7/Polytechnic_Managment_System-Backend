# RPI Polytechnic Management System

This is a comprehensive backend management system for RPI Polytechnic, built with **Express.js**, **TypeScript**, and **MongoDB**. It handles various administrative and academic processes such as user management (Students, Instructors, Admins), semester planning, subject offering, and registration.

## 🚀 Features

-   **User Management**:
    -   **Student**: Manage student profiles, guardians, and academic details.
    -   **Instructor**: Manage instructor profiles and departmental assignments.
    -   **Admin**: Administrative access and management.
    -   **Authentication**: Secure login and password management using JWT and Bcrypt.
-   **Academic Management**:
    -   **Academic Semesters**: Create and manage semesters with codes, years, and months.
    -   **Academic Departments**: distinct departments and link them to instructors.
    -   **Subjects**: Manage course subjects, credits, regulations, and prerequisites.
    -   **Offered Subjects**: Schedule subjects for specific semesters, instructors, and time slots.
    -   **Semester Registration**: Manage registration periods, status (Upcoming, Ongoing, Ended), and shifts.

## 🛠 Technology Stack

-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **Language**: TypeScript
-   **Database**: MongoDB (via Mongoose)
-   **Validation**: Zod & Mongoose Schema Validation
-   **Authentication**: JSON Web Tokens (JWT)
-   **Utilities**:
    -   `bcrypt` for password hashing.
    -   `cors` for cross-origin resource sharing.
    -   `cookie-parser` for cookie handling.
    -   `helmet` & `cors` for security.

## 🏃‍♂️ Installation & Run Locally

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd rpi_p_m_s
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables**
    Create a `.env` file in the root directory and configure your variables (PORT, DATABASE_URL, etc.).

4.  **Run in Development Mode**
    ```bash
    npm run start:dev
    ```

5.  **Build and Run Production**
    ```bash
    npm run build
    npm run start:prod
    ```

## 📚 Database Schemas

Here is an overview of the key data models used in the system.

### 1. User
Base entity for authentication and authorization.
- `id`: String (Unique)
- `email`: String (Unique)
- `password`: String (Hashed)
- `role`: Enum (`student`, `admin`, `instructor`)
- `status`: Enum (`active`, `blocked`)
- `isDeleted`: Boolean

### 2. Student
Extends User with academic and personal details.
- `id`: String (Unique, Student ID)
- `user`: ObjectId (Ref: User)
- `name`: Object (First, Middle, Last Name)
- `gender`: Enum (`male`, `female`, `others`)
- `dateOfBirth`: Date
- `email`: String
- `contactNo`: String
- `emergencyContactNo`: String
- `bloodGroup`: Enum (`A+`, `A-`, `B+`, etc.)
- `presentAddress`: String
- `permanentAddress`: String
- `guardian`: Object (Father/Mother details)
- `localGuardian`: Object (Name, Occupation, Contact, Address)
- `admissionSemester`: ObjectId (Ref: AcademicSemester)
- `academicDepartment`: ObjectId (Ref: AcademicDepartment)

### 3. Instructor
Details for teaching staff.
- `id`: String
- `user`: ObjectId (Ref: User)
- `designation`: String
- `name`: Object
- `gender`: Enum
- `dateOfBirth`: Date
- `email`: String
- `contactNo`: String
- `academicDepartment`: ObjectId (Ref: AcademicDepartment)

### 4. Admin
Administrative staff details.
- `id`: String
- `user`: ObjectId (Ref: User)
- `designation`: String
- `name`: Object
- `contactNo`: String
- `email`: String

### 5. Academic Semester
Defines the academic calendar.
- `name`: Enum (`Autumn`, `Summer`, `Fall`)
- `code`: Enum (`01`, `02`, `03`)
- `year`: String
- `startMonth`: Enum (Months)
- `endMonth`: Enum (Months)

### 6. Subject
Course curriculum details.
- `title`: String
- `prefix`: String
- `code`: Number
- `credits`: Number
- `regulation`: Number
- `preRequisiteSubjects`: Array of Objects (Ref: Subject)

### 7. Semester Registration
Controls registration windows.
- `academicSemester`: ObjectId (Ref: AcademicSemester)
- `status`: Enum (`UPCOMING`, `ONGOING`, `ENDED`)
- `shift`: Enum
- `startDate`: Date
- `endDate`: Date
- `totalCredit`: Number

### 8. Offered Subject
Specific classes available for registration.
- `semesterRegistration`: ObjectId (Ref: SemesterRegistration)
- `academicSemester`: ObjectId (Ref: AcademicSemester)
- `academicDepartment`: ObjectId (Ref: AcademicDepartment)
- `subject`: ObjectId (Ref: Subject)
- `instructor`: ObjectId (Ref: Instructor)
- `maxCapacity`: Number
- `section`: Number
- `days`: Array (`Sat`, `Sun`, `Mon`, etc.)
- `startTime`: String
- `endTime`: String

## 🛣 API Routes (Overview)

-   `/api/v1/users` - User management
-   `/api/v1/students` - Student operations
-   `/api/v1/admins` - Admin operations
-   `/api/v1/instructors` - Instructor operations
-   `/api/v1/academic-semesters` - Semester management
-   `/api/v1/academic-departments` - Department management
-   `/api/v1/subjects` - Subject management
-   `/api/v1/courses` - Course offerings
-   `/api/v1/semester-registrations` - Registration management
-   `/api/v1/auth` - Authentication (Login/Refresh Token)

