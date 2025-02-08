import { Queue } from "bull";
import { createBullBoard } from "@bull-board/api";
import { BullAdapter } from "@bull-board/api/bullAdapter";
import { ExpressAdapter } from "@bull-board/express";

// Create queues
export const listingsQueue = new Queue('listings', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

// Create Bull Board
export const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/queues');

createBullBoard({
  queues: [new BullAdapter(listingsQueue)],
  serverAdapter,
});

// Export the queue instance
export const queues = {
  listings: listingsQueue,
}; 