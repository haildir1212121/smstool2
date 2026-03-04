const { messagesContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
    try {
        const threadId = context.bindingData.threadId;
        const since = req.query.since || "";
        const container = messagesContainer();

        let q, params;
        if (since) {
            q = "SELECT * FROM c WHERE c.threadId = @threadId AND c.createdAt > @since ORDER BY c.createdAt ASC";
            params = [{ name: "@threadId", value: threadId }, { name: "@since", value: since }];
        } else {
            q = "SELECT * FROM c WHERE c.threadId = @threadId ORDER BY c.createdAt ASC";
            params = [{ name: "@threadId", value: threadId }];
        }

        const { resources } = await container.items
            .query({ query: q, parameters: params })
            .fetchAll();

        context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: resources };
    } catch (err) {
        context.log.error("messages-list error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
