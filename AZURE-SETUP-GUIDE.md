# Azure Setup Guide — SMS Dispatch Tool

This guide walks you through every click and configuration needed to set up the Azure resources for your SMS tool.

---

## Prerequisites

- An Azure account (create one at https://portal.azure.com if you don't have one)
- Node.js 18+ installed locally
- Your existing Firebase project (for data export)

---

## Step 1: Create a Resource Group

A Resource Group is a container that holds all your related Azure resources.

1. Go to **https://portal.azure.com**
2. Search for **"Resource groups"** in the top search bar
3. Click **"+ Create"**
4. Fill in:
   - **Subscription**: Select your subscription
   - **Resource group name**: `smstool-rg`
   - **Region**: Pick the closest to your users (e.g., `East US`)
5. Click **"Review + Create"** → **"Create"**

---

## Step 2: Create Azure Cosmos DB (Database)

This replaces Firebase Firestore.

1. Search for **"Azure Cosmos DB"** in the portal search bar
2. Click **"+ Create"**
3. Select **"Azure Cosmos DB for NoSQL"** → Click **"Create"**
4. Fill in:
   - **Subscription**: Your subscription
   - **Resource Group**: `smstool-rg`
   - **Account Name**: `smstool-cosmos` (must be globally unique — add numbers if taken, e.g., `smstool-cosmos-123`)
   - **Location**: Same region as your resource group (e.g., `East US`)
   - **Capacity mode**: **Serverless** (cheapest for small/medium workloads — no minimum cost)
5. Click **"Review + Create"** → **"Create"**
6. Wait for deployment to finish (~2 minutes), then click **"Go to resource"**

### Create the Database and Containers

7. In your Cosmos DB account, click **"Data Explorer"** in the left sidebar
8. Click **"New Container"** (at the top)
9. Create the first container:
   - **Database id**: Select **"Create new"** → type `smstool`
   - **Container id**: `threads`
   - **Partition key**: `/orgId`
   - Click **"OK"**
10. Click **"New Container"** again:
    - **Database id**: Select **"Use existing"** → select `smstool`
    - **Container id**: `messages`
    - **Partition key**: `/threadId`
    - Click **"OK"**
11. Click **"New Container"** again:
    - **Database id**: Select **"Use existing"** → select `smstool`
    - **Container id**: `logs`
    - **Partition key**: `/orgId`
    - Click **"OK"**

### Copy the Connection String

12. In the left sidebar, click **"Keys"** (under Settings)
13. Copy the **"PRIMARY CONNECTION STRING"** — you'll need this later
    - It looks like: `AccountEndpoint=https://smstool-cosmos.documents.azure.com:443/;AccountKey=abc123...==;`
    - **Save this somewhere safe** — you'll use it in Step 4, Step 5, and Step 6

---

## Step 3: Create Azure Blob Storage (Media Files)

This replaces Firebase Storage for MMS image/video uploads.

1. Search for **"Storage accounts"** in the portal search bar
2. Click **"+ Create"**
3. Fill in:
   - **Subscription**: Your subscription
   - **Resource Group**: `smstool-rg`
   - **Storage account name**: `smstoolmedia` (must be globally unique, lowercase, no dashes — try `smstoolmedia123` if taken)
   - **Region**: Same region (e.g., `East US`)
   - **Performance**: **Standard**
   - **Redundancy**: **LRS** (Locally-redundant storage — cheapest)
4. Click **"Review + Create"** → **"Create"**
5. Wait for deployment, then click **"Go to resource"**

### Create the Media Container

6. In the left sidebar, click **"Containers"** (under Data storage)
7. Click **"+ Container"**
8. Name: `media`
9. **Public access level**: `Blob` (allows public read access for images sent via MMS)
10. Click **"Create"**

### Enable CORS (Required for browser uploads)

11. In the left sidebar, click **"Resource sharing (CORS)"** (under Settings)
12. Add a CORS rule:
    - **Allowed origins**: `*`
    - **Allowed methods**: Select all (GET, POST, PUT, etc.)
    - **Allowed headers**: `*`
    - **Exposed headers**: `*`
    - **Max age**: `3600`
13. Click **"Save"**

### Copy the Connection String

14. In the left sidebar, click **"Access keys"** (under Security + networking)
15. Click **"Show"** next to key1
16. Copy the **"Connection string"**
    - It looks like: `DefaultEndpointsProtocol=https;AccountName=smstoolmedia;AccountKey=abc123...==;EndpointSuffix=core.windows.net`
    - **Save this somewhere safe**

---

## Step 4: Migrate Your Firestore Data

Before deploying the new app, move your existing data from Firebase to Cosmos DB.

### Get Your Firebase Service Account Key

1. Go to **https://console.firebase.google.com**
2. Select your project (**sms-dlx**)
3. Click the **gear icon** → **"Project settings"**
4. Go to the **"Service accounts"** tab
5. Click **"Generate new private key"** → **"Generate key"**
6. A JSON file will download. Rename it to `firebase-service-account.json`
7. Move it to the `scripts/` folder in this project

### Run the Migration

```bash
cd scripts/
npm install
```

8. Open `migrate.js` and replace the placeholder connection string:
```js
const COSMOS_CONNECTION_STRING = "AccountEndpoint=https://smstool-cosmos.documents.azure.com:443/;AccountKey=YOUR_KEY_HERE;";
```
Paste the Cosmos DB connection string you copied in Step 2.

9. Run the migration:
```bash
node migrate.js
```

You should see output like:
```
=== Firestore → Azure Cosmos DB Migration ===

[1/6] Connecting to Firebase...
  ✓ Firebase connected

[2/6] Connecting to Azure Cosmos DB...
  ✓ Database "smstool" ready
  ✓ Containers created (threads, messages, logs)

[3/6] Migrating threads...
  ✓ Threads migrated: 45 success, 0 errors

[4/6] Migrating messages...
  ✓ Messages migrated: 1,230 success, 0 errors

[5/6] Migrating logs...
  ✓ Logs migrated: 89 success, 0 errors

[6/6] Migration Complete!
┌──────────────────────────────────┐
│  Threads:     45 migrated        │
│  Messages:  1230 migrated        │
│  Logs:        89 migrated        │
│  Errors:       0 total           │
└──────────────────────────────────┘
```

### Verify the Data

10. Go back to **Azure Portal** → your Cosmos DB account → **Data Explorer**
11. Expand `smstool` → `threads` → click **"Items"** — you should see all your contacts
12. Check `messages` and `logs` too

---

## Step 5: Deploy with Azure Static Web Apps

This hosts both the frontend (`index.html`) and the API (Azure Functions) together.

### Option A: Deploy via GitHub (Recommended)

1. Push this repo to GitHub if you haven't already
2. Search for **"Static Web Apps"** in the Azure portal
3. Click **"+ Create"**
4. Fill in:
   - **Subscription**: Your subscription
   - **Resource Group**: `smstool-rg`
   - **Name**: `smstool-app`
   - **Plan type**: **Free**
   - **Region**: Same region
   - **Source**: **GitHub**
5. Click **"Sign in with GitHub"** and authorize
6. Select:
   - **Organization**: Your GitHub username
   - **Repository**: `smstool2`
   - **Branch**: `claude/migrate-firebase-azure-cjbmi` (or `main` after you merge)
7. **Build Details**:
   - **Build Preset**: `Custom`
   - **App location**: `/` (root — where index.html is)
   - **Api location**: `api`
   - **Output location**: leave empty
8. Click **"Review + Create"** → **"Create"**

Azure will automatically deploy your app. It creates a GitHub Action that redeploys on every push.

### Option B: Deploy via CLI

```bash
# Install the CLI extension
npm install -g @azure/static-web-apps-cli

# Build the API dependencies
cd api && npm install && cd ..

# Deploy
swa deploy --app-location . --api-location api
```

---

## Step 6: Configure Environment Variables

The deployed API needs the connection strings to reach Cosmos DB and Blob Storage.

1. In the Azure portal, go to your **Static Web App** (`smstool-app`)
2. In the left sidebar, click **"Configuration"** (under Settings)
3. Click **"+ Add"** for each of these application settings:

| Name | Value |
|------|-------|
| `COSMOS_CONNECTION_STRING` | `AccountEndpoint=https://smstool-cosmos.documents.azure.com:443/;AccountKey=YOUR_KEY;` |
| `COSMOS_DATABASE_NAME` | `smstool` |
| `AZURE_STORAGE_CONNECTION_STRING` | `DefaultEndpointsProtocol=https;AccountName=smstoolmedia;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net` |
| `AZURE_STORAGE_CONTAINER_NAME` | `media` |

4. Click **"Save"** at the top

---

## Step 7: Configure Twilio Webhook (Already Done)

Your Twilio integration is unchanged — it still uses the same backend at `sms-backend-3488.twil.io`. No Twilio changes are needed.

If you want to verify:
1. Go to **https://console.twilio.com**
2. Go to **Phone Numbers** → Your number → **Messaging Configuration**
3. Confirm the webhook URL for incoming messages points to your Twilio Function

---

## Step 8: Verify Everything Works

1. Open your Static Web App URL (found in Azure portal → Static Web App → Overview → **URL**)
   - It looks like: `https://smstool-app-abc123.azurestaticapps.net`
2. You should see the Dispatch Command interface with all your contacts loaded
3. Test:
   - [ ] Contacts load in the sidebar
   - [ ] Click a contact → messages load
   - [ ] Send a test SMS → message appears and is delivered
   - [ ] Receive an inbound SMS → notification appears
   - [ ] Create a new contact
   - [ ] Edit contact tags and notes
   - [ ] Check the Logs tab
   - [ ] Send a broadcast (to 1-2 test numbers)

---

## Step 9: Set Up Monitoring (Optional)

1. In your Static Web App, click **"Application Insights"** in the left sidebar
2. Click **"Enable Application Insights"**
3. This gives you:
   - Request/response logs for all API calls
   - Error tracking and alerts
   - Performance metrics

To set up alerts:
1. Go to your Application Insights resource
2. Click **"Alerts"** → **"+ Create"** → **"Alert rule"**
3. Recommended alerts:
   - **Failed requests > 5 in 5 minutes**
   - **Server response time > 3 seconds**

---

## Cost Estimate

With the recommended settings above:

| Service | Tier | Estimated Monthly Cost |
|---------|------|----------------------|
| Cosmos DB | Serverless | ~$0–5 (pay per request) |
| Blob Storage | Standard LRS | ~$0.02/GB stored |
| Static Web Apps | Free | $0 |
| **Total** | | **~$1–5/month** |

---

## Troubleshooting

### "API 500" errors in browser console
- Check that all 4 environment variables are set in Static Web App Configuration
- Go to Application Insights → Failures to see detailed error messages

### Messages not loading
- In Azure portal → Cosmos DB → Data Explorer, verify the `messages` container has data
- Check the partition key is `/threadId` (not `/orgId`)

### Media uploads failing
- Verify CORS is enabled on the Storage Account
- Check the `media` container exists and has Blob-level public access

### Data Explorer shows empty containers
- Re-run the migration script: `cd scripts && node migrate.js`
- Check you used the correct Cosmos DB connection string

---

## File Structure Reference

```
smstool2/
├── index.html                         ← Frontend (no Firebase, uses /api/* endpoints)
├── staticwebapp.config.json           ← Azure Static Web Apps routing config
├── api/                               ← Azure Functions (backend API)
│   ├── host.json                      ← Functions runtime config
│   ├── package.json                   ← API dependencies
│   ├── local.settings.json.example    ← Template for local dev settings
│   ├── shared/
│   │   ├── cosmos.js                  ← Cosmos DB client (threads, messages, logs)
│   │   └── storage.js                 ← Blob Storage client (media uploads)
│   ├── threads-list/                  ← GET  /api/threads
│   ├── thread-upsert/                 ← PUT  /api/threads/{id}
│   ├── thread-patch/                  ← PATCH /api/threads/{id}
│   ├── thread-delete/                 ← DELETE /api/threads/{id}
│   ├── messages-list/                 ← GET  /api/threads/{id}/messages
│   ├── message-upsert/               ← PUT  /api/threads/{id}/messages/{msgId}
│   ├── logs-list/                     ← GET  /api/logs
│   ├── log-create/                    ← POST /api/logs
│   └── media-upload/                  ← POST /api/upload
└── scripts/
    ├── package.json                   ← Migration script dependencies
    └── migrate.js                     ← Firestore → Cosmos DB data migration
```
