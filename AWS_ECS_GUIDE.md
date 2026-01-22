# The "From Scratch" Ultimate Direct Guide to AWS ECS + CodeBuild

This is a complete, click-by-click manual to building a CI/CD pipeline from zero. It assumes you have **no prior resources** created. Follow every step exactly, and it will work.

---

## 🛑 Phase 1: Create the IAM Role (The Security Pass)
We need a "security pass" for CodeBuild so it can talk to ECS, ECR, and Secrets Manager without asking for permission every time.

### Step 1: Create the Basic Role
1.  Log in to the **AWS Console**.
2.  Search for **IAM** in the top search bar and click it.
3.  In the left sidebar, click **Roles**.
4.  Click the orange **Create role** button.
5.  **Trusted Config**:
    *   Select **AWS service**.
    *   In the "Service or Use Case" dropdown, select **CodeBuild**.
    *   Click **Next**.
6.  **Add Permissions** (Search for and check the box next to each of these exact names):
    *   `AmazonEC2ContainerRegistryPowerUser` (Allows pushing Docker images)
    *   `AmazonECS_FullAccess` (Allows updating the website)
    *   `CloudWatchLogsFullAccess` (Allows saving build logs)
    *   Click **Next**.
7.  **Name the Role**:
    *   Role name: `codebuild-ecs-deploy-role`
    *   Click **Create role**.

### Step 2: Add Permission for Secrets (Visual Way - NO JSON)
This is needed so CodeBuild can read your GitHub or Docker Hub tokens.
1.  In the **IAM Roles** list, click on the name of the role you just created: `codebuild-ecs-deploy-role`.
2.  On the right side, click **Add permissions** → **Create inline policy**.
3.  Click the **Visual** button (do not use JSON).
4.  **Service**: Search for and select **Secrets Manager**.
5.  **Actions**:
    *   Type `GetSecretValue` in the search box.
    *   Check the box next to **GetSecretValue**.
6.  **Resources**:
    *   Click **Specific**.
    *   Click **Add ARNs**.
    *   *Since we haven't created the secret yet, for now, strictly for setup ease:* Check the box **"Any in this account"**. (Later steps will show you how to create the secret).
7.  Click **Next**.
8.  **Policy Name**: Type `SecretAccessPolicy`.
9.  Click **Create policy**.

✅ **Role is Ready.**

---

## 🐳 Phase 2: Create the ECR Repository (The Image Storage)
This is where your Docker images will be stored.

1.  Search for **ECR** (Elastic Container Registry) in the AWS top bar.
2.  Click **Repositories** on the left.
3.  Click **Create repository**.
4.  **Visibility settings**: Keep it **Private**.
5.  **Repository name**: `my-app`
    *   *Note: This name is important. We will call this `IMAGE_REPO_NAME` later.*
6.  Click **Create repository**.
7.  **Copy the URI**:
    *   You will see your new repo in the list.
    *   Look at the **URI** column (e.g., `123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app`).
    *   Write down the number at the start (`123456789012`). This is your **AWS Account ID**.

✅ **Repo is Ready.**

---

## 🔑 Phase 3: Docker Hub Token (Avoid the Crash)
To prevent the "429 Too Many Requests" error, we need a "Download Pass" from Docker Hub.

