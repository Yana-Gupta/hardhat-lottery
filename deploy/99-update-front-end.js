const { ethers, network } = require("hardhat")
const fs = require("fs")

const FRONT_END_ADDRESS_FILE = `../nextjs-frontend-lottery/constants/contractAddresses.json`
const FRONT_END_ABI_FILE = `../nextjs-frontend-lottery/constants/abi.json`

module.exports = async function () {
  if (process.env.UPDATE_FRONT_END) {
    console.log("updating 📈 frontend...")
    updateContractAddresses()
    updateAbi()
  }
}

async function updateAbi() {
  const lottery = await ethers.getContract("Lottery")
  fs.writeFileSync(
    FRONT_END_ABI_FILE,
    lottery.interface.format(ethers.utils.FormatTypes.json)
  )
}

async function updateContractAddresses() {
  const lottery = await ethers.getContract("Lottery")
  const chainId = network.config.chainId.toString()
  const contractAddress = JSON.parse(fs.readFileSync(FRONT_END_ADDRESS_FILE, "utf8"))
  if (chainId in contractAddress) {
    if (!contractAddress[chainId].includes(lottery.address)) {
      contractAddress[chainId].push(lottery.address)
    }
  } else {
    contractAddress[chainId] = [lottery.address]
  }
  fs.writeFileSync(FRONT_END_ADDRESS_FILE, JSON.stringify(contractAddress))
}

module.exports.tags = ["all", "frontend"]
