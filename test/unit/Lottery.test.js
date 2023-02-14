const { deployments, getNamedAccounts, ethers, network } = require("hardhat")
const { assert, expect } = require("chai")

const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config.js")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery", function () {
      let lottery, vrfCoordinatorV2Mock, deployer, lotteryEnterenceFee, interval
      const chainId = network.config.chainId

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        lottery = await ethers.getContract("Lottery", deployer)
        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        )
        lotteryEnterenceFee = await lottery.getEnterenceFee()
        interval = await lottery.getInterval()
      })

      describe("constructor", function () {
        it("Intializes the Lottery State correctly...", async function () {
          const lotteryState = await lottery.getLotteryState()
          interval = await lottery.getInterval()
          assert.equal(lotteryState.toString(), "0")
          assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
      })

      describe("enterRaffle", function () {
        it("reverts when you didn't pay enough.... ", async function () {
          await expect(lottery.enterLottery()).to.be.revertedWithCustomError(
            lottery,
            "Lottery__NotEnoughETHEntered"
          )
        })

        it("keeps track of players when they enters the lottery...", async function () {
          await lottery.enterLottery({ value: lotteryEnterenceFee })
          const playerFromContract = await lottery.getPlayer(0)
          assert.equal(playerFromContract, deployer)
        })

        it("emits events on enter... ", async function () {
          await expect(
            lottery.enterLottery({ value: lotteryEnterenceFee })
          ).to.emit(lottery, "LotteryEnter")
        })

        it("doesn't allow enterence when lottery is calculating...  ", async function () {
          await lottery.enterLottery({ value: lotteryEnterenceFee })
          await network.provider.request({
            method: "evm_increaseTime",
            params: [interval.toNumber() + 1],
          })
          await network.provider.request({
            method: "evm_mine",
            params: [],
          })

          // We will pretend to be a chainlink keeper
          await lottery.performUpkeep([])

          const getState = await lottery.getLotteryState()
          console.log(getState)
          await expect(
            lottery.enterLottery({ value: lotteryEnterenceFee })
          ).to.be.revertedWithCustomError(lottery, `Lottery__NotOpen`)
        })
      })

      describe("checkUpKeep", function () {
        it("retuns false if someone has not sent any funds...", async function () {
          await network.provider.request({
            method: "evm_increaseTime",
            params: [interval.toNumber() + 1],
          })
          await network.provider.request({
            method: "evm_mine",
            params: [],
          })
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          await expect(upkeepNeeded, false)
        })

        it("returns false if lottery isn't open...", async function () {
          await lottery.enterLottery({ value: lotteryEnterenceFee })
          await network.provider.request({
            method: "evm_increaseTime",
            params: [interval.toNumber() + 1],
          })
          await network.provider.request({
            method: "evm_mine",
            params: [],
          })
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          await expect(upkeepNeeded, false)
        })

        it("returns false if enough time has not passed...", async function () {
          await lottery.enterLottery({ value: lotteryEnterenceFee })
          await network.provider.request({
            method: "evm_increaseTime",
            params: [interval.toNumber() - 1],
          })
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          await expect(upkeepNeeded, false)
        })

        it("returns false if lottery has not any player...", async function () {
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          await (upkeepNeeded, false)
        })

        it("returns true only if someone has sent some fund....", async function () {
          await lottery.enterLottery({ value: lotteryEnterenceFee })
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
          await expect(upkeepNeeded, true)
        })
      })

      describe("performUpKeep", function () {
        it("it will revert if checkupkeep returns upkeepneeded false.....", async function () {
          await expect(lottery.performUpkeep([])).to.be.revertedWithCustomError(
            lottery,
            "Lottery__UpkeedNotNeeded"
          )
        })

        it("can only run if checkUpKeep is true...", async function () {
          await lottery.enterLottery({ value: lotteryEnterenceFee })
          await network.provider.request({
            method: "evm_increaseTime",
            params: [interval.toNumber() + 1],
          })
          await network.provider.request({
            method: "evm_mine",
            params: [],
          })
          const tx = await lottery.performUpkeep([])
          assert(tx)
        })

        it("updates the lottery state, emits an event, and calls the vrf coordinator...", async function () {
          await lottery.enterLottery({ value: lotteryEnterenceFee })
          await network.provider.request({
            method: "evm_increaseTime",
            params: [interval.toNumber() + 1],
          })
          await network.provider.request({
            method: "evm_mine",
            params: [],
          })

          const txResponse = await lottery.performUpkeep([])
          const txRecipt = await txResponse.wait(1)

          const requestId = txRecipt.events[1].args.requestId
          lotteryState = await lottery.getLotteryState()
          assert(requestId.toNumber() > 0)
          assert(lotteryState == 1)
        })
      })

      describe("fulfillRandomWords", function () {
        beforeEach(async function () {
          await lottery.enterLottery({ value: lotteryEnterenceFee })
          await network.provider.request({
            method: "evm_increaseTime",
            params: [interval.toNumber() + 1],
          })
          await network.provider.request({
            method: "evm_mine",
            params: [],
          })
        })

        it("can only be called after performUpkeep...", async function () {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)
          ).to.be.revertedWith("nonexistent request")
        })

        it("picks a winnner, resets the lottery, and sends money", async function () {
          const additionalEntrants = 3
          const startingAccountIndex = 1
          const accounts = await ethers.getSigners()
          for (
            i = startingAccountIndex;
            i < additionalEntrants + startingAccountIndex;
            i++
          ) {
            const accountConnectedLottery = lottery.connect(accounts[i])
            await accountConnectedLottery.enterLottery({
              value: lotteryEnterenceFee,
            })
          }
          const startingTimeStamp = await lottery.getLatestTimeStamp()

          await new Promise(async (resolve, reject) => {
            lottery.once("WinnerPicked", async () => {
              try {
                // console.log(accounts[1].address)
                // console.log(accounts[2].address)
                // console.log(accounts[3].address)
                // console.log(accounts[4].address)
                const recentWinner = await lottery.getRecentWinner()
                // console.log(recentWinner)

                const winnerEndingBalance = await accounts[1].getBalance()
                const lotteryState = await lottery.getLotteryState()
                const endingTimeStamp = await lottery.getLatestTimeStamp()
                const numPlayers = await lottery.getNumberOfPlayers()
                assert.equal(numPlayers.toString(), "0")
                assert.equal(lotteryState.toString(), "0")
                assert(endingTimeStamp > startingTimeStamp)

                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance
                    .add(
                      lotteryEnterenceFee
                        .mul(additionalEntrants)
                        .add(lotteryEnterenceFee)
                    )
                    .toString()
                )
                resolve()
              } catch (e) {
                reject(e)
              }
            })
            const tx = await lottery.performUpkeep([])
            const txReceipt = await tx.wait(1)
            console.log(accounts[2].address)
            const winnerStartingBalance = await accounts[1].getBalance()
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              lottery.address
            )
          })
        })
      })
    })
