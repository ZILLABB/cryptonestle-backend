import { Response } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { parsePaginationParams, generatePaginationMeta } from '../utils/helpers';

export class UserController {
  // Get user profile
  getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        walletAddress: true,
        isEmailVerified: true,
        isKycVerified: true,
        isTwoFactorEnabled: true,
        referralCode: true,
        totalInvested: true,
        totalEarnings: true,
        totalWithdrawn: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    res.json({
      status: 'success',
      data: { user },
    });
  });

  // Update user profile
  updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { firstName, lastName, phoneNumber } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        phoneNumber,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        walletAddress: true,
        isEmailVerified: true,
        isKycVerified: true,
        isTwoFactorEnabled: true,
        referralCode: true,
        totalInvested: true,
        totalEarnings: true,
        totalWithdrawn: true,
        createdAt: true,
      },
    });

    res.json({
      status: 'success',
      message: 'Profile updated successfully',
      data: { user },
    });
  });

  // Get user dashboard data
  getDashboard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    // Get user stats
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalInvested: true,
        totalEarnings: true,
        totalWithdrawn: true,
      },
    });

    // Get active investments count
    const activeInvestments = await prisma.investment.count({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    // Get recent investments
    const recentInvestments = await prisma.investment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        plan: {
          select: {
            name: true,
            returnPercentage: true,
            durationDays: true,
          },
        },
      },
    });

    // Get recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    res.json({
      status: 'success',
      data: {
        stats: {
          totalInvested: user?.totalInvested || 0,
          totalEarnings: user?.totalEarnings || 0,
          totalWithdrawn: user?.totalWithdrawn || 0,
          activeInvestments,
        },
        recentInvestments,
        recentTransactions,
      },
    });
  });

  // Get user investments
  getUserInvestments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { page, limit, skip } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const [investments, total] = await Promise.all([
      prisma.investment.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: {
            select: {
              name: true,
              returnPercentage: true,
              durationDays: true,
            },
          },
        },
      }),
      prisma.investment.count({
        where: { userId },
      }),
    ]);

    const meta = generatePaginationMeta(page, limit, total);

    res.json({
      status: 'success',
      data: { investments },
      meta,
    });
  });

  // Get user transactions
  getUserTransactions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { page, limit, skip } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({
        where: { userId },
      }),
    ]);

    const meta = generatePaginationMeta(page, limit, total);

    res.json({
      status: 'success',
      data: { transactions },
      meta,
    });
  });

  // Get user withdrawals
  getUserWithdrawals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { page, limit, skip } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.withdrawal.count({
        where: { userId },
      }),
    ]);

    const meta = generatePaginationMeta(page, limit, total);

    res.json({
      status: 'success',
      data: { withdrawals },
      meta,
    });
  });

  // Get user notifications
  getNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { page, limit, skip } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({
        where: { userId },
      }),
    ]);

    const meta = generatePaginationMeta(page, limit, total);

    res.json({
      status: 'success',
      data: { notifications },
      meta,
    });
  });

  // Mark notification as read
  markNotificationAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!notification) {
      throw new CustomError('Notification not found', 404);
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({
      status: 'success',
      message: 'Notification marked as read',
    });
  });
}
