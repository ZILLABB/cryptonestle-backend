// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CryptonestleToken (CNEST)
 * @dev Platform token for Cryptonestle ecosystem
 * Features: Burnable, Pausable, Mintable (by owner)
 */
contract CryptonestleToken is ERC20, ERC20Burnable, Pausable, Ownable {
    
    // Token details
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 billion tokens
    uint256 public constant INITIAL_SUPPLY = 100000000 * 10**18; // 100 million tokens
    
    // Vesting and distribution
    mapping(address => uint256) public vestedTokens;
    mapping(address => uint256) public vestingReleaseTime;
    
    // Staking rewards
    mapping(address => uint256) public stakingRewards;
    mapping(address => uint256) public lastStakeTime;
    
    // Platform features
    bool public stakingEnabled = false;
    uint256 public stakingRewardRate = 100; // 1% per year (100 basis points)
    
    // Events
    event TokensVested(address indexed beneficiary, uint256 amount, uint256 releaseTime);
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event StakingRewardClaimed(address indexed user, uint256 amount);
    event StakingStatusChanged(bool enabled);

    constructor() ERC20("Cryptonestle Token", "CNEST") Ownable(msg.sender) {
        // Mint initial supply to contract deployer
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    /**
     * @dev Mint new tokens (only owner, respects max supply)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds maximum supply");
        _mint(to, amount);
    }

    /**
     * @dev Vest tokens for a beneficiary
     */
    function vestTokens(
        address beneficiary,
        uint256 amount,
        uint256 releaseTime
    ) external onlyOwner {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Amount must be greater than 0");
        require(releaseTime > block.timestamp, "Release time must be in the future");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Transfer tokens to this contract for vesting
        _transfer(msg.sender, address(this), amount);
        
        vestedTokens[beneficiary] += amount;
        vestingReleaseTime[beneficiary] = releaseTime;

        emit TokensVested(beneficiary, amount, releaseTime);
    }

    /**
     * @dev Release vested tokens
     */
    function releaseVestedTokens() external {
        uint256 amount = vestedTokens[msg.sender];
        require(amount > 0, "No vested tokens");
        require(block.timestamp >= vestingReleaseTime[msg.sender], "Tokens not yet vested");

        vestedTokens[msg.sender] = 0;
        _transfer(address(this), msg.sender, amount);

        emit TokensReleased(msg.sender, amount);
    }

    /**
     * @dev Enable/disable staking
     */
    function setStakingEnabled(bool _enabled) external onlyOwner {
        stakingEnabled = _enabled;
        emit StakingStatusChanged(_enabled);
    }

    /**
     * @dev Set staking reward rate (basis points)
     */
    function setStakingRewardRate(uint256 _rate) external onlyOwner {
        require(_rate <= 10000, "Rate cannot exceed 100%");
        stakingRewardRate = _rate;
    }

    /**
     * @dev Stake tokens for rewards
     */
    function stakeTokens(uint256 amount) external whenNotPaused {
        require(stakingEnabled, "Staking is not enabled");
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Calculate pending rewards before updating stake
        _updateStakingRewards(msg.sender);

        // Transfer tokens to contract for staking
        _transfer(msg.sender, address(this), amount);
        
        lastStakeTime[msg.sender] = block.timestamp;
    }

    /**
     * @dev Unstake tokens
     */
    function unstakeTokens(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(address(this)) >= amount, "Insufficient staked balance");

        // Calculate and update rewards
        _updateStakingRewards(msg.sender);

        // Transfer tokens back to user
        _transfer(address(this), msg.sender, amount);
    }

    /**
     * @dev Claim staking rewards
     */
    function claimStakingRewards() external {
        _updateStakingRewards(msg.sender);
        
        uint256 rewards = stakingRewards[msg.sender];
        require(rewards > 0, "No rewards to claim");

        stakingRewards[msg.sender] = 0;
        
        // Mint rewards (if within max supply)
        if (totalSupply() + rewards <= MAX_SUPPLY) {
            _mint(msg.sender, rewards);
        }

        emit StakingRewardClaimed(msg.sender, rewards);
    }

    /**
     * @dev Update staking rewards for a user
     */
    function _updateStakingRewards(address user) internal {
        if (lastStakeTime[user] == 0) return;

        uint256 timeStaked = block.timestamp - lastStakeTime[user];
        uint256 stakedBalance = balanceOf(address(this)); // Simplified - in production, track per user
        
        if (timeStaked > 0 && stakedBalance > 0) {
            uint256 rewards = (stakedBalance * stakingRewardRate * timeStaked) / (365 days * 10000);
            stakingRewards[user] += rewards;
        }

        lastStakeTime[user] = block.timestamp;
    }

    /**
     * @dev Get user's staking information
     */
    function getStakingInfo(address user) external view returns (
        uint256 stakedAmount,
        uint256 pendingRewards,
        uint256 stakeTime
    ) {
        stakedAmount = balanceOf(address(this)); // Simplified
        pendingRewards = stakingRewards[user];
        stakeTime = lastStakeTime[user];
    }

    /**
     * @dev Pause token transfers (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause token transfers (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Override update to include pause functionality
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._update(from, to, amount);
    }

    /**
     * @dev Batch transfer tokens to multiple addresses
     */
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            transfer(recipients[i], amounts[i]);
        }
    }

    /**
     * @dev Emergency token recovery (only owner)
     */
    function emergencyTokenRecovery(
        address tokenAddress,
        uint256 amount
    ) external onlyOwner {
        require(tokenAddress != address(this), "Cannot recover own tokens");
        IERC20(tokenAddress).transfer(owner(), amount);
    }

    /**
     * @dev Get token information
     */
    function getTokenInfo() external view returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint256 tokenDecimals,
        uint256 tokenTotalSupply,
        uint256 tokenMaxSupply
    ) {
        tokenName = name();
        tokenSymbol = symbol();
        tokenDecimals = decimals();
        tokenTotalSupply = totalSupply();
        tokenMaxSupply = MAX_SUPPLY;
    }
}
