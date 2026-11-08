// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.30;

/// Commitments establish provenance and integrity, never the truth of a report.
contract ThreatRegistry {
    mapping(address => mapping(bytes32 => uint256)) public registeredAt;
    event ReportRegistered(address indexed reporter, bytes32 indexed digest, uint256 timestamp);

    function register(bytes32 digest) external {
        require(digest != bytes32(0), "Empty digest");
        require(registeredAt[msg.sender][digest] == 0, "Already registered");
        registeredAt[msg.sender][digest] = block.timestamp;
        emit ReportRegistered(msg.sender, digest, block.timestamp);
    }
}
