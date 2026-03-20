// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract SettlementAnchor is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct SessionAnchor {
        bytes32 sessionHash;
        bytes32 merchantId;
        bytes32 venueId;
        address merchantPayoutAddress;
        uint256 anchoredAt;
        uint256 grossAmount;
        uint256 operatorFeeAmount;
        bool disputed;
    }

    mapping(bytes32 => SessionAnchor) public sessionAnchors;

    event SessionAnchored(
        bytes32 indexed sessionId,
        bytes32 indexed sessionHash,
        bytes32 indexed merchantId,
        address merchantPayoutAddress,
        uint256 grossAmount,
        uint256 operatorFeeAmount
    );
    event SessionDisputed(bytes32 indexed sessionId, bytes32 disputeReference);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    function anchorSession(
        bytes32 sessionId,
        bytes32 sessionHash,
        bytes32 merchantId,
        bytes32 venueId,
        address merchantPayoutAddress,
        uint256 grossAmount,
        uint256 operatorFeeAmount
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        require(sessionId != bytes32(0), "sessionId required");
        require(sessionHash != bytes32(0), "sessionHash required");
        require(merchantPayoutAddress != address(0), "payoutAddress required");

        sessionAnchors[sessionId] = SessionAnchor({
            sessionHash: sessionHash,
            merchantId: merchantId,
            venueId: venueId,
            merchantPayoutAddress: merchantPayoutAddress,
            anchoredAt: block.timestamp,
            grossAmount: grossAmount,
            operatorFeeAmount: operatorFeeAmount,
            disputed: false
        });

        emit SessionAnchored(sessionId, sessionHash, merchantId, merchantPayoutAddress, grossAmount, operatorFeeAmount);
    }

    function flagDispute(bytes32 sessionId, bytes32 disputeReference) external onlyRole(OPERATOR_ROLE) {
        require(sessionAnchors[sessionId].sessionHash != bytes32(0), "session missing");
        sessionAnchors[sessionId].disputed = true;
        emit SessionDisputed(sessionId, disputeReference);
    }
}
