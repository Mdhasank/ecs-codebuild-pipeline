# AWS ECS CodeBuild CI/CD Pipeline

This project contains a Dockerized Node.js application and a complete CI/CD configuration (`buildspec.yml`) for deploying to **AWS ECS (Fargate)** via **AWS CodeBuild**.

## 📖 Complete Setup Guide

For a step-by-step walkthrough on setting up the entire infrastructure (IAM, ECR, ECS, CodeBuild), please refer to the **[AWS_ECS_GUIDE.md](./AWS_ECS_GUIDE.md)** included in this repository.

## 📂 Project Structure

- `app/`: The core Node.js application (Express + EJS).
  - `Dockerfile`: Multi-stage build configuration.
- `buildspec.yml`: The build specification file used by AWS CodeBuild to build, push, and deploy.
- `AWS_ECS_GUIDE.md`: Detailed documentation for setting up the AWS environment.

## ⚙️ Configuration

To run this pipeline successfully, you must configure the following **Environment Variables** in your AWS CodeBuild project.

| Variable | Description | Example |
| :--- | :--- | :--- |
| `AWS_ACCOUNT_ID` | Your AWS Account ID. | `123456789012` |
| `AWS_DEFAULT_REGION` | The region where resources reside. | `us-east-1` |
| `IMAGE_REPO_NAME` | The name of your ECR repository. | `my-app` |
| `PROJECT_NAME` | The prefix for your ECS Cluster/Service. | `ecs-codebuild-pipeline` |
| `CONTAINER_NAME` | The container name in your Task Def. | `app` |
| `DOCKERHUB_USERNAME` | Your Docker Hub username (to avoid rate limits). | `johndoe` |
| `DOCKERHUB_PASSWORD` | Your Docker Hub Access Token (PAT). | `dckr_pat_xxx` |

> **⚠️ Important:** Mark `DOCKERHUB_PASSWORD` as a **Sensitive** variable in CodeBuild to mask it in logs.

## 🚀 CI/CD Workflow

1.  **Source**: CodeBuild pulls the latest code from GitHub.
2.  **Auth**: Logs in to Docker Hub (to pull base images) and Amazon ECR.
3.  **Build**: Builds the Docker image from `app/Dockerfile`.
4.  **Push**: Pushes the image to your private Amazon ECR with `latest` and `commit-hash` tags.
5.  **Deploy**: Updates the ECS Service to use the new image, triggering a rolling deployment on Fargate.

## 🛠️ Troubleshooting

If you encounter `429 Too Many Requests` (Docker Rate Limit) or `ServiceNotFoundException`:
1.  Check that you have added the Docker Hub credentials to CodeBuild.
2.  Verify your `PROJECT_NAME` matches your actual ECS Service name format (e.g., `${PROJECT_NAME}-service`).
3.  See **[AWS_ECS_GUIDE.md](./AWS_ECS_GUIDE.md)** for detailed troubleshooting.
