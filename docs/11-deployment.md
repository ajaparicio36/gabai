# 11 — GCP Deployment

Two-track deployment for GAVAI on Google Cloud Platform.

## Architecture Overview

|                   | Track 1: Hackathon                 | Track 2: Production                 |
| ----------------- | ---------------------------------- | ----------------------------------- |
| **Infra**         | Single GCE VM (`e2-custom-4-8192`) | Cloud Run + Cloud SQL + Memorystore |
| **Orchestration** | Docker Compose (5 containers)      | Managed services                    |
| **SSL**           | Caddy (Let's Encrypt)              | Load Balancer + managed certs       |
| **DB**            | PostGIS container (local volume)   | Cloud SQL + PostGIS extension       |
| **Redis**         | Redis container                    | Memorystore for Redis               |
| **Models**        | Copied into ML image at build      | Cloud Storage + download at startup |
| **Secrets**       | `.env` file on VM                  | Secret Manager                      |
| **CI/CD**         | Manual git pull + rebuild          | Cloud Build trigger on push to main |
| **Deploy time**   | ~15 min                            | ~2-3 days setup                     |
| **Cost/mo**       | ~$100                              | ~$250-400                           |
| **Auto-scaling**  | None                               | 0-10 instances per service          |

```
Track 1:                           Track 2:
┌─────────────────────┐            ┌──────────────────────────────┐
│  GCE VM (1 instance) │            │  Cloud Load Balancer + CDN    │
│  ┌─────────────────┐ │            │  ┌──────────┬──────────────┐ │
│  │ Caddy :443      │ │            │  │ Cloud Run│ Cloud Run    │ │
│  ├─────────────────┤ │            │  │ Web      │ API + ML     │ │
│  │ Web :4200       │ │            │  ├──────────┴──────────────┤ │
│  │ API :3000       │ │            │  │ Cloud SQL │ Memorystore │ │
│  │ ML  :8000       │ │            │  │ (PostGIS) │ (Redis)     │ │
│  │ DB  :5432       │ │            │  └──────────┴──────────────┘ │
│  │ Redis :6379     │ │            │  Cloud Storage  Secret Mgr   │
│  └─────────────────┘ │            └──────────────────────────────┘
└─────────────────────┘
```

---

## Prerequisites

```bash
# GCP project
gcloud projects create gavai-prod --name="GAVAI Production"
gcloud config set project gavai-prod

# Enable APIs
gcloud services enable \
  compute.googleapis.com \
  secretmanager.googleapis.com \
  dns.googleapis.com

# Install tools
brew install terraform   # or https://developer.hashicorp.com/terraform/downloads
gcloud components install beta
```

---

## Track 1 — Hackathon (Terraform + GCE VM)

All infrastructure lives in `infra/hackathon/`:

```
infra/hackathon/
  main.tf          # GCE instance, static IP, firewall, DNS
  variables.tf     # Input variables
  outputs.tf       # Deployment info after apply
  startup.sh       # VM bootstrap (Docker, git clone, .env)
  terraform.tfvars.example
```

### Step 1: Configure Variables

```bash
cd infra/hackathon
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set your gcp_project_id, domain, ssh key path, etc.
```

### Step 2: Provision

```bash
terraform init
terraform plan
terraform apply -auto-approve
```

Outputs:

```
public_ip  = 34.xxx.xxx.xxx
ssh_command = ssh gavai@34.xxx.xxx.xxx
url        = http://34.xxx.xxx.xxx
```

### Step 3: Configure Secrets

```bash
gcloud compute ssh gavai-vm --zone=asia-southeast1-a

cd /opt/gavai
vi .env
```

Fill in ALL values (JWT secrets, API keys, etc.). Generate JWT secrets:

```bash
openssl rand -hex 32  # for JWT_SECRET
openssl rand -hex 32  # for JWT_REFRESH_SECRET
```

### Step 4: Launch

```bash
cd /opt/gavai

# Build all images
docker compose build --parallel

# Start everything
docker compose up -d

# Verify
docker compose ps
docker compose logs -f
```

### Step 5: Enable HTTPS (Caddy)

If you have a domain and its DNS points to the VM's IP:

```bash
cd /opt/gavai

# Set your domain in Caddyfile (edit the file first)
vi Caddyfile

# Launch with Caddy
DOMAIN=your-domain.com docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d caddy
```

Caddy auto-provisions Let's Encrypt SSL. Routes:

- `/api/*` → NestJS `:3000`
- `/*` → Next.js `:4200`

Without a domain, just use the raw IP — HTTP on port 4200 (web) and 3000 (api).

### Step 6: Verify

```bash
# API health
curl http://<IP>:3000/api/v1/health

# Web server
curl -I http://<IP>:4200

# ML sidecar docs
curl http://<IP>:8000/v1/docs
```

### Quick Reference

```bash
# SSH
gcloud compute ssh gavai-vm --zone=asia-southeast1-a

# Rebuild + restart after code/config changes
cd /opt/gavai && git pull && docker compose up -d --build

# View logs
docker compose logs api -f --tail=100

# Resource usage
docker stats

# Tear down
cd infra/hackathon && terraform destroy
```

### Cost Estimate

| Resource                            | Cost/mo      |
| ----------------------------------- | ------------ |
| GCE e2-custom-4-8192 (4 vCPU, 8 GB) | ~$82         |
| 100 GB PD-SSD                       | ~$17         |
| Static IP (unused)                  | ~$7          |
| Network egress (est.)               | ~$10         |
| **Total**                           | **~$116/mo** |

### Caveats

- No auto-healing or auto-scaling
- No managed DB backups (run `pg_dump` manually)
- No CI/CD (manual git pull + rebuild)
- Single region, no DR

All acceptable for hackathon — the production track below addresses each.

---

## Track 2 — Production Pathway

Gradually migrate each service to managed GCP equivalents.

### Target Architecture

```
                   ┌──────────────────────────┐
                   │  Cloud Load Balancer      │
                   │  + Cloud CDN + SSL cert   │
                   └──────────┬───────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
   ┌──────▼──────┐   ┌───────▼───────┐   ┌───────▼──────┐
   │  Cloud Run   │   │  Cloud Run    │   │  Cloud Run   │
   │  Next.js Web │   │  NestJS API   │   │  FastAPI ML  │
   │  (4200)      │   │  (3000)       │   │  (8000)      │
   └──────────────┘   └──┬───┬───────┘   └──────┬───────┘
                         │   │                  │
         ┌───────────────┘   │          ┌───────┘
         │                   │          │
  ┌──────▼──────┐   ┌────────▼──────────▼──────┐
  │ Memorystore  │   │  Cloud SQL PostgreSQL 16 │
  │ Redis 7      │   │  + PostGIS extension     │
  │ 5 GB Basic   │   │  2 vCPU, 8 GB, 50 GB SSD│
  └──────────────┘   └─────────────────────────┘

  ┌──────────────┐   ┌──────────────────┐
  │ Cloud Storage│   │  Secret Manager  │
  │ models/*.pkl │   │  all env vars    │
  └──────────────┘   └──────────────────┘

  ┌──────────────────┐
  │ Artifact Registry │
  │ Docker images     │
  └──────────────────┘
```

### Migration Phases

| Phase | What                                          | Effort  |
| ----- | --------------------------------------------- | ------- |
| **A** | Cloud SQL (PostGIS) + Memorystore provisioned | 1 day   |
| **B** | Cloud Run for API + Web (still using VM DB)   | 1 day   |
| **C** | Switch API/ML to Cloud SQL + Memorystore      | 0.5 day |
| **D** | Cloud Run for ML + GCS model storage          | 0.5 day |
| **E** | Load Balancer + Cloud Build CI/CD             | 1 day   |

### Phase A: Managed DB + Redis

```bash
# Cloud SQL with PostGIS
gcloud sql instances create gavai-db \
  --database-version=POSTGRES_16 \
  --tier=db-custom-2-8192 \
  --region=asia-southeast1 \
  --storage-size=50 --storage-type=SSD \
  --no-assign-ip \
  --network=default

gcloud sql databases create gavai --instance=gavai-db

# Enable PostGIS
gcloud sql connect gavai-db --user=postgres --database=gavai
# > CREATE EXTENSION IF NOT EXISTS postgis;
# > CREATE EXTENSION IF NOT EXISTS postgis_topology;

# Memorystore Redis
gcloud redis instances create gavai-redis \
  --size=5 \
  --region=asia-southeast1 \
  --redis-version=redis_7_x \
  --network=default \
  --connect-mode=PRIVATE_SERVICE_ACCESS

# Run Prisma migrations from local via proxy
# Start proxy in another terminal:
# ./cloud-sql-proxy gavai-prod:asia-southeast1:gavai-db --port 5433
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5433/gavai?schema=public" \
  pnpm nx run @gavai/platform:prisma-migrate
```

### Phase B: Cloud Run for API + Web

```bash
# Create Artifact Registry
gcloud artifacts repositories create gavai \
  --repository-format=docker \
  --location=asia-southeast1

# Build & push all images
for svc in api web ml; do
  docker build \
    -f apps/gavai/$svc/Dockerfile \
    -t asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/$svc:latest \
    .
  docker push asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/$svc:latest
done

# VPC connector (for private Cloud SQL/Memorystore access)
gcloud compute networks vpc-access connectors create gavai-vpc-conn \
  --region=asia-southeast1 \
  --range=10.8.0.0/28 \
  --network=default

# Store secrets
echo -n "postgresql://..." | gcloud secrets create DATABASE_URL --data-file=-
echo -n "redis://..." | gcloud secrets create REDIS_URL --data-file=-
# ... repeat for all env vars

# Deploy
gcloud run deploy gavai-api \
  --image=asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/api:latest \
  --region=asia-southeast1 --platform=managed \
  --allow-unauthenticated \
  --vpc-connector=gavai-vpc-conn \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,<other-secrets> \
  --cpu=2 --memory=4Gi --min-instances=0 --max-instances=10

gcloud run deploy gavai-web \
  --image=asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/web:latest \
  --region=asia-southeast1 --platform=managed \
  --allow-unauthenticated \
  --cpu=1 --memory=2Gi --min-instances=0 --max-instances=10 \
  --set-env-vars=NEXT_PUBLIC_API_URL=https://api.gavai.dev/api/v1

gcloud run deploy gavai-ml \
  --image=asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/ml:latest \
  --region=asia-southeast1 --platform=managed \
  --no-allow-unauthenticated \
  --vpc-connector=gavai-vpc-conn \
  --cpu=2 --memory=4Gi --min-instances=0 --max-instances=5 \
  --concurrency=10 --timeout=300
```

### Phase D: GCS for ML Models

```bash
gsutil mb -l asia-southeast1 gs://gavai-models
gsutil cp models/*.pkl gs://gavai-models/

# Grant access to ML service account
gcloud storage buckets add-iam-policy-binding gs://gavai-models \
  --member="serviceAccount:gavai-ml@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

Add model download at startup in the ML sidecar:

```python
# apps/gavai/sidecar/src/sidecar/model_loader.py
from google.cloud import storage
import os

BUCKET = os.environ["MODELS_BUCKET"]

def download_models() -> str:
    client = storage.Client()
    bucket = client.bucket(BUCKET.replace("gs://", ""))
    os.makedirs("/tmp/models", exist_ok=True)
    for blob in bucket.list_blobs():
        blob.download_to_filename(f"/tmp/models/{blob.name}")
    return "/tmp/models"
```

### Phase E: CI/CD with Cloud Build

Create `cloudbuild.yaml` in repo root:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'apps/gavai/nest/Dockerfile'
      - '-t'
      - 'asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/api:$COMMIT_SHA'
      - '-t'
      - 'asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/api:latest'
      - '.'
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'apps/gavai/web/Dockerfile'
      - '-t'
      - 'asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/web:$COMMIT_SHA'
      - '-t'
      - 'asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/web:latest'
      - '.'
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-f'
      - 'apps/gavai/sidecar/Dockerfile'
      - '-t'
      - 'asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/ml:$COMMIT_SHA'
      - '-t'
      - 'asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/ml:latest'
      - '.'
images:
  - 'asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/api:$COMMIT_SHA'
  - 'asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/api:latest'
  - 'asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/web:$COMMIT_SHA'
  - 'asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/web:latest'
  - 'asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/ml:$COMMIT_SHA'
  - 'asia-southeast1-docker.pkg.dev/$PROJECT_ID/gavai/ml:latest'
timeout: 1800s
options:
  machineType: 'E2_HIGHCPU_8'
```

```bash
gcloud builds triggers create github \
  --name="gavai-deploy" \
  --repo="ajaparicio/gabai" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml"
```

### Production Cost Estimate

| Resource            | Spec                        | Cost/mo          |
| ------------------- | --------------------------- | ---------------- |
| Cloud SQL           | 2 vCPU, 8 GB, 50 GB SSD     | ~$105            |
| Memorystore         | 5 GB Basic                  | ~$50             |
| Cloud Run (API)     | 2 CPU, 4 GB, 0-10 instances | ~$30-60          |
| Cloud Run (Web)     | 1 CPU, 2 GB, 0-10 instances | ~$10-30          |
| Cloud Run (ML)      | 2 CPU, 4 GB, 0-5 instances  | ~$10-30          |
| Cloud Storage       | 10 GB                       | ~$1              |
| Secret Manager      | ~15 secrets                 | ~$1              |
| Artifact Registry   | ~5 GB                       | ~$1              |
| Load Balancer + CDN | —                           | ~$20             |
| **Total**           |                             | **~$230-400/mo** |

Cloud Run scales to zero when idle, so costs are traffic-dependent. Cloud SQL is the primary fixed cost.

---

## Troubleshooting

### Docker daemon not running on VM

```bash
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Log out and back in
```

### PostGIS extension not loaded

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
SELECT PostGIS_Version();
```

### Cloud Run cold starts

- Set `--min-instances=1` for the API (~$30/mo extra)
- ML service has the longest cold start (model loading) — consider `--min-instances=1` or startup probe

### Docker Compose build fails on VM

```bash
df -h                          # Check disk space
docker system prune -af        # Clean up
```

### .env not read by docker compose

```bash
docker compose --env-file .env up -d
docker compose exec api env | grep DATABASE_URL
```
