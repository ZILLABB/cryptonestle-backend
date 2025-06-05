// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CryptonestleMultiToken
 * @dev Multi-token investment contract supporting ETH and ERC20 tokens
 */
contract CryptonestleMultiToken is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // Supported token structure
    struct SupportedToken {
        address tokenAddress; // address(0) for ETH
        string symbol;
        uint8 decimals;
        bool isActive;
        uint256 minInvestment;
        uint256 maxInvestment;
    }

    // Multi-token investment structure
    struct MultiTokenInvestment {
        uint256 id;
        address investor;
        uint256 planId;
        address tokenAddress;
        uint256 amount;
        uint256 expectedReturn;
        uint256 startTime;
        uint256 maturityTime;
        bool isWithdrawn;
        bool isActive;
    }

    // Investment plan (reused from main contract)
    struct InvestmentPlan {
        uint256 id;
        string name;
        uint256 durationDays;
        uint256 returnPercentage;
        bool isActive;
    }

    // State variables
    mapping(uint256 => InvestmentPlan) public investmentPlans;
    mapping(address => SupportedToken) public supportedTokens;
    mapping(uint256 => MultiTokenInvestment) public multiTokenInvestments;
    mapping(address => uint256[]) public userMultiTokenInvestments;
    mapping(address => mapping(address => uint256)) public userTokenBalances;

    address[] public supportedTokensList;
    uint256 public nextPlanId = 1;
    uint256 public nextInvestmentId = 1;
    uint256 public platformFeePercentage = 250; // 2.5%

    // Events
    event TokenAdded(address indexed tokenAddress, string symbol);
    event TokenUpdated(address indexed tokenAddress, bool isActive);
    event MultiTokenInvestmentCreated(
        uint256 indexed investmentId,
        address indexed investor,
        address indexed tokenAddress,
        uint256 amount
    );
    event MultiTokenInvestmentWithdrawn(
        uint256 indexed investmentId,
        address indexed investor,
        address indexed tokenAddress,
        uint256 amount,
        uint256 profit
    );

    constructor() Ownable(msg.sender) {
        // Add ETH as default supported token
        _addSupportedToken(address(0), "ETH", 18, 0.01 ether, 100 ether);

        // Create default plans
        _createDefaultPlans();
    }

    /**
     * @dev Add supported token
     */
    function addSupportedToken(
        address _tokenAddress,
        string memory _symbol,
        uint8 _decimals,
        uint256 _minInvestment,
        uint256 _maxInvestment
    ) external onlyOwner {
        _addSupportedToken(_tokenAddress, _symbol, _decimals, _minInvestment, _maxInvestment);
    }

    /**
     * @dev Internal function to add supported token
     */
    function _addSupportedToken(
        address _tokenAddress,
        string memory _symbol,
        uint8 _decimals,
        uint256 _minInvestment,
        uint256 _maxInvestment
    ) internal {
        require(!supportedTokens[_tokenAddress].isActive, "Token already supported");
        require(_maxInvestment >= _minInvestment, "Invalid investment limits");

        supportedTokens[_tokenAddress] = SupportedToken({
            tokenAddress: _tokenAddress,
            symbol: _symbol,
            decimals: _decimals,
            isActive: true,
            minInvestment: _minInvestment,
            maxInvestment: _maxInvestment
        });

        supportedTokensList.push(_tokenAddress);
        emit TokenAdded(_tokenAddress, _symbol);
    }

    /**
     * @dev Update token status
     */
    function updateTokenStatus(address _tokenAddress, bool _isActive) external onlyOwner {
        require(supportedTokens[_tokenAddress].tokenAddress == _tokenAddress, "Token not found");
        supportedTokens[_tokenAddress].isActive = _isActive;
        emit TokenUpdated(_tokenAddress, _isActive);
    }

    /**
     * @dev Create default investment plans
     */
    function _createDefaultPlans() internal {
        _createPlan("Starter Plan", 7, 500);     // 7 days, 5%
        _createPlan("Growth Plan", 14, 1200);    // 14 days, 12%
        _createPlan("Premium Plan", 30, 2500);   // 30 days, 25%
        _createPlan("Elite Plan", 60, 5000);     // 60 days, 50%
        _createPlan("Diamond Plan", 90, 10000);  // 90 days, 100%
    }

    /**
     * @dev Internal function to create plan
     */
    function _createPlan(string memory _name, uint256 _durationDays, uint256 _returnPercentage) internal {
        investmentPlans[nextPlanId] = InvestmentPlan({
            id: nextPlanId,
            name: _name,
            durationDays: _durationDays,
            returnPercentage: _returnPercentage,
            isActive: true
        });
        nextPlanId++;
    }

    /**
     * @dev Invest with ETH
     */
    function investETH(uint256 _planId) external payable nonReentrant whenNotPaused {
        require(supportedTokens[address(0)].isActive, "ETH not supported");
        require(msg.value >= supportedTokens[address(0)].minInvestment, "Amount too low");
        require(msg.value <= supportedTokens[address(0)].maxInvestment, "Amount too high");

        _createMultiTokenInvestment(_planId, address(0), msg.value);
    }

    /**
     * @dev Invest with ERC20 token
     */
    function investToken(
        uint256 _planId,
        address _tokenAddress,
        uint256 _amount
    ) external nonReentrant whenNotPaused {
        SupportedToken memory token = supportedTokens[_tokenAddress];
        require(token.isActive, "Token not supported");
        require(_amount >= token.minInvestment, "Amount too low");
        require(_amount <= token.maxInvestment, "Amount too high");

        // Transfer tokens from user to contract
        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);

        _createMultiTokenInvestment(_planId, _tokenAddress, _amount);
    }

    /**
     * @dev Internal function to create multi-token investment
     */
    function _createMultiTokenInvestment(
        uint256 _planId,
        address _tokenAddress,
        uint256 _amount
    ) internal {
        require(_planId > 0 && _planId < nextPlanId, "Invalid plan ID");
        require(investmentPlans[_planId].isActive, "Plan not active");

        InvestmentPlan memory plan = investmentPlans[_planId];
        
        // Calculate expected return
        uint256 expectedReturn = (_amount * plan.returnPercentage) / 10000;
        uint256 maturityTime = block.timestamp + (plan.durationDays * 1 days);

        // Create investment
        multiTokenInvestments[nextInvestmentId] = MultiTokenInvestment({
            id: nextInvestmentId,
            investor: msg.sender,
            planId: _planId,
            tokenAddress: _tokenAddress,
            amount: _amount,
            expectedReturn: expectedReturn,
            startTime: block.timestamp,
            maturityTime: maturityTime,
            isWithdrawn: false,
            isActive: true
        });

        // Update user investments
        userMultiTokenInvestments[msg.sender].push(nextInvestmentId);
        userTokenBalances[msg.sender][_tokenAddress] = userTokenBalances[msg.sender][_tokenAddress] + _amount;

        emit MultiTokenInvestmentCreated(nextInvestmentId, msg.sender, _tokenAddress, _amount);
        nextInvestmentId++;
    }

    /**
     * @dev Withdraw matured multi-token investment
     */
    function withdrawMultiTokenInvestment(uint256 _investmentId) external nonReentrant {
        MultiTokenInvestment storage investment = multiTokenInvestments[_investmentId];
        
        require(investment.investor == msg.sender, "Not the investor");
        require(!investment.isWithdrawn, "Already withdrawn");
        require(investment.isActive, "Investment not active");
        require(block.timestamp >= investment.maturityTime, "Not yet matured");

        // Calculate amounts
        uint256 totalAmount = investment.amount + investment.expectedReturn;
        uint256 platformFee = (investment.expectedReturn * platformFeePercentage) / 10000;
        uint256 userAmount = totalAmount - platformFee;

        // Mark as withdrawn
        investment.isWithdrawn = true;
        investment.isActive = false;

        // Transfer funds
        if (investment.tokenAddress == address(0)) {
            // ETH withdrawal
            payable(msg.sender).transfer(userAmount);
            if (platformFee > 0) {
                payable(owner()).transfer(platformFee);
            }
        } else {
            // ERC20 token withdrawal
            IERC20(investment.tokenAddress).safeTransfer(msg.sender, userAmount);
            if (platformFee > 0) {
                IERC20(investment.tokenAddress).safeTransfer(owner(), platformFee);
            }
        }

        emit MultiTokenInvestmentWithdrawn(
            _investmentId,
            msg.sender,
            investment.tokenAddress,
            userAmount,
            investment.expectedReturn
        );
    }

    /**
     * @dev Get supported tokens list
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokensList;
    }

    /**
     * @dev Get user's multi-token investments
     */
    function getUserMultiTokenInvestments(address _user) external view returns (uint256[] memory) {
        return userMultiTokenInvestments[_user];
    }

    /**
     * @dev Get investment details
     */
    function getMultiTokenInvestment(uint256 _investmentId) external view returns (MultiTokenInvestment memory) {
        return multiTokenInvestments[_investmentId];
    }

    /**
     * @dev Check if investment is matured
     */
    function isMultiTokenInvestmentMatured(uint256 _investmentId) external view returns (bool) {
        return block.timestamp >= multiTokenInvestments[_investmentId].maturityTime;
    }

    /**
     * @dev Get user's token balance summary
     */
    function getUserTokenBalances(address _user) external view returns (
        address[] memory tokens,
        uint256[] memory balances
    ) {
        tokens = new address[](supportedTokensList.length);
        balances = new uint256[](supportedTokensList.length);

        for (uint256 i = 0; i < supportedTokensList.length; i++) {
            tokens[i] = supportedTokensList[i];
            balances[i] = userTokenBalances[_user][supportedTokensList[i]];
        }
    }

    /**
     * @dev Emergency withdrawal for specific token (only owner)
     */
    function emergencyTokenWithdrawal(address _tokenAddress, uint256 _amount) external onlyOwner {
        if (_tokenAddress == address(0)) {
            payable(owner()).transfer(_amount);
        } else {
            IERC20(_tokenAddress).safeTransfer(owner(), _amount);
        }
    }

    /**
     * @dev Update platform fee (only owner)
     */
    function updatePlatformFee(uint256 _newFeePercentage) external onlyOwner {
        require(_newFeePercentage <= 1000, "Fee cannot exceed 10%");
        platformFeePercentage = _newFeePercentage;
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
     * @dev Receive function for ETH
     */
    receive() external payable {}
}
