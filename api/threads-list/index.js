const { threadsContainer } = require("../shared/cosmos");

module.exports = async function (context, req) {
    try {
        const orgId = req.query.orgId || "dispatch_team_main";
        const container = threadsContainer();

        const { resources } = await container.items
            .query({
                query: "SELECT * FROM c WHERE c.orgId = @orgId ORDER BY c.lastMessageAtMs DESC",
                parameters: [{ name: "@orgId", value: orgId }]
            })
            .fetchAll();

        context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: resources };
    } catch (err) {
        context.log.error("threads-list error:", err.message);
        context.res = { status: 500, body: { error: err.message } };
    }
};
