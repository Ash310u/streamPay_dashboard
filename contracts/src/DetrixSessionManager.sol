// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract DetrixSessionManager is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum StreamStatus {
        None,
        Active,
        Closed,
        Disputed
    }

    struct SessionRecord {
        bytes32 sessionId;
        bytes32 merchantId;
        bytes32 venueId;
        bytes32 userId;
        bytes32 pricingPlanId;
        bytes32 sessionHash;
        bytes32 disputeHash;
        string streamReference;
        uint64 startedAt;
        uint64 closedAt;
        StreamStatus status;
    }

    mapping(bytes32 => SessionRecord) private sessions;

    event SessionStarted(
        bytes32 indexed sessionId,
        bytes32 indexed merchantId,
        bytes32 indexed venueId,
        bytes32 userId,
        string streamReference
    );
    event SessionClosed(bytes32 indexed sessionId, bytes32 sessionHash);
    event SessionDisputed(bytes32 indexed sessionId, bytes32 disputeHash);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    function startSession(
        bytes32 sessionId,
        bytes32 merchantId,
        bytes32 venueId,
        bytes32 userId,
        bytes32 pricingPlanId,
        string calldata streamReference
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        require(sessionId != bytes32(0), "sessionId required");
        require(sessions[sessionId].status == StreamStatus.None, "session exists");

        sessions[sessionId] = SessionRecord({
            sessionId: sessionId,
            merchantId: merchantId,
            venueId: venueId,
            userId: userId,
            pricingPlanId: pricingPlanId,
            sessionHash: bytes32(0),
            disputeHash: bytes32(0),
            streamReference: streamReference,
            startedAt: uint64(block.timestamp),
            closedAt: 0,
            status: StreamStatus.Active
        });

        emit SessionStarted(sessionId, merchantId, venueId, userId, streamReference);
    }

    function closeSession(bytes32 sessionId, bytes32 sessionHash) external onlyRole(OPERATOR_ROLE) nonReentrant {
        SessionRecord storage record = sessions[sessionId];
        require(record.status == StreamStatus.Active, "session not active");
        require(sessionHash != bytes32(0), "sessionHash required");

        record.sessionHash = sessionHash;
        record.closedAt = uint64(block.timestamp);
        record.status = StreamStatus.Closed;

        emit SessionClosed(sessionId, sessionHash);
    }

    function flagDispute(bytes32 sessionId, bytes32 disputeHash) external onlyRole(OPERATOR_ROLE) {
        SessionRecord storage record = sessions[sessionId];
        require(record.status == StreamStatus.Active || record.status == StreamStatus.Closed, "session missing");
        require(disputeHash != bytes32(0), "disputeHash required");

        record.disputeHash = disputeHash;
        record.status = StreamStatus.Disputed;

        emit SessionDisputed(sessionId, disputeHash);
    }

    function getSession(bytes32 sessionId) external view returns (SessionRecord memory) {
        return sessions[sessionId];
    }
}
