const { run } = require("hardhat")

const verify = async (contractAddress, arguments) => {
  console.log("Verifying Contract... ")

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: arguments,
    })
  } catch (e) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already verified 🇵🇲 ")
    } else {
      console.log("Error ❄️ : ", e)
    }
  }
}

module.exports = { verify }
