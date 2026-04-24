output "ec2_public_ip" {
  description = "Public IP of the CodeGuard EC2 instance"
  value       = aws_eip.codeguard_eip.public_ip
}

output "ec2_public_dns" {
  description = "Public DNS of the CodeGuard EC2 instance"
  value       = aws_instance.codeguard.public_dns
}

output "s3_reports_bucket" {
  description = "S3 bucket name for analysis reports"
  value       = aws_s3_bucket.codeguard_reports.bucket
}

output "s3_backups_bucket" {
  description = "S3 bucket name for database backups"
  value       = aws_s3_bucket.codeguard_backups.bucket
}

output "app_url" {
  description = "URL to access CodeGuard"
  value       = "http://${aws_eip.codeguard_eip.public_ip}"
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i ~/.ssh/codeguard ubuntu@${aws_eip.codeguard_eip.public_ip}"
}
