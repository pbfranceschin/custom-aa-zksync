import { utils, Wallet, Provider, Contract , EIP712Signer, types} from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import dotenv from "dotenv";
dotenv.config();

const pkey = process.env.PRIVATE_KEY;
const NFT_ADDRESS = process.env.NFT_ADDRESS;
const ACCOUNT_ADDRESS = process.env.ACCOUNT_ADDRESS;

const populateTx = async (operation: string, contract: Contract, args: any[]) => {
    if(operation === "transfer") {
        return await contract.populateTransaction.transferFrom(args[0], args[1], args[2]);
    } else if(operation === "safeTransferFrom") {
        return await contract.populateTransaction.safeTransferFrom(args[0], args[1], args[2]);
    } else if(operation === "approve") {
        return await contract.populateTransaction.approve(args[0], args[1]);
    } else if(operation === "setApprovalForAll") {
        return await contract.populateTransaction.setApprovalForAll(args[0], args[1]);
    } else return
}

export default async function (hre: HardhatRuntimeEnvironment) {
    if(!pkey || !NFT_ADDRESS || !ACCOUNT_ADDRESS) throw new Error('missing env');
    // @ts-ignore target zkSyncTestnet in config file which can be testnet or local
    const provider = new Provider(hre.config.networks.zkSyncTestnet.url);
    
    const owner = new Wallet(pkey, provider);
    const bal = await provider.getBalance(owner.address);
    console.log(`owner balance ${ ethers.utils.formatEther(bal)} ETH`);
    
    const aaArtifact = await hre.artifacts.readArtifact("rWallet");
    const account = new Contract(ACCOUNT_ADDRESS, aaArtifact.abi, provider);
  
    const nftArtifact = await hre.artifacts.readArtifact("NFT");
    const nft = new Contract(NFT_ADDRESS, nftArtifact.abi, provider);
    
    const assets = await account.getLoans();
    if(assets.length === 0) throw new Error('no assets');
    if(!assets[0]) throw new Error('invalid assets');

    console.log(`\ntoken ${assets[0].id} of contract ${assets[0].contract_}`);

    // const operation = "transfer";
    const operation = "safeTransferFrom";
    // const operation = "approve";
    // const operation = "setApprovalForAll";
    console.log(`\noperation: ${operation}`);
    const args = [ACCOUNT_ADDRESS, owner.address, assets[0].id]; // transfer
    // const args = [owner.address, assets[0].id];                  // approve
    // const args = [owner.address, true];                          // setApprovalForAll

    let tx = await populateTx(operation, nft, args);
    if(!tx) throw new Error('invalid operation');
    tx = {
        ...tx,
        from: ACCOUNT_ADDRESS,
        chainId: (await provider.getNetwork()).chainId,
        nonce: await provider.getTransactionCount(ACCOUNT_ADDRESS),
        type: 113,
        customData: {
          gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        } as types.Eip712Meta,
        value: ethers.BigNumber.from(0),
    };

    tx.gasPrice = await provider.getGasPrice();
    tx.gasLimit = await provider.estimateGas(tx);
    
    const signedTxHash = EIP712Signer.getSignedDigest(tx);
    const signature = ethers.utils.arrayify(
        ethers.utils.joinSignature(owner._signingKey().signDigest(signedTxHash))
    );

    tx.customData = {
        ...tx.customData,
        customSignature: signature,
    };
    console.log(`sending tx...`);
    try{
        const sentTx = await provider.sendTransaction(utils.serialize(tx));
        console.log('...');
        await sentTx.wait();
    } catch(e) {
        console.log(e);
    }
}