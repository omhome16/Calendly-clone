# Calendly Clone Application

A comprehensive, full-stack enterprise scheduling application built natively to replicate Calendly's core booking mechanisms. This project provides individuals with the ability to define distinct Event Types, construct sophisticated availability bounds, handle dynamic Date Overrides (e.g. holidays / split shifts), and process real-time overlapping constraints across varied timezones.

---

## 🚀 Technology Stack

| Layer | Technology | Description |
|-----------|-----------|-----------|
| **Frontend** | React, Vite | Ultra-fast client rendering. |
| **Styling** | Tailwind CSS | Utility-first responsive semantic design layout. |
| **State** | TanStack Query | Caches and seamlessly invalidates API fetching automatically on mutations. |
| **Backend** | PostgreSQL | Robust relational database. Essential for rigid constraints and transactional consistency. |
| **API Framework** | Python FastAPI | Extremely performant, heavily typed API framework. |
| **ORM** | SQLAlchemy | Deeply mapping Python classes into PostgreSQL Data Types securely. |

---

## 🛠️ Local Startup & Execution

Follow these precise instructions to launch the full-stack architecture locally.

### 1. Database Setup
1. Ensure **PostgreSQL** is actively running on your machine.
2. Create an empty database for the app. Open `psql` or `pgAdmin` and execute:
   ```sql
   CREATE DATABASE calendly_clone_db;
   ```

### 2. Backend API Setup
1. Open a terminal at the project root and navigate down uniquely into the backend folder:
   ```bash
   cd backend
   ```
2. Initialize and activate a Python Virtual Environment:
   ```bash
   python -m venv venv
   
   # Windows Activation
   venv\Scripts\activate
   
   # Mac/Linux Activation
   source venv/bin/activate
   ```
3. Install package dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Define your environment connection. Inside the `backend/` folder, ensure your `.env` is configured natively to target your locally created Postgres instance. It should securely contain:
   ```env
   DATABASE_URL=postgresql://YOUR_POSTGRES_USER:YOUR_PASSWORD@localhost:5432/calendly_clone_db
   ```
5. Seed the database with the default Admin User, standard Event templates, and sample bookings. *Note: The seed script performs table generation automatically via SQLAlchemy:*
   ```bash
   python -m app.seed
   ```
6. Boot the FastAPI Server. 
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The backend API is now alive at `http://localhost:8000`.

### 3. Frontend React Setup
1. Open a fresh parallel terminal instance and navigate into the UI:
   ```bash
   cd frontend
   ```
2. Install the `npm` ecosystem defined inside package bounds:
   ```bash
   npm install
   ```
3. Boot the development server:
   ```bash
   npm run dev
   ```
   The frontend UI application runs natively at `http://localhost:5173`. 

*(The frontend comes pre-configured via Vite variables to target `http://localhost:8000` automatically).*

---

## 🧠 Relational Database Architecture

The application utilizes highly decoupled relational architectures ensuring that changes in dynamic rule-sets logically propagate without wiping existing dependencies.

```mermaid
erDiagram
    User ||--o{ EventType : "owns"
    User ||--|{ AvailabilitySchedule : "has"
    AvailabilitySchedule ||--o{ AvailabilityRule : "defines regular hours"
    AvailabilitySchedule ||--o{ DateOverride : "defines date exceptions"
    AvailabilitySchedule |o--o{ EventType : "applies to"
    EventType ||--o{ Booking : "generates"
    EventType ||--o{ SingleUseLink : "allows"
    EventType ||--o{ CustomQuestion : "asks"
    Booking ||--o| Booking : "rescheduled from"
    Booking |o--o| SingleUseLink : "consumes"

    User {
        Integer id PK
        String name
        String email
        String username
        String timezone
    }

    EventType {
        Integer id PK
        Integer user_id FK "-> User.id"
        Integer schedule_id FK "-> AvailabilitySchedule.id"
        String name
        String slug
        Integer duration
        String event_category 
        Integer buffer_before
        Integer buffer_after
        Integer max_per_day
        Integer schedule_days_ahead
        Integer min_notice_hours
    }

    AvailabilitySchedule {
        Integer id PK
        Integer user_id FK "-> User.id"
        String name
        Boolean is_default
        String timezone
        Integer meeting_limit_per_day
    }

    AvailabilityRule {
        Integer id PK
        Integer schedule_id FK "-> AvailabilitySchedule.id"
        SmallInteger day_of_week 
        Boolean is_available
        Time start_time
        Time end_time
    }

    DateOverride {
        Integer id PK
        Integer schedule_id FK "-> AvailabilitySchedule.id"
        Date override_date
        Boolean is_available
        Time start_time
        Time end_time
        Time start_time_2
        Time end_time_2
    }

    Booking {
        Integer id PK
        Integer event_type_id FK "-> EventType.id"
        Integer rescheduled_from FK "-> Booking.id"
        String status 
        DateTime start_time
        DateTime end_time
        String invitee_email
        String invitee_timezone
    }
```

