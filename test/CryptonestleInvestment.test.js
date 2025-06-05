const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CryptonestleInvestment", function () {
  let investment;
  let token;
  let owner;
  let investor1;
  let investor2;
  let feeCollector;

  beforeEach(async function () {
    [owner, investor1, investor2, feeCollector] = await ethers.getSigners();

    // Deploy CryptonestleInvestment contract
    const CryptonestleInvestment = await ethers.getContractFactory("CryptonestleInvestment");
    investment = await CryptonestleInvestment.deploy(feeCollector.address);
    await investment.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await investment.owner()).to.equal(owner.address);
    });

    it("Should set the right fee collector", async function () {
      expect(await investment.feeCollector()).to.equal(feeCollector.address);
    });

    it("Should create default investment plans", async function () {
      // Check if default plans are created (plan IDs 1-5)
      for (let i = 1; i <= 5; i++) {
        const plan = await investment.getInvestmentPlan(i);
        expect(plan.isActive).to.be.true;
        expect(plan.id).to.equal(i);
      }
    });

    it("Should have correct default plan parameters", async function () {
      // Test Starter Plan (ID: 1)
      const starterPlan = await investment.getInvestmentPlan(1);
      expect(starterPlan.name).to.equal("Starter Plan");
      expect(starterPlan.durationDays).to.equal(7);
      expect(starterPlan.returnPercentage).to.equal(500); // 5%

      // Test Diamond Plan (ID: 5)
      const diamondPlan = await investment.getInvestmentPlan(5);
      expect(diamondPlan.name).to.equal("Diamond Plan");
      expect(diamondPlan.durationDays).to.equal(90);
      expect(diamondPlan.returnPercentage).to.equal(10000); // 100%
    });
  });

  describe("Investment Plans Management", function () {
    it("Should allow owner to create new investment plan", async function () {
      await investment.createInvestmentPlan(
        "Test Plan",
        30,
        1500, // 15%
        ethers.parseEther("0.1"),
        ethers.parseEther("10")
      );

      const plan = await investment.getInvestmentPlan(6); // Should be ID 6
      expect(plan.name).to.equal("Test Plan");
      expect(plan.durationDays).to.equal(30);
      expect(plan.returnPercentage).to.equal(1500);
    });

    it("Should not allow non-owner to create investment plan", async function () {
      await expect(
        investment.connect(investor1).createInvestmentPlan(
          "Unauthorized Plan",
          30,
          1500,
          ethers.parseEther("0.1"),
          ethers.parseEther("10")
        )
      ).to.be.revertedWithCustomError(investment, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to update plan status", async function () {
      await investment.updatePlanStatus(1, false);
      const plan = await investment.getInvestmentPlan(1);
      expect(plan.isActive).to.be.false;
    });
  });

  describe("Investments", function () {
    it("Should allow valid investment", async function () {
      const investmentAmount = ethers.parseEther("0.5");
      const planId = 1; // Starter Plan

      await expect(
        investment.connect(investor1).invest(planId, { value: investmentAmount })
      ).to.emit(investment, "InvestmentCreated");

      const userInvestments = await investment.getUserInvestments(investor1.address);
      expect(userInvestments.length).to.equal(1);

      const investmentDetails = await investment.getInvestment(userInvestments[0]);
      expect(investmentDetails.investor).to.equal(investor1.address);
      expect(investmentDetails.amount).to.equal(investmentAmount);
      expect(investmentDetails.planId).to.equal(planId);
    });

    it("Should reject investment below minimum amount", async function () {
      const planId = 1; // Starter Plan (min: 0.01 ETH)
      const lowAmount = ethers.parseEther("0.005");

      await expect(
        investment.connect(investor1).invest(planId, { value: lowAmount })
      ).to.be.revertedWith("Investment amount too low");
    });

    it("Should reject investment above maximum amount", async function () {
      const planId = 1; // Starter Plan (max: 1 ETH)
      const highAmount = ethers.parseEther("2");

      await expect(
        investment.connect(investor1).invest(planId, { value: highAmount })
      ).to.be.revertedWith("Investment amount too high");
    });

    it("Should calculate correct expected return", async function () {
      const investmentAmount = ethers.parseEther("1");
      const planId = 1; // Starter Plan (5% return)

      await investment.connect(investor1).invest(planId, { value: investmentAmount });
      
      const userInvestments = await investment.getUserInvestments(investor1.address);
      const investmentDetails = await investment.getInvestment(userInvestments[0]);
      
      // Expected return should be 5% of investment amount
      const expectedReturn = investmentAmount * BigInt(500) / BigInt(10000);
      expect(investmentDetails.expectedReturn).to.equal(expectedReturn);
    });

    it("Should update user statistics correctly", async function () {
      const investmentAmount = ethers.parseEther("1");
      const planId = 1;

      await investment.connect(investor1).invest(planId, { value: investmentAmount });

      const userStats = await investment.getUserStats(investor1.address);
      expect(userStats.totalInvested).to.equal(investmentAmount);
      expect(userStats.activeInvestments).to.equal(1);
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      // Create an investment first
      const investmentAmount = ethers.parseEther("1");
      const planId = 1; // 7 days plan
      await investment.connect(investor1).invest(planId, { value: investmentAmount });
    });

    it("Should not allow withdrawal before maturity", async function () {
      const userInvestments = await investment.getUserInvestments(investor1.address);
      const investmentId = userInvestments[0];

      await expect(
        investment.connect(investor1).withdraw(investmentId)
      ).to.be.revertedWith("Investment not yet matured");
    });

    it("Should allow withdrawal after maturity", async function () {
      const userInvestments = await investment.getUserInvestments(investor1.address);
      const investmentId = userInvestments[0];

      // Deposit profits to contract so it can pay out returns
      await investment.depositProfits({ value: ethers.parseEther("1") });

      // Fast forward time by 8 days (more than 7 days plan duration)
      await ethers.provider.send("evm_increaseTime", [8 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      const initialBalance = await ethers.provider.getBalance(investor1.address);

      await expect(
        investment.connect(investor1).withdraw(investmentId)
      ).to.emit(investment, "InvestmentWithdrawn");

      const finalBalance = await ethers.provider.getBalance(investor1.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should calculate platform fee correctly", async function () {
      const userInvestments = await investment.getUserInvestments(investor1.address);
      const investmentId = userInvestments[0];

      // Deposit profits to contract
      await investment.depositProfits({ value: ethers.parseEther("1") });

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [8 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      const initialFeeCollectorBalance = await ethers.provider.getBalance(feeCollector.address);

      await investment.connect(investor1).withdraw(investmentId);

      const finalFeeCollectorBalance = await ethers.provider.getBalance(feeCollector.address);
      expect(finalFeeCollectorBalance).to.be.gt(initialFeeCollectorBalance);
    });

    it("Should allow emergency withdrawal", async function () {
      const userInvestments = await investment.getUserInvestments(investor1.address);
      const investmentId = userInvestments[0];

      const initialBalance = await ethers.provider.getBalance(investor1.address);

      await expect(
        investment.connect(investor1).emergencyWithdraw(investmentId)
      ).to.emit(investment, "EmergencyWithdrawal");

      const finalBalance = await ethers.provider.getBalance(investor1.address);
      expect(finalBalance).to.be.gt(initialBalance);

      // Check that investment is marked as withdrawn
      const investmentDetails = await investment.getInvestment(investmentId);
      expect(investmentDetails.isWithdrawn).to.be.true;
      expect(investmentDetails.isActive).to.be.false;
    });
  });

  describe("Contract Management", function () {
    it("Should allow owner to pause contract", async function () {
      await investment.pause();
      expect(await investment.paused()).to.be.true;

      // Should not allow investments when paused
      await expect(
        investment.connect(investor1).invest(1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(investment, "EnforcedPause");
    });

    it("Should allow owner to unpause contract", async function () {
      await investment.pause();
      await investment.unpause();
      expect(await investment.paused()).to.be.false;
    });

    it("Should allow owner to update platform fee", async function () {
      const newFee = 300; // 3%
      await investment.updatePlatformFee(newFee);
      expect(await investment.platformFeePercentage()).to.equal(newFee);
    });

    it("Should not allow platform fee above 10%", async function () {
      await expect(
        investment.updatePlatformFee(1100) // 11%
      ).to.be.revertedWith("Fee cannot exceed 10%");
    });

    it("Should allow owner to update fee collector", async function () {
      await investment.updateFeeCollector(investor2.address);
      expect(await investment.feeCollector()).to.equal(investor2.address);
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Create some investments for testing
      await investment.connect(investor1).invest(1, { value: ethers.parseEther("1") });
      await investment.connect(investor2).invest(2, { value: ethers.parseEther("2") });
    });

    it("Should return correct contract statistics", async function () {
      const stats = await investment.getContractStats();
      expect(stats._totalInvestments).to.equal(ethers.parseEther("3"));
      expect(stats._contractBalance).to.equal(ethers.parseEther("3"));
    });

    it("Should check investment maturity correctly", async function () {
      const userInvestments = await investment.getUserInvestments(investor1.address);
      const investmentId = userInvestments[0];

      // Should not be matured initially
      expect(await investment.isInvestmentMatured(investmentId)).to.be.false;

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [8 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      // Should be matured now
      expect(await investment.isInvestmentMatured(investmentId)).to.be.true;
    });
  });
});
