import { prisma } from '../index';
import { EmailService } from './EmailService';
import { logger } from '../utils/logger';
import { NotificationType } from '@prisma/client';

export interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  data?: any;
  sendEmail?: boolean;
}

export class NotificationService {
  private emailService = new EmailService();

  /**
   * Create a new notification
   */
  async createNotification(notificationData: NotificationData): Promise<void> {
    try {
      // Create notification in database
      await prisma.notification.create({
        data: {
          userId: notificationData.userId,
          title: notificationData.title,
          message: notificationData.message,
          type: notificationData.type,
          data: notificationData.data,
        },
      });

      // Send email notification if requested
      if (notificationData.sendEmail) {
        await this.sendEmailNotification(notificationData);
      }

      logger.info(`Notification created for user: ${notificationData.userId}`);
    } catch (error) {
      logger.error('Error creating notification:', error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notificationData: NotificationData): Promise<void> {
    try {
      // Get user email
      const user = await prisma.user.findUnique({
        where: { id: notificationData.userId },
        select: { email: true, firstName: true },
      });

      if (!user?.email) {
        return;
      }

      // Send email based on notification type
      switch (notificationData.type) {
        case 'INVESTMENT':
          if (notificationData.data?.investmentDetails) {
            await this.emailService.sendInvestmentConfirmationEmail(
              user.email,
              notificationData.data.investmentDetails
            );
          }
          break;

        case 'WITHDRAWAL':
          if (notificationData.data?.withdrawalDetails) {
            await this.emailService.sendWithdrawalNotificationEmail(
              user.email,
              notificationData.data.withdrawalDetails
            );
          }
          break;

        default:
          // Send generic notification email
          await this.sendGenericNotificationEmail(
            user.email,
            user.firstName || 'User',
            notificationData.title,
            notificationData.message
          );
          break;
      }
    } catch (error) {
      logger.error('Error sending email notification:', error);
    }
  }

  /**
   * Send generic notification email
   */
  private async sendGenericNotificationEmail(
    email: string,
    firstName: string,
    title: string,
    message: string
  ): Promise<void> {
    // This would be implemented with a generic email template
    logger.info(`Generic notification email sent to: ${email}`);
  }

  /**
   * Notify user about investment confirmation
   */
  async notifyInvestmentConfirmation(
    userId: string,
    investmentDetails: {
      amount: string;
      currency: string;
      planName: string;
      duration: number;
      expectedReturn: string;
      maturityDate: string;
    }
  ): Promise<void> {
    await this.createNotification({
      userId,
      title: 'Investment Confirmed',
      message: `Your investment of ${investmentDetails.amount} ${investmentDetails.currency} in ${investmentDetails.planName} has been confirmed.`,
      type: 'INVESTMENT',
      data: { investmentDetails },
      sendEmail: true,
    });
  }

  /**
   * Notify user about investment maturity
   */
  async notifyInvestmentMaturity(
    userId: string,
    investmentDetails: {
      amount: string;
      currency: string;
      planName: string;
      return: string;
    }
  ): Promise<void> {
    await this.createNotification({
      userId,
      title: 'Investment Matured',
      message: `Your investment in ${investmentDetails.planName} has matured. You earned ${investmentDetails.return} ${investmentDetails.currency}.`,
      type: 'INVESTMENT',
      data: { investmentDetails },
      sendEmail: true,
    });
  }

  /**
   * Notify user about withdrawal status
   */
  async notifyWithdrawalStatus(
    userId: string,
    withdrawalDetails: {
      amount: string;
      currency: string;
      walletAddress: string;
      status: string;
    }
  ): Promise<void> {
    const statusMessages = {
      APPROVED: 'Your withdrawal request has been approved and is being processed.',
      PROCESSING: 'Your withdrawal is currently being processed.',
      COMPLETED: 'Your withdrawal has been completed successfully.',
      REJECTED: 'Your withdrawal request has been rejected.',
      CANCELLED: 'Your withdrawal request has been cancelled.',
    };

    const message = statusMessages[withdrawalDetails.status as keyof typeof statusMessages] || 
                   `Your withdrawal status has been updated to ${withdrawalDetails.status}.`;

    await this.createNotification({
      userId,
      title: 'Withdrawal Update',
      message,
      type: 'WITHDRAWAL',
      data: { withdrawalDetails },
      sendEmail: true,
    });
  }

  /**
   * Notify user about transaction confirmation
   */
  async notifyTransactionConfirmation(
    userId: string,
    transactionDetails: {
      hash: string;
      type: string;
      amount: string;
      currency: string;
    }
  ): Promise<void> {
    await this.createNotification({
      userId,
      title: 'Transaction Confirmed',
      message: `Your ${transactionDetails.type.toLowerCase()} transaction of ${transactionDetails.amount} ${transactionDetails.currency} has been confirmed.`,
      type: 'TRANSACTION',
      data: { transactionDetails },
      sendEmail: false, // Usually don't send email for transaction confirmations
    });
  }

  /**
   * Notify user about security events
   */
  async notifySecurityEvent(
    userId: string,
    eventType: string,
    details: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      title: 'Security Alert',
      message: `Security event: ${eventType}. ${details}`,
      type: 'SECURITY',
      data: { eventType, details },
      sendEmail: true,
    });
  }

  /**
   * Send system-wide notification
   */
  async sendSystemNotification(
    title: string,
    message: string,
    userIds?: string[]
  ): Promise<void> {
    try {
      let targetUsers: string[];

      if (userIds) {
        targetUsers = userIds;
      } else {
        // Get all active users
        const users = await prisma.user.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true },
        });
        targetUsers = users.map(user => user.id);
      }

      // Create notifications for all target users
      const notifications = targetUsers.map(userId => ({
        userId,
        title,
        message,
        type: 'SYSTEM' as NotificationType,
      }));

      await prisma.notification.createMany({
        data: notifications,
      });

      logger.info(`System notification sent to ${targetUsers.length} users`);
    } catch (error) {
      logger.error('Error sending system notification:', error);
    }
  }

  /**
   * Send promotional notification
   */
  async sendPromotionalNotification(
    userId: string,
    title: string,
    message: string,
    promotionData?: any
  ): Promise<void> {
    await this.createNotification({
      userId,
      title,
      message,
      type: 'PROMOTION',
      data: promotionData,
      sendEmail: false, // Usually don't send email for promotions unless explicitly requested
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId,
        },
        data: {
          isRead: true,
        },
      });

      return result.count > 0;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return result.count;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      return 0;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });
    } catch (error) {
      logger.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  /**
   * Delete old notifications (cleanup job)
   */
  async deleteOldNotifications(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          isRead: true,
        },
      });

      logger.info(`Deleted ${result.count} old notifications`);
      return result.count;
    } catch (error) {
      logger.error('Error deleting old notifications:', error);
      return 0;
    }
  }
}
