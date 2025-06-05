// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CryptonestleInvestment
 * @dev Main investment contract for Cryptonestle platform
 * Handles investment deposits, ROI calculations, and withdrawals
 */
contract CryptonestleInvestment is ReentrancyGuard, Pausable, Ownable {

    // Investment plan structure
    struct InvestmentPlan {
        uint256 id;
        string name;
        uint256 durationDays;
        uint256 returnPercentage; // Percentage with 2 decimals (e.g., 1000 = 10.00%)
        uint256 minAmount;
        uint256 maxAmount;
        bool isActive;
        uint256 totalInvestments;
        uint256 totalAmount;
    }

    // User investment structure
    struct Investment {
        uint256 id;
        address investor;
        uint256 planId;
        uint256 amount;
        uint256 expectedReturn;
        uint256 startTime;
        uint256 maturityTime;
        bool isWithdrawn;
        bool isActive;
    }

    // State variables
    mapping(uint256 => InvestmentPlan) public investmentPlans;
    mapping(uint256 => Investment) public investments;
    mapping(address => uint256[]) public userInvestments;
    mapping(address => uint256) public userTotalInvested;
    mapping(address => uint256) public userTotalEarned;

    uint256 public nextPlanId = 1;
    uint256 public nextInvestmentId = 1;
    uint256 public platformFeePercentage = 250; // 2.5% with 2 decimals
    uint256 public totalPlatformFees;
    uint256 public totalInvestments;
    uint256 public totalWithdrawals;

    address public feeCollector;

    // Events
    event PlanCreated(uint256 indexed planId, string name, uint256 returnPercentage, uint256 durationDays);
    event PlanUpdated(uint256 indexed planId, bool isActive);
    event InvestmentCreated(uint256 indexed investmentId, address indexed investor, uint256 planId, uint256 amount);
    event InvestmentWithdrawn(uint256 indexed investmentId, address indexed investor, uint256 amount, uint256 profit);
    event EmergencyWithdrawal(uint256 indexed investmentId, address indexed investor, uint256 amount);
    event FeeCollected(uint256 amount);

    // Modifiers
    modifier validPlan(uint256 _planId) {
        require(_planId > 0 && _planId < nextPlanId, "Invalid plan ID");
        require(investmentPlans[_planId].isActive, "Plan is not active");
        _;
    }

    modifier validInvestment(uint256 _investmentId) {
        require(_investmentId > 0 && _investmentId < nextInvestmentId, "Invalid investment ID");
        require(investments[_investmentId].isActive, "Investment is not active");
        _;
    }

    modifier onlyInvestor(uint256 _investmentId) {
        require(investments[_investmentId].investor == msg.sender, "Not the investor");
        _;
    }

    constructor(address _feeCollector) Ownable(msg.sender) {
        feeCollector = _feeCollector;

        // Create default investment plans
        _createDefaultPlans();
    }

    /**
     * @dev Create default investment plans
     */
    function _createDefaultPlans() private {
        // Starter Plan: 7 days, 5% ROI
        createInvestmentPlan("Starter Plan", 7, 500, 0.01 ether, 1 ether);
        
        // Growth Plan: 14 days, 12% ROI
        createInvestmentPlan("Growth Plan", 14, 1200, 0.1 ether, 5 ether);
        
        // Premium Plan: 30 days, 25% ROI
        createInvestmentPlan("Premium Plan", 30, 2500, 1 ether, 10 ether);
        
        // Elite Plan: 60 days, 50% ROI
        createInvestmentPlan("Elite Plan", 60, 5000, 5 ether, 50 ether);
        
        // Diamond Plan: 90 days, 100% ROI
        createInvestmentPlan("Diamond Plan", 90, 10000, 10 ether, 100 ether);
    }

    /**
     * @dev Create a new investment plan (only owner)
     */
    function createInvestmentPlan(
        string memory _name,
        uint256 _durationDays,
        uint256 _returnPercentage,
        uint256 _minAmount,
        uint256 _maxAmount
    ) public onlyOwner {
        require(_durationDays > 0, "Duration must be greater than 0");
        require(_returnPercentage > 0, "Return percentage must be greater than 0");
        require(_minAmount > 0, "Minimum amount must be greater than 0");
        require(_maxAmount >= _minAmount, "Maximum amount must be >= minimum amount");

        investmentPlans[nextPlanId] = InvestmentPlan({
            id: nextPlanId,
            name: _name,
            durationDays: _durationDays,
            returnPercentage: _returnPercentage,
            minAmount: _minAmount,
            maxAmount: _maxAmount,
            isActive: true,
            totalInvestments: 0,
            totalAmount: 0
        });

        emit PlanCreated(nextPlanId, _name, _returnPercentage, _durationDays);
        nextPlanId++;
    }

    /**
     * @dev Update investment plan status
     */
    function updatePlanStatus(uint256 _planId, bool _isActive) external onlyOwner {
        require(_planId > 0 && _planId < nextPlanId, "Invalid plan ID");
        investmentPlans[_planId].isActive = _isActive;
        emit PlanUpdated(_planId, _isActive);
    }

    /**
     * @dev Create a new investment
     */
    function invest(uint256 _planId) external payable validPlan(_planId) nonReentrant whenNotPaused {
        InvestmentPlan storage plan = investmentPlans[_planId];
        
        require(msg.value >= plan.minAmount, "Investment amount too low");
        require(msg.value <= plan.maxAmount, "Investment amount too high");

        // Calculate expected return
        uint256 expectedReturn = (msg.value * plan.returnPercentage) / 10000;
        uint256 maturityTime = block.timestamp + (plan.durationDays * 1 days);

        // Create investment
        investments[nextInvestmentId] = Investment({
            id: nextInvestmentId,
            investor: msg.sender,
            planId: _planId,
            amount: msg.value,
            expectedReturn: expectedReturn,
            startTime: block.timestamp,
            maturityTime: maturityTime,
            isWithdrawn: false,
            isActive: true
        });

        // Update user and plan statistics
        userInvestments[msg.sender].push(nextInvestmentId);
        userTotalInvested[msg.sender] = userTotalInvested[msg.sender] + msg.value;

        plan.totalInvestments++;
        plan.totalAmount = plan.totalAmount + msg.value;
        totalInvestments = totalInvestments + msg.value;

        emit InvestmentCreated(nextInvestmentId, msg.sender, _planId, msg.value);
        nextInvestmentId++;
    }

    /**
     * @dev Withdraw matured investment
     */
    function withdraw(uint256 _investmentId) 
        external 
        validInvestment(_investmentId) 
        onlyInvestor(_investmentId) 
        nonReentrant 
        whenNotPaused 
    {
        Investment storage investment = investments[_investmentId];
        
        require(!investment.isWithdrawn, "Investment already withdrawn");
        require(block.timestamp >= investment.maturityTime, "Investment not yet matured");

        // Calculate total withdrawal amount (principal + profit)
        uint256 totalAmount = investment.amount + investment.expectedReturn;

        // Calculate platform fee
        uint256 platformFee = (investment.expectedReturn * platformFeePercentage) / 10000;
        uint256 userAmount = totalAmount - platformFee;

        // Mark as withdrawn
        investment.isWithdrawn = true;
        investment.isActive = false;

        // Update statistics
        userTotalEarned[msg.sender] = userTotalEarned[msg.sender] + investment.expectedReturn;
        totalWithdrawals = totalWithdrawals + totalAmount;
        totalPlatformFees = totalPlatformFees + platformFee;

        // Transfer funds
        payable(msg.sender).transfer(userAmount);
        if (platformFee > 0) {
            payable(feeCollector).transfer(platformFee);
            emit FeeCollected(platformFee);
        }

        emit InvestmentWithdrawn(_investmentId, msg.sender, userAmount, investment.expectedReturn);
    }

    /**
     * @dev Emergency withdrawal (only principal, no profit)
     */
    function emergencyWithdraw(uint256 _investmentId) 
        external 
        validInvestment(_investmentId) 
        onlyInvestor(_investmentId) 
        nonReentrant 
    {
        Investment storage investment = investments[_investmentId];
        
        require(!investment.isWithdrawn, "Investment already withdrawn");
        require(investment.isActive, "Investment not active");

        uint256 amount = investment.amount;

        // Mark as withdrawn
        investment.isWithdrawn = true;
        investment.isActive = false;

        // Update statistics
        totalWithdrawals = totalWithdrawals + amount;

        // Transfer only principal amount
        payable(msg.sender).transfer(amount);

        emit EmergencyWithdrawal(_investmentId, msg.sender, amount);
    }

    /**
     * @dev Get investment plan details
     */
    function getInvestmentPlan(uint256 _planId) external view returns (InvestmentPlan memory) {
        require(_planId > 0 && _planId < nextPlanId, "Invalid plan ID");
        return investmentPlans[_planId];
    }

    /**
     * @dev Get investment details
     */
    function getInvestment(uint256 _investmentId) external view returns (Investment memory) {
        require(_investmentId > 0 && _investmentId < nextInvestmentId, "Invalid investment ID");
        return investments[_investmentId];
    }

    /**
     * @dev Get user's investment IDs
     */
    function getUserInvestments(address _user) external view returns (uint256[] memory) {
        return userInvestments[_user];
    }

    /**
     * @dev Get user's investment statistics
     */
    function getUserStats(address _user) external view returns (
        uint256 totalInvested,
        uint256 totalEarned,
        uint256 activeInvestments
    ) {
        totalInvested = userTotalInvested[_user];
        totalEarned = userTotalEarned[_user];
        
        uint256[] memory userInvestmentIds = userInvestments[_user];
        for (uint256 i = 0; i < userInvestmentIds.length; i++) {
            if (investments[userInvestmentIds[i]].isActive) {
                activeInvestments++;
            }
        }
    }

    /**
     * @dev Check if investment is matured
     */
    function isInvestmentMatured(uint256 _investmentId) external view returns (bool) {
        require(_investmentId > 0 && _investmentId < nextInvestmentId, "Invalid investment ID");
        return block.timestamp >= investments[_investmentId].maturityTime;
    }

    /**
     * @dev Get contract statistics
     */
    function getContractStats() external view returns (
        uint256 _totalInvestments,
        uint256 _totalWithdrawals,
        uint256 _totalPlatformFees,
        uint256 _contractBalance
    ) {
        _totalInvestments = totalInvestments;
        _totalWithdrawals = totalWithdrawals;
        _totalPlatformFees = totalPlatformFees;
        _contractBalance = address(this).balance;
    }

    /**
     * @dev Update platform fee percentage (only owner)
     */
    function updatePlatformFee(uint256 _newFeePercentage) external onlyOwner {
        require(_newFeePercentage <= 1000, "Fee cannot exceed 10%");
        platformFeePercentage = _newFeePercentage;
    }

    /**
     * @dev Update fee collector address (only owner)
     */
    function updateFeeCollector(address _newFeeCollector) external onlyOwner {
        require(_newFeeCollector != address(0), "Invalid fee collector address");
        feeCollector = _newFeeCollector;
    }

    /**
     * @dev Pause contract (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Deposit profits into contract (only owner)
     */
    function depositProfits() external payable onlyOwner {
        // This function allows the owner to deposit profits into the contract
        // In a real platform, profits would come from trading/DeFi activities
    }

    /**
     * @dev Emergency fund withdrawal (only owner)
     */
    function emergencyFundWithdrawal(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient contract balance");
        payable(owner()).transfer(_amount);
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}

    /**
     * @dev Fallback function
     */
    fallback() external payable {}
}
