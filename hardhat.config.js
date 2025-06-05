require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 5,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    mainnet: {
      url: process.env.ETH_RPC_URL || "",
      accounts: process.env.ETH_PRIVATE_KEY && process.env.ETH_PRIVATE_KEY.length === 66 ? [process.env.ETH_PRIVATE_KEY] : [],
      chainId: 1,
    },
    bsc: {
      url: process.env.BSC_RPC_URL || "",
      accounts: process.env.BSC_PRIVATE_KEY && process.env.BSC_PRIVATE_KEY.length === 66 ? [process.env.BSC_PRIVATE_KEY] : [],
      chainId: 56,
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: process.env.BSC_PRIVATE_KEY && process.env.BSC_PRIVATE_KEY.length === 66 ? [process.env.BSC_PRIVATE_KEY] : [],
      chainId: 97,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "",
      accounts: process.env.POLYGON_PRIVATE_KEY && process.env.POLYGON_PRIVATE_KEY.length === 66 ? [process.env.POLYGON_PRIVATE_KEY] : [],
      chainId: 137,
    },
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com/",
      accounts: process.env.POLYGON_PRIVATE_KEY && process.env.POLYGON_PRIVATE_KEY.length === 66 ? [process.env.POLYGON_PRIVATE_KEY] : [],
      chainId: 80001,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
