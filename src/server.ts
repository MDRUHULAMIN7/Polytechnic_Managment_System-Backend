import { createServer, type Server } from 'http';
import app from './app.js';
import config from './app/config/index.js';
import mongoose from 'mongoose';
import seedSuperAdmin from './app/DB/index.js';
import { socketService } from './app/socket/socket.service.js';
import { NotificationService } from './app/modules/notification/notification.service.js';
import { syncRoomIndexes } from './app/modules/room/room.model.js';
import { logger } from './app/utils/logger.js';

let server: Server;
async function main() {
  try {
    await mongoose.connect(config.database_url as string);
    await syncRoomIndexes();
    await seedSuperAdmin();
    void NotificationService.backfillRetentionIntoDB().catch((error) => {
      logger.error('Notification retention backfill failed.', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    const httpServer = createServer(app);
    socketService.initialize(httpServer);
    server = httpServer.listen(config.port, () => {
      logger.info('Server started successfully.', {
        port: config.port,
        environment: config.NODE_ENV,
      });
    });
  } catch (error) {
    logger.error('Server startup failed.', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}
main();
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection detected. Shutting down.', {
    error: error instanceof Error ? error.message : String(error),
  });
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception detected. Shutting down.', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
