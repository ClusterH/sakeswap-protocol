pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SakeToken.sol";

// SakeMaster is the master of Sake. He can make Sake and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once SAKE is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract SakeMasterV2 is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 amountStoken; // How many S tokens the user has provided.
        uint256 amountLPtoken; // How many LP tokens the user has provided.
        uint256 pengdingSake; // record sake amount when user withdraw lp.
        uint256 rewardDebt; // Reward debt. See explanation below.
        uint256 lastWithdrawBlock; // user last withdraw time;

        //
        // We do some fancy math here. Basically, any point in time, the amount of SAKEs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accSakePerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accSakePerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        IERC20 sToken; // Address of S token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. SAKEs to distribute per block.
        uint256 lastRewardBlock; // Last block number that SAKEs distribution occurs.
        uint256 accSakePerShare; // Accumulated SAKEs per share, times 1e12. See below.
        uint256 multiplierSToken; // times 1e8;
        bool sakeLockSwitch; // true-have sake withdraw interval,default 1 months;false-no withdraw interval,but have sake withdraw fee,default 10%
    }

    // The SAKE TOKEN!
    SakeToken public sake;
    // sakeMaker address.
    address public sakeMaker;
    // admin address.
    address public admin;
    // receive sake fee address
    address public sakeFeeAddress;
    // Block number when trade mining speed up period ends.
    uint256 public tradeMiningSpeedUpEndBlock;
    // Block number when phase II yield farming period ends.
    uint256 public yieldFarmingIIEndBlock;
    // Block number when trade mining period ends.
    uint256 public tradeMiningEndBlock;
    // trade mining speed end block num,about 1 months.
    uint256 public tradeMiningSpeedUpEndBlockNum = 192000;
    // phase II yield farming end block num,about 6 months.
    uint256 public yieldFarmingIIEndBlockNum = 1152000;
    // trade mining end block num,about 12 months.
    uint256 public tradeMiningEndBlockNum = 2304000;
    // SAKE tokens created per block for phase II yield farming.
    uint256 public sakePerBlockYieldFarming = 5 * 10**18;
    // SAKE tokens created per block for trade mining.
    uint256 public sakePerBlockTradeMining = 10 * 10**18;
    // Bonus muliplier for trade mining.
    uint256 public constant BONUS_MULTIPLIER = 2;
    // withdraw block num interval,about 1 months.
    uint256 public withdrawInterval = 192000;
    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when SAKE mining starts.
    uint256 public startBlock;
    // The ratio of withdraw lp fee(default is 0%)
    uint8 public lpFeeRatio = 0;
    // The ratio of withdraw sake fee if no withdraw interval(default is 10%)
    uint8 public sakeFeeRatio = 10;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens and S tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amountLPtoken, uint256 amountStoken);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amountLPtoken);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amountLPtoken);

    constructor(
        SakeToken _sake,
        address _admin,
        address _sakeMaker,
        address _sakeFeeAddress,
        uint256 _startBlock
    ) public {
        sake = _sake;
        admin = _admin;
        sakeMaker = _sakeMaker;
        sakeFeeAddress = _sakeFeeAddress;
        startBlock = _startBlock;
        tradeMiningSpeedUpEndBlock = startBlock.add(tradeMiningSpeedUpEndBlockNum);
        yieldFarmingIIEndBlock = startBlock.add(yieldFarmingIIEndBlockNum);
        tradeMiningEndBlock = startBlock.add(tradeMiningEndBlockNum);
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // XXX DO NOT add the same LP token more than once.
    function _checkValidity(IERC20 _lpToken, IERC20 _sToken) internal view {
        for (uint256 i = 0; i < poolInfo.length; i++) {
            require(poolInfo[i].lpToken != _lpToken && poolInfo[i].sToken != _sToken, "pool exist");
        }
    }

    // Add a new lp to the pool. Can only be called by the admin.
    function add(
        uint256 _allocPoint,
        uint256 _multiplierSToken,
        IERC20 _lpToken,
        IERC20 _sToken,
        bool _withUpdate
    ) public {
        require(msg.sender == admin, "add:Call must come from admin.");
        if (_withUpdate) {
            massUpdatePools();
        }
        _checkValidity(_lpToken, _sToken);
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                sToken: _sToken,
                allocPoint: _allocPoint,
                multiplierSToken: _multiplierSToken,
                lastRewardBlock: lastRewardBlock,
                accSakePerShare: 0,
                sakeLockSwitch: true
            })
        );
    }

    // Update the given pool's SAKE allocation point. Can only be called by the admin.
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) public {
        require(msg.sender == admin, "set:Call must come from admin.");
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    function setMultiplierSToken(
        uint256 _pid,
        uint256 _multiplierSToken,
        bool _withUpdate
    ) public {
        require(msg.sender == admin, "sms:Call must come from admin.");
        if (_withUpdate) {
            massUpdatePools();
        }
        poolInfo[_pid].multiplierSToken = _multiplierSToken;
    }

    // set sake withdraw switch. Can only be called by the admin.
    function setSakeLockSwitch(
        uint256 _pid,
        bool _sakeLockSwitch,
        bool _withUpdate
    ) public {
        require(msg.sender == admin, "s:Call must come from admin.");
        if (_withUpdate) {
            massUpdatePools();
        }
        poolInfo[_pid].sakeLockSwitch = _sakeLockSwitch;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256 multipY, uint256 multipT) {
        uint256 _toFinalY = _to > yieldFarmingIIEndBlock ? yieldFarmingIIEndBlock : _to;
        uint256 _toFinalT = _to > tradeMiningEndBlock ? tradeMiningEndBlock : _to;
        // phase II yield farming multiplier
        if (_from >= yieldFarmingIIEndBlock) {
            multipY = 0;
        } else {
            multipY = _toFinalY.sub(_from);
        }
        // trade mining multiplier
        if (_from >= tradeMiningEndBlock) {
            multipT = 0;
        } else {
            if (_toFinalT <= tradeMiningSpeedUpEndBlock) {
                multipT = _toFinalT.sub(_from).mul(BONUS_MULTIPLIER);
            } else {
                if (_from < tradeMiningSpeedUpEndBlock) {
                    multipT = tradeMiningSpeedUpEndBlock.sub(_from).mul(BONUS_MULTIPLIER).add(
                        _toFinalT.sub(tradeMiningSpeedUpEndBlock)
                    );
                } else {
                    multipT = _toFinalT.sub(_from);
                }
            }
        }
    }

    function getSakePerBlock(uint256 blockNum) public view returns (uint256) {
        if (blockNum <= tradeMiningSpeedUpEndBlock) {
            return sakePerBlockYieldFarming.add(sakePerBlockTradeMining.mul(BONUS_MULTIPLIER));
        } else if (blockNum > tradeMiningSpeedUpEndBlock && blockNum <= yieldFarmingIIEndBlock) {
            return sakePerBlockYieldFarming.add(sakePerBlockTradeMining);
        } else if (blockNum > yieldFarmingIIEndBlock && blockNum <= tradeMiningEndBlock) {
            return sakePerBlockTradeMining;
        } else {
            return 0;
        }
    }

    // Handover the saketoken mintage right.
    function handoverSakeMintage(address newOwner) public onlyOwner {
        sake.transferOwnership(newOwner);
    }

    // View function to see pending SAKEs on frontend.
    function pendingSake(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accSakePerShare = pool.accSakePerShare;
        uint256 lpTokenSupply = pool.lpToken.balanceOf(address(this));
        uint256 sTokenSupply = pool.sToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpTokenSupply != 0) {
            uint256 totalSupply = lpTokenSupply.add(sTokenSupply.mul(pool.multiplierSToken).div(1e8));
            (uint256 multipY, uint256 multipT) = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 sakeRewardY = multipY.mul(sakePerBlockYieldFarming).mul(pool.allocPoint).div(totalAllocPoint);
            uint256 sakeRewardT = multipT.mul(sakePerBlockTradeMining).mul(pool.allocPoint).div(totalAllocPoint);
            uint256 sakeReward = sakeRewardY.add(sakeRewardT);
            accSakePerShare = accSakePerShare.add(sakeReward.mul(1e12).div(totalSupply));
        }
        return user.amount.mul(accSakePerShare).div(1e12).add(user.pengdingSake).sub(user.rewardDebt);
    }

    // Update reward vairables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpTokenSupply = pool.lpToken.balanceOf(address(this));
        uint256 sTokenSupply = pool.sToken.balanceOf(address(this));
        if (lpTokenSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        (uint256 multipY, uint256 multipT) = getMultiplier(pool.lastRewardBlock, block.number);
        if (multipY == 0 && multipT == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 sakeRewardY = multipY.mul(sakePerBlockYieldFarming).mul(pool.allocPoint).div(totalAllocPoint);
        uint256 sakeRewardT = multipT.mul(sakePerBlockTradeMining).mul(pool.allocPoint).div(totalAllocPoint);
        uint256 sakeReward = sakeRewardY.add(sakeRewardT);
        uint256 totalSupply = lpTokenSupply.add(sTokenSupply.mul(pool.multiplierSToken).div(1e8));
        if (sake.owner() == address(this)) {
            sake.mint(address(this), sakeRewardT);
        }
        pool.accSakePerShare = pool.accSakePerShare.add(sakeReward.mul(1e12).div(totalSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to SakeMasterV2 for SAKE allocation.
    function deposit(
        uint256 _pid,
        uint256 _amountlpToken,
        uint256 _amountsToken
    ) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        if (_amountlpToken <= 0 && user.pengdingSake == 0) {
            require(user.amountLPtoken > 0, "deposit:invalid");
        }
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accSakePerShare).div(1e12).add(user.pengdingSake).sub(user.rewardDebt);
        uint256 _originAmountStoken = user.amountStoken;
        user.amountLPtoken = user.amountLPtoken.add(_amountlpToken);
        user.amountStoken = user.amountStoken.add(_amountsToken);
        user.amount = user.amount.add(_amountlpToken.add(_amountsToken.mul(pool.multiplierSToken).div(1e8)));
        user.pengdingSake = pending;
        if (pool.sakeLockSwitch) {
            if (block.number > (user.lastWithdrawBlock.add(withdrawInterval))) {
                user.lastWithdrawBlock = block.number;
                user.pengdingSake = 0;
                user.amountStoken = _amountsToken;
                user.amount = user.amountLPtoken.add(_amountsToken.mul(pool.multiplierSToken).div(1e8));
                pool.sToken.safeTransfer(address(1), _originAmountStoken);
                if (pending > 0) {
                    _safeSakeTransfer(msg.sender, pending);
                }
            }
        } else {
            user.lastWithdrawBlock = block.number;
            user.pengdingSake = 0;
            if (_amountlpToken == 0 && _amountsToken == 0) {
                user.amountStoken = 0;
                user.amount = user.amountLPtoken;
                pool.sToken.safeTransfer(address(1), _originAmountStoken);
            }
            if (pending > 0) {
                uint256 sakeFee = pending.mul(sakeFeeRatio).div(100);
                uint256 sakeToUser = pending.sub(sakeFee);
                _safeSakeTransfer(msg.sender, sakeToUser);
                _safeSakeTransfer(sakeFeeAddress, sakeFee);
            }
        }
        user.rewardDebt = user.amount.mul(pool.accSakePerShare).div(1e12);
        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amountlpToken);
        pool.sToken.safeTransferFrom(address(msg.sender), address(this), _amountsToken);
        emit Deposit(msg.sender, _pid, _amountlpToken, _amountsToken);
    }

    // Withdraw LP tokens from SakeMaster.
    function withdraw(uint256 _pid, uint256 _amountLPtoken) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amountLPtoken >= _amountLPtoken, "withdraw: LP amount not enough");
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accSakePerShare).div(1e12).add(user.pengdingSake).sub(user.rewardDebt);
        user.amountLPtoken = user.amountLPtoken.sub(_amountLPtoken);
        uint256 _amountStoken = user.amountStoken;
        user.amountStoken = 0;
        user.amount = user.amountLPtoken;
        user.rewardDebt = user.amount.mul(pool.accSakePerShare).div(1e12);
        if (pool.sakeLockSwitch) {
            if (block.number > (user.lastWithdrawBlock.add(withdrawInterval))) {
                user.lastWithdrawBlock = block.number;
                user.pengdingSake = 0;
                _safeSakeTransfer(msg.sender, pending);
            } else {
                user.pengdingSake = pending;
            }
        } else {
            user.lastWithdrawBlock = block.number;
            user.pengdingSake = 0;
            uint256 sakeFee = pending.mul(sakeFeeRatio).div(100);
            uint256 sakeToUser = pending.sub(sakeFee);
            _safeSakeTransfer(msg.sender, sakeToUser);
            _safeSakeTransfer(sakeFeeAddress, sakeFee);
        }
        uint256 lpTokenFee;
        uint256 lpTokenToUser;
        if (block.number < tradeMiningEndBlock) {
            lpTokenFee = _amountLPtoken.mul(lpFeeRatio).div(100);
            pool.lpToken.safeTransfer(sakeMaker, lpTokenFee);
        }
        lpTokenToUser = _amountLPtoken.sub(lpTokenFee);
        pool.lpToken.safeTransfer(address(msg.sender), lpTokenToUser);
        pool.sToken.safeTransfer(address(1), _amountStoken);
        emit Withdraw(msg.sender, _pid, lpTokenToUser);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amountLPtoken > 0, "withdraw: LP amount not enough");
        uint256 _amountLPtoken = user.amountLPtoken;
        uint256 _amountStoken = user.amountStoken;
        user.amount = 0;
        user.amountLPtoken = 0;
        user.amountStoken = 0;
        user.rewardDebt = 0;

        uint256 lpTokenFee;
        uint256 lpTokenToUser;
        if (block.number < tradeMiningEndBlock) {
            lpTokenFee = _amountLPtoken.mul(lpFeeRatio).div(100);
            pool.lpToken.safeTransfer(sakeMaker, lpTokenFee);
        }
        lpTokenToUser = _amountLPtoken.sub(lpTokenFee);
        pool.lpToken.safeTransfer(address(msg.sender), lpTokenToUser);
        pool.sToken.safeTransfer(address(1), _amountStoken);
        emit EmergencyWithdraw(msg.sender, _pid, lpTokenToUser);
    }

    // Safe sake transfer function, just in case if rounding error causes pool to not have enough SAKEs.
    function _safeSakeTransfer(address _to, uint256 _amount) internal {
        uint256 sakeBal = sake.balanceOf(address(this));
        if (_amount > sakeBal) {
            sake.transfer(_to, sakeBal);
        } else {
            sake.transfer(_to, _amount);
        }
    }

    // Update admin address by owner.
    function setAdmin(address _adminaddr) public onlyOwner {
        require(_adminaddr != address(0), "invalid address");
        admin = _adminaddr;
    }

    // Update sakeMaker address by admin.
    function setSakeMaker(address _sakeMaker) public {
        require(msg.sender == admin, "sm:Call must come from admin.");
        require(_sakeMaker != address(0), "invalid address");
        sakeMaker = _sakeMaker;
    }

    // Update sakeFee address by admin.
    function setSakeFeeAddress(address _sakeFeeAddress) public {
        require(msg.sender == admin, "sf:Call must come from admin.");
        require(_sakeFeeAddress != address(0), "invalid address");
        sakeFeeAddress = _sakeFeeAddress;
    }

    // update tradeMiningSpeedUpEndBlock by owner
    function setTradeMiningSpeedUpEndBlock(uint256 _endBlock) public {
        require(msg.sender == admin, "tmsu:Call must come from admin.");
        require(_endBlock > startBlock, "invalid endBlock");
        tradeMiningSpeedUpEndBlock = _endBlock;
    }

    // update yieldFarmingIIEndBlock by owner
    function setYieldFarmingIIEndBlock(uint256 _endBlock) public {
        require(msg.sender == admin, "yf:Call must come from admin.");
        require(_endBlock > startBlock, "invalid endBlock");
        yieldFarmingIIEndBlock = _endBlock;
    }

    // update tradeMiningEndBlock by owner
    function setTradeMiningEndBlock(uint256 _endBlock) public {
        require(msg.sender == admin, "tm:Call must come from admin.");
        require(_endBlock > startBlock, "invalid endBlock");
        tradeMiningEndBlock = _endBlock;
    }

    function setSakeFeeRatio(uint8 newRatio) public {
        require(msg.sender == admin, "sfr:Call must come from admin.");
        require(newRatio >= 0 && newRatio <= 100, "invalid ratio");
        sakeFeeRatio = newRatio;
    }

    function setLpFeeRatio(uint8 newRatio) public {
        require(msg.sender == admin, "lp:Call must come from admin.");
        require(newRatio >= 0 && newRatio <= 100, "invalid ratio");
        lpFeeRatio = newRatio;
    }

    function setWithdrawInterval(uint256 _blockNum) public {
        require(msg.sender == admin, "i:Call must come from admin.");
        withdrawInterval = _blockNum;
    }

    // set sakePerBlock phase II yield farming
    function setSakePerBlockYieldFarming(uint256 _sakePerBlockYieldFarming, bool _withUpdate) public {
        require(msg.sender == admin, "yield:Call must come from admin.");
        if (_withUpdate) {
            massUpdatePools();
        }
        sakePerBlockYieldFarming = _sakePerBlockYieldFarming;
    }

    // set sakePerBlock trade mining
    function setSakePerBlockTradeMining(uint256 _sakePerBlockTradeMining, bool _withUpdate) public {
        require(msg.sender == admin, "trade:Call must come from admin.");
        if (_withUpdate) {
            massUpdatePools();
        }
        sakePerBlockTradeMining = _sakePerBlockTradeMining;
    }
}
