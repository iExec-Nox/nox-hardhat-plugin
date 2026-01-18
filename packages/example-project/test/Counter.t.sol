// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Counter} from "../contracts/Counter.sol";
import {Test} from "forge-std/Test.sol";

contract CounterTest is Test {
    Counter counter;

    function setUp() public {
        counter = new Counter();
    }

    function test_InitialValue() public view {
        require(counter.x() == 0, "Initial value should be 0");
    }

    function testFuzz_Inc(uint8 x) public {
        for (uint8 i = 0; i < x; i++) {
            counter.inc();
        }
        require(
            counter.x() == x,
            "Value after calling inc x times should be x"
        );
    }

    function test_IncByZero() public {
        vm.expectRevert();
        counter.incBy(0);
    }

    function test_CoreHelloValue() public {
        // Deploy a mock HelloWorld contract at the expected address
        address coreAddress = counter.CORE_MOCK_ADDRESS();
        
        // Deploy mock bytecode that returns 42
        bytes memory mockCode = hex"602a60005260206000f3";
        vm.etch(coreAddress, mockCode);
        
        // Now coreHelloValue should return 42
        uint256 value = counter.coreHelloValue();
        assertEq(value, 42, "coreHelloValue should return 42");
    }
}
