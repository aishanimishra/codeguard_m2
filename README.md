# 🛡️ CodeGuard

**Automated Python code quality gating with GitHub OAuth, Pylint analysis, and commit status checks.**

Every push or PR triggers a Pylint analysis. If the score falls below your threshold, the commit is blocked. Full dashboard to track score trends, file-by-file breakdowns, and history.

---

## Architecture

```
GitHub Push / PR
      │
      ▼ webhook
┌─────────────┐     clone + pylint    ┌──────────────┐
│   FastAPI   │ ──────────────────── │  Pylint 3.x  │
│  (backend)  │                      └──────────────┘
│             │ ── commit status ──▶  GitHub API
└─────────────┘
      │
      ▼ REST API
┌─────────────┐
│  React SPA  │  (Vite + Recharts + Tailwind)
│  (frontend) │
└─────────────┘
      │
      ▼ port 80
    Nginx
```

---

## Quick Start

### 1. Create a GitHub OAuth App

Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**

| Field | Value |
|---|---|
| Application name | CodeGuard |
| Homepage URL | `http://YOUR_SERVER_IP` |
| Authorization callback URL | `http://YOUR_SERVER_IP/auth/callback` |

Copy the **Client ID** and **Client Secret**.

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_WEBHOOK_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
FRONTEND_URL=http://YOUR_SERVER_IP   # or https://your-domain.com
```

### 3. Deploy with Docker Compose

```bash
docker-compose up --build -d
```

App is live at **http://YOUR_SERVER_IP**

### 4. First use

1. Open the app and click **Continue with GitHub**
2. Go to **Add Repo** → select a Python repo → set your quality threshold
3. Push code to that repo — analysis starts automatically
4. Click **Run analysis** to analyse immediately without pushing

---

## How the quality gate works

| Score | Gate |
|---|---|
| ≥ threshold | ✅ `success` — merge allowed |
| < threshold | ❌ `failure` — build blocked |
| Error during analysis | `error` |

The commit status is posted directly to GitHub, so it integrates with branch protection rules. In your repo settings → **Branches → Branch protection rules**, enable:

- ✅ Require status checks to pass before merging
- Search for: `CodeGuard / quality-gate`

---

## Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env  # fill in values
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # runs on http://localhost:3000
```

The Vite dev server proxies `/api/*` to `localhost:8000`.

---

## Project structure

```
codeguard/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + CORS
│   │   ├── api/
│   │   │   ├── auth.py          # GitHub OAuth routes
│   │   │   ├── repos.py         # Repo registration + webhook install
│   │   │   ├── analysis.py      # Manual trigger + detail fetch
│   │   │   └── webhook.py       # GitHub push/PR webhook handler
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic settings
│   │   │   ├── database.py      # SQLAlchemy async engine
│   │   │   └── security.py      # JWT auth
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── repo.py
│   │   │   └── analysis.py
│   │   └── services/
│   │       ├── analyser.py      # Pylint runner + score calculator
│   │       ├── github.py        # Clone repo + post commit status
│   │       └── runner.py        # Orchestrates full analysis pipeline
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx        # GitHub OAuth landing
│   │   │   ├── Callback.jsx     # OAuth token exchange
│   │   │   ├── Dashboard.jsx    # Overview + trend chart
│   │   │   ├── Repos.jsx        # All registered repos
│   │   │   ├── RepoDetail.jsx   # Per-repo history + settings
│   │   │   ├── AddRepo.jsx      # Register a new repo
│   │   │   └── AnalysisDetail.jsx  # Full file breakdown
│   │   ├── components/
│   │   │   ├── layout/          # Sidebar, AppLayout
│   │   │   └── ui/              # ScoreRing, GateBadge
│   │   ├── hooks/useAuth.jsx    # Auth context
│   │   └── lib/api.js           # Typed API client
│   ├── nginx.conf               # SPA routing + API proxy
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Customising Pylint rules

Create a `backend/.pylintrc` (or `pyproject.toml`) to override defaults:

```ini
[MASTER]
disable=C0114,C0115,C0116   # disable missing-docstring warnings

[FORMAT]
max-line-length=120

[DESIGN]
max-args=8
max-locals=20
```

Mount it into the container or copy it into `backend/` — it will be picked up automatically when Pylint runs.

---

## Webhook troubleshooting

If webhooks aren't being received:
- Your server must be publicly reachable (not `localhost`)
- Use [smee.io](https://smee.io) or `ngrok` for local development
- Check GitHub → repo → Settings → Webhooks → Recent Deliveries for errors
- Verify `GITHUB_WEBHOOK_SECRET` matches what's in GitHub

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy async, SQLite |
| Analysis | Pylint 3.x |
| Auth | GitHub OAuth 2.0, JWT |
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Proxy | Nginx |
| Deploy | Docker Compose |

---

## Module 2 — File Upload Analyser

A **public-facing, no-login** tool for instant Pylint analysis. Anyone can upload a `.py` file or paste code and get a score, issue breakdown, and a downloadable PDF report.

**Live at:** `http://YOUR_SERVER_IP/analyse`

### Features

- Drag-and-drop `.py` upload **or** paste code directly
- Same score ring, issue badges, and file breakdown UI as the main dashboard
- One-click PDF report download (generated server-side with ReportLab)
- Results stored in **AWS S3** with a shareable result UUID
- Analysis metrics pushed to **AWS CloudWatch** (score, issue count, duration)
- No GitHub account or login required

### How it works

