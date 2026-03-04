const { BlobServiceClient } = require("@azure/storage-blob");

let blobServiceClient;
let containerClient;

function getContainerClient() {
    if (!containerClient) {
        blobServiceClient = BlobServiceClient.fromConnectionString(
            process.env.AZURE_STORAGE_CONNECTION_STRING
        );
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "media";
        containerClient = blobServiceClient.getContainerClient(containerName);
    }
    return containerClient;
}

module.exports = { getContainerClient };
