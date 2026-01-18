import { network } from "hardhat";

async function main() {
  const { ethers, networkName } = await network.connect();
  
  console.log(`Deploying Counter to ${networkName}...`);
  const counter = await ethers.deployContract("Counter");
  
  console.log("Waiting for the deployment tx to confirm");
  await counter.waitForDeployment();
  
  console.log("Counter address:", await counter.getAddress());

  console.log("\nCalling coreHelloValue()...");
  try {
    const helloValue = await counter.coreHelloValue();
    console.log(`coreHelloValue() returned: ${helloValue}`);
  } catch (error: any) {
    console.log(`coreHelloValue() call failed: ${error.message}`);
    console.log(
      "(Expected if CORE_MOCK_ADDRESS at 0x0000000000000000000000000000000000000042 is not deployed on this network)"
    );
  }
}

main();
