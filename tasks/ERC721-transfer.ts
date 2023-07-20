import { Wallet, Contract, Provider, EIP712Signer, types, utils } from "zksync-web3";
import { BigNumber, ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import dotenv from "dotenv";
dotenv.config();

// ******
// to run script: yarn hardhat run scripts/ERC20-transfer.ts --network <network-name>
// ******

const pkey = process.env.PRIVATE_KEY;
const ACCOUNT_ADDRESS = "";
const NFT_ADDRESS = "";
const tokenUri = "trossoqualquer";

const mint = async (
    nft: Contract,
    minter: Wallet,
    to: string
): Promise<any> => {
    let tokenId: any;
    let err: any;
    try {
        console.log('\nminting...');
        const mint = await nft.connect(minter).safeMint(to, tokenUri);
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

async function ERC721Transfer (hre: HardhatRuntimeEnvironment) {
    if(!pkey) throw new Error("missing private key");
    // @ts-ignore target zkSyncTestnet in config file which can be testnet or local
    const provider = new Provider(hre.config.networks.zkSyncTestnet.url);
    console.log('*******checkpoint*******');
    const owner = new Wallet(pkey, provider);
    const accountArtifact = await hre.artifacts.readArtifact("AAAccount");
    const account = new Contract(ACCOUNT_ADDRESS, accountArtifact.abi, owner);
    const nftArtifact = await hre.artifacts.readArtifact("NFT");
    const nft = new Contract(NFT_ADDRESS, nftArtifact.abi, owner);

    const tokenId = await mint(nft, owner, account.address);
    if(!tokenId) throw new Error('mint transaction failed');

    console.log('\n...');
    let ERC20transferTx = await nft.populateTransaction.safeTransferFrom(
        account.address, owner.address, tokenId
    );
    ERC20transferTx = {
        ...ERC20transferTx,
        from: account.address,
        chainId: (await provider.getNetwork()).chainId,
        nonce: await provider.getTransactionCount(account.address),
        type: 113,
        customData: {
            gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
          } as types.Eip712Meta,
        value: ethers.BigNumber.from(0),
    };
    
    ERC20transferTx.gasPrice = await provider.getGasPrice();
    ERC20transferTx.gasLimit = await provider.estimateGas(ERC20transferTx);

    const signedTxHash = EIP712Signer.getSignedDigest(ERC20transferTx);
    const signature = ethers.utils.arrayify(
        ethers.utils.joinSignature(owner._signingKey().signDigest(signedTxHash))
    );

    ERC20transferTx.customData = {
        ...ERC20transferTx.customData,
        customSignature: signature,
    };
    console.log(`\ntransfering token ${tokenId} to ${owner.address}...`);
    const transfer = await provider.sendTransaction(utils.serialize(ERC20transferTx));
    const receipt = await transfer.wait();
    console.log(`\ntransfer tx: ${receipt.transactionHash}`);
    console.log('\nchecking new owner...');
    const newOwner = await nft.ownerOf(tokenId);
    console.log(`\nnew owner == ${owner.address}?` , newOwner==owner.address);
}

export default ERC721Transfer;