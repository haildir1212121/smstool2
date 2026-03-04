const { threadsContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
    try {
        const threadId = context.bindingData.threadId;
        const orgId = req.query.orgId || "dispatch_team_main";
        const data = req.body;
        const container = threadsContainer();

        // Only read existing doc if we need to merge (increment ops)
        let merged;
        if (data._incrementUnread) {
            let existing = null;
            try {
                const { resource } = await container.item(threadId, orgId).read();
                existing = resource;
            } catch (e) {
                if (e.code !== 404) throw e;
            }
            merged = existing ? { ...existing, ...data } : { ...data, orgId, id: threadId };
            merged.unread = (existing?.unread || 0) + data._incrementUnread;
            delete merged._incrementUnread;
        } else {
            merged = { ...data, orgId, id: threadId };
        }

        await container.items.upsert(merged);

        context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: merged };
    } catch (err) {
        context.log.error("thread-upsert error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
