// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract DetrixMerchantRegistry is AccessControl, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum MerchantStatus {
        Pending,
        Active,
        Suspended
    }

    struct MerchantRecord {
        bytes32 merchantId;
        address payoutAddress;
        bytes32 metadataHash;
        MerchantStatus status;
        uint64 updatedAt;
    }

    mapping(bytes32 => MerchantRecord) private merchantRecords;

    event MerchantRegistered(bytes32 indexed merchantId, address indexed payoutAddress, bytes32 metadataHash);
    event MerchantStatusUpdated(bytes32 indexed merchantId, MerchantStatus status);
    event MerchantPayoutAddressUpdated(bytes32 indexed merchantId, address indexed payoutAddress);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    function registerMerchant(
        bytes32 merchantId,
        address payoutAddress,
        bytes32 metadataHash
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(merchantId != bytes32(0), "merchantId required");
        require(payoutAddress != address(0), "payoutAddress required");

        merchantRecords[merchantId] = MerchantRecord({
            merchantId: merchantId,
            payoutAddress: payoutAddress,
            metadataHash: metadataHash,
            status: MerchantStatus.Active,
            updatedAt: uint64(block.timestamp)
        });

        emit MerchantRegistered(merchantId, payoutAddress, metadataHash);
    }

    function updatePayoutAddress(bytes32 merchantId, address payoutAddress) external onlyRole(OPERATOR_ROLE) {
        require(payoutAddress != address(0), "payoutAddress required");
        MerchantRecord storage record = merchantRecords[merchantId];
        require(record.merchantId != bytes32(0), "merchant missing");

        record.payoutAddress = payoutAddress;
        record.updatedAt = uint64(block.timestamp);

        emit MerchantPayoutAddressUpdated(merchantId, payoutAddress);
    }

    function setMerchantStatus(bytes32 merchantId, MerchantStatus status) external onlyRole(OPERATOR_ROLE) {
        MerchantRecord storage record = merchantRecords[merchantId];
        require(record.merchantId != bytes32(0), "merchant missing");

        record.status = status;
        record.updatedAt = uint64(block.timestamp);

        emit MerchantStatusUpdated(merchantId, status);
    }

    function getMerchant(bytes32 merchantId) external view returns (MerchantRecord memory) {
        return merchantRecords[merchantId];
    }
}

