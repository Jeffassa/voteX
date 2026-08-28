// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SmartVote — registre on-chain d'intégrité des votes ESATIC
/// @notice Ne stocke que des hashes de votes (jamais les votes en clair).
///         Le backend FastAPI signe et soumet les transactions.
contract SmartVote {
    struct Election {
        uint256 id;
        string title;
        uint256 startsAt;
        uint256 endsAt;
        bool open;
        address admin;
    }

    address public owner;
    uint256 public nextElectionId = 1;

    mapping(uint256 => Election) public elections;
    mapping(uint256 => mapping(bytes32 => bool)) public voteRecorded;
    mapping(uint256 => uint256) public voteCount;

    event ElectionCreated(uint256 indexed id, string title, uint256 startsAt, uint256 endsAt);
    event ElectionOpened(uint256 indexed id);
    event ElectionClosed(uint256 indexed id);
    event VoteCast(uint256 indexed electionId, bytes32 indexed voteHash, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "SmartVote: not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createElection(string calldata title, uint256 startsAt, uint256 endsAt) external onlyOwner returns (uint256) {
        require(endsAt > startsAt, "SmartVote: invalid period");
        uint256 id = nextElectionId++;
        elections[id] = Election({
            id: id,
            title: title,
            startsAt: startsAt,
            endsAt: endsAt,
            open: false,
            admin: msg.sender
        });
        emit ElectionCreated(id, title, startsAt, endsAt);
        return id;
    }

    function openElection(uint256 electionId) external onlyOwner {
        Election storage e = elections[electionId];
        require(e.id != 0, "SmartVote: unknown election");
        e.open = true;
        emit ElectionOpened(electionId);
    }

    function closeElection(uint256 electionId) external onlyOwner {
        Election storage e = elections[electionId];
        require(e.id != 0, "SmartVote: unknown election");
        e.open = false;
        emit ElectionClosed(electionId);
    }

    function castVote(uint256 electionId, bytes32 voteHash) external onlyOwner {
        Election storage e = elections[electionId];
        require(e.id != 0, "SmartVote: unknown election");
        require(e.open, "SmartVote: election not open");
        require(block.timestamp >= e.startsAt && block.timestamp <= e.endsAt, "SmartVote: out of period");
        require(!voteRecorded[electionId][voteHash], "SmartVote: vote already recorded");

        voteRecorded[electionId][voteHash] = true;
        voteCount[electionId] += 1;
        emit VoteCast(electionId, voteHash, block.timestamp);
    }

    function verifyVote(uint256 electionId, bytes32 voteHash) external view returns (bool) {
        return voteRecorded[electionId][voteHash];
    }

    function getElection(uint256 electionId) external view returns (Election memory) {
        return elections[electionId];
    }
}
