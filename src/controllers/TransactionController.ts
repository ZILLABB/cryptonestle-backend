import { Response } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { parsePaginationParams, generatePaginationMeta } from '../utils/helpers';

export class TransactionController {
  // Get user transactions
  getUserTransactions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { page, limit, skip } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const { type, status } = req.query;

    // Build where clause
    const where: any = { userId };
    if (type) where.type = type;
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          investment: {
            select: {
              id: true,
              plan: {
                select: {
                  name: true,
                },
              },
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

  // Get single transaction
  getTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        investment: {
          select: {
            id: true,
            amount: true,
            plan: {
              select: {
                name: true,
                returnPercentage: true,
                durationDays: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      throw new CustomError('Transaction not found', 404);
    }

    res.json({
      status: 'success',
      data: { transaction },
    });
  });
}
