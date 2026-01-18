// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Minimal core contract used by the mock plugin.
contract HelloWorld {
    function hello() external pure returns (uint256) {
        return 42;
    }
}
