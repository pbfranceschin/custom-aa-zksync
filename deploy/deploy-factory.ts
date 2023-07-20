import { utils, Wallet, Provider } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

import * as dotenv from "dotenv";
dotenv.config();

const pkey = process.env.PRIVATE_KEY;

export default async function (hre: HardhatRuntimeEnvironment) {
  if(!pkey) throw new Error('missing env');
  // @ts-ignore target zkSyncTestnet in config file which can be testnet or local
  const provider = new Provider(hre.config.networks.zkSyncTestnet.url);
  const owner = new Wallet(pkey, provider);
  const deployer = new Deployer(hre, owner);
  const factoryArtifact = await deployer.loadArtifact("rWalletFactory");
  const aaArtifact = await deployer.loadArtifact("rWallet");

  // print owner balance
  const ownerBalance = await owner.getBalance();
  console.log(`owner balance: ${ethers.utils.formatEther(ownerBalance)}`);
  if (ownerBalance.toString() === "0") {
    throw new Error("no funds on wallet");
  }

  const factory = await deployer.deploy(
    factoryArtifact,
    [utils.hashBytecode(aaArtifact.bytecode)],
    undefined,
    [aaArtifact.bytecode]
  );

  console.log(`wallet factory address: ${factory.address}`);

//   const aaFactory = new ethers.Contract(
//     factory.address,
//     factoryArtifact.abi,
//     wallet
//   );

//   const owner = Wallet.createRandom();
//   console.log("SC Account owner pk: ", owner.privateKey);

//   const salt = ethers.constants.HashZero;
//   const tx = await aaFactory.deployAccount(salt, owner.address);
//   await tx.wait();

//   const abiCoder = new ethers.utils.AbiCoder();
//   const accountAddress = utils.create2Address(
//     factory.address,
//     await aaFactory.aaBytecodeHash(),
//     salt,
//     abiCoder.encode(["address"], [owner.address])
//   );

//   console.log(`SC Account deployed on address ${accountAddress}`);

//   console.log("Funding smart contract account with some ETH");
//   await (
//     await wallet.sendTransaction({
//       to: accountAddress,
//       value: ethers.utils.parseEther("0.002"),
//     })
//   ).wait();
//   console.log(`Done!`);
}
