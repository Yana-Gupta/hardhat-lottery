const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")

const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30")

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const deployer = await getNamedAccounts()
  const chainId = network.config.chainId
  let vrfCoordinatorV2Address, subscriptionId

  if (developmentChains.includes(network.name)) {
    const VRFCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    )

    vrfCoordinatorV2Address = VRFCoordinatorV2Mock.address

    const transactionResponse = await VRFCoordinatorV2Mock.createSubscription()
    const transactionReceipt = await transactionResponse.wait(1)
    subscriptionId = transactionReceipt.events[0].args[0]
    await VRFCoordinatorV2Mock.fundSubscription(
      subscriptionId,
      VRF_SUB_FUND_AMOUNT
    )
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorv2"]
    subscriptionId = networkConfig[chainId]["subscriptionId"]
  }

  const enterenceFee = networkConfig[chainId]["enterenceFee"]
  const gasLane = networkConfig[chainId]["gasLane"]
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
  const interval = networkConfig[chainId]["interval"]
  const arguments = [
    vrfCoordinatorV2Address,
    enterenceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ]

  const lottery = await deploy("Lottery", {
    from: deployer.deployer,
    args: arguments,
    log: true,
    waitConformations: network.config.blockConformations || 1,
  })

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifying ..........")
    await verify(lottery.address, arguments)
  }

  log("--------------------------------------------")
}

module.exports.tags = ["all", "lottery"]
