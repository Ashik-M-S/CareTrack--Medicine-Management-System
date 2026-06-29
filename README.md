# CareTrack - Medicine Reminder System

CareTrack is a comprehensive solution for managing medicine schedules, designed for both caretakers and patients.

## Features

- **Auth**: Secure JWT-based authentication for Patients and Caretakers.
- **Caretaker Dashboard**: Search patients by email, send care requests, and manage medicine schedules.
- **Patient Dashboard**: Accept/Reject care requests and view daily medicine schedules.
- **Smart Reminders**: Automated email notifications for upcoming doses and missed dose alerts.
- **Modern UI**: Premium design using Glassmorphism and smooth animations.

## Tech Stack

- **Frontend**: HTML, CSS (Vanilla), JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose)

## Setup Instructions

### 1. Prerequisites
- Node.js installed on your machine.
- MongoDB instance running (local or Atlas).

### 2. Installation
1. Open the project in VS Code.
2. Navigate to the `caretrack` directory.
3. Install dependencies:
   ```bash
   npm install
   ```

### 3. Configuration
1. Open the `.env` file.
2. Update `MONGODB_URI` with your connection string.
3. Update `EMAIL_USER` and `EMAIL_PASS` with your Gmail and App Password for notifications.

### 4. Running the Application
#### Start Backend:
```bash
npm run dev
```

#### Open Frontend:
- npm start

## User Flow
1. **Register** as a Caretaker and a Patient (two different emails).
2. **Caretaker**: Search for the patient's email and click "Add Patient".
3. **Patient**: Login, accept the request from the dashboard.
4. **Caretaker**: Go to the dashboard, click "Schedule Meds" for the patient.
5. **Patient**: View the schedule and mark doses as taken.
