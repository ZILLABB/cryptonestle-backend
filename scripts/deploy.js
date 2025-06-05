const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting Cryptonestle Smart Contract Deployment...\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy CryptonestleToken first
  console.log("🪙 Deploying CryptonestleToken...");
  const CryptonestleToken = await ethers.getContractFactory("CryptonestleToken");
  const token = await CryptonestleToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✅ CryptonestleToken deployed to:", tokenAddress);

  // Deploy CryptonestleInvestment
  console.log("\n💎 Deploying CryptonestleInvestment...");
  const CryptonestleInvestment = await ethers.getContractFactory("CryptonestleInvestment");
  const investment = await CryptonestleInvestment.deploy(deployer.address); // Fee collector
  await investment.waitForDeployment();
  const investmentAddress = await investment.getAddress();
  console.log("✅ CryptonestleInvestment deployed to:", investmentAddress);

  // Deploy CryptonestleMultiToken
  console.log("\n🌐 Deploying CryptonestleMultiToken...");
  const CryptonestleMultiToken = await ethers.getContractFactory("CryptonestleMultiToken");
  const multiToken = await CryptonestleMultiToken.deploy();
  await multiToken.waitForDeployment();
  const multiTokenAddress = await multiToken.getAddress();
  console.log("✅ CryptonestleMultiToken deployed to:", multiTokenAddress);

  // Add CNEST token to MultiToken contract
  console.log("\n🔗 Adding CNEST token to MultiToken contract...");
  const tokenInfo = await token.getTokenInfo();
  await multiToken.addSupportedToken(
    tokenAddress,
    tokenInfo.tokenSymbol,
    tokenInfo.tokenDecimals,
    ethers.parseEther("100"), // Min 100 CNEST
    ethers.parseEther("1000000") // Max 1M CNEST
  );
  console.log("✅ CNEST token added to MultiToken contract");

  // Verify deployments
  console.log("\n🔍 Verifying deployments...");
  
  // Check token deployment
  const tokenName = await token.name();
  const tokenSymbol = await token.symbol();
  const tokenSupply = await token.totalSupply();
  console.log(`📊 Token: ${tokenName} (${tokenSymbol})`);
  console.log(`📊 Initial Supply: ${ethers.formatEther(tokenSupply)} tokens`);

  // Check investment contract
  const contractStats = await investment.getContractStats();
  console.log(`📊 Investment Contract Balance: ${ethers.formatEther(contractStats._contractBalance)} ETH`);

  // Check supported tokens in MultiToken contract
  const supportedTokens = await multiToken.getSupportedTokens();
  console.log(`📊 MultiToken Supported Tokens: ${supportedTokens.length}`);

  // Display deployment summary
  console.log("\n🎉 Deployment Summary:");
  console.log("=" .repeat(50));
  console.log(`🪙 CryptonestleToken (CNEST): ${tokenAddress}`);
  console.log(`💎 CryptonestleInvestment:    ${investmentAddress}`);
  console.log(`🌐 CryptonestleMultiToken:    ${multiTokenAddress}`);
  console.log("=" .repeat(50));

  // Save deployment addresses to file
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      CryptonestleToken: tokenAddress,
      CryptonestleInvestment: investmentAddress,
      CryptonestleMultiToken: multiTokenAddress
    },
    gasUsed: {
      // Gas usage would be calculated here in a real deployment
    }
  };

  const fs = require('fs');
  const path = require('path');
  
  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  // Save deployment info
  const networkName = (await ethers.provider.getNetwork()).name || 'unknown';
  const deploymentFile = path.join(deploymentsDir, `${networkName}-deployment.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`\n📄 Deployment info saved to: ${deploymentFile}`);

  // Display next steps
  console.log("\n🚀 Next Steps:");
  console.log("1. Update your backend .env file with contract addresses");
  console.log("2. Verify contracts on block explorer (if on testnet/mainnet)");
  console.log("3. Test contract interactions");
  console.log("4. Set up frontend integration");

  // Display environment variables to add
  console.log("\n📝 Add these to your .env file:");
  console.log(`CNEST_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`INVESTMENT_CONTRACT_ADDRESS=${investmentAddress}`);
  console.log(`MULTITOKEN_CONTRACT_ADDRESS=${multiTokenAddress}`);

  console.log("\n✨ Deployment completed successfully!");
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
