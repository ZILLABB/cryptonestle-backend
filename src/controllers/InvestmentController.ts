import { Response } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { parsePaginationParams, generatePaginationMeta, calculateInvestmentReturn, calculateMaturityDate } from '../utils/helpers';

export class InvestmentController {
  // Get investment plans (public)
  getInvestmentPlans = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, skip } = parsePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const [plans, total] = await Promise.all([
      prisma.investmentPlan.findMany({
        where: { isActive: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.investmentPlan.count({
        where: { isActive: true },
      }),
    ]);

    const meta = generatePaginationMeta(page, limit, total);

    res.json({
      status: 'success',
      data: { plans },
      meta,
    });
  });

  // Get single investment plan
  getInvestmentPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const plan = await prisma.investmentPlan.findFirst({
      where: {
        id,
        isActive: true,
      },
    });

    if (!plan) {
      throw new CustomError('Investment plan not found', 404);
    }

    res.json({
      status: 'success',
      data: { plan },
    });
  });

  // Create investment
  createInvestment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { planId, amount, currency = 'ETH', transactionHash } = req.body;

    // Get investment plan
    const plan = await prisma.investmentPlan.findFirst({
      where: {
        id: planId,
        isActive: true,
      },
    });

    if (!plan) {
      throw new CustomError('Investment plan not found', 404);
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (amountNum < parseFloat(plan.minAmount.toString()) || amountNum > parseFloat(plan.maxAmount.toString())) {
      throw new CustomError(`Investment amount must be between ${plan.minAmount} and ${plan.maxAmount} ${currency}`, 400);
    }

    // Calculate expected return
    const expectedReturn = calculateInvestmentReturn(amountNum, parseFloat(plan.returnPercentage.toString()));

    // Create investment
    const investment = await prisma.investment.create({
      data: {
        userId,
        planId,
        amount: amountNum,
        currency,
        expectedReturn,
        transactionHash,
        status: transactionHash ? 'PENDING' : 'PENDING', // Will be updated when transaction is confirmed
      },
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

    res.status(201).json({
      status: 'success',
      message: 'Investment created successfully',
      data: { investment },
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

  // Get single investment
  getInvestment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const investment = await prisma.investment.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        plan: {
          select: {
            name: true,
            description: true,
            returnPercentage: true,
            durationDays: true,
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!investment) {
      throw new CustomError('Investment not found', 404);
    }

    res.json({
      status: 'success',
      data: { investment },
    });
  });
}
