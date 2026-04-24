terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.5.0"
}

provider "aws" {
  region = var.aws_region
}

# ── Data sources ─────────────────────────────────────────────────
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-*-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# ── IAM Role for EC2 ─────────────────────────────────────────────
resource "aws_iam_role" "codeguard_role" {
  name = "codeguard-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
  tags = { Name = "codeguard-role" }
}

resource "aws_iam_role_policy" "codeguard_s3_policy" {
  name = "codeguard-s3-policy"
  role = aws_iam_role.codeguard_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"]
        Resource = [
          aws_s3_bucket.codeguard_reports.arn,
          "${aws_s3_bucket.codeguard_reports.arn}/*",
          aws_s3_bucket.codeguard_backups.arn,
          "${aws_s3_bucket.codeguard_backups.arn}/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData", "logs:CreateLogGroup",
                    "logs:CreateLogStream", "logs:PutLogEvents",
                    "cloudwatch:GetMetricStatistics"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "codeguard_profile" {
  name = "codeguard-instance-profile"
  role = aws_iam_role.codeguard_role.name
}

# ── S3 Buckets ───────────────────────────────────────────────────
resource "aws_s3_bucket" "codeguard_reports" {
  bucket        = "${var.project_name}-reports-${var.environment}"
  force_destroy = true
  tags          = { Name = "codeguard-reports", Environment = var.environment }
}

resource "aws_s3_bucket" "codeguard_backups" {
  bucket        = "${var.project_name}-backups-${var.environment}"
  force_destroy = true
  tags          = { Name = "codeguard-backups", Environment = var.environment }
}

resource "aws_s3_bucket_versioning" "backups_versioning" {
  bucket = aws_s3_bucket.codeguard_backups.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups_lifecycle" {
  bucket = aws_s3_bucket.codeguard_backups.id
  rule {
    id     = "expire-old-backups"
    status = "Enabled"
    filter { prefix = "" }
    expiration { days = 30 }
  }
}

# ── Security Group ───────────────────────────────────────────────
resource "aws_security_group" "codeguard_sg" {
  name        = "codeguard-sg"
  description = "CodeGuard security group"

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "SSH"
    from_port = 22 
    to_port = 22 
    protocol = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }
  ingress {
    description = "FastAPI backend"
    from_port = 8000 
    to_port = 8000 
    protocol = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port = 0 
    to_port = 0 
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "codeguard-sg" }
}

# ── Key Pair ─────────────────────────────────────────────────────
resource "aws_key_pair" "codeguard_key" {
  key_name   = "codeguard-key"
  public_key = file(var.public_key_path)
}

# ── EC2 Instance ─────────────────────────────────────────────────
resource "aws_instance" "codeguard" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.codeguard_key.key_name
  vpc_security_group_ids = [aws_security_group.codeguard_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.codeguard_profile.name

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
    tags        = { Name = "codeguard-root-ebs" }
  }

  user_data = <<-EOF
    #!/bin/bash
    apt-get update -y
    apt-get install -y docker.io docker-compose-v2 git awscli python3-pip
    systemctl start docker
    systemctl enable docker
    usermod -aG docker ubuntu
    mkdir -p /app/data
    echo "CodeGuard EC2 ready" > /home/ubuntu/ready.txt
  EOF

  tags = { Name = "codeguard-server", Environment = var.environment }
}

# ── Elastic IP ───────────────────────────────────────────────────
resource "aws_eip" "codeguard_eip" {
  instance = aws_instance.codeguard.id
  domain   = "vpc"
  tags     = { Name = "codeguard-eip" }
}

# ── CloudWatch Alarms ────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "cpu_alarm" {
  alarm_name          = "codeguard-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 120
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "CPU above 80% for 4 minutes"
  dimensions          = { InstanceId = aws_instance.codeguard.id }
  tags                = { Name = "codeguard-cpu-alarm" }
}

resource "aws_cloudwatch_log_group" "codeguard_logs" {
  name              = "/codeguard/app"
  retention_in_days = 14
  tags              = { Name = "codeguard-logs" }
}
