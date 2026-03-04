const { threadsContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
    try {
        const threadId = context.bindingData.threadId;
        const orgId = req.query.orgId || "dispatch_team_main";
        const updates = req.body;
        const container = threadsContainer();

        // Build Cosmos patch operations (single round-trip, no read needed)
        const ops = [];
        for (const [key, value] of Object.entries(updates)) {
            if (key === "_incrementUnread") {
                ops.push({ op: "incr", path: "/unread", value: value });
            } else {
                ops.push({ op: "set", path: `/${key}`, value: value });
            }
        }

        const { resource } = await container.item(threadId, orgId).patch(ops);

        context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: resource };
    } catch (err) {
        if (err.code === 404) {
            context.res = { status: 404, body: { error: "Thread not found" } };
            return;
        }
        context.log.error("thread-patch error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
