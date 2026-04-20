// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";
import {externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {MyConfidentialToken} from "./MyConfidentialToken.sol";

contract MyConfidentialTokenTest is Test {
    MyConfidentialToken internal token;

    address internal owner = address(0xA11CE);
    address internal alice = address(0xB0B);
    address internal bob = address(0xCAFE);

    string internal constant NAME = "My Confidential Token";
    string internal constant SYMBOL = "MCT";
    string internal constant URI = "ipfs://example";

    function setUp() public {
        vm.prank(owner);
        token = new MyConfidentialToken(NAME, SYMBOL, URI);

        vm.label(owner, "owner");
        vm.label(alice, "alice");
        vm.label(bob, "bob");
        vm.label(address(token), "MyConfidentialToken");
    }

    // ============ Metadata Tests ============

    function test_Metadata() public view {
        assertEq(token.name(), NAME);
        assertEq(token.symbol(), SYMBOL);
        assertEq(token.contractURI(), URI);
        assertEq(token.decimals(), 18);
        assertEq(token.OWNER(), owner);
    }

    function test_SupportsInterface() public view {
        assertTrue(token.supportsInterface(type(IERC7984).interfaceId));
        assertTrue(token.supportsInterface(type(IERC165).interfaceId));
    }

    function test_SupportsInterface_UnknownId() public view {
        assertFalse(token.supportsInterface(bytes4(0xdeadbeef)));
    }

    // ============ setOperator / isOperator Tests ============

    function test_IsOperator_SelfIsAlwaysOperator() public view {
        assertTrue(token.isOperator(alice, alice));
    }

    function test_IsOperator_DefaultsToFalse() public view {
        assertFalse(token.isOperator(alice, bob));
    }

    function test_SetOperator() public {
        uint48 until = uint48(block.timestamp + 1 days);

        vm.prank(alice);
        token.setOperator(bob, until);

        assertTrue(token.isOperator(alice, bob));
    }

    function test_SetOperator_ExpiresAfterUntil() public {
        uint48 until = uint48(block.timestamp + 1 hours);

        vm.prank(alice);
        token.setOperator(bob, until);
        assertTrue(token.isOperator(alice, bob));

        vm.warp(uint256(until) + 1);
        assertFalse(token.isOperator(alice, bob));
    }

    // ============ mint access control ============

    function test_RevertWhen_Mint_NotOwner() public {
        // A dummy payload is enough: the call must revert on the access-
        // control check before any Nox/TEE operation is performed.
        externalEuint256 payload;
        vm.expectRevert(
            abi.encodeWithSelector(MyConfidentialToken.NotOwner.selector, alice)
        );
        vm.prank(alice);
        token.mint(alice, payload, "");
    }
}
