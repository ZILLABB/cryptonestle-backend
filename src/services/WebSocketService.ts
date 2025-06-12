import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { PriceService, CryptoPrice, PortfolioValue } from './PriceService';
import { SmartContractService, TransactionStatus } from './SmartContractService';

export interface WebSocketEvents {
  // Client to Server events
  'join-room': (room: string) => void;
  'leave-room': (room: string) => void;
  'subscribe-prices': () => void;
  'unsubscribe-prices': () => void;
  'subscribe-portfolio': (userId: string) => void;
  'unsubscribe-portfolio': () => void;
  'subscribe-transactions': (userId: string) => void;
  'unsubscribe-transactions': () => void;

  // Server to Client events
  'price-update': (prices: CryptoPrice[]) => void;
  'portfolio-update': (portfolio: PortfolioValue) => void;
  'transaction-update': (transaction: TransactionStatus) => void;
  'investment-created': (investment: any) => void;
  'investment-matured': (investment: any) => void;
  'withdrawal-approved': (withdrawal: any) => void;
  'notification': (notification: any) => void;
  'error': (error: { message: string; code?: string }) => void;
}

export class WebSocketService {
  private io: SocketIOServer;
  private priceService: PriceService;
  private smartContractService: SmartContractService;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private priceSubscribers: Set<string> = new Set(); // socketIds subscribed to prices
  private portfolioSubscribers: Map<string, string> = new Map(); // socketId -> userId
  private transactionSubscribers: Map<string, string> = new Map(); // socketId -> userId

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.priceService = new PriceService();
    this.smartContractService = new SmartContractService();

    this.setupEventHandlers();
    this.startPriceBroadcast();
    this.startPortfolioUpdates();

    logger.info('WebSocket service initialized');
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Handle authentication
      socket.on('authenticate', async (token: string) => {
        try {
          const userId = await this.authenticateSocket(token);
          if (userId) {
            socket.data.userId = userId;
            this.addUserConnection(userId, socket.id);
            socket.emit('authenticated', { userId });
            logger.info(`Socket ${socket.id} authenticated for user ${userId}`);
          } else {
            socket.emit('error', { message: 'Authentication failed' });
          }
        } catch (error) {
          logger.error('Socket authentication error:', error);
          socket.emit('error', { message: 'Authentication error' });
        }
      });

      // Handle room management
      socket.on('join-room', (room: string) => {
        socket.join(room);
        logger.info(`Socket ${socket.id} joined room: ${room}`);
      });

      socket.on('leave-room', (room: string) => {
        socket.leave(room);
        logger.info(`Socket ${socket.id} left room: ${room}`);
      });

      // Handle price subscriptions
      socket.on('subscribe-prices', () => {
        this.priceSubscribers.add(socket.id);
        logger.info(`Socket ${socket.id} subscribed to price updates`);
        
        // Send current prices immediately
        this.sendCurrentPrices(socket.id);
      });

      socket.on('unsubscribe-prices', () => {
        this.priceSubscribers.delete(socket.id);
        logger.info(`Socket ${socket.id} unsubscribed from price updates`);
      });

      // Handle portfolio subscriptions
      socket.on('subscribe-portfolio', (userId: string) => {
        if (socket.data.userId === userId) {
          this.portfolioSubscribers.set(socket.id, userId);
          logger.info(`Socket ${socket.id} subscribed to portfolio updates for user ${userId}`);
          
          // Send current portfolio immediately
          this.sendCurrentPortfolio(socket.id, userId);
        } else {
          socket.emit('error', { message: 'Unauthorized portfolio subscription' });
        }
      });

      socket.on('unsubscribe-portfolio', () => {
        this.portfolioSubscribers.delete(socket.id);
        logger.info(`Socket ${socket.id} unsubscribed from portfolio updates`);
      });

      // Handle transaction subscriptions
      socket.on('subscribe-transactions', (userId: string) => {
        if (socket.data.userId === userId) {
          this.transactionSubscribers.set(socket.id, userId);
          logger.info(`Socket ${socket.id} subscribed to transaction updates for user ${userId}`);
        } else {
          socket.emit('error', { message: 'Unauthorized transaction subscription' });
        }
      });

