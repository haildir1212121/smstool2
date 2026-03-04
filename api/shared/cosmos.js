const { CosmosClient } = require("@azure/cosmos");

let client;
let database;

function getDatabase() {
    if (!database) {
        client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
        database = client.database(process.env.COSMOS_DATABASE_NAME || "smstool");
    }
    return database;
}

function threadsContainer() {
    return getDatabase().container("threads");
}

function messagesContainer() {
    return getDatabase().container("messages");
}

function logsContainer() {
    return getDatabase().container("logs");
}

module.exports = { getDatabase, threadsContainer, messagesContainer, logsContainer };
