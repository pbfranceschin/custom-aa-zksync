import { utils, Wallet, Provider } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import dotenv from "dotenv";
dotenv.config();

const pkey = process.env.PRIVATE_KEY;
// const pkey = "f02d097a4059c83f459856e8455f63ad8fc1b260ba35871ac03d60e94304712c";

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(`pkey ${pkey}`);
  if(!pkey) throw new Error('missing private key');
  // @ts-ignore target zkSyncTestnet in config file which can be testnet or local
  const provider = new Provider(hre.config.networks.zkSyncTestnet.url);
  const owner = new Wallet(pkey, provider);
  const deployer = new Deployer(hre, owner);

  const tokenArtifact = await deployer.loadArtifact("TestToken");
  console.log('\ndeploying token contract...');
  const token = await deployer.deploy(tokenArtifact, []);
  console.log(`\ntoken contract address: ${token.address}`);
  
}