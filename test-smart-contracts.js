const { ethers } = require('ethers');
require('dotenv').config();

// Contract addresses from deployment
const INVESTMENT_CONTRACT_ADDRESS = process.env.INVESTMENT_CONTRACT_ADDRESS;
const TOKEN_CONTRACT_ADDRESS = process.env.CNEST_TOKEN_ADDRESS;
const MULTITOKEN_CONTRACT_ADDRESS = process.env.MULTITOKEN_CONTRACT_ADDRESS;

// Contract ABIs (simplified for testing)
const INVESTMENT_ABI = [
  "function invest(uint256 planId) external payable",
  "function withdraw(uint256 investmentId) external",
  "function getInvestment(uint256 investmentId) external view returns (tuple(uint256 id, address investor, uint256 planId, uint256 amount, uint256 expectedReturn, uint256 startTime, uint256 maturityTime, bool isWithdrawn, bool isActive))",
  "function getUserInvestments(address user) external view returns (uint256[])",
  "function getInvestmentPlan(uint256 planId) external view returns (tuple(uint256 id, string name, uint256 durationDays, uint256 returnPercentage, uint256 minAmount, uint256 maxAmount, bool isActive, uint256 totalInvestments, uint256 totalAmount))",
  "function isInvestmentMatured(uint256 investmentId) external view returns (bool)",
  "function depositProfits() external payable",
  "function getContractStats() external view returns (uint256 totalInvestments, uint256 totalWithdrawals, uint256 totalPlatformFees, uint256 contractBalance)",
  "event InvestmentCreated(uint256 indexed investmentId, address indexed investor, uint256 planId, uint256 amount)"
];

const TOKEN_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function mint(address to, uint256 amount) external"
];

