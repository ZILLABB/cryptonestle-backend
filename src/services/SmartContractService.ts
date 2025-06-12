import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { prisma } from '../index';

// Contract ABIs (simplified - in production, import from artifacts)
const INVESTMENT_CONTRACT_ABI = [
  "function invest(uint256 planId) external payable",
  "function withdraw(uint256 investmentId) external",
  "function emergencyWithdraw(uint256 investmentId) external",
  "function getInvestment(uint256 investmentId) external view returns (tuple(uint256 id, address investor, uint256 planId, uint256 amount, uint256 expectedReturn, uint256 startTime, uint256 maturityTime, bool isWithdrawn, bool isActive))",
  "function getUserInvestments(address user) external view returns (uint256[])",
  "function isInvestmentMatured(uint256 investmentId) external view returns (bool)",
  "function getContractStats() external view returns (uint256 totalInvestments, uint256 totalWithdrawals, uint256 totalPlatformFees, uint256 contractBalance)",
  "event InvestmentCreated(uint256 indexed investmentId, address indexed investor, uint256 planId, uint256 amount)",
  "event InvestmentWithdrawn(uint256 indexed investmentId, address indexed investor, uint256 amount, uint256 profit)"
];

const TOKEN_CONTRACT_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function mint(address to, uint256 amount) external",
  "function burn(uint256 amount) external"
];

// Multi-token contract ABI
const MULTITOKEN_CONTRACT_ABI = [
  "function investETH(uint256 _planId) external payable",
  "function investToken(uint256 _planId, address _tokenAddress, uint256 _amount) external",
  "function withdrawMultiTokenInvestment(uint256 _investmentId) external",
  "function getMultiTokenInvestment(uint256 _investmentId) external view returns (tuple(uint256 id, address investor, uint256 planId, address tokenAddress, uint256 amount, uint256 expectedReturn, uint256 startTime, uint256 maturityTime, bool isWithdrawn, bool isActive))",
  "function getUserMultiTokenInvestments(address _investor) external view returns (uint256[])"
];

export interface SmartContractInvestment {
  id: number;
  investor: string;
  planId: number;
  amount: string;
  expectedReturn: string;
  startTime: number;
  maturityTime: number;
  isWithdrawn: boolean;
  isActive: boolean;
}

export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: string;
  gasPrice?: string;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  estimatedCost: string;
  estimatedCostUSD?: string;
}

export interface WalletBalance {
  eth: string;
  token: string;
  usd?: string;
}

export interface TransactionStatus {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
}

export class SmartContractService {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private signers: Map<string, ethers.Wallet> = new Map();
  private contracts: Map<string, ethers.Contract> = new Map();

  constructor() {
    this.initializeProviders();
    this.initializeContracts();
  }

  private initializeProviders() {
    // Initialize providers for different networks
    const networks = [
      { name: 'ethereum', rpc: process.env.ETH_RPC_URL, privateKey: process.env.ETH_PRIVATE_KEY },
      { name: 'bsc', rpc: process.env.BSC_RPC_URL, privateKey: process.env.BSC_PRIVATE_KEY },
      { name: 'polygon', rpc: process.env.POLYGON_RPC_URL, privateKey: process.env.POLYGON_PRIVATE_KEY },
    ];

    for (const network of networks) {
      if (network.rpc) {
        try {
          const provider = new ethers.JsonRpcProvider(network.rpc);
          this.providers.set(network.name, provider);

          // Only create signer if private key is valid (not placeholder)
          if (network.privateKey &&
              network.privateKey.length === 66 &&
              network.privateKey.startsWith('0x') &&
              !network.privateKey.includes('your-')) {
            const signer = new ethers.Wallet(network.privateKey, provider);
            this.signers.set(network.name, signer);
            logger.info(`Initialized ${network.name} network with signer`);
          } else {
            logger.info(`Initialized ${network.name} network without signer (invalid/placeholder private key)`);
          }
        } catch (error) {
          logger.error(`Failed to initialize ${network.name} network:`, error);
        }
      }
    }
  }

