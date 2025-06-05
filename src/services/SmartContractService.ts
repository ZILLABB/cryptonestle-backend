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
  "function mint(address to, uint256 amount) external",
  "function burn(uint256 amount) external"
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
        const provider = new ethers.JsonRpcProvider(network.rpc);
        this.providers.set(network.name, provider);

        if (network.privateKey) {
          const signer = new ethers.Wallet(network.privateKey, provider);
          this.signers.set(network.name, signer);
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

      // Update or create investment record
      await prisma.investment.upsert({
        where: { 
          transactionHash: `${network}-${investmentId}` // Use network-investmentId as unique identifier
        },
        update: {
          status: investmentDetails.isActive ? 'ACTIVE' : 'COMPLETED',
          actualReturn: investmentDetails.isWithdrawn ? parseFloat(investmentDetails.expectedReturn) : null,
        },
        create: {
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
}