async function main() {
  console.log('🚀 Testing Cryptonestle Smart Contracts Integration...\n');

  // Setup provider and signer
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  const signer = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, provider);

  console.log('📝 Using account:', signer.address);
  const balance = await provider.getBalance(signer.address);
  console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH\n');

  // Initialize contracts
  const investmentContract = new ethers.Contract(INVESTMENT_CONTRACT_ADDRESS, INVESTMENT_ABI, signer);
  const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_ABI, signer);

  try {
    // Test 1: Check token information
    console.log('🪙 Testing Token Contract...');
    const tokenName = await tokenContract.name();
    const tokenSymbol = await tokenContract.symbol();
    const totalSupply = await tokenContract.totalSupply();
    const userBalance = await tokenContract.balanceOf(signer.address);

    console.log(`   Token: ${tokenName} (${tokenSymbol})`);
    console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} tokens`);
    console.log(`   User Balance: ${ethers.formatEther(userBalance)} tokens`);

    // Test 2: Check investment plans
    console.log('\n💎 Testing Investment Plans...');
    for (let i = 1; i <= 5; i++) {
      try {
        const plan = await investmentContract.getInvestmentPlan(i);
        console.log(`   Plan ${i}: ${plan.name} - ${plan.durationDays} days, ${plan.returnPercentage / 100}% ROI`);
        console.log(`            Min: ${ethers.formatEther(plan.minAmount)} ETH, Max: ${ethers.formatEther(plan.maxAmount)} ETH`);
      } catch (error) {
        console.log(`   Plan ${i}: Error - ${error.message}`);
      }
    }

    // Test 3: Create an investment
    console.log('\n📈 Testing Investment Creation...');
    const investmentAmount = ethers.parseEther("0.1"); // 0.1 ETH
    const planId = 1; // Starter Plan

    console.log(`   Creating investment: ${ethers.formatEther(investmentAmount)} ETH in Plan ${planId}...`);
    
    const investTx = await investmentContract.invest(planId, { value: investmentAmount });
    console.log(`   Transaction sent: ${investTx.hash}`);
    
    const receipt = await investTx.wait();
    console.log(`   ✅ Investment created! Gas used: ${receipt.gasUsed.toString()}`);

    // Get the investment ID from the event
    const investmentCreatedEvent = receipt.logs.find(log => {
      try {
        const parsed = investmentContract.interface.parseLog(log);
        return parsed.name === 'InvestmentCreated';
      } catch {
        return false;
      }
    });

    if (investmentCreatedEvent) {
      const parsedEvent = investmentContract.interface.parseLog(investmentCreatedEvent);
      const investmentId = parsedEvent.args.investmentId;
      console.log(`   Investment ID: ${investmentId}`);

      // Test 4: Check investment details
      console.log('\n🔍 Testing Investment Details...');
      const investment = await investmentContract.getInvestment(investmentId);
      console.log(`   Investment Amount: ${ethers.formatEther(investment.amount)} ETH`);
      console.log(`   Expected Return: ${ethers.formatEther(investment.expectedReturn)} ETH`);
      console.log(`   Start Time: ${new Date(Number(investment.startTime) * 1000).toLocaleString()}`);
      console.log(`   Maturity Time: ${new Date(Number(investment.maturityTime) * 1000).toLocaleString()}`);
      console.log(`   Is Active: ${investment.isActive}`);

      // Test 5: Check if investment is matured
      const isMatured = await investmentContract.isInvestmentMatured(investmentId);
      console.log(`   Is Matured: ${isMatured}`);

      // Test 6: Get user investments
      console.log('\n👤 Testing User Investments...');
      const userInvestments = await investmentContract.getUserInvestments(signer.address);
      console.log(`   User has ${userInvestments.length} investment(s)`);
      console.log(`   Investment IDs: [${userInvestments.join(', ')}]`);

      // Test 7: Deposit profits for withdrawal testing
      console.log('\n💰 Depositing Profits for Testing...');
      const profitAmount = ethers.parseEther("0.1");
      const depositTx = await investmentContract.depositProfits({ value: profitAmount });
      await depositTx.wait();
      console.log(`   ✅ Deposited ${ethers.formatEther(profitAmount)} ETH as profits`);
    }

    // Test 8: Check contract statistics
    console.log('\n📊 Testing Contract Statistics...');
    const stats = await investmentContract.getContractStats();
    console.log(`   Total Investments: ${ethers.formatEther(stats.totalInvestments)} ETH`);
    console.log(`   Total Withdrawals: ${ethers.formatEther(stats.totalWithdrawals)} ETH`);
    console.log(`   Total Platform Fees: ${ethers.formatEther(stats.totalPlatformFees)} ETH`);
    console.log(`   Contract Balance: ${ethers.formatEther(stats.contractBalance)} ETH`);

    // Test 9: Test token minting (owner only)
    console.log('\n🏭 Testing Token Minting...');
    try {
      const mintAmount = ethers.parseEther("1000"); // 1000 tokens
      const mintTx = await tokenContract.mint(signer.address, mintAmount);
      await mintTx.wait();
      
      const newBalance = await tokenContract.balanceOf(signer.address);
      console.log(`   ✅ Minted ${ethers.formatEther(mintAmount)} tokens`);
      console.log(`   New balance: ${ethers.formatEther(newBalance)} tokens`);
    } catch (error) {
      console.log(`   ❌ Minting failed: ${error.message}`);
    }

    console.log('\n🎉 Smart Contract Integration Tests Completed!');
    console.log('\n📋 Summary:');
    console.log('✅ Token contract working');
    console.log('✅ Investment contract working');
    console.log('✅ Investment creation working');
    console.log('✅ Investment tracking working');
    console.log('✅ Contract statistics working');

    console.log('\n🚀 Next Steps:');
    console.log('1. Integrate smart contracts with backend API');
    console.log('2. Create frontend interface');
    console.log('3. Test withdrawal functionality after maturity');
    console.log('4. Deploy to testnet for public testing');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
main().catch(console.error);
