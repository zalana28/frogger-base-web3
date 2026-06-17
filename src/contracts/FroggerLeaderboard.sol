// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FroggerLeaderboard
 * @notice Onchain leaderboard for Base Frogger DX with anti-cheat gating.
 *         Companion to BombermanLeaderboard. Players must call recordPlay()
 *         before submitScore() — submitScore consumes the active game so
 *         each play can only post one score.
 */
contract FroggerLeaderboard is Ownable, ReentrancyGuard {
    // ─── Types ─────────────────────────────────────────────────────────────
    struct ScoreEntry {
        address player;
        string  name;       // 1–12 printable-ASCII chars
        uint32  score;      // 0–MAX_SCORE
        uint16  level;      // 1–MAX_LEVEL
        uint64  timestamp;  // block.timestamp at submit
    }

    // ─── Constants ─────────────────────────────────────────────────────────
    uint8  public constant TOP_N         = 10;
    uint32 public constant MAX_SCORE     = 10_000;
    uint16 public constant MAX_LEVEL     = 9;
    uint8  public constant MAX_NAME_LEN  = 12;

    // ─── Storage ───────────────────────────────────────────────────────────
    uint256 public playFee;     // wei, charged on recordPlay()
    uint256 public submitFee;   // wei, charged on submitScore()
    address public treasury;    // receives fees

    ScoreEntry[TOP_N] private _topScores;

    mapping(address => uint64) public activeGameStartedAt; // 0 = no active game
    mapping(address => uint32) public personalBest;
    mapping(address => uint32) public gamesPlayed;

    uint256 public totalPlays;
    uint256 public totalScoresSubmitted;

    // ─── Events ────────────────────────────────────────────────────────────
    event GameStarted(address indexed player, uint256 amount, uint256 timestamp);
    event ScoreSubmitted(
        address indexed player,
        string  name,
        uint32  indexed score,
        uint16  level,
        uint256 timestamp
    );
    event TopScoresUpdated(uint8 indexed position, address indexed player, uint32 score);
    event PlayFeeUpdated(uint256 newFee);
    event SubmitFeeUpdated(uint256 newFee);
    event TreasuryUpdated(address indexed newTreasury);

    // ─── Constructor ───────────────────────────────────────────────────────
    constructor(uint256 _playFee, uint256 _submitFee, address _treasury)
        Ownable(msg.sender)
    {
        require(_treasury != address(0), "Zero treasury");
        playFee   = _playFee;
        submitFee = _submitFee;
        treasury  = _treasury;
    }

    // ─── Player actions ────────────────────────────────────────────────────

    /// @notice Pay play fee and start a new game session.
    function recordPlay() external payable nonReentrant {
        require(msg.value >= playFee, "Insufficient play fee");

        activeGameStartedAt[msg.sender] = uint64(block.timestamp);
        unchecked {
            totalPlays++;
            gamesPlayed[msg.sender]++;
        }

        if (msg.value > 0) {
            (bool ok, ) = treasury.call{value: msg.value}("");
            require(ok, "Treasury transfer failed");
        }

        emit GameStarted(msg.sender, msg.value, block.timestamp);
    }

    /// @notice Submit a finished round's score. Requires a prior recordPlay().
    function submitScore(string calldata name, uint32 score, uint16 level)
        external
        payable
        nonReentrant
    {
        require(msg.value >= submitFee, "Insufficient submit fee");
        require(activeGameStartedAt[msg.sender] > 0, "No active game");
        require(score <= MAX_SCORE, "Score too high");
        require(level >= 1 && level <= MAX_LEVEL, "Invalid level");

        bytes memory nb = bytes(name);
        require(nb.length > 0 && nb.length <= MAX_NAME_LEN, "Bad name length");
        require(_isValidName(nb), "Invalid name chars");

        // Consume the active game so the same play can't submit twice
        activeGameStartedAt[msg.sender] = 0;

        if (score > personalBest[msg.sender]) {
            personalBest[msg.sender] = score;
        }

        _insertTopScore(ScoreEntry({
            player:    msg.sender,
            name:      name,
            score:     score,
            level:     level,
            timestamp: uint64(block.timestamp)
        }));

        unchecked { totalScoresSubmitted++; }

        if (msg.value > 0) {
            (bool ok, ) = treasury.call{value: msg.value}("");
            require(ok, "Treasury transfer failed");
        }

        emit ScoreSubmitted(msg.sender, name, score, level, block.timestamp);
    }

    // ─── View functions ────────────────────────────────────────────────────

    function getTopScores() external view returns (ScoreEntry[TOP_N] memory list) {
        list = _topScores;
    }

    function getTopScore(uint8 idx) external view returns (ScoreEntry memory) {
        require(idx < TOP_N, "Out of range");
        return _topScores[idx];
    }

    function hasActiveGame(address player) external view returns (bool) {
        return activeGameStartedAt[player] > 0;
    }

    function getStats()
        external
        view
        returns (
            uint256 _totalPlays,
            uint256 _totalScoresSubmitted,
            uint256 _playFee,
            uint256 _submitFee,
            address _treasury
        )
    {
        return (totalPlays, totalScoresSubmitted, playFee, submitFee, treasury);
    }

    // ─── Owner actions ─────────────────────────────────────────────────────

    function setPlayFee(uint256 _playFee) external onlyOwner {
        playFee = _playFee;
        emit PlayFeeUpdated(_playFee);
    }

    function setSubmitFee(uint256 _submitFee) external onlyOwner {
        submitFee = _submitFee;
        emit SubmitFeeUpdated(_submitFee);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /// @notice Sweep any stuck ETH back to treasury (treasury already gets
    ///         fees directly, this is purely a safety hatch).
    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        require(bal > 0, "Nothing to withdraw");
        (bool ok, ) = treasury.call{value: bal}("");
        require(ok, "Withdraw failed");
    }

    // ─── Internal ──────────────────────────────────────────────────────────

    function _insertTopScore(ScoreEntry memory entry) internal {
        // Find insertion position (sorted DESC by score)
        uint8 pos = TOP_N;
        for (uint8 i = 0; i < TOP_N; i++) {
            if (entry.score > _topScores[i].score) {
                pos = i;
                break;
            }
        }
        if (pos == TOP_N) return; // Not high enough for top 10

        // Shift entries down by one (drops the last slot)
        for (uint8 j = TOP_N - 1; j > pos; j--) {
            _topScores[j] = _topScores[j - 1];
        }
        _topScores[pos] = entry;
        emit TopScoresUpdated(pos, entry.player, entry.score);
    }

    function _isValidName(bytes memory nb) internal pure returns (bool) {
        // Printable ASCII only (0x20–0x7E); no leading/trailing space.
        if (nb[0] == 0x20 || nb[nb.length - 1] == 0x20) return false;
        for (uint256 i = 0; i < nb.length; i++) {
            uint8 c = uint8(nb[i]);
            if (c < 0x20 || c > 0x7E) return false;
        }
        return true;
    }

    receive() external payable {}
}
