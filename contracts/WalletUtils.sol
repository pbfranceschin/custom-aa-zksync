// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract WalletUtils {

    function _extractFunctionSignature(bytes memory data) internal pure returns (bytes4) {
        // require(data.length >= 4, "Invalid data length");
        bytes4 functionSelector;
        assembly {
            functionSelector := mload(add(data, 32))
        }
        return functionSelector;
    }

    function _getNFTowner(address contract_, uint256 tokenId) internal view returns(address) {
        IERC721 nftContract = IERC721(contract_);
        return nftContract.ownerOf(tokenId);
    }

    // CHANGE: use .call to save gas
    function _isApproved(address contract_, uint256 tokenId) internal view returns(bool) {
        IERC721 nftContract = IERC721(contract_);
        return nftContract.getApproved(tokenId) != address(0);
    }

    function _isApprovedForAll(address contract_, address operator) internal view returns(bool) {
        IERC721 nftContract = IERC721(contract_);
        return nftContract.isApprovedForAll(address(this), operator);
    }


}