# Complete Guide: Deploying to AWS ECS via CodeBuild (CI/CD)

This guide details exactly how to set up a Continuous Deployment pipeline for a GitHub repository to AWS ECS (Fargate) using AWS CodeBuild. It synthesizes best practices and fixes for common issues like Docker Hub rate limiting.

---

## 🏗️ Phase 1: IAM Role Configuration
Before creating resources, we need a role that allows CodeBuild to talk to ECS, ECR, and optionally Secrets Manager.

### 1. Create the CodeBuild Service Role
1. Go to **IAM Console** → **Roles** → **Create role**.
2. **Trusted Entity**: Select **AWS Service** → **CodeBuild**.
3. **Permissions**:
   Search for and attach the following managed policies:
   - `AmazonEC2ContainerRegistryPowerUser` (to push images to ECR)
   - `AmazonECS_FullAccess` (to update ECS services)
   - `CloudWatchLogsFullAccess` (for build logs)
   - `AmazonS3ReadOnlyAccess` (if needed, usually safe to add)
4. **Role Name**: `codebuild-ecs-deploy-role`.
5. Click **Create role**.

### 2. (Optional) Add Secrets Manager Access
If you plan to use `secretsmanager` for GitHub tokens or Docker Hub passwords:
1. Open the *newly created role* `codebuild-ecs-deploy-role`.
2. Click **Add permissions** → **Create inline policy**.
3. **JSON Editor**:
   ```json
   {
       "Version": "2012-10-17",
       "Statement": [
           {
               "Effect": "Allow",
               "Action": "secretsmanager:GetSecretValue",
               "Resource": "*"
           }
       ]
   }
   ```
   *(Note: For tighter security, replace `*` with the specific ARN of your secret)*.
4. Name the policy `SecretsManagerAccess` and create it.

---

## 📦 Phase 2: ECR & Local Setup

### 1. Create ECR Repository
1. Go to **Amazon ECR** → **Repositories** → **Create repository**.
2. **Visibility**: Private.
3. **Name**: `my-app` (Remember this name; it is your `IMAGE_REPO_NAME`).
4. Click **Create repository**.

