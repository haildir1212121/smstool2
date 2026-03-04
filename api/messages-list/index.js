const { messagesContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
    try {
        const threadId = context.bindingData.threadId;
        const container = messagesContainer();

        const { resources } = await container.items
            .query({
                query: "SELECT * FROM c WHERE c.threadId = @threadId ORDER BY c.createdAt ASC",
                parameters: [{ name: "@threadId", value: threadId }]
            })
            .fetchAll();

        context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: resources };
    } catch (err) {
        context.log.error("messages-list error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
