// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

// A contract allows user to pay
// Announces winnner within minutes

// imports
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";



// Errors 
error Lottery__NotEnoughETHEntered();
error Lottery__TransferFailed();
error Lottery__NotOpen();
error Lottery__UpkeedNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);



/** @title A simple Lottery Contract
 * @author yana gupta
 * @dev This implements chainlink vrf v2 or chainlink keepers
 */


contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {

  enum LotteryState {
    OPEN,
    CALCULATING
  }

  // State Variable
  uint256 private immutable i_entranceFee;
  address payable[] private s_players;
  VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
  bytes32 private immutable i_gasLane;
  uint64 private immutable i_subscriptionId;
  uint32 private immutable i_callbackGasLimit;
  uint16 private constant REQUEST_CONFORMATIONS = 3;
  uint16 private constant NUM_WORDS = 1;
  uint256 private immutable i_interval;

  // Lottery Variables 
  address private s_recentWinner;
  LotteryState private s_lotteryState;
  uint256 private s_lastTimeStamp;

  // Events
  event LotteryEnter(address indexed player);
  event RequestedLotteryWinner(uint256 indexed requestId);
  event WinnerPicked(address indexed winner);

  constructor(
    address vrfCoordinatorV2,
    uint256 entranceFee,
    bytes32 gasLane,
    uint64 subscriptionId,
    uint32 callbackGasLimit,
    uint256 interval
  ) VRFConsumerBaseV2(vrfCoordinatorV2) {
    i_entranceFee = entranceFee;
    i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
    i_gasLane = gasLane;
    i_subscriptionId = subscriptionId;
    i_callbackGasLimit = callbackGasLimit;
    s_lotteryState = LotteryState.OPEN;
    i_interval = interval;
  }

  function getEntranceFee() public view returns (uint256) {
    return i_entranceFee;
  }

  function getInterval () public view returns (uint256) {
    return i_interval;
  }

  function enterLottery() public payable {
    if (msg.value < i_entranceFee) {
      revert Lottery__NotEnoughETHEntered();
    }
    if ( s_lotteryState != LotteryState.OPEN) {
        revert Lottery__NotOpen();
    }
    s_players.push(payable(msg.sender));
    // Name events wish reversed
    emit LotteryEnter(msg.sender);
  }


  function pickRandomWinner() external {
    // Request the random number
    // Once we get it, do something with it
  }

  function fulfillRandomWords(
    uint256 /* requestId */,
    uint256[] memory randomWords
  ) internal override {
    // random_number mod s_players size -- winner
    uint256 indexOfWinner = randomWords[0] % s_players.length;
    address payable recentWinner = s_players[indexOfWinner];
    s_recentWinner = recentWinner;
    s_lotteryState = LotteryState.OPEN;
    s_players = new address payable[](0);
    s_lastTimeStamp = block.timestamp;
    (bool success, ) = recentWinner.call{value: address(this).balance}("");
    if (!success) {
      revert Lottery__TransferFailed();
    }
    emit WinnerPicked(recentWinner);
  }

  function checkUpkeep ( bytes memory checkData ) public override returns (bool upkeepNeeded, bytes memory /* performData */  ) {
    bool isOpen = (LotteryState.OPEN == s_lotteryState); 
    bool timePassed = ( ( block.timestamp - s_lastTimeStamp ) > i_interval);
    bool hasPlayers = (s_players.length > 0 );
    bool hasBalance = address(this).balance > 0;
    upkeepNeeded = ( isOpen && timePassed && hasPlayers && hasBalance);
    return (upkeepNeeded, "0x0");
  }

  function performUpkeep(bytes memory /* perform Data */) external override {   
    (bool upkeepNeeded, ) = checkUpkeep("");
    if ( !upkeepNeeded ) {
      revert Lottery__UpkeedNotNeeded(address(this).balance, s_players.length, uint256(s_lotteryState));
    }
    s_lotteryState = LotteryState.CALCULATING; 
    uint256 requestId = i_vrfCoordinator.requestRandomWords(
    i_gasLane,
    i_subscriptionId,
    REQUEST_CONFORMATIONS,
    i_callbackGasLimit,
    NUM_WORDS
    );
    emit RequestedLotteryWinner(requestId);
  }

  function getPlayer(uint256 index) public view returns (address) {
    return s_players[index];
    }

  function announceRandomWinner() public {}

  function getRecentWinner() public view returns (address) {
    return s_recentWinner;
  }
  function getLotteryState() public view returns (LotteryState) {
    return s_lotteryState;
  }

  function getNumWord() public pure returns (uint256) {
    return NUM_WORDS;
  }

  function getNumberOfPlayers() public view returns (uint256) {
    return s_players.length;
  }

  function getLatestTimeStamp() public view returns (uint256) {
    return s_lastTimeStamp;
  }

  function getRequestConformations() public pure returns (uint256) {
    return REQUEST_CONFORMATIONS;
  }

}