```
Browser → POST /api/upload/file  (or /paste)
              │
              ▼
        FastAPI (upload.py)
              │
              ├─ run_pylint_on_dir()  ← same analyser as Module 1
              │
              ├─ S3: save result JSON   (if UPLOAD_RESULTS_BUCKET set)
              │
              ├─ CloudWatch: push metrics
              │
              └─ return JSON → browser renders results
                                    │
                                    └─ POST /api/upload/report
                                                │
                                                ▼
                                         ReportLab PDF → download
```

### AWS setup (optional but recommended)

**1. Create the S3 bucket** (Terraform does this automatically):
```bash
aws s3 mb s3://codeguard-results-dev --region us-east-1
```

**2. Set environment variables** in `.env`:
```env
UPLOAD_RESULTS_BUCKET=codeguard-results-dev
AWS_REGION=us-east-1
CW_NAMESPACE=CodeGuard
```

**3. IAM permissions required** (attached to EC2 instance profile by Terraform):
- `s3:PutObject`, `s3:GetObject` on the results bucket
- `cloudwatch:PutMetricData`

If `UPLOAD_RESULTS_BUCKET` is empty, results are still returned to the browser — S3 persistence is simply skipped. The app never crashes if AWS isn't configured.

### New API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/upload/file` | None | Upload a `.py` file |
| `POST` | `/api/upload/paste` | None | Paste Python code |
| `GET`  | `/api/upload/result/{id}` | None | Fetch cached result from S3 |
| `POST` | `/api/upload/report` | None | Generate PDF from result JSON |
| `GET`  | `/api/upload/report/{id}` | None | Generate PDF from S3 result |

### PDF report contents

- Quality score (colour-coded ring)
- File metadata and result UUID
- Issue summary table (fatal / error / warning / refactor / convention)
- Most common Pylint symbols with counts
- Full file breakdown — every file with every issue, line number, severity, and symbol
- CodeGuard branding, timestamp, and result ID in footer

---

## Infrastructure (Module 2 additions)

All infrastructure is defined as code in `infra/`.

### Terraform (`infra/terraform/`)

Provisions the full AWS stack from scratch:

| Resource | Purpose |
|---|---|
| VPC + subnets + IGW | Isolated network for the app |
| Security Group | HTTP/HTTPS/SSH ingress |
| EC2 (Ubuntu 24.04, t3.small) | Application server |
| Elastic IP | Static public IP |
| IAM Role + Instance Profile | Grants EC2 access to S3 + CloudWatch, no hardcoded keys |
| S3 bucket | Persistent result storage with versioning, AES-256 encryption, 30-day lifecycle |
| CloudWatch Log Group | `/codeguard/dev/app` with 14-day retention |
| CloudWatch Alarms | High CPU (>80%) + Low quality score (<5.0 avg) |
| CloudWatch Dashboard | Score, analysis count, duration, EC2 CPU, issues per analysis |

```bash
cd infra/terraform
terraform init
terraform apply -var-file=env/dev.tfvars
```

Outputs: public IP, S3 bucket name, dashboard URL, SSH command.

### Ansible (`infra/ansible/`)

Configures the EC2 instance after provisioning:

```bash
# Replace <EC2_PUBLIC_IP> in inventory.ini first
cd infra/ansible
ansible-playbook site.yml -i inventory.ini \
  --extra-vars "s3_bucket=codeguard-results-dev aws_region=us-east-1"
```

Tasks run:
- Install Docker, Nginx, certbot
- Write `.env` from template, copy `docker-compose.yml`
- Create `codeguard.service` systemd unit (auto-start on reboot)
- Configure Nginx as reverse proxy (`/api/` → FastAPI, `/` → React)
- Set up logrotate for app logs
- Start and enable CloudWatch agent

### Jenkins CI/CD (`Jenkinsfile`)

6-stage pipeline triggered on every push:

```
Checkout → Lint & Test → Build Docker → Push to ECR → Terraform apply → Ansible deploy → Smoke test
```

Each stage uses the appropriate tool:
- **Git** — checkout, commit SHA tagging
- **Pylint** — lint gate (fail if score < 7.0)
- **Docker** — build backend + frontend images
- **AWS ECR** — push tagged images
- **Terraform** — idempotent infra updates
- **Ansible** — rolling app deployment
- **curl** — smoke test `/api/health` with retries

---

## Updated project structure

```
codeguard/
├── backend/
│   └── app/
│       ├── api/
│       │   ├── upload.py        ← NEW: public upload endpoints
│       │   └── report.py        ← NEW: PDF download endpoints
│       └── services/
│           └── report.py        ← NEW: ReportLab PDF generator
├── frontend/
│   └── src/pages/
│       └── UploadAnalyser.jsx   ← NEW: public /analyse page
├── infra/
│   ├── terraform/
│   │   ├── main.tf              ← NEW: EC2, S3, IAM, CloudWatch
│   │   ├── variables.tf         ← NEW
│   │   ├── userdata.sh.tpl      ← NEW: EC2 bootstrap script
│   │   └── env/dev.tfvars       ← NEW
│   └── ansible/
│       ├── site.yml             ← NEW: full server config playbook
│       ├── inventory.ini        ← NEW
│       └── templates/
│           ├── env.j2           ← NEW
│           └── nginx.j2         ← NEW
├── docker-compose.yml           (updated: health check, AWS env vars)
├── .env.example                 (updated: AWS vars)
├── Jenkinsfile                  ← NEW: full CI/CD pipeline
└── README.md
```
