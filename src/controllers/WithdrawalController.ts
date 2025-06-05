import { Response } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { parsePaginationParams, generatePaginationMeta } from '../utils/helpers';

export class WithdrawalController {
  // Create withdrawal request
  createWithdrawal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { amount, walletAddress, currency = 'ETH' } = req.body;

    // Get user's available balance (this would need to be calculated based on completed investments)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalEarnings: true,
        totalWithdrawn: true,
      },
    });

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    const availableBalance = parseFloat(user.totalEarnings.toString()) - parseFloat(user.totalWithdrawn.toString());
    const withdrawalAmount = parseFloat(amount);

    if (withdrawalAmount > availableBalance) {
      throw new CustomError('Insufficient balance for withdrawal', 400);
    }

    if (withdrawalAmount <= 0) {
      throw new CustomError('Withdrawal amount must be greater than 0', 400);
    }

    // Create withdrawal request
    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId,
        amount: withdrawalAmount,
        currency,
        walletAddress,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Withdrawal request created successfully',
      data: { withdrawal },
    });
  });

  // Get user withdrawals
  getUserWithdrawals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { page, limit, skip } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const { status } = req.query;

    // Build where clause
    const where: any = { userId };
    if (status) where.status = status;

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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

  // Get single withdrawal
  getWithdrawal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const withdrawal = await prisma.withdrawal.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!withdrawal) {
      throw new CustomError('Withdrawal not found', 404);
    }

    res.json({
      status: 'success',
      data: { withdrawal },
    });
  });
}
