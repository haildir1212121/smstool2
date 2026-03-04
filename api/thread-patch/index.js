const { threadsContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
    try {
        const threadId = context.bindingData.threadId;
        const orgId = req.query.orgId || "dispatch_team_main";
        const updates = req.body;
        const container = threadsContainer();

        const { resource: existing } = await container.item(threadId, orgId).read();
        if (!existing) {
            context.res = { status: 404, body: { error: "Thread not found" } };
            return;
        }

        const merged = { ...existing, ...updates };

        // Handle increment operations
        if (updates._incrementUnread) {
            merged.unread = (existing.unread || 0) + updates._incrementUnread;
            delete merged._incrementUnread;
        }

        await container.item(threadId, orgId).replace(merged);

        context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: merged };
    } catch (err) {
        context.log.error("thread-patch error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
