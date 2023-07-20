// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IAccount.sol";
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
// Used for signature validation
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// Access zkSync system contracts for nonce validation via NONCE_HOLDER_SYSTEM_CONTRACT
import {
    BOOTLOADER_FORMAL_ADDRESS, NONCE_HOLDER_SYSTEM_CONTRACT, DEPLOYER_SYSTEM_CONTRACT, INonceHolder
} from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
// to call non-view function of system contracts
import "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";
import "./WalletUtils.sol";
import "./UnauthorizedSignatureCalls.sol";

// BOOTLOADER_FORMAL_ADDRESS, NONCE_HOLDER_SYSTEM_CONTRACT, DEPLOYER_SYSTEM_CONTRACT,


contract rWallet is IAccount, IERC1271, WalletUtils {
    // to get transaction hash
    using TransactionHelper for Transaction;

    // state variable for account owner
    address public owner;

    bytes4 constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;

    struct NFT {
        uint256 index;
        uint256 indexByContract;
        address contract_;
        uint256 id;
        address lender;
        bool borrowed;
        uint256 startTime;
        uint256 endTime;
    }

    NFT[] private _loans;

    mapping(address =>  NFT[]) private _loansByContract;

    mapping(address => uint256) private _operatorCount;

    modifier onlyWallet() {
        require(msg.sender == address(this), "method can only be called by the account itself");
        _;
    }
    
    modifier onlyBootloader() {
        require(
            msg.sender == BOOTLOADER_FORMAL_ADDRESS,
            "Only bootloader can call this method"
        );
        // Continue execution if called from the bootloader.
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    function _beforeValidateCheck(address target, bytes memory data) private returns(bool) {
        if (data.length < 4) return true;
        bytes4 funcSel = _extractFunctionSignature(data);
        if(funcSel == APPROVE_ALL_SEL){
            if(_loansByContract[target].length > 0) return false;
            bool approved;
            assembly {
                approved := mload(add(data, 68))
            }
            if(approved) _operatorCount[target]++;
            else {
                address operator;
                assembly{
                    operator := mload(add(data, 36))
                }
                if(!approved) {
                    if(_isApprovedForAll(target, operator)) _operatorCount[target]--;
                }
            }
            return true;
        }
        if(
            funcSel == TRANSFER_SEL ||
            funcSel == SAFE_TRANSFER_SEL ||
            funcSel == SAFE_TRANSFER_DATA_SEL
        ) {
            address from;
            uint256 tokenId;
            assembly {	     
	            from := mload(add(data, 36))
	            tokenId := mload(add(data, 100))
	        }
            if(from == address(this)){
                return !_isLoan(target, tokenId);
            }
        }
        if(funcSel == APPROVE_SEL) {
            uint256 tokenId;
            assembly{
                tokenId := mload(add(data, 68))
            }
            return !_isLoan(target, tokenId);
        }
        
        return true;
    }

    function _isLoan(address contract_, uint256 tokenId) private view returns(bool){
        NFT[] memory loans_ = _loansByContract[contract_];
        for(uint i=0; i<loans_.length; i++){
            if(loans_[i].id == tokenId){
                return true;
            }
        }
        return false;
    }

    function validateTransaction(
        bytes32,
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) external payable override onlyBootloader returns (bytes4 magic) {
        bool authorized = _beforeValidateCheck(
            address(uint160(_transaction.to)),
            _transaction.data
        );
        require(authorized, "Unauthorized operations!");
        return _validateTransaction(_suggestedSignedHash, _transaction);
    }

    function _validateTransaction(
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) internal returns (bytes4 magic) {
        // Incrementing the nonce of the account.
        // Note, that reserved[0] by convention is currently equal to the nonce passed in the transaction
        SystemContractsCaller.systemCallWithPropagatedRevert(
            uint32(gasleft()),
            address(NONCE_HOLDER_SYSTEM_CONTRACT),
            0,
            abi.encodeCall(
                INonceHolder.incrementMinNonceIfEquals,
                (_transaction.nonce)
            )
        );

        bytes32 txHash;
        // While the suggested signed hash is usually provided, it is generally
        // not recommended to rely on it to be present, since in the future
        // there may be tx types with no suggested signed hash.
        if (_suggestedSignedHash == bytes32(0)) {
            txHash = _transaction.encodeHash();
        } else {
            txHash = _suggestedSignedHash;
        }

        // The fact there is are enough balance for the account
        // should be checked explicitly to prevent user paying for fee for a
        // transaction that wouldn't be included on Ethereum.
        uint256 totalRequiredBalance = _transaction.totalRequiredBalance();
        require(
            totalRequiredBalance <= address(this).balance,
            "Not enough balance for fee + value"
        );

        if (
            isValidSignature(txHash, _transaction.signature) ==
            EIP1271_SUCCESS_RETURN_VALUE
        ) {
            magic = ACCOUNT_VALIDATION_SUCCESS_MAGIC;
        } else {
            magic = bytes4(0);
        }
    }

    function executeTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        _executeTransaction(_transaction);
    }

    function _executeTransaction(Transaction calldata _transaction) internal {
        address to = address(uint160(_transaction.to));
        uint128 value = Utils.safeCastToU128(_transaction.value);
        bytes memory data = _transaction.data;

        if (to == address(DEPLOYER_SYSTEM_CONTRACT)) {
            uint32 gas = Utils.safeCastToU32(gasleft());

            // Note, that the deployer contract can only be called
            // with a "systemCall" flag.
            SystemContractsCaller.systemCallWithPropagatedRevert(
                gas,
                to,
                value,
                data
            );
        } else {
            bool success;
            assembly {
                success := call(
                    gas(),
                    to,
                    value,
                    add(data, 0x20),
                    mload(data),
                    0,
                    0
                )
            }
            require(success);
        }
    }

    function executeTransactionFromOutside(
        Transaction calldata _transaction
    ) external payable {
        _validateTransaction(bytes32(0), _transaction);
        _executeTransaction(_transaction);
    }

    function isValidSignature(
        bytes32 _hash,
        bytes memory _signature
    ) public view override returns (bytes4 magic) {
        magic = EIP1271_SUCCESS_RETURN_VALUE;

        if (_signature.length != 65) {
            // Signature is invalid anyway, but we need to proceed with the signature verification as usual
            // in order for the fee estimation to work correctly
            _signature = new bytes(65);

            // Making sure that the signatures look like a valid ECDSA signature and are not rejected rightaway
            // while skipping the main verification process.
            _signature[64] = bytes1(uint8(27));
        }

        // extract ECDSA signature
        uint8 v;
        bytes32 r;
        bytes32 s;
        // Signature loading code
        // we jump 32 (0x20) as the first slot of bytes contains the length
        // we jump 65 (0x41) per signature
        // for v we load 32 bytes ending with v (the first 31 come from s) then apply a mask
        assembly {
            r := mload(add(_signature, 0x20))
            s := mload(add(_signature, 0x40))
            v := and(mload(add(_signature, 0x41)), 0xff)
        }

        if (v != 27 && v != 28) {
            magic = bytes4(0);
        }

        // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
        // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
        // the valid range for s in (301): 0 < s < secp256k1n ÷ 2 + 1, and for v in (302): v ∈ {27, 28}. Most
        // signatures from current libraries generate a unique signature with an s-value in the lower half order.
        //
        // If your library generates malleable signatures, such as s-values in the upper range, calculate a new s-value
        // with 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - s1 and flip v from 27 to 28 or
        // vice versa. If your library also generates signatures with 0/1 for v instead 27/28, add 27 to v to accept
        // these malleable signatures as well.
        if (
            uint256(s) >
            0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
        ) {
            magic = bytes4(0);
        }

        address recoveredAddress = ecrecover(_hash, v, r, s);

        // Note, that we should abstain from using the require here in order to allow for fee estimation to work
        if (recoveredAddress != owner && recoveredAddress != address(0)) {
            magic = bytes4(0);
        }
    }

    function payForTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        bool success = _transaction.payToTheBootloader();
        require(success, "Failed to pay the fee to the operator");
    }

    function prepareForPaymaster(
        bytes32, // _txHash
        bytes32, // _suggestedSignedHash
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        _transaction.processPaymasterInput();
    }

    fallback() external {
        // fallback of default account shouldn't be called by bootloader under no circumstances
        assert(msg.sender != BOOTLOADER_FORMAL_ADDRESS);

        // If the contract is called directly, behave like an EOA
    }

    receive() external payable {
        // If the contract is called directly, behave like an EOA.
        // Note, that is okay if the bootloader sends funds with no calldata as it may be used for refunds/operator payments
    }

    // Wallet Methods //

    function getLoans() external view returns(NFT[] memory) {
        return _loans;
    }

    function getLoansByContract(address contract_) external view returns(NFT[] memory) {
        return _loansByContract[contract_];
    }

    function getOperatorCount(address contract_) public view returns(uint256) {
        return _operatorCount[contract_];
    }

    /**
     * To be called upon a rental tx by marketplace contract
     * this a requirement for marketplace to be used
     */
    // TODO: RESTRICT CALL TO TRUSTED CONTRACTS
    function uponNFTLoan(address _contract, uint256 id, address owner_, uint256 duration) external {
        NFT memory newAsset = NFT(
            _loans.length,
            _loansByContract[_contract].length,
            _contract,
            id,
            owner_,
            true,
            block.timestamp,
            block.timestamp + duration
        );
        _loans.push(newAsset);
        _loansByContract[_contract].push(newAsset);
    }


        /**
     * releaseAsset method
     * releases asset(s) from wallet.
     * should be called by owner in case loans make operations reach gas limit.
     * this might happen because `_isLoan` needs to be called at every transaction
     */
    function releaseSingleAsset(uint256 index) public onlyWallet {
        _releaseAsset(index);
    }

    function _releaseAsset(uint256 index) private {
        IERC721 nftContract = IERC721(_loans[index].contract_);
        nftContract.safeTransferFrom(
            address(this),
            _loans[index].lender,
            _loans[index].id
        );
        _subAssetFromLists(index);
    }
    
    function _subAssetFromLists(uint256 index) private {
        uint256 lastIndex = _loans.length;  
        uint256 indexByContract = _loans[index].indexByContract;
        address contract_ = _loans[index].contract_;
        _loans[index] = _loans[lastIndex];
        _loans.pop();
        lastIndex = _loansByContract[contract_].length -1;
        _loansByContract[contract_][indexByContract] = _loansByContract[contract_][lastIndex];
        _loansByContract[contract_].pop();
    }

        /**
     * @dev allows any caller to pull asset back to original owner in exchange for a fee
     * checks if assest is a loan and if loan end time was reached
     */
    function pullAsset(uint256 index) external {
        require(
            block.timestamp > _loans[index].endTime,
            "Loan duration not reached"
        );
        _releaseAsset(index);
    }
}
