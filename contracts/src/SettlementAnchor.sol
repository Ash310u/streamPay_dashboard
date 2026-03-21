// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SettlementAnchor
 * @notice Immutable on-chain audit trail for Detrix T+1 batch settlements.
 *         Each session can be anchored once (via anchorSession) once during
 *         the billing cycle, and formally settled (via recordSettlement) during
 *         the T+1 batch run.  Both operations are gated to OPERATOR_ROLE.
 */
contract SettlementAnchor is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ── Legacy anchor struct (kept for backwards compatibility) ────────────────

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

    // ── T+1 settlement records ─────────────────────────────────────────────────

    struct SettlementRecord {
        address merchant;
        uint256 grossInrPaise;
        uint256 feeInrPaise;
        uint256 netInrPaise;
        string  batchDate;
        uint256 recordedAt;
    }

    mapping(bytes32 => SettlementRecord) private _settlements;
    mapping(address => uint256) private _merchantTotalPayout;

    // ── Owner convenience (DEFAULT_ADMIN_ROLE holder) ──────────────────────────

    address private _owner;

    // ── Events ─────────────────────────────────────────────────────────────────

    event SessionAnchored(
        bytes32 indexed sessionId,
        bytes32 indexed sessionHash,
        bytes32 indexed merchantId,
        address merchantPayoutAddress,
        uint256 grossAmount,
        uint256 operatorFeeAmount
    );

    event SessionDisputed(bytes32 indexed sessionId, bytes32 disputeReference);

    event SettlementRecorded(
        bytes32 indexed sessionId,
        address indexed merchant,
        uint256 netInrPaise,
        string  batchDate
    );

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(address admin) {
        _owner = admin;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // ── Owner accessor (for simple ownership checks) ──────────────────────────

    function owner() external view returns (address) {
        return _owner;
    }

    // ── Legacy anchor (pre-settlement billing proof) ──────────────────────────

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

    // ── T+1 Settlement API ────────────────────────────────────────────────────

    /**
     * @notice Record a T+1 batch settlement for a session on-chain.
     * @param sessionId   Unique session identifier (bytes32)
     * @param merchant    Merchant wallet address (for payout tracking)
     * @param grossInrPaise  Total INR gross in paise
     * @param feeInrPaise    Platform fee in paise
     * @param netInrPaise    Merchant net payout in paise
     * @param batchDate   ISO date string of the settlement batch (e.g. "2025-04-01")
     */
    function recordSettlement(
        bytes32 sessionId,
        address merchant,
        uint256 grossInrPaise,
        uint256 feeInrPaise,
        uint256 netInrPaise,
        string calldata batchDate
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant whenNotPaused {
        require(sessionId != bytes32(0), "sessionId required");
        require(merchant != address(0), "merchant required");
        require(_settlements[sessionId].recordedAt == 0, "Session already settled");

        _settlements[sessionId] = SettlementRecord({
            merchant: merchant,
            grossInrPaise: grossInrPaise,
            feeInrPaise: feeInrPaise,
            netInrPaise: netInrPaise,
            batchDate: batchDate,
            recordedAt: block.timestamp
        });

        _merchantTotalPayout[merchant] += netInrPaise;

        emit SettlementRecorded(sessionId, merchant, netInrPaise, batchDate);
    }

    /**
     * @notice Read a settlement record.
     */
    function getSettlement(bytes32 sessionId) external view returns (SettlementRecord memory) {
        return _settlements[sessionId];
    }

    /**
     * @notice Cumulative net INR (in paise) paid out to a merchant across all batches.
     */
    function merchantTotalPayout(address merchant) external view returns (uint256) {
        return _merchantTotalPayout[merchant];
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
