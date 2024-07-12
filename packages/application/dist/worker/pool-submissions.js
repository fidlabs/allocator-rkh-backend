import "reflect-metadata";
import { initialize } from "../startup.js";
import { TYPES } from "../types.js";
import { CreateDatacapAllocatorCommand } from "../application/commands/definitions/create-datacap-allocator.js";
(async () => {
    // Init container
    const container = await initialize();
    // Initialize RabbitMQ
    const eventBus = container.get(TYPES.EventBus);
    await eventBus.init();
    // Get the Airtable client from the container
    const client = container.get(TYPES.AirtableClient);
    // Get the command bus from the container
    const commandBus = container.get(TYPES.CommandBus);
    // Start the application
    setInterval(async () => {
        const newRecords = await client.getTableRecords();
        for (const record of newRecords) {
            console.log("Processing new record", record);
            const result = await commandBus.send(new CreateDatacapAllocatorCommand({
                githubUserId: record.fields["Bug ID"]
            }));
            console.log("Datacap allocator created successfully", result);
        }
    }, 1000);
})();
