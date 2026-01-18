// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface ICoreHelloWorld {
    function hello() external view returns (uint256);
}

contract Counter {
    uint public x;

    event Increment(uint by);

    address public constant CORE_MOCK_ADDRESS =
        0x0000000000000000000000000000000000000042;

    function inc() public {
        x++;
        emit Increment(1);
    }

    function incBy(uint by) public {
        require(by > 0, "incBy: increment should be positive");
        x += by;
        emit Increment(by);
    }

    function coreHelloValue() public view returns (uint256) {
        return ICoreHelloWorld(CORE_MOCK_ADDRESS).hello();
    }
}
