# Student Document Request and Tracking System

A web-based system where students request school documents (such as a Certificate of Enrollment) and track their status online, and authorized school staff manage those requests.

**Course / Section:** ITPC 103 \& ITPE 101 — \[BSIT 2-A]

## Group Members

* Arique, Mikaela Andrea V.
* Dela Cruz, Mary Joy B.
* Junaid, Nicolas Idriyan M.
* Locson, Julia Francince Q.
* Najam, Mervin D.
* Talib, Rashida D.

## Features

* **Online document request** — students pick a document, state the purpose and number of copies.
* **Request status tracking** — Pending → Processing → Ready for Release → Completed, shown as a progress tracker.
* **Request management** — staff search, filter, view and update request status with remarks.
* **Request history and records** — every status change is stored with who made it and when.

## Tech Stack

|Layer|Tool|
|-|-|
|Frontend|ReactJS (Vite)|
|Backend|Node.js + Express|
|Database|MySQL|

## Scope and Limitations

Only school-supported document types are included. Approval and release still follow school policy. The system does not generate official documents and has no online payment.

## How to Run

Requirements: Node.js 18+, MySQL 8+.

1. **Database** — import the schema:

```
   mysql -u root -p < database/schema.sql
   ```

2. **Backend**

```
   cd server
   cp .env.example .env      # then set DB\\\_PASSWORD and JWT\\\_SECRET
   npm install
   npm run seed              # creates the staff account
   npm run dev
   ```

3. **Frontend** (new terminal)

```
   cd client
   npm install
   npm run dev
   ```

4. Open http://localhost:5173

## Default Accounts

* Staff: `staff@school.edu` / `staff123`
* Student: click **Register** on the login page.

## Project Structure

```
database/schema.sql   MySQL tables and document types
server/               Express API (auth, requests, status history)
client/               React app (student and staff pages)
```

