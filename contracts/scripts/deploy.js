const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying PatientHealthAccessControl with account:", deployer.address);

  const Contract = await hre.ethers.getContractFactory("PatientHealthAccessControl");
  const contract = await Contract.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("PatientHealthAccessControl deployed to:", address);
  console.log("Sepolia Etherscan:", `https://sepolia.etherscan.io/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
