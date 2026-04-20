// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/token/ERC7984.sol";
import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/**
 * @title MyConfidentialToken
 * @notice Minimal ERC-7984 confidential fungible token used as a sample for the
 *         `@iexec-nox/nox-hardhat-plugin` example project.
 */
contract MyConfidentialToken is ERC7984 {
    address public immutable OWNER;

    error NotOwner(address caller);

    constructor(string memory name_, string memory symbol_, string memory contractURI_)
        ERC7984(name_, symbol_, contractURI_)
    {
        OWNER = msg.sender;
    }

    /// @notice Mint an encrypted amount to `to`. Only callable by the owner.
    function mint(address to, externalEuint256 encryptedAmount, bytes calldata inputProof) external returns (euint256) {
        require(msg.sender == OWNER, NotOwner(msg.sender));
        return _mint(to, Nox.fromExternal(encryptedAmount, inputProof));
    }
}
