import { Wallet, Contract, Provider, EIP712Signer, types, utils } from "zksync-web3";
import { ethers, BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import dotenv from "dotenv";
import fundAccount from "./fund-account";
dotenv.config();


const pkey = process.env.PRIVATE_KEY;
// const pkey = "f02d097a4059c83f459856e8455f63ad8fc1b260ba35871ac03d60e94304712c";
const ACCOUNT_ADDRESS = process.env.ACCOUNT_ADDRESS;
// const ACCOUNT_ADDRESS = "0x0E1E6FCf9704f4122b792b7078C5D8e00BF13393";
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
 
const transferToAccount = async (contract: Contract, sender: Wallet, value: number): Promise<any> => {
    // let err: any;
    // try {
        console.log(`\ntransfering ${value} tokens to ${ACCOUNT_ADDRESS}`);
        const tx = await contract.connect(sender).transfer(ACCOUNT_ADDRESS, value);
        console.log('\n...');
        const receipt = await tx.wait();
        console.log('\ntx', receipt.transactionHash);
    // } catch (error) {
    //     console.log(error);
    //     err = error
    // }
    // if(err) return
    return 1;
}

export default async function (hre: HardhatRuntimeEnvironment) {
    if(!pkey || !ACCOUNT_ADDRESS || !TOKEN_ADDRESS) throw new Error("missing env");
    // @ts-ignore target zkSyncTestnet in config file which can be testnet or local
    const provider = new Provider(hre.config.networks.zkSyncTestnet.url);
    const owner = new Wallet(pkey, provider);
    
    const tokenArtifact = await hre.artifacts.readArtifact("TestToken");
    const token = new Contract(TOKEN_ADDRESS, tokenArtifact.abi, provider);

    // console.log("\nchecking sender's token balance...");
    // console.log('bal:', (await token.balanceOf(owner.address)).toString());
    // // const success = await transferToAccount(token, owner, 50);
    // // if(!success) throw new Error('transaction to account failed');
    
    console.log("\nchecking account's balance...");
    console.log('bal: ', (await token.balanceOf(ACCOUNT_ADDRESS)).toString() );
    
    console.log('\n...');
    const amount = 10;
    let transferTx = await token.populateTransaction.transfer(owner.address, amount);
    transferTx = {
        ...transferTx,
        from: ACCOUNT_ADDRESS,
        chainId: (await provider.getNetwork()).chainId,
        nonce: await provider.getTransactionCount(ACCOUNT_ADDRESS),
        type: 113,
        customData: {
          gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        } as types.Eip712Meta,
        value: ethers.BigNumber.from(0),
    };

    transferTx.gasPrice = await provider.getGasPrice();
    transferTx.gasLimit = await provider.estimateGas(transferTx);
    
    const signedTxHash = EIP712Signer.getSignedDigest(transferTx);
    const signature = ethers.utils.arrayify(
        ethers.utils.joinSignature(owner._signingKey().signDigest(signedTxHash))
    );

    transferTx.customData = {
        ...transferTx.customData,
        customSignature: signature,
    };
    console.log(`transfering ${amount} tokens to ${owner.address}`)
    const sentTx = await provider.sendTransaction(utils.serialize(transferTx));
    console.log('...');
    await sentTx.wait();
  
}