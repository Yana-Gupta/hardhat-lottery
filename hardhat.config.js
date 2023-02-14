require("@nomicfoundation/hardhat-toolbox")
require("hardhat-deploy")
require("hardhat-gas-reporter")
require("@nomiclabs/hardhat-ethers");
require("hardhat-deploy-ethers");
require("dotenv").config()



module.exports = {
  paths: {
    artifacts: "./build",
  },
  solidity: "0.8.17",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      blockConformations: 1,
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL,
      accounts: [ process.env.PRIVATE_KEY1, process.env.PRIVATE_KEY2],
      chainId: 5,
      blockConformations: 5,
      gas: 2100000,
      gasPrice: 80000000, 
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
      1: 0,
    },
    player: {
      default: 1,
    },
  },
  mocha: {
    timeout: 300000,
  },
  etherscan: {
    apiKey: {
      goerli: process.env.ETHERSCAN_API_KEY
    }
  }
};
