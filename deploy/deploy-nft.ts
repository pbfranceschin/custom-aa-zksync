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
//   console.log(owner.address);
//   return
  const deployer = new Deployer(hre, owner);

  // Bridge funds if the wallet on zkSync doesn't have enough funds.
  // const depositAmount = ethers.utils.parseEther('0.1');
  // const depositHandle = await deployer.zkWallet.deposit({
  //   to: deployer.zkWallet.address,
  //   token: utils.ETH_ADDRESS,
  //   amount: depositAmount,
  // });
  // await depositHandle.wait();
  
  const nftArtifact = await deployer.loadArtifact("NFT");
  console.log('\ndeploying nft contract...');
  const nft = await deployer.deploy(nftArtifact, []);
  console.log(`\nNFT contract address: ${nft.address}`);
  
}
