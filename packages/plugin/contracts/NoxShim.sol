// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Nox} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

contract NoxShim {
    function noxComputeAddress() external view returns (address) {
        return Nox.noxComputeContract();
    }
}
