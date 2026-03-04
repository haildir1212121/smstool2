const { getContainerClient } = require("../shared/storage");
const crypto = require("crypto");

module.exports = async function (context, req) {
    try {
        const orgId = req.query.orgId || "dispatch_team_main";
        const threadId = req.query.threadId;

        if (!threadId) {
            context.res = { status: 400, body: { error: "threadId query parameter is required" } };
            return;
        }

        const body = req.body;
        if (!body || !body.length) {
            context.res = { status: 400, body: { error: "Request body must contain file data" } };
            return;
        }

        const containerClient = getContainerClient();
        await containerClient.createIfNotExists({ access: "blob" });

        const blobName = `mms/${orgId}/${threadId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        const contentType = req.headers["content-type"] || "application/octet-stream";

        await blockBlobClient.upload(body, body.length, {
            blobHTTPHeaders: { blobContentType: contentType }
        });

        context.res = {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: { url: blockBlobClient.url }
        };
    } catch (err) {
        context.log.error("media-upload error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
