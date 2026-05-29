variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-southeast1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "asia-southeast1-a"
}

variable "domain" {
  description = "Domain name (leave empty for IP-only access)"
  type        = string
  default     = ""
}

variable "ssh_user" {
  description = "SSH username for the VM"
  type        = string
  default     = "gavai"
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key file"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "machine_type" {
  description = "GCE machine type"
  type        = string
  default     = "e2-custom-4-8192" # 4 vCPU, 8 GB RAM
}

variable "boot_disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 100
}

variable "git_repo_url" {
  description = "Git repo URL for cloning the code"
  type        = string
  default     = "https://github.com/ajaparicio36/gabai.git"
}

variable "git_branch" {
  description = "Git branch to deploy"
  type        = string
  default     = "main"
}
