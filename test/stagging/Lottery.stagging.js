const { deployments, getNamedAccounts, ethers, network } = require("hardhat")
const { assert, expect } = require("chai")

const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config.js")

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery", function () {
      let lottery, deployer, lotteryEnterenceFee

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        lottery = await ethers.getContract("Lottery", deployer)
        lotteryEnterenceFee = await lottery.getEnterenceFee()
      })

      describe("fulfillRandwomWords", function () {
        it("works with live chainlink Keepers and Chainklink VRF, we get a random winner", async function () {
          const startingTimeStamp = await lottery.getLatestTimeStamp()
          const accounts = await ethers.getSigners()
          await new Promise(async (resolve, reject) => {
            console.log("WinnerPicked event fired!")
            lottery.once("WinnterPicked", async () => {
              try {
                const recentWinner = await lottery.getRecentWinner()
                const lotteryState = await lottery.getLotteryState()
                const winnerEndingBalance = await accounts[0].getBalance()
                const endgingTimeStamp = await lottery.getLatestTimeStamp()

                await expect(lottery.getPlayer(0)).to.be.reverted
                assert.equal(recentWinner.toString(), accounts[0].toString())
                assert.equal(lotteryState, 0)
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(lotteryEnterenceFee).toString()
                )

                assert.equal(endgingTimeStamp > startingTimeStamp)
                resolve()
              } catch (e) {
                reject(e)
              }
            })
            await lottery.enterLottery({ value: lotteryEnterenceFee })
            const winnerStartingBalance = await accounts[0].getBalance
          })
        })
      })
    })
