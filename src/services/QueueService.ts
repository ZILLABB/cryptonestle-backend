import Bull from 'bull';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { BlockchainService } from './BlockchainService';
import { NotificationService } from './NotificationService';

export class QueueService {
  private redis: Redis;
  private transactionQueue: Bull.Queue;
  private investmentQueue: Bull.Queue;
  private notificationQueue: Bull.Queue;
  private blockchainService: BlockchainService;
  private notificationService: NotificationService;

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Initialize services
    this.blockchainService = new BlockchainService();
    this.notificationService = new NotificationService();

    // Initialize queues
    this.transactionQueue = new Bull('transaction processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    });

    this.investmentQueue = new Bull('investment processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    });

    this.notificationQueue = new Bull('notification processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    });

    this.setupQueueProcessors();
    this.setupScheduledJobs();
  }

  /**
   * Setup queue processors
   */
  private setupQueueProcessors(): void {
    // Transaction monitoring processor
    this.transactionQueue.process('monitor-transactions', async (job) => {
      logger.info('Processing transaction monitoring job');
      await this.blockchainService.monitorPendingTransactions();
      return { processed: true };
    });

    // Investment maturity processor
    this.investmentQueue.process('process-matured-investments', async (job) => {
      logger.info('Processing matured investments job');
      await this.blockchainService.processMaturedInvestments();
      return { processed: true };
    });

    // Notification processor
    this.notificationQueue.process('send-notification', async (job) => {
      const { notificationData } = job.data;
      logger.info(`Processing notification job for user: ${notificationData.userId}`);
      await this.notificationService.createNotification(notificationData);
      return { processed: true };
    });

    // Cleanup processor
    this.notificationQueue.process('cleanup-notifications', async (job) => {
      logger.info('Processing notification cleanup job');
      const deletedCount = await this.notificationService.deleteOldNotifications(30);
      return { deletedCount };
    });

    // Error handling
    this.transactionQueue.on('failed', (job, err) => {
      logger.error(`Transaction queue job ${job.id} failed:`, err);
    });

    this.investmentQueue.on('failed', (job, err) => {
      logger.error(`Investment queue job ${job.id} failed:`, err);
    });

    this.notificationQueue.on('failed', (job, err) => {
      logger.error(`Notification queue job ${job.id} failed:`, err);
    });
  }

  /**
   * Setup scheduled jobs
   */
  private setupScheduledJobs(): void {
    // Monitor transactions every 2 minutes
    this.transactionQueue.add(
      'monitor-transactions',
      {},
      {
        repeat: { cron: '*/2 * * * *' }, // Every 2 minutes
        removeOnComplete: 5,
        removeOnFail: 10,
      }
    );

    // Process matured investments every hour
    this.investmentQueue.add(
      'process-matured-investments',
      {},
      {
        repeat: { cron: '0 * * * *' }, // Every hour
        removeOnComplete: 5,
        removeOnFail: 10,
      }
    );

    // Cleanup old notifications daily at 2 AM
    this.notificationQueue.add(
      'cleanup-notifications',
      {},
      {
        repeat: { cron: '0 2 * * *' }, // Daily at 2 AM
        removeOnComplete: 5,
        removeOnFail: 10,
      }
    );

    logger.info('Scheduled jobs setup completed');
  }

  /**
   * Add notification to queue
   */
  async addNotificationJob(notificationData: any): Promise<void> {
    try {
      await this.notificationQueue.add('send-notification', {
        notificationData,
      });
      logger.info('Notification job added to queue');
    } catch (error) {
      logger.error('Error adding notification job to queue:', error);
    }
  }

  /**
   * Add transaction monitoring job
   */
  async addTransactionMonitoringJob(): Promise<void> {
    try {
      await this.transactionQueue.add('monitor-transactions', {});
      logger.info('Transaction monitoring job added to queue');
    } catch (error) {
      logger.error('Error adding transaction monitoring job to queue:', error);
    }
  }

  /**
   * Add investment processing job
   */
  async addInvestmentProcessingJob(): Promise<void> {
    try {
      await this.investmentQueue.add('process-matured-investments', {});
      logger.info('Investment processing job added to queue');
    } catch (error) {
      logger.error('Error adding investment processing job to queue:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
    try {
      const [transactionStats, investmentStats, notificationStats] = await Promise.all([
        this.getQueueStatistics(this.transactionQueue),
        this.getQueueStatistics(this.investmentQueue),
        this.getQueueStatistics(this.notificationQueue),
      ]);

      return {
        transaction: transactionStats,
        investment: investmentStats,
        notification: notificationStats,
      };
    } catch (error) {
      logger.error('Error getting queue statistics:', error);
      return null;
    }
  }

  /**
   * Get statistics for a specific queue
   */
  private async getQueueStatistics(queue: Bull.Queue): Promise<any> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Clean up completed jobs
   */
  async cleanupJobs(): Promise<void> {
    try {
      await Promise.all([
        this.transactionQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 24 hours
        this.transactionQueue.clean(24 * 60 * 60 * 1000, 'failed'),
        this.investmentQueue.clean(24 * 60 * 60 * 1000, 'completed'),
        this.investmentQueue.clean(24 * 60 * 60 * 1000, 'failed'),
        this.notificationQueue.clean(24 * 60 * 60 * 1000, 'completed'),
        this.notificationQueue.clean(24 * 60 * 60 * 1000, 'failed'),
      ]);

      logger.info('Queue cleanup completed');
    } catch (error) {
      logger.error('Error cleaning up queues:', error);
    }
  }

  /**
   * Pause all queues
   */
  async pauseQueues(): Promise<void> {
    try {
      await Promise.all([
        this.transactionQueue.pause(),
        this.investmentQueue.pause(),
        this.notificationQueue.pause(),
      ]);

      logger.info('All queues paused');
    } catch (error) {
      logger.error('Error pausing queues:', error);
    }
  }

  /**
   * Resume all queues
   */
  async resumeQueues(): Promise<void> {
    try {
      await Promise.all([
        this.transactionQueue.resume(),
        this.investmentQueue.resume(),
        this.notificationQueue.resume(),
      ]);

      logger.info('All queues resumed');
    } catch (error) {
      logger.error('Error resuming queues:', error);
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    try {
      await Promise.all([
        this.transactionQueue.close(),
        this.investmentQueue.close(),
        this.notificationQueue.close(),
      ]);

      await this.redis.disconnect();
      logger.info('Queue service closed');
    } catch (error) {
      logger.error('Error closing queue service:', error);
    }
  }
}
