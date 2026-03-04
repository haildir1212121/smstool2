const { logsContainer } = require("../shared/cosmos");
const crypto = require("crypto");

module.exports = async function (context, req) {
    try {
        const orgId = req.query.orgId || "dispatch_team_main";
        const data = req.body;
        const container = logsContainer();

        const doc = {
            ...data,
            id: crypto.randomUUID(),
            orgId: orgId,
            createdAt: new Date().toISOString()
        };

        await container.items.create(doc);

        context.res = { status: 201, headers: { "Content-Type": "application/json" }, body: doc };
    } catch (err) {
        context.log.error("log-create error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
