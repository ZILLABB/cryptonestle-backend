import { Response } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { parsePaginationParams, generatePaginationMeta } from '../utils/helpers';

export class AdminController {
  // Get admin dashboard data
  getDashboard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get overall statistics
    const [
      totalUsers,
      totalInvestments,
      totalWithdrawals,
      totalTransactions,
      activeInvestments,
      pendingWithdrawals,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.investment.count(),
      prisma.withdrawal.count(),
      prisma.transaction.count(),
      prisma.investment.count({ where: { status: 'ACTIVE' } }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    ]);

    // Get recent activities
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    const recentInvestments = await prisma.investment.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        plan: {
          select: {
            name: true,
          },
        },
      },
    });

    res.json({
      status: 'success',
      data: {
        stats: {
          totalUsers,
          totalInvestments,
          totalWithdrawals,
          totalTransactions,
          activeInvestments,
          pendingWithdrawals,
        },
        recentUsers,
        recentInvestments,
      },
    });
  });

  // Get all users
  getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, skip } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const { status, role } = req.query;

    // Build where clause
    const where: any = {};
    if (status) where.status = status;
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          walletAddress: true,
          role: true,
          status: true,
          isEmailVerified: true,
          isKycVerified: true,
          totalInvested: true,
          totalEarnings: true,
          totalWithdrawn: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const meta = generatePaginationMeta(page, limit, total);

    res.json({
      status: 'success',
      data: { users },
      meta,
    });
  });

  // Get single user
  getUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        walletAddress: true,
        role: true,
        status: true,
        isEmailVerified: true,
        isKycVerified: true,
        isTwoFactorEnabled: true,
        referralCode: true,
        totalInvested: true,
        totalEarnings: true,
        totalWithdrawn: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    // Get user's investments, transactions, and withdrawals
    const [investments, transactions, withdrawals] = await Promise.all([
      prisma.investment.findMany({
        where: { userId: id },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.transaction.findMany({
        where: { userId: id },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.withdrawal.findMany({
        where: { userId: id },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      status: 'success',
      data: {
        user,
        investments,
        transactions,
        withdrawals,
      },
    });
  });

  // Update user status
  updateUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    res.json({
      status: 'success',
      message: 'User status updated successfully',
      data: { user },
    });
  });

  // Get investment plans
  getInvestmentPlans = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, skip } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const [plans, total] = await Promise.all([
      prisma.investmentPlan.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.investmentPlan.count(),
    ]);

    const meta = generatePaginationMeta(page, limit, total);

    res.json({
      status: 'success',
      data: { plans },
      meta,
    });
  });

  // Create investment plan
  createInvestmentPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, description, durationDays, returnPercentage, minAmount, maxAmount } = req.body;

    const plan = await prisma.investmentPlan.create({
      data: {
        name,
        description,
        durationDays: parseInt(durationDays),
        returnPercentage: parseFloat(returnPercentage),
        minAmount: parseFloat(minAmount),
        maxAmount: parseFloat(maxAmount),
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Investment plan created successfully',
      data: { plan },
    });
  });

  // Update investment plan
  updateInvestmentPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { name, description, durationDays, returnPercentage, minAmount, maxAmount, isActive } = req.body;

    const plan = await prisma.investmentPlan.update({
      where: { id },
      data: {
        name,
        description,
        durationDays: parseInt(durationDays),
        returnPercentage: parseFloat(returnPercentage),
        minAmount: parseFloat(minAmount),
        maxAmount: parseFloat(maxAmount),
        isActive,
      },
    });

    res.json({
      status: 'success',
      message: 'Investment plan updated successfully',
      data: { plan },
    });
  });

  // Delete investment plan
  deleteInvestmentPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    // Check if plan has active investments
    const activeInvestments = await prisma.investment.count({
      where: {
        planId: id,
        status: 'ACTIVE',
      },
    });

    if (activeInvestments > 0) {
      throw new CustomError('Cannot delete plan with active investments', 400);
    }

    await prisma.investmentPlan.delete({
      where: { id },
    });

    res.json({
      status: 'success',
      message: 'Investment plan deleted successfully',
    });
  });

  // Get all investments
  getInvestments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, skip } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const { status } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const [investments, total] = await Promise.all([
      prisma.investment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          plan: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.investment.count({ where }),
    ]);

    const meta = generatePaginationMeta(page, limit, total);

    res.json({
      status: 'success',
      data: { investments },
      meta,
    });
  });

  // Update investment status
  updateInvestmentStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const investment = await prisma.investment.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        plan: {
          select: {
            name: true,
          },
        },
      },
    });

    res.json({
      status: 'success',
      message: 'Investment status updated successfully',
      data: { investment },
    });
  });

  // Get all withdrawals
  getWithdrawals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, skip } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const { status } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.withdrawal.count({ where }),
    ]);

    const meta = generatePaginationMeta(page, limit, total);

    res.json({
      status: 'success',
      data: { withdrawals },
      meta,
    });
  });

  // Update withdrawal status
  updateWithdrawalStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status, adminNotes, transactionHash } = req.body;

    const updateData: any = { status, adminNotes };
    if (status === 'COMPLETED') {
      updateData.processedAt = new Date();
      updateData.transactionHash = transactionHash;
    }

    const withdrawal = await prisma.withdrawal.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    res.json({
      status: 'success',
      message: 'Withdrawal status updated successfully',
      data: { withdrawal },
    });
  });

  // Get all transactions
  getTransactions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, skip } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const { type, status } = req.query;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    const meta = generatePaginationMeta(page, limit, total);

    res.json({
      status: 'success',
      data: { transactions },
      meta,
    });
  });

  // Get system settings
  getSystemSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const settings = await prisma.systemSettings.findMany({
      orderBy: { key: 'asc' },
    });

    res.json({
      status: 'success',
      data: { settings },
    });
  });

  // Update system settings
  updateSystemSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { settings } = req.body;

    // Update each setting
    const updatePromises = settings.map((setting: any) =>
      prisma.systemSettings.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: {
          key: setting.key,
          value: setting.value,
          description: setting.description,
        },
      })
    );

    await Promise.all(updatePromises);

    res.json({
      status: 'success',
      message: 'System settings updated successfully',
    });
  });
}
