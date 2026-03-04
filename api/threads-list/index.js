const { threadsContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
    try {
        const orgId = req.query.orgId || "dispatch_team_main";
        const since = parseInt(req.query.since) || 0;
        const container = threadsContainer();

        let q, params;
        if (since > 0) {
            q = "SELECT * FROM c WHERE c.orgId = @orgId AND c.lastMessageAtMs > @since ORDER BY c.lastMessageAtMs DESC";
            params = [{ name: "@orgId", value: orgId }, { name: "@since", value: since }];
        } else {
            q = "SELECT * FROM c WHERE c.orgId = @orgId ORDER BY c.lastMessageAtMs DESC";
            params = [{ name: "@orgId", value: orgId }];
        }

        const { resources } = await container.items
            .query({ query: q, parameters: params })
            .fetchAll();

        context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: resources };
    } catch (err) {
        context.log.error("threads-list error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
