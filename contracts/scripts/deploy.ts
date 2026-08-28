import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Déploiement avec :", deployer.address);

  const SmartVote = await ethers.getContractFactory("SmartVote");
  const smartVote = await SmartVote.deploy();
  await smartVote.waitForDeployment();

  const address = await smartVote.getAddress();
  console.log("SmartVote déployé à :", address);
  console.log("\nÀ copier dans backend/.env :");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
