import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { prisma } from '../index';

export interface TransactionDetails {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
  confirmations?: number;
  status?: number;
}

export class BlockchainService {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private wallets: Map<string, ethers.Wallet> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // Ethereum
    if (process.env.ETH_RPC_URL) {
      const ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
      this.providers.set('ethereum', ethProvider);
      
      if (process.env.ETH_PRIVATE_KEY) {
        const ethWallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, ethProvider);
        this.wallets.set('ethereum', ethWallet);
      }
    }

    // BSC
    if (process.env.BSC_RPC_URL) {
      const bscProvider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
      this.providers.set('bsc', bscProvider);
      
      if (process.env.BSC_PRIVATE_KEY) {
        const bscWallet = new ethers.Wallet(process.env.BSC_PRIVATE_KEY, bscProvider);
        this.wallets.set('bsc', bscWallet);
      }
    }

    // Polygon
    if (process.env.POLYGON_RPC_URL) {
      const polygonProvider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
      this.providers.set('polygon', polygonProvider);
      
      if (process.env.POLYGON_PRIVATE_KEY) {
        const polygonWallet = new ethers.Wallet(process.env.POLYGON_PRIVATE_KEY, polygonProvider);
        this.wallets.set('polygon', polygonWallet);
      }
    }
  }

  /**
   * Get provider for a specific network
   */
  getProvider(network: string): ethers.JsonRpcProvider | null {
    return this.providers.get(network.toLowerCase()) || null;
  }

  /**
   * Get wallet for a specific network
   */
  getWallet(network: string): ethers.Wallet | null {
    return this.wallets.get(network.toLowerCase()) || null;
  }

  /**
   * Verify transaction on blockchain
   */
  async verifyTransaction(
    transactionHash: string,
    network: string = 'ethereum'
  ): Promise<TransactionDetails | null> {
    try {
      const provider = this.getProvider(network);
      if (!provider) {
        throw new Error(`Provider not found for network: ${network}`);
      }

      const tx = await provider.getTransaction(transactionHash);
      if (!tx) {
        return null;
      }

      const receipt = await provider.getTransactionReceipt(transactionHash);
      
      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: ethers.formatEther(tx.value),
        gasUsed: receipt?.gasUsed.toString(),
        gasPrice: tx.gasPrice?.toString(),
        blockNumber: tx.blockNumber || undefined,
        confirmations: await tx.confirmations(),
        status: receipt?.status || undefined,
      };
    } catch (error) {
      logger.error(`Error verifying transaction ${transactionHash}:`, error);
      return null;
    }
  }

  /**
   * Check if transaction is confirmed
   */
  async isTransactionConfirmed(
    transactionHash: string,
    network: string = 'ethereum',
    requiredConfirmations: number = 6
  ): Promise<boolean> {
    try {
      const provider = this.getProvider(network);
      if (!provider) {
        return false;
      }

      const tx = await provider.getTransaction(transactionHash);
      if (!tx) {
        return false;
      }

      const confirmations = await tx.confirmations();
      return confirmations >= requiredConfirmations;
    } catch (error) {
      logger.error(`Error checking transaction confirmations:`, error);
      return false;
    }
  }

  /**
   * Send cryptocurrency to an address
   */
  async sendTransaction(
    toAddress: string,
    amount: string,
    network: string = 'ethereum'
  ): Promise<string | null> {
    try {
      const wallet = this.getWallet(network);
      if (!wallet) {
        throw new Error(`Wallet not found for network: ${network}`);
      }

      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amount),
      });

      logger.info(`Transaction sent: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      logger.error(`Error sending transaction:`, error);
      return null;
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(
    address: string,
    network: string = 'ethereum'
  ): Promise<string | null> {
    try {
      const provider = this.getProvider(network);
      if (!provider) {
        return null;
      }

      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error(`Error getting wallet balance:`, error);
      return null;
    }
  }

  /**
   * Monitor pending transactions
   */
  async monitorPendingTransactions(): Promise<void> {
    try {
      // Get all pending transactions
      const pendingTransactions = await prisma.transaction.findMany({
        where: {
          status: 'PENDING',
          transactionHash: {
            not: null,
          },
        },
      });

      for (const transaction of pendingTransactions) {
        if (!transaction.transactionHash) continue;

        const network = transaction.blockchainNetwork || 'ethereum';
        const isConfirmed = await this.isTransactionConfirmed(
          transaction.transactionHash,
          network
        );

        if (isConfirmed) {
          // Update transaction status
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'CONFIRMED' },
          });

          // If it's an investment transaction, activate the investment
          if (transaction.type === 'INVESTMENT' && transaction.investmentId) {
            await this.activateInvestment(transaction.investmentId);
          }

          logger.info(`Transaction confirmed: ${transaction.transactionHash}`);
        }
      }
    } catch (error) {
      logger.error('Error monitoring pending transactions:', error);
    }
  }

  /**
   * Activate investment after transaction confirmation
   */
  private async activateInvestment(investmentId: string): Promise<void> {
    try {
      const investment = await prisma.investment.findUnique({
        where: { id: investmentId },
        include: { plan: true },
      });

      if (!investment || !investment.plan) {
        return;
      }

      const startDate = new Date();
      const maturityDate = new Date();
      maturityDate.setDate(startDate.getDate() + investment.plan.durationDays);

      await prisma.investment.update({
        where: { id: investmentId },
        data: {
          status: 'ACTIVE',
          startDate,
          maturityDate,
        },
      });

      // Update user's total invested amount
      await prisma.user.update({
        where: { id: investment.userId },
        data: {
          totalInvested: {
            increment: investment.amount,
          },
        },
      });

      logger.info(`Investment activated: ${investmentId}`);
    } catch (error) {
      logger.error(`Error activating investment ${investmentId}:`, error);
    }
  }

  /**
   * Process matured investments
   */
  async processMaturedInvestments(): Promise<void> {
    try {
      const maturedInvestments = await prisma.investment.findMany({
        where: {
          status: 'ACTIVE',
          maturityDate: {
            lte: new Date(),
          },
        },
        include: {
          user: true,
          plan: true,
        },
      });

      for (const investment of maturedInvestments) {
        // Calculate actual return
        const actualReturn = parseFloat(investment.expectedReturn.toString());

        // Update investment status
        await prisma.investment.update({
          where: { id: investment.id },
          data: {
            status: 'COMPLETED',
            actualReturn,
          },
        });

        // Update user's total earnings
        await prisma.user.update({
          where: { id: investment.userId },
          data: {
            totalEarnings: {
              increment: actualReturn,
            },
          },
        });

        // Create return transaction
        await prisma.transaction.create({
          data: {
            userId: investment.userId,
            investmentId: investment.id,
            type: 'RETURN',
            amount: actualReturn,
            currency: investment.currency,
            status: 'CONFIRMED',
            description: `Investment return for ${investment.plan.name}`,
          },
        });

        logger.info(`Investment matured: ${investment.id}`);
      }
    } catch (error) {
      logger.error('Error processing matured investments:', error);
    }
  }

  /**
   * Validate Ethereum address
   */
  isValidAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Generate new wallet
   */
  generateWallet(): { address: string; privateKey: string; mnemonic: string } {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase || '',
    };
  }

  /**
   * Get current gas price
   */
  async getCurrentGasPrice(network: string = 'ethereum'): Promise<string | null> {
    try {
      const provider = this.getProvider(network);
      if (!provider) {
        return null;
      }

      const feeData = await provider.getFeeData();
      return feeData.gasPrice?.toString() || null;
    } catch (error) {
      logger.error('Error getting gas price:', error);
      return null;
    }
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(
    toAddress: string,
    amount: string,
    network: string = 'ethereum'
  ): Promise<string | null> {
    try {
      const provider = this.getProvider(network);
      if (!provider) {
        return null;
      }

      const gasEstimate = await provider.estimateGas({
        to: toAddress,
        value: ethers.parseEther(amount),
      });

      return gasEstimate.toString();
    } catch (error) {
      logger.error('Error estimating gas:', error);
      return null;
    }
  }
}
