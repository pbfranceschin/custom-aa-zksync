import { utils, Wallet, Provider, EIP712Signer, types, Contract } from "zksync-web3";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ethers } from "hardhat";
import * as hre from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const pkey = process.env.PRIVATE_KEY;

async function deployAccount(owner: string, deployer: Deployer): Promise<Contract>{
    const artifact = await deployer.loadArtifact("RWallet");
    return await deployer.deploy(artifact, [owner]);
}

async function deployNFT(deployer: Deployer): Promise<Contract>{
    const artifact = await deployer.loadArtifact("NFT");
    return await deployer.deploy(artifact, []);
}

describe("Testing Wallet", function () {
    
    if(!pkey) throw new Error("missing private key");
    const provider = Provider.getDefaultProvider();
    let tokenId: BigNumber;
    let aaWallet: Contract;
    let nft: Contract;
    let owner: Wallet    ;
    let dummy: Wallet;
    // const provider = ethers.provider;

    
    before(async () => {
        
        const [owner, dummy] = await ethers.getSigners();
        const dummy1 = new Wallet(pkey, provider);
        const deployer = new Deployer(hre, dummy1);

        // const aaFactory = new RWallet__factory(owner)
        aaWallet = await deployAccount(owner.address, deployer);
        // aaWallet = await factory.deploy(owner.address);
        console.log(`\nwallet deployed at ${aaWallet.address}\n`);
        nft = await deployNFT(deployer);
        // const nftFactory = new NFT__factory(dummy);
        // nft = await nftFactory.deploy();
        console.log(`nft deployed at ${nft.address}\n`);
        const mintTx = await nft.connect(dummy1).safeMint(aaWallet.address);
        const mintReceipt = await mintTx.wait();
        const mintEvent = mintReceipt.events?.find((event: any) => event.event === 'Transfer');
        tokenId = mintEvent?.args?.tokenId;
        const nft1owner = await nft.ownerOf(tokenId);
        expect(nft1owner).to.eq(aaWallet.address);
        console.log(`\nnft ${tokenId} minted to ${aaWallet.address}\n`);
    });
});