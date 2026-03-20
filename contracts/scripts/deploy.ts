import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const merchantRegistryFactory = await ethers.getContractFactory("DetrixMerchantRegistry");
  const sessionManagerFactory = await ethers.getContractFactory("DetrixSessionManager");
  const settlementAnchorFactory = await ethers.getContractFactory("SettlementAnchor");

  const merchantRegistry = await merchantRegistryFactory.deploy(deployer.address);
  await merchantRegistry.waitForDeployment();

  const sessionManager = await sessionManagerFactory.deploy(deployer.address);
  await sessionManager.waitForDeployment();

  const settlementAnchor = await settlementAnchorFactory.deploy(deployer.address);
  await settlementAnchor.waitForDeployment();

  console.log(
    JSON.stringify(
      {
        deployer: deployer.address,
        merchantRegistry: await merchantRegistry.getAddress(),
        sessionManager: await sessionManager.getAddress(),
        settlementAnchor: await settlementAnchor.getAddress()
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

