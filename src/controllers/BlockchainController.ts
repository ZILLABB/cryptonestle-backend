import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { SmartContractService } from '../services/SmartContractService';
import { logger } from '../utils/logger';

export class BlockchainController {
  private smartContractService: SmartContractService;

  constructor() {
    this.smartContractService = new SmartContractService();
  }

  /**
   * Connect wallet and validate signature
   */
  connectWallet = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { walletAddress, signature, message } = req.body;
    const userId = req.user!.id;

    if (!walletAddress || !signature || !message) {
      throw new CustomError('Wallet address, signature, and message are required', 400);
    }

    // Validate wallet signature
    const isValidSignature = await this.smartContractService.validateWalletSignature(
      walletAddress,
      signature,
      message
    );

    if (!isValidSignature) {
      throw new CustomError('Invalid wallet signature', 400);
    }

    // Update user's wallet address in database
    const { prisma } = await import('../index');
    await prisma.user.update({
      where: { id: userId },
      data: { walletAddress: walletAddress.toLowerCase() },
    });

    // Get wallet balance
    const balance = await this.smartContractService.getWalletBalance(walletAddress);

    res.json({
      status: 'success',
      message: 'Wallet connected successfully',
      data: {
        walletAddress: walletAddress.toLowerCase(),
        balance,
        isConnected: true,
      },
    });
  });

  /**
   * Execute investment transaction
   */
  executeInvestment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { planId, amount, network = 'ethereum' } = req.body;
    const userId = req.user!.id;

    if (!planId || !amount) {
      throw new CustomError('Plan ID and amount are required', 400);
    }

    // Validate amount
    const investmentAmount = parseFloat(amount);
    if (investmentAmount <= 0) {
      throw new CustomError('Investment amount must be greater than 0', 400);
    }

    // Execute investment on smart contract
    const result = await this.smartContractService.executeInvestment(
      userId,
      parseInt(planId),
      amount,
      network
    );

    if (!result.success) {
      throw new CustomError(result.error || 'Investment execution failed', 400);
    }

    res.json({
      status: 'success',
      message: 'Investment transaction initiated successfully',
      data: {
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed,
        gasPrice: result.gasPrice,
        amount: investmentAmount,
        planId: parseInt(planId),
        network,
      },
    });
  });

  /**
   * Execute withdrawal transaction
   */
  executeWithdrawal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { investmentId, network = 'ethereum' } = req.body;
    const userId = req.user!.id;

    if (!investmentId) {
      throw new CustomError('Investment ID is required', 400);
    }

    // Execute withdrawal on smart contract
    const result = await this.smartContractService.executeWithdrawal(
      userId,
      parseInt(investmentId),
      network
    );

    if (!result.success) {
      throw new CustomError(result.error || 'Withdrawal execution failed', 400);
    }

    res.json({
      status: 'success',
      message: 'Withdrawal transaction initiated successfully',
      data: {
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed,
        gasPrice: result.gasPrice,
        investmentId: parseInt(investmentId),
        network,
      },
    });
  });

  /**
   * Get transaction status
   */
  getTransactionStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { hash } = req.params;
    const { network = 'ethereum' } = req.query;

    if (!hash) {
      throw new CustomError('Transaction hash is required', 400);
    }

    const status = await this.smartContractService.getTransactionStatus(
      hash,
      network as string
    );

    if (!status) {
      throw new CustomError('Transaction not found', 404);
    }

    res.json({
      status: 'success',
      data: status,
    });
  });

  /**
   * Estimate gas for transaction
   */
  estimateGas = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { method, params, value, network = 'ethereum' } = req.body;

    if (!method || !params) {
      throw new CustomError('Method and parameters are required', 400);
    }

    const gasEstimate = await this.smartContractService.getGasEstimate(
      method,
      params,
      value,
      network
    );

    if (!gasEstimate) {
      throw new CustomError('Gas estimation failed', 400);
    }

    res.json({
      status: 'success',
      data: gasEstimate,
    });
  });

  /**
   * Get wallet balance
   */
  getWalletBalance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { address } = req.params;
    const { network = 'ethereum' } = req.query;

    if (!address) {
      throw new CustomError('Wallet address is required', 400);
    }

    const balance = await this.smartContractService.getWalletBalance(
      address,
      network as string
    );

    if (!balance) {
      throw new CustomError('Failed to get wallet balance', 400);
    }

    res.json({
      status: 'success',
      data: balance,
    });
  });

  /**
   * Get investment details from smart contract
   */
  getInvestmentDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { investmentId } = req.params;
    const { network = 'ethereum' } = req.query;

    if (!investmentId) {
      throw new CustomError('Investment ID is required', 400);
    }

    const investment = await this.smartContractService.getInvestmentDetails(
      parseInt(investmentId),
      network as string
    );

    if (!investment) {
      throw new CustomError('Investment not found', 404);
    }

    res.json({
      status: 'success',
      data: investment,
    });
  });

  /**
   * Get user investments from smart contract
   */
  getUserInvestments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { network = 'ethereum' } = req.query;

    // Get user's wallet address
    const { prisma } = await import('../index');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    if (!user?.walletAddress) {
      throw new CustomError('User wallet address not found', 400);
    }

    const investmentIds = await this.smartContractService.getUserInvestments(
      user.walletAddress,
      network as string
    );

    // Get detailed information for each investment
    const investments = await Promise.all(
      investmentIds.map(async (id) => {
        return await this.smartContractService.getInvestmentDetails(id, network as string);
      })
    );

    res.json({
      status: 'success',
      data: {
        investmentIds,
        investments: investments.filter(Boolean),
      },
    });
  });

  /**
   * Get contract statistics
   */
  getContractStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { network = 'ethereum' } = req.query;

    const stats = await this.smartContractService.getContractStats(network as string);

    if (!stats) {
      throw new CustomError('Failed to get contract statistics', 400);
    }

    res.json({
      status: 'success',
      data: stats,
    });
  });
}
