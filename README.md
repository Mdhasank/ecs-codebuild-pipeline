# AWS ECS CodeBuild CI/CD Pipeline

This project provides a premium Dockerized Node.js (Express + EJS) application and an AWS CodeBuild configuration (`buildspec.yml`) to automate builds and deployments to AWS ECS.

## Project Structure

- `app/`: The core application.
  - `views/`: EJS templates for the premium dashboard.
  - `public/`: CSS and assets.
  - `index.js`: Express server.
  - `Dockerfile`: Container configuration.
  - `package.json`: Logic and dependencies.
- `buildspec.yml`: Build instructions for AWS CodeBuild.

## Prerequisites

- An existing **Amazon ECR** repository.
- An existing **Amazon ECS** Cluster and Service (Fargate).
- AWS CLI configured or CodeBuild IAM roles set up to access ECR and ECS.

## Deployment Steps

### 1. Prepare Environment Variables
The `buildspec.yml` uses several environment variables. You must set these in your **AWS CodeBuild Project settings**:

| Variable | Description |
| :--- | :--- |
| `AWS_ACCOUNT_ID` | Your AWS Account ID. |
| `AWS_DEFAULT_REGION` | The region where your ECR/ECS live (e.g. `us-east-1`). |
| `IMAGE_REPO_NAME` | The name of your ECR repository. |
| `PROJECT_NAME` | The name prefix used for your ECS Cluster/Service (e.g. `my-app`). |
| `CONTAINER_NAME` | The name of the container defined in your ECS Task Definition. |

### 2. Manual Trigger
1. Zip the `app/` folder and the `buildspec.yml` file.
2. Upload the zip to S3.
3. Start the build in CodeBuild.

### 3. CI/CD Flow
Once triggered, the pipeline will:
1. **Login** to your Amazon ECR.
2. **Build** the Docker image using the `app/Dockerfile`.
3. **Push** the image with two tags: `latest` and the unique `commit-hash`.
4. **Deploy** by triggering an `update-service` on your ECS Cluster, forcing a new deployment with the latest image.

## Notes
- Ensure your CodeBuild IAM Role has the `AmazonEC2ContainerRegistryPowerUser` and `AmazonECS_FullAccess` policies (or specific permissions for `ecs:UpdateService`).
