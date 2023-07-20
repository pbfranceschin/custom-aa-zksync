import { Wallet, Contract, Provider, EIP712Signer, types, utils } from "zksync-web3";
import { ethers, BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import dotenv from "dotenv";
dotenv.config();


const pkey = process.env.PRIVATE_KEY;
const NFT_ADDRESS = process.env.NFT_ADDRESS;
const tokenUri = "https://ipfs.filebase.io/ipfs/QmZtGwzymqv9SzNvVBuxV2SnxX9SzsP2DBZWiA2Kq7rAgb";
const ACCOUNT_ADDRESS = process.env.ACCOUNT_ADDRESS;

const mint = async (
    nft: Contract,
    minter: Wallet,
    to: string
): Promise<any> => {
    let tokenId: any;
    let err: any;
    
    try {        
        console.log('\nminting...');
        const mint = await nft.connect(minter).mint(to, tokenUri);
        const receipt = await mint.wait();
        console.log(receipt);
        console.log(`\nmint tx: ${receipt.transactionHash}`);
        const mintEvent = receipt.events?.find((event: any) => event.event === 'Transfer');
        tokenId = mintEvent?.args?.tokenId;
    } catch (error) {
        console.log(error);
        err = error;
    }
    if(err) return;
    const owner = await nft.ownerOf(tokenId);
    if(owner == to) console.log(`\ntoken ${tokenId} successfully mintet to ${to}`);
    else {
        console.log(`\nreturned owner of token ${tokenId}: ${owner}`);
        return;
    } 
    return tokenId
}

export default async function (hre: HardhatRuntimeEnvironment) {
    if(!pkey || !ACCOUNT_ADDRESS || !NFT_ADDRESS) throw new Error('missing env');
  // @ts-ignore target zkSyncTestnet in config file which can be testnet or local
  const provider = new Provider(hre.config.networks.zkSyncTestnet.url);
  
  const owner = new Wallet(pkey, provider);
  console.log('\naccount', ACCOUNT_ADDRESS, '\nnft', NFT_ADDRESS, '\nowner', owner.address);
  const bal = await provider.getBalance(owner.address);
  console.log(`owner balance ${ ethers.utils.formatEther(bal)} ETH`);
  console.log('check1')
  const aaArtifact = await hre.artifacts.readArtifact("rWallet");
  const account = new Contract(ACCOUNT_ADDRESS, aaArtifact.abi, provider);
  console.log('check2')
  const nftArtifact = await hre.artifacts.readArtifact("NFT");
  const nft = new Contract(NFT_ADDRESS, nftArtifact.abi, provider);
  console.log('check3')
//   const tokenId = await mint(nft, owner, ACCOUNT_ADDRESS);
//   if(!tokenId) throw new Error('mint failed');
  const tokenId = 4;
  

  const uponRent = await account.connect(owner).uponNFTLoan(
    NFT_ADDRESS,
    tokenId,
    owner.address,
    100
  );
  await uponRent.wait();
  console.log(`\nuponRent tx: ${uponRent.hash}`);

  console.log(`\nloans: ${await account.getLoans()}`);
  

}