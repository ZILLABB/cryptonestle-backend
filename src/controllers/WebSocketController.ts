import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export class WebSocketController {
  private webSocketService?: any; // Will be injected

  constructor() {}

  /**
   * Set WebSocket service
   */
  setWebSocketService(webSocketService: any): void {
    this.webSocketService = webSocketService;
  }

  /**
   * Get WebSocket connection statistics
   */
  getConnectionStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!this.webSocketService) {
      throw new CustomError('WebSocket service not available', 503);
    }

    const stats = {
      connectedUsers: this.webSocketService.getConnectedUsersCount(),
      totalConnections: this.webSocketService.getTotalConnectionsCount(),
      timestamp: new Date()
    };

    res.json({
      status: 'success',
      message: 'WebSocket connection statistics retrieved successfully',
      data: stats,
    });
  });

  /**
   * Check if a user is connected
   */
  checkUserConnection = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!this.webSocketService) {
      throw new CustomError('WebSocket service not available', 503);
    }

    const { userId } = req.params;
    const requestingUserId = req.user!.id;

    // Users can only check their own connection status, admins can check any user
    if (userId !== requestingUserId && req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      throw new CustomError('Insufficient permissions', 403);
    }

    const isConnected = this.webSocketService.isUserConnected(userId);

    res.json({
      status: 'success',
      message: 'User connection status retrieved successfully',
      data: {
        userId,
        isConnected,
        timestamp: new Date()
      },
    });
  });

  /**
   * Send notification to a specific user (admin only)
   */
  sendNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      throw new CustomError('Insufficient permissions', 403);
    }

    if (!this.webSocketService) {
      throw new CustomError('WebSocket service not available', 503);
    }

    const { userId, title, message, type = 'SYSTEM', data } = req.body;

    if (!userId || !title || !message) {
      throw new CustomError('User ID, title, and message are required', 400);
    }

    const notification = {
      id: `admin-${Date.now()}`,
      title,
      message,
      type,
      data,
      createdAt: new Date(),
      isRead: false
    };

    this.webSocketService.sendNotification(userId, notification);

    res.json({
      status: 'success',
      message: 'Notification sent successfully',
      data: {
        userId,
        notification,
        sent: true
      },
    });
  });

  /**
   * Broadcast notification to all users (admin only)
   */
  broadcastNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      throw new CustomError('Insufficient permissions', 403);
    }

    if (!this.webSocketService) {
      throw new CustomError('WebSocket service not available', 503);
    }

    const { title, message, type = 'SYSTEM', data } = req.body;

    if (!title || !message) {
      throw new CustomError('Title and message are required', 400);
    }

    const notification = {
      id: `broadcast-${Date.now()}`,
      title,
      message,
      type,
      data,
      createdAt: new Date(),
      isRead: false
    };

    this.webSocketService.broadcastNotification(notification);

    res.json({
      status: 'success',
      message: 'Notification broadcasted successfully',
      data: {
        notification,
        broadcasted: true,
        connectedUsers: this.webSocketService.getConnectedUsersCount()
      },
    });
  });

  /**
   * Trigger price update broadcast (admin only)
   */
  triggerPriceUpdate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      throw new CustomError('Insufficient permissions', 403);
    }

    if (!this.webSocketService) {
      throw new CustomError('WebSocket service not available', 503);
    }

    try {
      // Get current prices and broadcast
      const { PriceService } = await import('../services/PriceService');
      const priceService = new PriceService();
      const prices = await priceService.getCurrentPrices();
      
      this.webSocketService.broadcastPriceUpdate(prices);

      res.json({
        status: 'success',
        message: 'Price update broadcasted successfully',
        data: {
          pricesCount: prices.length,
          timestamp: new Date()
        },
      });
    } catch (error) {
      logger.error('Error triggering price update:', error);
      throw new CustomError('Failed to trigger price update', 500);
    }
  });

  /**
   * Trigger portfolio update for a user (admin only)
   */
  triggerPortfolioUpdate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPER_ADMIN') {
      throw new CustomError('Insufficient permissions', 403);
    }

    if (!this.webSocketService) {
      throw new CustomError('WebSocket service not available', 503);
    }

    const { userId } = req.params;

    if (!userId) {
      throw new CustomError('User ID is required', 400);
    }

    try {
      await this.webSocketService.broadcastPortfolioUpdate(userId);

      res.json({
        status: 'success',
        message: 'Portfolio update triggered successfully',
        data: {
          userId,
          timestamp: new Date()
        },
      });
    } catch (error) {
      logger.error('Error triggering portfolio update:', error);
      throw new CustomError('Failed to trigger portfolio update', 500);
    }
  });

  /**
   * Get WebSocket service health status
   */
  getHealthStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const isHealthy = !!this.webSocketService;
    const status = isHealthy ? 'healthy' : 'unhealthy';

    const healthData = {
      status,
      service: 'WebSocket',
      timestamp: new Date(),
      uptime: process.uptime(),
      ...(isHealthy && {
        connectedUsers: this.webSocketService.getConnectedUsersCount(),
        totalConnections: this.webSocketService.getTotalConnectionsCount()
      })
    };

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'success' : 'error',
      message: `WebSocket service is ${status}`,
      data: healthData,
    });
  });

  /**
   * Get WebSocket events documentation
   */
  getEventsDocumentation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const documentation = {
      clientToServer: {
        'authenticate': {
          description: 'Authenticate socket connection with JWT token',
          parameters: ['token: string']
        },
        'join-room': {
          description: 'Join a specific room',
          parameters: ['room: string']
        },
        'leave-room': {
          description: 'Leave a specific room',
          parameters: ['room: string']
        },
        'subscribe-prices': {
          description: 'Subscribe to real-time price updates',
          parameters: []
        },
        'unsubscribe-prices': {
          description: 'Unsubscribe from price updates',
          parameters: []
        },
        'subscribe-portfolio': {
          description: 'Subscribe to portfolio updates',
          parameters: ['userId: string']
        },
        'unsubscribe-portfolio': {
          description: 'Unsubscribe from portfolio updates',
          parameters: []
        },
        'subscribe-transactions': {
          description: 'Subscribe to transaction updates',
          parameters: ['userId: string']
        },
        'unsubscribe-transactions': {
          description: 'Unsubscribe from transaction updates',
          parameters: []
        }
      },
      serverToClient: {
        'authenticated': {
          description: 'Confirmation of successful authentication',
          data: 'userId: string'
        },
        'price-update': {
          description: 'Real-time cryptocurrency price updates',
          data: 'prices: CryptoPrice[]'
        },
        'portfolio-update': {
          description: 'User portfolio value updates',
          data: 'portfolio: PortfolioValue'
        },
        'transaction-update': {
          description: 'Transaction status updates',
          data: 'transaction: TransactionStatus'
        },
        'investment-created': {
          description: 'New investment creation notification',
          data: 'investment: Investment'
        },
        'investment-matured': {
          description: 'Investment maturity notification',
          data: 'investment: Investment'
        },
        'withdrawal-approved': {
          description: 'Withdrawal approval notification',
          data: 'withdrawal: Withdrawal'
        },
        'notification': {
          description: 'General notifications',
          data: 'notification: Notification'
        },
        'error': {
          description: 'Error messages',
          data: 'error: { message: string, code?: string }'
        }
      }
    };

    res.json({
      status: 'success',
      message: 'WebSocket events documentation retrieved successfully',
      data: documentation,
    });
  });
}
