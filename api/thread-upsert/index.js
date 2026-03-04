const { threadsContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
    try {
        const threadId = context.bindingData.threadId;
        const orgId = req.query.orgId || "dispatch_team_main";
        const data = req.body;
        const container = threadsContainer();

        let existing = null;
        try {
            const { resource } = await container.item(threadId, orgId).read();
            existing = resource;
        } catch (e) {
            if (e.code !== 404) throw e;
        }

        const merged = existing ? { ...existing, ...data } : { ...data, orgId, id: threadId };

        // Handle increment operations
        if (data._incrementUnread) {
            merged.unread = (existing?.unread || 0) + data._incrementUnread;
            delete merged._incrementUnread;
        }

        await container.items.upsert(merged);

        context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: merged };
    } catch (err) {
        context.log.error("thread-upsert error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
