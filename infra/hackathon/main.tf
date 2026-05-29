terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.region
}

# ── Static external IP ──────────────────────────────────────────────

resource "google_compute_address" "gavai_ip" {
  name   = "gavai-ip"
  region = var.region
}

# ── Firewall: allow HTTP, HTTPS, SSH ────────────────────────────────

resource "google_compute_firewall" "gavai_fw" {
  name    = "gavai-fw"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22", "80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["gavai"]
}

# ── Compute Engine VM ───────────────────────────────────────────────

resource "google_compute_instance" "gavai_vm" {
  name         = "gavai-vm"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["gavai"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.boot_disk_size_gb
      type  = "pd-ssd"
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.gavai_ip.address
    }
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${file(var.ssh_public_key_path)}"
  }

  metadata_startup_script = templatefile("${path.module}/startup.sh", {
    git_repo_url = var.git_repo_url
    git_branch   = var.git_branch
    zone         = var.zone
  })

  service_account {
    scopes = ["cloud-platform"]
  }
}

# ── DNS (optional — only if domain is provided) ─────────────────────

resource "google_dns_managed_zone" "gavai_zone" {
  count = var.domain != "" ? 1 : 0

  name     = "gavai-zone"
  dns_name = "${var.domain}."
}

resource "google_dns_record_set" "gavai_a" {
  count = var.domain != "" ? 1 : 0

  name         = "${var.domain}."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.gavai_zone[0].name

  rrdatas = [google_compute_address.gavai_ip.address]
}
