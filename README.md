# Calendly Clone

A full-stack, highly scalable scheduling and booking application designed to replicate core Calendly functionalities. It features complex temporal logic mapping, robust concurrency protection against double-booking, custom UI forms, intelligent multi-timezone parsing, and powerful event availability settings.

## 🚀 Tech Stack

- **Frontend**: React.js, Vite, Tailwind CSS, Lucide React (Icons), `date-fns` (Date calculations)
- **Backend / API**: Python 3, FastAPI, SQLAlchemy ORM, Pydantic, Uvicorn
- **Database Engine**: PostgreSQL 
- **State Management**: TanStack React Query (Frontend)

---

## ⚙️ Local Setup Instructions

Ensure that you have **Node.js** (v18+), **Python** (3.9+), and **PostgreSQL** natively installed and running.

### 1. Database Setup
Launch `psql` or pgAdmin and create the database:
```sql
CREATE DATABASE calendly_clone_db;
```

### 2. Backend Configuration
Navigate to the backend directory and set up your active Python environment:
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file inside the `backend` folder securely defining your connection bounds and SMTP (if you wish to enable native email delivery):
```env
# Database configuration
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/calendly_clone_db

# Email Notification Configuration (Optional - Falls back to console print)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=your_email@gmail.com
```

Initialize your database schema and start the API engine natively:
```bash
python reset_db.py
uvicorn main:app --reload --port 8000
```

### 3. Frontend Configuration
Open a new terminal session securely attached to your project root and navigate down:
```bash
cd frontend
npm install
npm run dev
```
The React development application will boot up at `http://localhost:5173`. 

---

## 🧠 System Architecture & Database Anatomy

The relational database architecture is designed gracefully to handle strict multi-layer boundaries allowing an Event Type to detach/reattach logically from explicit Availability rulesets without mutating existing dependencies.

### Core Tables:
- **`users`**: Identity block holding `timezone` anchors.
- **`event_types`**: The specific meeting blueprint definition (e.g., "15 Min Chat"). Holds duration, buffers, limits, and slug references.
- **`availability_schedules`**: Grouped sets of recurring limits and rules natively separated from Event Types for reusability. 
- **`availability_rules`**: Infinite recurring bounded rules based rigidly on `0-6` Day Index definitions.
- **`date_overrides`**: Chronological override arrays designed to instantly discard standard rules for a specific static Date matching coordinate (used natively for Holidays or Split-shift logic).
- **`bookings`**: Transactional records holding physical Timestamp constraints bound safely in native UTC format.

### Database State Logic / Assumptions
- **Soft Deletion Protocol**: `bookings` are explicitly never deleted. They follow a strict Status Enum transition mapping (`active` -> `cancelled` / `rescheduled`) to permit auditable chronological sweeps and descendant-branch mapping.
- **Native Application Logic**: The Database lacks a stringent backend Unique constraint for Overlapping bookings. This operates under the assumption that application layer math inside `crud.py` provides perfectly customized overlaps specifically allowing concurrent logic where explicit limits permit.
- **One User Assumption**: This is currently scaled out as an independent MVP. As such, the application hardcodes requests securely pointing at `user_id = 1` inside the API layer. Multi-tenant mappings would simply involve injecting verified JWT extraction to derive user contexts natively.

---

## 📡 API Endpoints Core Mapping

The FastAPI layer dynamically governs interactions separated strictly across modular execution arrays.

### Availability Module (`/api/availability`)
- `GET /` - Fetches global standard Schedule arrays.
- `PATCH /{schedule_id}` - Modifies the base ruleset.
- `POST /{schedule_id}/overrides` - Defines a manual Date exception matrix.
- `DELETE /overrides/{override_id}` - Kills an override safely restoring base recurring math for that explicit date.

### Booking Module (`/api/bookings`)
- `GET /` - Aggregates Dashboard view listings (`upcoming`, `past`).
- `POST /{slug}` - The core ingestion point. Converts user payloads, calculates explicit buffer additions, executes multi-loop DB overlap sweeps against existing bounds, and creates the entry.
- `PATCH /{booking_id}/cancel` - Triggers state transition.
- `PATCH /{booking_id}/reschedule` - Triggers DNA transition mutating old booking safely into inherited clone natively mapped at a new chronological window.

### Transient Module (`/api/slots`)
- `GET /{slug}/{date}` - High intensity logic. Fetches exact defined limits and explicitly returns sliced mathematically parsed intervals validating physical intersections.
- `GET /{slug}/available-days/{year}/{month}` - Used actively by monthly calendar UI renders. Returns a matrix defining exactly which days explicitly possess at least One (1) valid non-conflicting timeslot.

---

## ⚙️ Core Logic Functions Definition

### `check_booking_conflicts`
Executes an explicit PostgreSQL `JOIN` querying any existing active bookings specifically owned mechanically by the exact Host bounding the proposed Meeting template. Calculates if bounds overlap mathematically checking if proposed `start_time` intercepts the domain of existing `[start, end]`.

### `generate_available_slots`
Triggers when an Invitee views a host's dynamic link. 
1. Calculates explicit boundaries based on standard schedules factoring in explicit holiday Overrides. 
2. Fetches existing conflicting temporal debts bound to the specific host.
3. Steps mechanically iterating exactly `duration` instances natively generating permutations.
4. If a permutation touches an aggregate conflicting block, discards it natively.
5. If the total booking capacity currently spanning the physical Day overlaps the Parent daily metric mapping limit, inherently strips that Day explicitly across arrays.

### `cancelMutation` (React Callback Logic)
Instead of forcing isolated updates across Dashboard arrays when users change statuses, the robust frontend framework wraps explicit invalidator requests querying `TanStack`. When an asynchronous API cancels an event, React-Query intercepts completion tracking safely triggering deep `['bookings']` cache invalidations which instantly repaints the user state.