      socket.on('unsubscribe-transactions', () => {
        this.transactionSubscribers.delete(socket.id);
        logger.info(`Socket ${socket.id} unsubscribed from transaction updates`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
        this.handleDisconnection(socket);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  /**
   * Authenticate socket connection using JWT token
   */
  private async authenticateSocket(token: string): Promise<string | null> {
    try {
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      return decoded.userId;
    } catch (error) {
      logger.error('Socket authentication failed:', error);
      return null;
    }
  }

  /**
   * Add user connection mapping
   */
  private addUserConnection(userId: string, socketId: string): void {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
  }

  /**
   * Handle socket disconnection cleanup
   */
  private handleDisconnection(socket: Socket): void {
    const userId = socket.data.userId;
    
    // Remove from user connections
    if (userId && this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId)!.delete(socket.id);
      if (this.connectedUsers.get(userId)!.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }

    // Remove from subscriptions
    this.priceSubscribers.delete(socket.id);
    this.portfolioSubscribers.delete(socket.id);
    this.transactionSubscribers.delete(socket.id);
  }

  /**
   * Start broadcasting price updates
   */
  private startPriceBroadcast(): void {
    setInterval(async () => {
      if (this.priceSubscribers.size > 0) {
        try {
          const prices = await this.priceService.getCurrentPrices();
          this.broadcastPriceUpdate(prices);
        } catch (error) {
          logger.error('Error broadcasting price updates:', error);
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Start portfolio update checks
   */
  private startPortfolioUpdates(): void {
    setInterval(async () => {
      if (this.portfolioSubscribers.size > 0) {
        for (const [socketId, userId] of this.portfolioSubscribers.entries()) {
          try {
            const portfolio = await this.priceService.getPortfolioValue(userId);
            this.io.to(socketId).emit('portfolio-update', portfolio);
          } catch (error) {
            logger.error(`Error updating portfolio for user ${userId}:`, error);
          }
        }
      }
    }, 60000); // Every minute
  }

  /**
   * Send current prices to a specific socket
   */
  private async sendCurrentPrices(socketId: string): Promise<void> {
    try {
      const prices = await this.priceService.getCurrentPrices();
      this.io.to(socketId).emit('price-update', prices);
    } catch (error) {
      logger.error('Error sending current prices:', error);
    }
  }

  /**
   * Send current portfolio to a specific socket
   */
  private async sendCurrentPortfolio(socketId: string, userId: string): Promise<void> {
    try {
      const portfolio = await this.priceService.getPortfolioValue(userId);
      this.io.to(socketId).emit('portfolio-update', portfolio);
    } catch (error) {
      logger.error('Error sending current portfolio:', error);
    }
  }

  // ========================================
  // PUBLIC METHODS FOR BROADCASTING EVENTS
  // ========================================

  /**
   * Broadcast price updates to all subscribers
   */
  broadcastPriceUpdate(prices: CryptoPrice[]): void {
    if (this.priceSubscribers.size > 0) {
      for (const socketId of this.priceSubscribers) {
        this.io.to(socketId).emit('price-update', prices);
      }
      logger.info(`Price update broadcasted to ${this.priceSubscribers.size} subscribers`);
    }
  }

  /**
   * Broadcast portfolio update to specific user
   */
  async broadcastPortfolioUpdate(userId: string): Promise<void> {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets && userSockets.size > 0) {
      try {
        const portfolio = await this.priceService.getPortfolioValue(userId);
        for (const socketId of userSockets) {
          this.io.to(socketId).emit('portfolio-update', portfolio);
        }
        logger.info(`Portfolio update sent to user ${userId}`);
      } catch (error) {
        logger.error(`Error broadcasting portfolio update for user ${userId}:`, error);
      }
    }
  }

  /**
   * Broadcast transaction update to specific user
   */
  broadcastTransactionUpdate(userId: string, transaction: TransactionStatus): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets && userSockets.size > 0) {
      for (const socketId of userSockets) {
        this.io.to(socketId).emit('transaction-update', transaction);
      }
      logger.info(`Transaction update sent to user ${userId}`);
    }
  }

  /**
   * Broadcast investment creation notification
   */
  broadcastInvestmentCreated(userId: string, investment: any): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets && userSockets.size > 0) {
      for (const socketId of userSockets) {
        this.io.to(socketId).emit('investment-created', investment);
      }
      logger.info(`Investment creation notification sent to user ${userId}`);
    }
  }

  /**
   * Broadcast investment maturity notification
   */
  broadcastInvestmentMatured(userId: string, investment: any): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets && userSockets.size > 0) {
      for (const socketId of userSockets) {
        this.io.to(socketId).emit('investment-matured', investment);
      }
      logger.info(`Investment maturity notification sent to user ${userId}`);
    }
  }

  /**
   * Broadcast withdrawal approval notification
   */
  broadcastWithdrawalApproved(userId: string, withdrawal: any): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets && userSockets.size > 0) {
      for (const socketId of userSockets) {
        this.io.to(socketId).emit('withdrawal-approved', withdrawal);
      }
      logger.info(`Withdrawal approval notification sent to user ${userId}`);
    }
  }

  /**
   * Send notification to specific user
   */
  sendNotification(userId: string, notification: any): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets && userSockets.size > 0) {
      for (const socketId of userSockets) {
        this.io.to(socketId).emit('notification', notification);
      }
      logger.info(`Notification sent to user ${userId}`);
    }
  }

  /**
   * Send notification to all connected users
   */
  broadcastNotification(notification: any): void {
    this.io.emit('notification', notification);
    logger.info('Notification broadcasted to all users');
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get total connections count
   */
  getTotalConnectionsCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}
