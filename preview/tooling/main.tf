# Godhuli Shop — core AWS infrastructure
terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
  backend "s3" {
    bucket = "godhuli-tfstate"
    key    = "shop/prod.tfstate"
    region = "ap-south-1"
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = local.common_tags
  }
}

variable "region" {
  type    = string
  default = "ap-south-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be \"staging\" or \"production\"."
  }
}

variable "buckets" {
  type = map(object({ versioned = bool, public = optional(bool, false) }))
  default = {
    invoices = { versioned = true }
    assets   = { versioned = false, public = true }
  }
}

locals {
  name_prefix = "godhuli-${var.environment}"
  is_prod     = var.environment == "production"
  common_tags = {
    Project     = "godhuli-shop"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
  ingress_ports = [80, 443]
}

data "aws_vpc" "main" {
  tags = { Name = "${local.name_prefix}-vpc" }
}

resource "aws_s3_bucket" "this" {
  for_each = var.buckets
  bucket   = "${local.name_prefix}-${each.key}"
  tags     = merge(local.common_tags, { Public = tostring(each.value.public) })
}

resource "aws_security_group" "api" {
  name   = "${local.name_prefix}-api"
  vpc_id = data.aws_vpc.main.id

  dynamic "ingress" {
    for_each = local.ingress_ports
    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }
}

resource "aws_iam_policy" "invoices_rw" {
  name   = "${local.name_prefix}-invoices-rw"
  policy = <<-EOT
    {
      "Version": "2012-10-17",
      "Statement": [{ "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"],
                      "Resource": "${aws_s3_bucket.this["invoices"].arn}/*" }]
    }
  EOT
}

output "bucket_arns" {
  value       = { for k, b in aws_s3_bucket.this : k => b.arn }
  description = "ARNs of all shop buckets"
}

output "replicas" {
  value = local.is_prod ? 3 : 1
}
