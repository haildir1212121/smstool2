const { messagesContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
    try {
        const threadId = context.bindingData.threadId;
        const msgId = context.bindingData.msgId;
        const data = req.body;
        const container = messagesContainer();

        const doc = {
            ...data,
            id: msgId,
            threadId: threadId,
            createdAt: data.createdAt || new Date().toISOString()
        };

        await container.items.upsert(doc);

        context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: doc };
    } catch (err) {
        context.log.error("message-upsert error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
