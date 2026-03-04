/**
 * ============================================================
 * Firestore → Azure Cosmos DB Migration Script
 * ============================================================
 *
 * This script reads all data from your Firebase Firestore
 * (threads, messages, logs) and writes it into Azure Cosmos DB.
 *
 * PREREQUISITES:
 *   1. Node.js 18+ installed
 *   2. Run: npm install (in this directory)
 *   3. Place your Firebase service account key JSON file in this
 *      directory as "firebase-service-account.json"
 *      (Download from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key)
 *   4. Fill in your Cosmos DB connection string below
 *
 * USAGE:
 *   node migrate.js
 *
 * The script will:
 *   - Export all threads from Firestore → Cosmos DB "threads" container
 *   - Export all messages (sub-collections under each thread) → Cosmos DB "messages" container
 *   - Export all logs → Cosmos DB "logs" container
 *   - Create containers automatically if they don't exist
 *   - Print progress and a final summary
 * ============================================================
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { CosmosClient } = require("@azure/cosmos");

// ─── CONFIGURATION (EDIT THESE) ─────────────────────────────
const FIREBASE_SERVICE_ACCOUNT_PATH = "./firebase-service-account.json";
const COSMOS_CONNECTION_STRING = "YOUR_COSMOS_CONNECTION_STRING_HERE"; // e.g. AccountEndpoint=https://xxx.documents.azure.com:443/;AccountKey=xxx;
const COSMOS_DATABASE_NAME = "smstool";
const FIRESTORE_ORG_ID = "dispatch_team_main";
// ─────────────────────────────────────────────────────────────

async function main() {
    console.log("=== Firestore → Azure Cosmos DB Migration ===\n");

    // ── 1. Connect to Firebase ──
    console.log("[1/6] Connecting to Firebase...");
    const serviceAccount = require(FIREBASE_SERVICE_ACCOUNT_PATH);
    initializeApp({ credential: cert(serviceAccount) });
    const firestore = getFirestore();
    console.log("  ✓ Firebase connected\n");

    // ── 2. Connect to Cosmos DB ──
    console.log("[2/6] Connecting to Azure Cosmos DB...");
    const cosmosClient = new CosmosClient(COSMOS_CONNECTION_STRING);

    // Create database if needed
    const { database } = await cosmosClient.databases.createIfNotExists({ id: COSMOS_DATABASE_NAME });
    console.log(`  ✓ Database "${COSMOS_DATABASE_NAME}" ready`);

    // Create containers with partition keys matching our API code
    const { container: threadsContainer } = await database.containers.createIfNotExists({
        id: "threads",
        partitionKey: { paths: ["/orgId"] }
    });
    const { container: messagesContainer } = await database.containers.createIfNotExists({
        id: "messages",
        partitionKey: { paths: ["/threadId"] }
    });
    const { container: logsContainer } = await database.containers.createIfNotExists({
        id: "logs",
        partitionKey: { paths: ["/orgId"] }
    });
    console.log("  ✓ Containers created (threads, messages, logs)\n");

    // ── 3. Migrate Threads ──
    console.log("[3/6] Migrating threads...");
    const threadsSnap = await firestore
        .collection("organizations").doc(FIRESTORE_ORG_ID)
        .collection("threads").get();

    let threadCount = 0;
    let threadErrors = 0;
    const threadIds = [];

    for (const doc of threadsSnap.docs) {
        const data = doc.data();
        const cosmosDoc = {
            id: doc.id,
            orgId: FIRESTORE_ORG_ID,
            phone: data.phone || doc.id,
            name: data.name || doc.id,
            unread: data.unread || 0,
            lastMessageText: data.lastMessageText || "",
            lastMessageAtMs: data.lastMessageAtMs || 0,
            lastReadAtMs: data.lastReadAtMs || 0,
            isUrgent: data.isUrgent || false,
            tags: data.tags || [],
            notes: data.notes || ""
        };

        // Preserve any extra fields from Firestore
        for (const key of Object.keys(data)) {
            if (!(key in cosmosDoc)) {
                cosmosDoc[key] = data[key];
            }
        }

        try {
            await threadsContainer.items.upsert(cosmosDoc);
            threadIds.push(doc.id);
            threadCount++;
            process.stdout.write(`  Threads: ${threadCount}/${threadsSnap.size}\r`);
        } catch (err) {
            threadErrors++;
            console.error(`  ✗ Failed thread "${doc.id}": ${err.message}`);
        }
    }
    console.log(`  ✓ Threads migrated: ${threadCount} success, ${threadErrors} errors\n`);

    // ── 4. Migrate Messages (sub-collections under each thread) ──
    console.log("[4/6] Migrating messages...");
    let msgCount = 0;
    let msgErrors = 0;

    for (let i = 0; i < threadIds.length; i++) {
        const threadId = threadIds[i];
        const msgsSnap = await firestore
            .collection("organizations").doc(FIRESTORE_ORG_ID)
            .collection("threads").doc(threadId)
            .collection("messages").get();

        for (const msgDoc of msgsSnap.docs) {
            const data = msgDoc.data();

            // Convert Firestore Timestamp to ISO string
            let createdAt;
            if (data.createdAt && typeof data.createdAt.toDate === "function") {
                createdAt = data.createdAt.toDate().toISOString();
            } else if (data.createdAt instanceof Date) {
                createdAt = data.createdAt.toISOString();
            } else if (typeof data.createdAt === "string") {
                createdAt = data.createdAt;
            } else {
                createdAt = new Date().toISOString();
            }

            const cosmosDoc = {
                id: msgDoc.id,
                threadId: threadId,
                body: data.body || "",
                direction: data.direction || "received",
                createdAt: createdAt,
                sid: data.sid || msgDoc.id,
                mediaUrls: data.mediaUrls || []
            };

            try {
                await messagesContainer.items.upsert(cosmosDoc);
                msgCount++;
            } catch (err) {
                msgErrors++;
                console.error(`  ✗ Failed message "${msgDoc.id}" in thread "${threadId}": ${err.message}`);
            }
        }
        process.stdout.write(`  Messages: ${msgCount} migrated (thread ${i + 1}/${threadIds.length})\r`);
    }
    console.log(`  ✓ Messages migrated: ${msgCount} success, ${msgErrors} errors\n`);

    // ── 5. Migrate Logs ──
    console.log("[5/6] Migrating logs...");
    const logsSnap = await firestore
        .collection("organizations").doc(FIRESTORE_ORG_ID)
        .collection("logs").get();

    let logCount = 0;
    let logErrors = 0;

    for (const doc of logsSnap.docs) {
        const data = doc.data();

        let createdAt;
        if (data.createdAt && typeof data.createdAt.toDate === "function") {
            createdAt = data.createdAt.toDate().toISOString();
        } else if (data.createdAt instanceof Date) {
            createdAt = data.createdAt.toISOString();
        } else if (typeof data.createdAt === "string") {
            createdAt = data.createdAt;
        } else {
            createdAt = new Date().toISOString();
        }

        const cosmosDoc = {
            id: doc.id,
            orgId: FIRESTORE_ORG_ID,
            type: data.type || "unknown",
            threadName: data.threadName || "",
            phone: data.phone || "",
            message: data.message || "",
            threadId: data.threadId || "",
            createdAt: createdAt
        };

        // Preserve extra fields
        for (const key of Object.keys(data)) {
            if (!(key in cosmosDoc) && key !== "createdAt") {
                cosmosDoc[key] = data[key];
            }
        }

        try {
            await logsContainer.items.upsert(cosmosDoc);
            logCount++;
            process.stdout.write(`  Logs: ${logCount}/${logsSnap.size}\r`);
        } catch (err) {
            logErrors++;
            console.error(`  ✗ Failed log "${doc.id}": ${err.message}`);
        }
    }
    console.log(`  ✓ Logs migrated: ${logCount} success, ${logErrors} errors\n`);

    // ── 6. Summary ──
    console.log("[6/6] Migration Complete!");
    console.log("┌──────────────────────────────────┐");
    console.log(`│  Threads:  ${String(threadCount).padStart(5)} migrated          │`);
    console.log(`│  Messages: ${String(msgCount).padStart(5)} migrated          │`);
    console.log(`│  Logs:     ${String(logCount).padStart(5)} migrated          │`);
    console.log(`│  Errors:   ${String(threadErrors + msgErrors + logErrors).padStart(5)} total             │`);
    console.log("└──────────────────────────────────┘");
}

main().catch(err => {
    console.error("\n✗ Migration failed:", err.message);
    process.exit(1);
});