### 2. Docker Hub Token (Crucial to avoid Rate Limits)
AWS CodeBuild IPs are often rate-limited by Docker Hub. You must authenticate.
1. Log in to [Docker Hub](https://hub.docker.com/).
2. Go to **Account Settings** → **Security** → **New Access Token**.
3. Description: `aws-codebuild`.
4. Permissions: **Read-only**.
5. **Copy the token** immediately. You will use this as `DOCKERHUB_PASSWORD`.

---

## 🚀 Phase 3: ECS Cluster & Service (Fargate)

### 1. Create Cluster
1. Go to **Amazon ECS** → **Clusters** → **Create cluster**.
2. **Name**: `ecs-codebuild-pipeline-cluster` (or `my-app-cluster`).
   * *Tip: To simplify variables later, consistent naming is key.*
3. Infrastructure: **AWS Fargate (Serverless)**.
4. Click **Create**.

### 2. Create Task Definition
1. Go to **Task Definitions** → **Create new Task Definition**.
2. **Family name**: `my-app-task`.
3. **Infrastructure**: Fargate.
4. **Task Role** & **Execution Role**: Select `ecsTaskExecutionRole` (create if missing).
5. **Container Details**:
   - **Name**: `app` (This explains the `CONTAINER_NAME` variable).
   - **Image URI**: `<AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/my-app:latest`
   - **Port**: `3000` (matches your Dockerfile EXPOSE).
6. Click **Create**.

### 3. Create Service
1. Go to your Cluster (`ecs-codebuild-pipeline-cluster`).
2. Click **Services** → **Create**.
3. **Compute options**: Launch type → Fargate.
4. **Task Definition**: `my-app-task`.
5. **Service Name**: `ecs-codebuild-pipeline-service`.
6. **Desired tasks**: 1.
7. **Networking**:
   - VPC: Default (or yours).
   - Subnets: Select all public ones.
   - **Security Group**: Create new → Inbound Rule → Custom TCP `3000` from `0.0.0.0/0`.
   - **Public IP**: ENABLED (Required for Fargate to pull images).
8. Click **Create**.

---

## 🛠️ Phase 4: CodeBuild Project Setup

### 1. Create Project
1. Go to **CodeBuild** → **Create project**.
2. **Name**: `my-app-build`.
3. **Source**: GitHub.
   - Connect your account (GitHub App recommended).
   - Select Repository: `your-username/your-repo`.
   - **Webhook**: Check "Rebuild every time a code change is pushed to this repository".

### 2. Environment
1. **Managed Image**: Amazon Linux 2 (or 2023).
2. **Runtime**: Standard.
3. **Image**: `aws/codebuild/amazonlinux2-x86_64-standard:4.0` (or 5.0/latest).
4. **Privileged**: ✅ **Checked** (Required to run Docker).
5. **Service Role**: Choose `codebuild-ecs-deploy-role`.

### 3. Environment Variables
Add these strictly.

| Name | Value | Type | Notes |
|------|-------|------|-------|
| `AWS_ACCOUNT_ID` | `123456789012` | Plaintext | Find in top right of console |
| `AWS_DEFAULT_REGION` | `us-east-1` | Plaintext | e.g. `us-east-1`, `us-east-2` |
| `IMAGE_REPO_NAME` | `my-app` | Plaintext | Name of ECR repo |
| `PROJECT_NAME` | `ecs-codebuild-pipeline` | Plaintext | Prefix for Service/Cluster names |
| `CONTAINER_NAME` | `app` | Plaintext | **Must match** Task Definition container name |
| `DOCKERHUB_USERNAME` | `your_docker_id` | Plaintext | For auth |
| `DOCKERHUB_PASSWORD` | `dckr_pat_...` | **Sensitive** | Your Docker Hub PAT |

### 4. Buildspec
Select "Use a buildspec file". Ensure `buildspec.yml` is in the root of your repo.

---

## 📄 Phase 5: The Buildspec
Ensure your `buildspec.yml` looks exactly like this to handle Docker Hub auth and ECS deployment.

```yaml
version: 0.2

phases:
  pre_build:
    commands:
      - echo Logging in to Docker Hub...
      - echo $DOCKERHUB_PASSWORD | docker login --username $DOCKERHUB_USERNAME --password-stdin
      - echo Logging in to Amazon ECR...
      - aws --version
      - REPOSITORY_URI=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/${IMAGE_REPO_NAME}
      - aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com
      - COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)
      - IMAGE_TAG=${COMMIT_HASH:=latest}
  build:
    commands:
      - echo Build started on `date`
      - echo Building the Docker image...
      - docker build -t $REPOSITORY_URI:latest app/
      - docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG
  post_build:
    commands:
      - echo Build completed on `date`
      - echo Pushing the Docker images...
      - docker push $REPOSITORY_URI:latest
      - docker push $REPOSITORY_URI:$IMAGE_TAG
      - echo Updating ECS service...
      # Assumes cluster is named "${PROJECT_NAME}-cluster" and service "${PROJECT_NAME}-service"
      - aws ecs update-service --cluster ${PROJECT_NAME}-cluster --service ${PROJECT_NAME}-service --force-new-deployment
      - echo Writing image definitions file...
      - printf '[{"name":"%s","imageUri":"%s"}]' ${CONTAINER_NAME} $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json
artifacts:
    files: imagedefinitions.json
```

---

## 🐛 Troubleshooting

### 1. `ServiceNotFoundException`
* **Cause**: `PROJECT_NAME` variable doesn't match your actual AWS resource names.
* **Fix**: Ensure your Cluster is named exactly `${PROJECT_NAME}-cluster` and Service is `${PROJECT_NAME}-service`. Or hardcode the names in `buildspec.yml`.

### 2. Docker Rate Limit (`429 Too Many Requests`)
* **Cause**: Pulling `node:18-alpine` anonymously.
* **Fix**: Ensure `DOCKERHUB_USERNAME` and `DOCKERHUB_PASSWORD` are set correcty in CodeBuild and the `pre_build` login step is present.

### 3. `CannotPullContainerError` (ECS)
* **Cause**: Task Execution Role (not CodeBuild role) doesn't have permissions or Public IP is disabled in Fargate.
* **Fix**: Ensure Subnets are "Public" and "Auto-assign public IP" is ENABLED in the ECS Service Network settings.

### 4. Build succeeds, but App not updating
* **Cause**: `CONTAINER_NAME` variable references a container that doesn't exist in the Task Def.
* **Fix**: Check Task Definition → Container Name. It must match `CONTAINER_NAME` env var exactly.
