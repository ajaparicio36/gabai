output "public_ip" {
  description = "Public IP address of the VM"
  value       = google_compute_address.gavai_ip.address
}

output "ssh_command" {
  description = "SSH into the VM"
  value       = "ssh ${var.ssh_user}@${google_compute_address.gavai_ip.address}"
}

output "gcloud_ssh_command" {
  description = "SSH via gcloud"
  value       = "gcloud compute ssh gavai-vm --zone=${var.zone}"
}

output "url" {
  description = "Application URL"
  value       = var.domain != "" ? "https://${var.domain}" : "http://${google_compute_address.gavai_ip.address}"
}

output "vm_status" {
  description = "Check VM startup logs"
  value       = "gcloud compute ssh gavai-vm --zone=${var.zone} --command='sudo journalctl -u google-startup-scripts.service -f'"
}
