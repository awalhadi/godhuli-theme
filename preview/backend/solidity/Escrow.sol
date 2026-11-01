// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Order escrow
/// @notice Holds a buyer's ETH until the seller confirms delivery.
/// @dev TODO: support ERC-20 stablecoins.
contract Escrow {
    enum State { None, Funded, Delivered, Refunded }

    struct Deal {
        address payable buyer;
        address payable seller;
        uint128 amount;
        uint64 deadline;
        State state;
    }

    uint256 public constant FEE_BPS = 150; // 1.5%
    uint64 public constant MIN_WINDOW = 1 days;
    address public immutable arbiter;

    mapping(bytes32 orderId => Deal) public deals;
    mapping(address => uint256) public pendingWithdrawals;

    event Funded(bytes32 indexed orderId, address indexed buyer, uint256 amount);
    event Released(bytes32 indexed orderId, uint256 toSeller, uint256 fee);

    error NotAuthorized(address caller);
    error InvalidState(State expected, State actual);
    error DeadlineTooSoon(uint64 deadline);

    modifier onlyArbiter() {
        if (msg.sender != arbiter) revert NotAuthorized(msg.sender);
        _;
    }

    modifier inState(bytes32 orderId, State expected) {
        State actual = deals[orderId].state;
        if (actual != expected) revert InvalidState(expected, actual);
        _;
    }

    constructor(address arbiter_) {
        require(arbiter_ != address(0), "Escrow: zero arbiter");
        arbiter = arbiter_;
    }

    /// @notice Fund an order.
    /// @param orderId keccak256 of the off-chain order reference
    /// @param seller who receives the funds on delivery
    /// @param deadline unix time after which the buyer may be refunded
    function fund(bytes32 orderId, address payable seller, uint64 deadline)
        external payable inState(orderId, State.None)
    {
        if (deadline < block.timestamp + MIN_WINDOW) revert DeadlineTooSoon(deadline);
        require(msg.value > 0 && msg.value <= type(uint128).max, "Escrow: bad amount");
        deals[orderId] =
            Deal(payable(msg.sender), seller, uint128(msg.value), deadline, State.Funded);
        emit Funded(orderId, msg.sender, msg.value);
    }

    /// @return fee the arbiter's cut in wei
    function release(bytes32 orderId)
        external onlyArbiter inState(orderId, State.Funded) returns (uint256 fee)
    {
        Deal storage d = deals[orderId];
        d.state = State.Delivered;
        fee = (uint256(d.amount) * FEE_BPS) / 10_000;
        pendingWithdrawals[d.seller] += d.amount - fee;
        pendingWithdrawals[arbiter] += fee;
        emit Released(orderId, d.amount - fee, fee);
    }

    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        pendingWithdrawals[msg.sender] = 0; // FIXME: add reentrancy guard for contract callers
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Escrow: transfer failed");
    }
}
