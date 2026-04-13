# Moote Friends & Family Picnic 2026

Event invitation and participation tracker for the annual Moote picnic.

**Date:** Saturday, June 20, 2026 at 12:00 pm  
**Location:** Bronte Creek Provincial Park — Day Use Side, Baseball A Pavilion  
**Address:** 1219 Burloak Drive, Oakville, ON L6M 4J2

---

## Features

- Password-protected invitation page
- Interactive map with directions (from east & west)
- Photo banner voting (4 options, credited to Adria Porter)
- Cornhole tournament RSVP form
- Password-protected admin dashboard with vote tallies, RSVP table, and CSV export

---

## Passwords

| Page | URL | Password |
|------|-----|----------|
| Invitation | `/` | `Moote2026` |
| Admin dashboard | `/admin` | `MooteAdmin2026` |

Passwords can be overridden via environment variables — see configuration below.

---

## Installation

### Requirements

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) (v2+)

---

### 1. Clone the repository

```bash
git clone https://github.com/parabyte-ca/picnic2026.git
cd picnic2026
```

---

### 2. (Optional) Configure passwords

Open `docker-compose.yml` and uncomment the environment variables to set custom passwords:

```yaml
environment:
  PORT: 3000
  MAIN_PASSWORD:  YourCustomPassword
  ADMIN_PASSWORD: YourCustomAdminPassword
```

If left commented out, the defaults (`Moote2026` / `MooteAdmin2026`) are used.

---

### 3. Build and start

```bash
docker compose up -d
```

The site will be available at **http://localhost:3000**

To serve on a different port (e.g. port 80), edit the `ports` line in `docker-compose.yml`:

```yaml
ports:
  - "80:3000"
```

---

### 4. View logs

```bash
docker compose logs -f
```

---

## Common commands

| Action | Command |
|--------|---------|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| Restart | `docker compose restart` |
| Rebuild after a code change | `docker compose up -d --build` |
| View live logs | `docker compose logs -f` |

---

## Data & backups

Votes and RSVPs are stored as JSON files inside a named Docker volume (`picnic_data`). Data persists across container restarts and re-deploys.

**Copy data files off the container:**

```bash
docker cp picnic2026:/app/data/votes.json  ./votes-backup.json
docker cp picnic2026:/app/data/rsvps.json  ./rsvps-backup.json
```

**Download RSVPs as CSV** from the admin dashboard (`/admin`) using the *Download CSV* button.

---

## Adding the real banner photos

The voting section currently shows placeholder images. To swap in the actual photos from the PDF:

1. Export the 4 photos as JPG files named `photo1.jpg` through `photo4.jpg`
2. Place them in `public/images/`
3. In `views/index.html`, update the four `<img>` src attributes from `.svg` → `.jpg`:

```html
<img src="/images/photo1.jpg" alt="Photo Option A by Adria Porter">
```

4. Rebuild the container:

```bash
docker compose up -d --build
```

---

## Running without Docker

Requires [Node.js](https://nodejs.org/) v18 or later.

```bash
npm install
node server.js
```

The site runs at **http://localhost:3000**