---

## 📡 API Endpoints

The API aggregates heavily nested logic to safely abstract complex mapping away from frontend clients.

### Bookings (`/api/bookings`)
*   `POST /{slug}` — Intake layer. It validates UTC bindings, executes overlapping overlap validations checking for intersections strictly against `active` statuses, logs boundaries checking `max_per_day`, and dynamically stamps limits.
*   `GET /` — Serves dashboard lists natively aggregating specific criteria arrays.
*   `PATCH /{booking_id}/cancel` — Executes soft deletion logic (`status -> cancelled`).
*   `PATCH /{booking_id}/reschedule` — Performs lineage transitions (`status -> rescheduled` for Old Booking, creates New Booking marking its `rescheduled_from` pointer referencing the older dead instance ID).

### Open Availability Mapping (`/api/slots`)
*   `GET /{slug}/available-days/{year}/{month}` — Sweeps specific dates over physical limits mapping back absolute array subsets indicating physical chronological availability slots natively ensuring specific limits logic checks out perfectly.
*   `GET /{slug}/{date}` — Dynamically builds `duration` iteration intervals slicing via `AvailabilitySchedule` arrays.

### Availability Management Base (`/api/availability`)
*   `GET /` & `GET /all` — Generates array structures required for UI visualization parsing profiles natively.
*   `PATCH /{schedule_id}` — Maps explicit bounds definitions (e.g., establishing global standard arrays enforcing max limitations mapped across schedules logic).
*   `POST /{schedule_id}/overrides` — Executes logical coordinate Date overrides natively intercepting bounds mapping logic.

### Event Templates (`/api/event-types`)
*   `GET /` & `GET /{id}` — Fetches core temporal configurations and limits for all defined meetings.
*   `POST /` & `PATCH /{id}` — Constructs or mutates core boundaries for a specific meeting template.
*   `DELETE /{id}` — Safely cascades execution wiping out specific custom configurations.

### Add-Ons & Connectivity (`/api/single-use-links`, `/api/holidays`, `/api/notifications`)
*   `POST /api/single-use-links/` — Generates a 64-character encrypted string explicitly bypassing public slug visibility constraints.
*   `GET /api/holidays/{country_code}/{year}` — Connects via proxy to standard holiday libraries natively fetching calendar bounds.
*   `POST /api/notifications/*` — Handles SMTP email dispatches routing standard calendar invitations to users recursively.

---

## ⚙️ Backend Insights & Algorithmic Design

1. **The Concurrency / Overlap Algorithm**
Rather than utilizing specific PostgreSQL layer restrictions which prohibit split-second shifting logic inherently, the Backend maps overlapping constraints logically against the data layer via exact overlapping math. When creating a booking, SQLAlchemy inherently queries: 
   `start_time < NEW_END and end_time > NEW_START`. 
   If *any* generic `active` block matching those criteria structurally intersects those timestamps identically, it natively prevents the instantiation from continuing correctly eliminating double-booking flaws.

2. **Temporal Ghost Inheritance (Rescheduling Engine)**
Physical Data Deletion introduces fatal flaws causing analytic destruction across multi-instance data structures. When a booking moves natively, its `status` string is overwritten natively to `rescheduled`, removing it dynamically from all future overlap algorithms, while the fresh instance securely maps via the `rescheduled_from` integer pointing back explicitly verifying structural linkage traces. 

3. **Timezone Sanitization Protocols**
All database entries execute against standard ISO standard compliant UTC configurations rigidly ensuring mathematical intersections behave flawlessly independent from client browser logic, saving transformations dynamically precisely until visual rendering. Constraints are maintained inherently mathematically universally regardless of endpoint geographic locales natively executing logical timezone conversions internally securely. 
