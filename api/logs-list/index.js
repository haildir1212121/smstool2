const { logsContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
    try {
        const orgId = req.query.orgId || "dispatch_team_main";
        const maxItems = parseInt(req.query.limit) || 200;
        const container = logsContainer();

        const { resources } = await container.items
            .query({
                query: "SELECT TOP @limit * FROM c WHERE c.orgId = @orgId ORDER BY c.createdAt DESC",
                parameters: [
                    { name: "@orgId", value: orgId },
                    { name: "@limit", value: maxItems }
                ]
            })
            .fetchAll();

        context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: resources };
    } catch (err) {
        context.log.error("logs-list error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