1.  Go to [hub.docker.com](https://hub.docker.com/) and log in.
2.  Click your **Profile Picture** (top right) → **Account Settings**.
3.  Click **Security** (left menu).
4.  Button **New Access Token**.
5.  **Description**: `AWS CodeBuild`.
6.  **Access permissions**: Read-only.
7.  Click **Generate**.
8.  ⚠️ **COPY THE TOKEN NOW**. You will never see it again. Save it in a notepad for a moment.

✅ **Token is Ready.**

---

## 🚀 Phase 4: Create ECS Resources (The Server)

### Step 1: Create the Cluster
1.  Search for **ECS** in the ID top bar.
2.  Click **Clusters** (left menu).
3.  Click **Create cluster**.
4.  **Cluster name**: `ecs-codebuild-pipeline-cluster`
    *   *Copy this name.*
5.  **Infrastructure**: Check **AWS Fargate (serverless)**.
6.  Click **Create**.

### Step 2: Create the Detailed Task Definition
This tells AWS *how* to run your container.
1.  In ECS, click **Task definitions** (left menu).
2.  Click **Create new task definition**.
3.  **Task definition family**: `my-app-task`.
4.  **Infrastructure requirements**:
    *   Launch type: **AWS Fargate**.
    *   OS Architecture: **Linux/X86_64**.
    *   Task size: CPU **.5 vCPU**, Memory **1 GB** (Smallest/Cheapest).
5.  **Task Role** and **Task Execution Role**:
    *   Select `ecsTaskExecutionRole` from the dropdown. (If it's not there, AWS usually offers to create it automatically).
6.  **Container - 1**:
    *   **Name**: `app`
        *   *Warning: This MUST be exactly `app` because our env vars later will use this name.*
    *   **Image URI**: Paste your ECR URI from Phase 2 (e.g., `123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest`).
        *   *Add `:latest` at the end.*
    *   **Container Port**: `3000`.
7.  Click **Create**.

### Step 3: Create the Service
This keeps the task running 24/7.
1.  Go back to **Clusters**.
2.  Click on `ecs-codebuild-pipeline-cluster`.
3.  Scroll down to the **Services** tab.
4.  Click **Create**.
5.  **Environment**:
    *   Compute options: **Launch type**.
    *   Launch type: **FARGATE**.
    *   Platform version: **LATEST**.
6.  **Deployment configuration**:
    *   Task definition: Family `my-app-task`, Revision `LATEST`.
    *   **Service name**: `ecs-codebuild-pipeline-service`
        *   *Copy this name explicitly.*
    *   Desired tasks: `1`.
7.  **Networking** (CRITICAL SECTIONS):
    *   **VPC**: Select your default VPC.
    *   **Subnets**: select all available subnets involved.
    *   **Security group**: Click **Create new security group**.
        *   Group name: `my-app-sg`.
        *   **Inbound rules**:
            *   Type: **Custom TCP**.
            *   Port range: `3000`.
            *   Source: `Anywhere` (`0.0.0.0/0`).
    *   **Public IP**: **TURN ON** (Select "Turned on").
        *   *If this is Off, Fargate cannot download the image and will fail, and you cannot access the site.*
8.  Click **Create**.

✅ **Server is Ready (but empty).**

---

## 🏗️ Phase 5: CodeBuild Project (The Automator)

### Step 1: Create Project
1.  Search for **CodeBuild**.
2.  Click **Create project**.
3.  **Project name**: `my-app-build`.
4.  **Source**:
    *   Source provider: **GitHub**.
    *   Click **Connect to GitHub** (OAuth) -> Authorize.
    *   **Repository**: Select your repo (e.g., `mdhasank/ecs-codebuild-pipeline`).
    *   **Source version**: Leave blank (uses default branch).
5.  **Primary source webhook events**:
    *   Check: **Rebuild every time a code change is pushed to this repository**.
    *   Event type: `PUSH`.

### Step 2: Environment Setup
1.  **Environment image**: Managed image.
2.  **Operating system**: Amazon Linux.
3.  **Runtime**: Standard.
4.  **Image**: `aws/codebuild/amazonlinux2-x86_64-standard:5.0` (Use the latest version available).
5.  **Privileged**: ✅ **Check this box** (Enable this flag if you want to build Docker images...).
    *   *If you miss this, Docker build fails.*
6.  **Service role**:
    *   Select **Existing service role**.
    *   Role ARN: Select `codebuild-ecs-deploy-role` (created in Phase 1).

### Step 3: Environment Variables (The Magic Keys)
Scroll to **Additional configuration**, then **Environment variables**. Add these rows carefully:

| Name | Value | Type |
| :--- | :--- | :--- |
| `AWS_ACCOUNT_ID` | `Your-12-digit-ID` | Plaintext |
| `AWS_DEFAULT_REGION` | `us-east-1` (or your region) | Plaintext |
| `IMAGE_REPO_NAME` | `my-app` | Plaintext |
| `PROJECT_NAME` | `ecs-codebuild-pipeline` | Plaintext |
| `CONTAINER_NAME` | `app` | Plaintext |
| `DOCKERHUB_USERNAME` | Your DockerHub Username | Plaintext |
| `DOCKERHUB_PASSWORD` | The Token you copied in Phase 3 | **Parameter** (or Plaintext, but Parameter/Secret is better). |

*Note: In the Type column, select **Plaintext** for all, unless you want to hide the password.*

### Step 4: Buildspec
1.  Select **Use a buildspec file**.
2.  Buildspec name: leave blank (it defaults to `buildspec.yml` in root).

### Step 5: Finish
1.  Click **Create build project**.

---

## ▶️ Phase 6: Run It

1.  Open your new project `my-app-build`.
2.  Click **Start build**.
3.  Watch the **Build logs**.
4.  If it succeeds, it will say "Phase complete: POST_BUILD State: SUCCEEDED".

---

## 🌐 Phase 7: How to Access Your Website

Since we are using **Fargate** (Serverless), there are no EC2 instances to log into. You access your specific running task.

### Option 1: Direct Verification (Quickest)
This is what we configured in Phase 4.

1.  Go to **ECS** -> **Clusters** -> `ecs-codebuild-pipeline-cluster`.
2.  Click the **Tasks** tab (look at the bottom list).
3.  Click on the **Task ID** (a long string of numbers/letters, e.g., `e132e4...`).
4.  Scroll to the **Configuration** or **Network** section.
5.  Look for **Public IP** (e.g., `54.123.45.67`).
6.  Open your browser and type: `http://<Public-IP>:3000`
    *   *Example: http://54.123.45.67:3000*
7.  **Troubleshooting**:
    *   **Site is loading forever?** Check your Security Group (`my-app-sg`). Ensure it allows **Inbound Traffic** on Port **3000** from Source **0.0.0.0/0** (Anywhere).
    *   **IP changes?** Yes, every time you deploy a new version, this IP will change. This is normal for Fargate tasks without a Load Balancer.

### Option 2: Production Setup (ALB)
*For reference only. This is how you make the URL stable so it doesn't change on every deploy.*

**Why?** The Public IP in Option 1 changes every time ECS restarts the task. An **Application Load Balancer (ALB)** gives you a permanent URL (like `my-app.us-east-1.elb.amazonaws.com`) that forwards traffic to whatever IP your task currently has.

**Rough Steps (For Future):**
1.  Go to **EC2** -> **Load Balancers** -> **Create Application Load Balancer**.
2.  Create a **Target Group** that points to IP addresses on Port 3000.
3.  Update your ECS Service to use this Load Balancer.
4.  Now you access the **ALB DNS Name**, effectively giving you a permanent website link.

**You are done!** 🎉
