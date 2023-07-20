import { utils, Wallet, Provider, Contract, ContractFactory} from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import dotenv from "dotenv";
dotenv.config();

const pkey = process.env.PRIVATE_KEY;
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;

export default async function (hre: HardhatRuntimeEnvironment) {
    if(!pkey || !FACTORY_ADDRESS) throw new Error('missing env');
  // @ts-ignore target zkSyncTestnet in config file which can be testnet or local
  const provider = new Provider(hre.config.networks.zkSyncTestnet.url);
  const owner = new Wallet(pkey, provider);
  const deployer = new Deployer(hre, owner);

  const ownerBalance = await owner.getBalance();
  console.log(`\nowner balance: ${ethers.utils.formatEther(ownerBalance)}`);
  
  const factoryArtifact = await deployer.loadArtifact("rWalletFactory");
  const aaFactory = new ethers.Contract(
    FACTORY_ADDRESS,
    factoryArtifact.abi,
    owner
  );

  const salt = ethers.constants.HashZero;

  const aaArtifact = await deployer.loadArtifact("rWallet");

  const contractFactory = new ContractFactory(aaArtifact.abi, aaArtifact.bytecode, owner, "createAccount");
  const aa = await contractFactory.deploy(owner.address);
  await aa.deployed();
  console.log(`wallet deplyed at ${aa.address}`);
  return
  
  const deployTx = await aaFactory.populateTransaction.deployAccount(salt, owner.address);
  const gas = await provider.estimateGas(deployTx);
  const gasPrice = await provider.getGasPrice();
  console.log(`estimated fee: ${ethers.utils.formatEther(gas.mul(gasPrice))}`);
    return

  console.log('\ndeploying account...');
  let err: any;
  try {
    const tx = await aaFactory.deployAccount(salt, owner.address, {gasLimit: 1000000});
    await tx.wait();
  } catch (error) {
    err = error;
  }
  if(err) throw new Error(err);
  
  const abiCoder = new ethers.utils.AbiCoder();
  const accountAddress = utils.create2Address(
    FACTORY_ADDRESS,
    await aaFactory.aaBytecodeHash(),
    salt,
    abiCoder.encode(["address"], [owner.address])
  );

  console.log(`Wallet deployed at address ${accountAddress}`);
  
}
