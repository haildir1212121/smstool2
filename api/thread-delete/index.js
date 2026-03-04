const { threadsContainer, messagesContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
    try {
        const threadId = context.bindingData.threadId;
        const orgId = req.query.orgId || "dispatch_team_main";

        // Delete all messages for this thread
        const msgContainer = messagesContainer();
        const { resources: messages } = await msgContainer.items
            .query({
                query: "SELECT c.id FROM c WHERE c.threadId = @threadId",
                parameters: [{ name: "@threadId", value: threadId }]
            })
            .fetchAll();

        for (const msg of messages) {
            await msgContainer.item(msg.id, threadId).delete();
        }

        // Delete the thread
        await threadsContainer().item(threadId, orgId).delete();

        context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: { deleted: true } };
    } catch (err) {
        context.log.error("thread-delete error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