  private initializeContracts() {
    // Initialize contract instances
    const contractAddresses = {
      investment: process.env.INVESTMENT_CONTRACT_ADDRESS,
      token: process.env.CNEST_TOKEN_ADDRESS,
      multiToken: process.env.MULTITOKEN_CONTRACT_ADDRESS,
    };

    for (const [network, signer] of this.signers.entries()) {
      if (contractAddresses.investment) {
        const investmentContract = new ethers.Contract(
          contractAddresses.investment,
          INVESTMENT_CONTRACT_ABI,
          signer
        );
        this.contracts.set(`${network}-investment`, investmentContract);
      }

      if (contractAddresses.token) {
        const tokenContract = new ethers.Contract(
          contractAddresses.token,
          TOKEN_CONTRACT_ABI,
          signer
        );
        this.contracts.set(`${network}-token`, tokenContract);
      }
    }
  }

  /**
   * Create investment on smart contract
   */
  async createInvestment(
    userAddress: string,
    planId: number,
    amount: string,
    network: string = 'ethereum'
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      const contract = this.contracts.get(`${network}-investment`);
      if (!contract) {
        throw new Error(`Investment contract not found for network: ${network}`);
      }

      // Convert amount to wei
      const amountWei = ethers.parseEther(amount);

      // Create investment transaction
      const tx = await contract.invest(planId, { value: amountWei });
      
      logger.info(`Investment transaction sent: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        logger.info(`Investment confirmed: ${tx.hash}`);
        return { success: true, transactionHash: tx.hash };
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      logger.error('Error creating investment on smart contract:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Withdraw investment from smart contract
   */
  async withdrawInvestment(
    investmentId: number,
    network: string = 'ethereum'
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      const contract = this.contracts.get(`${network}-investment`);
      if (!contract) {
        throw new Error(`Investment contract not found for network: ${network}`);
      }

      // Check if investment is matured
      const isMatured = await contract.isInvestmentMatured(investmentId);
      if (!isMatured) {
        throw new Error('Investment not yet matured');
      }

      // Withdraw investment
      const tx = await contract.withdraw(investmentId);
      
      logger.info(`Withdrawal transaction sent: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        logger.info(`Withdrawal confirmed: ${tx.hash}`);
        return { success: true, transactionHash: tx.hash };
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      logger.error('Error withdrawing investment from smart contract:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get investment details from smart contract
   */
  async getInvestmentDetails(
    investmentId: number,
    network: string = 'ethereum'
  ): Promise<SmartContractInvestment | null> {
    try {
      const contract = this.contracts.get(`${network}-investment`);
      if (!contract) {
        throw new Error(`Investment contract not found for network: ${network}`);
      }

      const investment = await contract.getInvestment(investmentId);
      
      return {
        id: Number(investment.id),
        investor: investment.investor,
        planId: Number(investment.planId),
        amount: ethers.formatEther(investment.amount),
        expectedReturn: ethers.formatEther(investment.expectedReturn),
        startTime: Number(investment.startTime),
        maturityTime: Number(investment.maturityTime),
        isWithdrawn: investment.isWithdrawn,
        isActive: investment.isActive,
      };
    } catch (error) {
      logger.error('Error getting investment details from smart contract:', error);
      return null;
    }
  }

  /**
   * Get user investments from smart contract
   */
  async getUserInvestments(
    userAddress: string,
    network: string = 'ethereum'
  ): Promise<number[]> {
    try {
      const contract = this.contracts.get(`${network}-investment`);
      if (!contract) {
        throw new Error(`Investment contract not found for network: ${network}`);
      }

      const investmentIds = await contract.getUserInvestments(userAddress);
      return investmentIds.map((id: bigint) => Number(id));
    } catch (error) {
      logger.error('Error getting user investments from smart contract:', error);
      return [];
    }
  }

  /**
   * Check if investment is matured
   */
  async isInvestmentMatured(
    investmentId: number,
    network: string = 'ethereum'
  ): Promise<boolean> {
    try {
      const contract = this.contracts.get(`${network}-investment`);
      if (!contract) {
        return false;
      }

      return await contract.isInvestmentMatured(investmentId);
    } catch (error) {
      logger.error('Error checking investment maturity:', error);
      return false;
    }
  }

  /**
   * Get contract statistics
   */
  async getContractStats(network: string = 'ethereum'): Promise<{
    totalInvestments: string;
    totalWithdrawals: string;
    totalPlatformFees: string;
    contractBalance: string;
  } | null> {
    try {
      const contract = this.contracts.get(`${network}-investment`);
      if (!contract) {
        return null;
      }

      const stats = await contract.getContractStats();
      
      return {
        totalInvestments: ethers.formatEther(stats.totalInvestments),
        totalWithdrawals: ethers.formatEther(stats.totalWithdrawals),
        totalPlatformFees: ethers.formatEther(stats.totalPlatformFees),
        contractBalance: ethers.formatEther(stats.contractBalance),
      };
    } catch (error) {
      logger.error('Error getting contract statistics:', error);
      return null;
    }
  }

  /**
   * Monitor investment events
   */
  async monitorInvestmentEvents(network: string = 'ethereum'): Promise<void> {
    try {
      const contract = this.contracts.get(`${network}-investment`);
      if (!contract) {
        return;
      }

      // Listen for InvestmentCreated events
      contract.on('InvestmentCreated', async (investmentId, investor, planId, amount, event) => {
        logger.info(`New investment created: ID ${investmentId}, Investor: ${investor}`);
        
        // Update database
        await this.syncInvestmentWithDatabase(Number(investmentId), network);
      });

      // Listen for InvestmentWithdrawn events
      contract.on('InvestmentWithdrawn', async (investmentId, investor, amount, profit, event) => {
        logger.info(`Investment withdrawn: ID ${investmentId}, Amount: ${ethers.formatEther(amount)}`);
        
        // Update database
        await this.syncWithdrawalWithDatabase(Number(investmentId), network);
      });

      logger.info(`Started monitoring investment events on ${network}`);
    } catch (error) {
      logger.error('Error monitoring investment events:', error);
    }
  }

  /**
   * Sync investment with database
   */
  private async syncInvestmentWithDatabase(investmentId: number, network: string): Promise<void> {
    try {
      const investmentDetails = await this.getInvestmentDetails(investmentId, network);
      if (!investmentDetails) {
        return;
      }

      // Find user in database
      const user = await prisma.user.findUnique({
        where: { walletAddress: investmentDetails.investor },
      });

      if (!user) {
        logger.warn(`User not found for wallet address: ${investmentDetails.investor}`);
        return;
      }

      // Find existing investment by transaction hash or create new one
      const existingInvestment = await prisma.investment.findFirst({
        where: {
          transactionHash: `${network}-${investmentId}`
        }
      });

      if (existingInvestment) {
        // Update existing investment
        await prisma.investment.update({
          where: { id: existingInvestment.id },
          data: {
            status: investmentDetails.isActive ? 'ACTIVE' : 'COMPLETED',
            actualReturn: investmentDetails.isWithdrawn ? parseFloat(investmentDetails.expectedReturn) : null,
          }
        });
      } else {
        // Create new investment record
        await prisma.investment.create({
          data: {
            userId: user.id,
            planId: '', // This would need to be mapped from smart contract plan ID to database plan ID
            amount: parseFloat(investmentDetails.amount),
            currency: 'ETH',
            expectedReturn: parseFloat(investmentDetails.expectedReturn),
            status: investmentDetails.isActive ? 'ACTIVE' : 'COMPLETED',
            startDate: new Date(investmentDetails.startTime * 1000),
            maturityDate: new Date(investmentDetails.maturityTime * 1000),
            transactionHash: `${network}-${investmentId}`,
            blockchainNetwork: network,
          },
        });
      }

      logger.info(`Investment synced with database: ${investmentId}`);
    } catch (error) {
      logger.error('Error syncing investment with database:', error);
    }
  }

  /**
   * Sync withdrawal with database
   */
  private async syncWithdrawalWithDatabase(investmentId: number, network: string): Promise<void> {
    try {
      // Update investment status in database
      await prisma.investment.updateMany({
        where: { 
          transactionHash: `${network}-${investmentId}`
        },
        data: {
          status: 'COMPLETED',
        },
      });

      logger.info(`Withdrawal synced with database: ${investmentId}`);
    } catch (error) {
      logger.error('Error syncing withdrawal with database:', error);
    }
  }

  /**
   * Get token balance
   */
  async getTokenBalance(
    userAddress: string,
    network: string = 'ethereum'
  ): Promise<string | null> {
    try {
      const contract = this.contracts.get(`${network}-token`);
      if (!contract) {
        return null;
      }

      const balance = await contract.balanceOf(userAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Error getting token balance:', error);
      return null;
    }
  }

  /**
   * Start monitoring all networks
   */
  async startMonitoring(): Promise<void> {
    for (const network of this.signers.keys()) {
      await this.monitorInvestmentEvents(network);
    }
  }

  // ========================================
  // CRITICAL FRONTEND INTEGRATION METHODS
  // ========================================

  /**
   * Execute investment with enhanced error handling and gas estimation
   */
  async executeInvestment(
    userId: string,
    planId: number,
    amount: string,
    network: string = 'ethereum'
  ): Promise<TransactionResult> {
    try {
      const contract = this.contracts.get(`${network}-investment`);
      if (!contract) {
        return { success: false, error: `Investment contract not found for network: ${network}` };
      }

      // Get user wallet address from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { walletAddress: true }
      });

      if (!user?.walletAddress) {
        return { success: false, error: 'User wallet address not found' };
      }

      // Convert amount to wei
      const amountWei = ethers.parseEther(amount);

      // Estimate gas before execution
      const gasEstimate = await this.estimateGas('invest', [planId], amountWei, network);
      if (!gasEstimate.success) {
        return { success: false, error: `Gas estimation failed: ${gasEstimate.error}` };
      }

      // Execute investment transaction
      const tx = await contract.invest(planId, {
        value: amountWei,
        gasLimit: gasEstimate.gasLimit,
        gasPrice: gasEstimate.gasPrice
      });

      logger.info(`Investment transaction sent: ${tx.hash} for user: ${userId}`);

      // Create pending investment record in database
      await this.createPendingInvestment(userId, planId, amount, tx.hash, network);

      return {
        success: true,
        transactionHash: tx.hash,
        gasUsed: gasEstimate.gasLimit,
        gasPrice: gasEstimate.gasPrice
      };
    } catch (error) {
      logger.error('Error executing investment:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Execute withdrawal with enhanced error handling
   */
  async executeWithdrawal(
    userId: string,
    investmentId: number,
    network: string = 'ethereum'
  ): Promise<TransactionResult> {
    try {
      const contract = this.contracts.get(`${network}-investment`);
      if (!contract) {
        return { success: false, error: `Investment contract not found for network: ${network}` };
      }

      // Verify user owns this investment
      const investment = await prisma.investment.findFirst({
        where: {
          userId,
          transactionHash: `${network}-${investmentId}`
        }
      });

      if (!investment) {
        return { success: false, error: 'Investment not found or not owned by user' };
      }

      // Check if investment is matured
      const isMatured = await contract.isInvestmentMatured(investmentId);
      if (!isMatured) {
        return { success: false, error: 'Investment not yet matured' };
      }

      // Estimate gas
      const gasEstimate = await this.estimateGas('withdraw', [investmentId], undefined, network);
      if (!gasEstimate.success) {
        return { success: false, error: `Gas estimation failed: ${gasEstimate.error}` };
      }

      // Execute withdrawal
      const tx = await contract.withdraw(investmentId, {
        gasLimit: gasEstimate.gasLimit,
        gasPrice: gasEstimate.gasPrice
      });

      logger.info(`Withdrawal transaction sent: ${tx.hash} for investment: ${investmentId}`);

      return {
        success: true,
        transactionHash: tx.hash,
        gasUsed: gasEstimate.gasLimit,
        gasPrice: gasEstimate.gasPrice
      };
    } catch (error) {
      logger.error('Error executing withdrawal:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Estimate gas for contract method execution
   */
  async estimateGas(
    method: string,
    params: any[],
    value?: bigint,
    network: string = 'ethereum'
  ): Promise<{ success: boolean; gasLimit?: string; gasPrice?: string; error?: string }> {
    try {
      const contract = this.contracts.get(`${network}-investment`);
      const provider = this.providers.get(network);

      if (!contract || !provider) {
        return { success: false, error: `Contract or provider not found for network: ${network}` };
      }

      // Estimate gas limit
      const gasLimit = await contract[method].estimateGas(...params, value ? { value } : {});

      // Get current gas price
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');

      return {
        success: true,
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrice.toString()
      };
    } catch (error) {
      logger.error('Error estimating gas:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get detailed gas estimate with USD cost
   */
  async getGasEstimate(
    method: string,
    params: any[],
    value?: string,
    network: string = 'ethereum'
  ): Promise<GasEstimate | null> {
    try {
      const valueWei = value ? ethers.parseEther(value) : undefined;
      const estimate = await this.estimateGas(method, params, valueWei, network);

      if (!estimate.success || !estimate.gasLimit || !estimate.gasPrice) {
        return null;
      }

      const gasLimit = BigInt(estimate.gasLimit);
      const gasPrice = BigInt(estimate.gasPrice);
      const estimatedCost = gasLimit * gasPrice;

      return {
        gasLimit: estimate.gasLimit,
        gasPrice: estimate.gasPrice,
        estimatedCost: ethers.formatEther(estimatedCost)
      };
    } catch (error) {
      logger.error('Error getting gas estimate:', error);
      return null;
    }
  }

  /**
   * Monitor transaction status
   */
  async getTransactionStatus(
    txHash: string,
    network: string = 'ethereum'
  ): Promise<TransactionStatus | null> {
    try {
      const provider = this.providers.get(network);
      if (!provider) {
        return null;
      }

      const tx = await provider.getTransaction(txHash);
      if (!tx) {
        return null;
      }

      const receipt = await provider.getTransactionReceipt(txHash);
      const currentBlock = await provider.getBlockNumber();

      let status: 'pending' | 'confirmed' | 'failed' = 'pending';
      let confirmations = 0;

      if (receipt) {
        status = receipt.status === 1 ? 'confirmed' : 'failed';
        confirmations = currentBlock - receipt.blockNumber + 1;
      }

      return {
        hash: txHash,
        status,
        confirmations,
        blockNumber: receipt?.blockNumber,
        gasUsed: receipt?.gasUsed.toString(),
        gasPrice: tx.gasPrice?.toString()
      };
    } catch (error) {
      logger.error('Error getting transaction status:', error);
      return null;
    }
  }

  /**
   * Validate wallet signature
   */
  async validateWalletSignature(
    address: string,
    signature: string,
    message: string
  ): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      logger.error('Error validating wallet signature:', error);
      return false;
    }
  }

  /**
   * Get wallet balances (ETH + Token)
   */
  async getWalletBalance(
    address: string,
    network: string = 'ethereum'
  ): Promise<WalletBalance | null> {
    try {
      const provider = this.providers.get(network);
      const tokenContract = this.contracts.get(`${network}-token`);

      if (!provider) {
        return null;
      }

      // Get ETH balance
      const ethBalance = await provider.getBalance(address);

      // Get token balance
      let tokenBalance = '0';
      if (tokenContract) {
        try {
          const balance = await tokenContract.balanceOf(address);
          tokenBalance = ethers.formatEther(balance);
        } catch (error) {
          logger.warn('Error getting token balance:', error);
        }
      }

      return {
        eth: ethers.formatEther(ethBalance),
        token: tokenBalance
      };
    } catch (error) {
      logger.error('Error getting wallet balance:', error);
      return null;
    }
  }

  /**
   * Create pending investment record in database
   */
  private async createPendingInvestment(
    userId: string,
    planId: number,
    amount: string,
    txHash: string,
    network: string
  ): Promise<void> {
    try {
      // Get investment plan from database
      const plan = await prisma.investmentPlan.findFirst({
        where: { id: planId.toString() }
      });

      if (!plan) {
        logger.error(`Investment plan not found: ${planId}`);
        return;
      }

      // Calculate expected return
      const investmentAmount = parseFloat(amount);
      const expectedReturn = (investmentAmount * plan.returnPercentage) / 100;
      const maturityDate = new Date();
      maturityDate.setDate(maturityDate.getDate() + plan.durationDays);

      // Create investment record
      await prisma.investment.create({
        data: {
          userId,
          planId: plan.id,
          amount: investmentAmount,
          currency: 'ETH',
          expectedReturn,
          status: 'PENDING',
          startDate: new Date(),
          maturityDate,
          transactionHash: txHash,
          blockchainNetwork: network,
        },
      });

      logger.info(`Pending investment created for user ${userId}, tx: ${txHash}`);
    } catch (error) {
      logger.error('Error creating pending investment:', error);
    }
  }
}
