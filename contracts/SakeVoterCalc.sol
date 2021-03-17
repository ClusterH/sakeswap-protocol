// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./sakeswap/interfaces/ISakeSwapPair.sol";
import "./SakeMaster.sol";
import "./SakeBar.sol";
import "./STokenMaster.sol";
import "./SakeMasterV2.sol";

struct IndexValue {
    uint256 keyIndex;
    address lpaddr;
}
struct KeyFlag {
    uint256 key;
    bool deleted;
}
struct ItMap {
    mapping(uint256 => IndexValue) data;
    KeyFlag[] keys;
    uint256 size;
}

library IterableMapping {
    function insert(
        ItMap storage self,
        uint256 key,
        address lpaddr
    ) internal returns (bool replaced) {
        uint256 keyIndex = self.data[key].keyIndex;
        self.data[key].lpaddr = lpaddr;
        if (keyIndex > 0) return true;
        else {
            keyIndex = self.keys.length;
            self.keys.push();
            self.data[key].keyIndex = keyIndex + 1;
            self.keys[keyIndex].key = key;
            self.size++;
            return false;
        }
    }

    function remove(ItMap storage self, uint256 key) internal returns (bool success) {
        uint256 keyIndex = self.data[key].keyIndex;
        if (keyIndex == 0) return false;
        delete self.data[key];
        self.keys[keyIndex - 1].deleted = true;
        self.size--;
    }

    function contains(ItMap storage self, uint256 key) internal view returns (bool) {
        return self.data[key].keyIndex > 0;
    }

    function iterateStart(ItMap storage self) internal view returns (uint256 keyIndex) {
        return iterateNext(self, uint256(-1));
    }

    function iterateValid(ItMap storage self, uint256 keyIndex) internal view returns (bool) {
        return keyIndex < self.keys.length;
    }

    function iterateNext(ItMap storage self, uint256 keyIndex) internal view returns (uint256 rkeyIndex) {
        keyIndex++;
        while (keyIndex < self.keys.length && self.keys[keyIndex].deleted) keyIndex++;
        return keyIndex;
    }

    function iterateGet(ItMap storage self, uint256 keyIndex) internal view returns (uint256 key, address lpaddr) {
        key = self.keys[keyIndex].key;
        lpaddr = self.data[key].lpaddr;
    }
}

contract SakeVoterCalc {
    using SafeMath for uint256;
    ItMap public voteLpPoolMap; //Voter LP Address
    // Apply library functions to the data type.
    using IterableMapping for ItMap;

    IERC20 public sake;
    SakeBar public bar;
    STokenMaster public stoken;
    SakeMaster public masterV1;
    SakeMasterV2 public masterV2;
    IERC20 public lpSakeEth = IERC20(0xAC10f17627Cd6bc22719CeEBf1fc524C9Cfdc255); //SAKE-ETH

    address public owner;
    uint256 public lpPow = 2;
    uint256 public balancePow = 1;
    uint256 public stakePow = 1;
    bool public sqrtEnable = true;

    modifier onlyOwner() {
        require(owner == msg.sender, "Not Owner");
        _;
    }

    constructor(
        address _tokenAddr,
        address _barAddr,
        address _stoken,
        address _masterAddr,
        address _masterV2Addr
    ) public {
        sake = IERC20(_tokenAddr);
        bar = SakeBar(_barAddr);
        stoken = STokenMaster(_stoken);
        masterV1 = SakeMaster(_masterAddr);
        masterV2 = SakeMasterV2(_masterV2Addr);
        owner = msg.sender;
        voteLpPoolMap.insert(voteLpPoolMap.size, 0xAC10f17627Cd6bc22719CeEBf1fc524C9Cfdc255); //SAKE-ETH
        voteLpPoolMap.insert(voteLpPoolMap.size, 0x5B255e213bCcE0FA8Ad2948E3D7A6F6E76472db8); //SAKE-USDT
        voteLpPoolMap.insert(voteLpPoolMap.size, 0xEc694c829CC192667cDAA6C7639Ef362f3cbF575); //SAKE-USDC
        voteLpPoolMap.insert(voteLpPoolMap.size, 0x838ce8f4Da8b49EA72378427485CF827c08a0abf); //SAKE-DAI
        voteLpPoolMap.insert(voteLpPoolMap.size, 0x49DE2D202fB703999c4D6a7e2dAA2F3700588f40); //SAKE-SUSHI
        voteLpPoolMap.insert(voteLpPoolMap.size, 0x83970b5570E4cb5FC5e21eF9B9F3c4F8A129c2f2); //SAKE-UNI
    }

    function sqrt(uint256 x) public pure returns (uint256 y) {
        uint256 z = x.add(1).div(2);
        y = x;
        while (z < y) {
            y = z;
            z = x.div(z).add(z).div(2);
        }
    }

    function totalSupply() external view returns (uint256) {
        uint256 voterTotal = 0;
        uint256 _vCtSakes = 0;
        uint256 totalBarSakes = 0;
        address _vLpToken;

        totalBarSakes = sake.balanceOf(address(bar));
        for (
            uint256 i = voteLpPoolMap.iterateStart();
            voteLpPoolMap.iterateValid(i);
            i = voteLpPoolMap.iterateNext(i)
        ) {
            //count lp contract sakenums
            (, _vLpToken) = voteLpPoolMap.iterateGet(i);
            _vCtSakes = _vCtSakes.add(sake.balanceOf(_vLpToken));
        }

        voterTotal =
            sake.totalSupply().sub(totalBarSakes).sub(_vCtSakes).mul(balancePow) +
            _vCtSakes.mul(lpPow) +
            totalBarSakes.mul(stakePow);
        if (sqrtEnable == true) {
            return sqrt(voterTotal);
        }
        return voterTotal;
    }

    function _getUserLpSakes(address _voter, address _vLpTokenAddr) internal view returns (uint256) {
        IERC20 _vtmpLpToken;
        IERC20 _vLpToken;
        uint256 _vUserLp = 0;
        uint256 _vtmpUserLp = 0;
        uint256 _vCtSakeNum = 0;
        uint256 _vUserSakeNum = 0;
        ISakeSwapPair _vPair;

        if (sake.balanceOf(_vLpTokenAddr) == 0) {
            return 0;
        }
        _vLpToken = IERC20(_vLpTokenAddr);
        //v1 pool
        for (uint256 j = 0; j < masterV1.poolLength(); j++) {
            (_vtmpLpToken, , , ) = masterV1.poolInfo(j);
            if (_vtmpLpToken == _vLpToken) {
                (_vtmpUserLp, ) = masterV1.userInfo(j, _voter);
                _vUserLp = _vUserLp.add(_vtmpUserLp);
                break;
            }
        }
        //v2 pool
        for (uint256 j = 0; j < masterV2.poolLength(); j++) {
            (_vtmpLpToken, , , , , , ) = masterV2.poolInfo(j);
            if (_vtmpLpToken == _vLpToken) {
                (, , _vtmpUserLp, , , ) = masterV2.userInfo(j, _voter);
                _vUserLp = _vUserLp.add(_vtmpUserLp);
                break;
            }
        }
        //stokenmaster pool
        if (lpSakeEth == _vLpToken) {
            (, , _vtmpUserLp, ) = stoken.userInfo(0, _voter);
            _vUserLp = _vUserLp.add(_vtmpUserLp);
        }
        //user balance lp
        _vPair = ISakeSwapPair(_vLpTokenAddr);
        _vUserLp = _vUserLp.add(_vPair.balanceOf(_voter));
        //user deposit sakenum = user_lptoken*contract_sakenum/contract_lptokens
        _vCtSakeNum = sake.balanceOf(address(_vLpToken));
        _vUserSakeNum = _vUserLp.mul(_vCtSakeNum).div(_vPair.totalSupply());
        return _vUserSakeNum;
    }

    //sum user deposit sakenum
    function balanceOf(address _voter) external view returns (uint256) {
        uint256 _votes = 0;
        uint256 _vCtSakeNum = 0;
        uint256 _vBarSakeNum = 0;
        address _vLpTokenAddr;

        for (
            uint256 i = voteLpPoolMap.iterateStart();
            voteLpPoolMap.iterateValid(i);
            i = voteLpPoolMap.iterateNext(i)
        ) {
            (, _vLpTokenAddr) = voteLpPoolMap.iterateGet(i);
            _vCtSakeNum = _vCtSakeNum.add(_getUserLpSakes(_voter, _vLpTokenAddr));
        }

        _vBarSakeNum = bar.balanceOf(_voter).mul(sake.balanceOf(address(bar))).div(bar.totalSupply());
        _votes = _vCtSakeNum.mul(lpPow) + sake.balanceOf(_voter).mul(balancePow) + _vBarSakeNum.mul(stakePow);
        if (sqrtEnable == true) {
            return sqrt(_votes);
        }
        return _votes;
    }

    function addVotePool(address newLpAddr) public onlyOwner {
        address _vTmpLpAddr;
        uint256 key = 0;
        for (
            uint256 i = voteLpPoolMap.iterateStart();
            voteLpPoolMap.iterateValid(i);
            i = voteLpPoolMap.iterateNext(i)
        ) {
            (, _vTmpLpAddr) = voteLpPoolMap.iterateGet(i);
            require(_vTmpLpAddr != newLpAddr, "newLpAddr already exist");
        }
        for (key = 0; voteLpPoolMap.iterateValid(key); key++) {
            if (voteLpPoolMap.contains(key) == false) {
                break;
            }
        }
        voteLpPoolMap.insert(key, newLpAddr);
    }

    function delVotePool(address newLpAddr) public onlyOwner {
        uint256 key = 0;
        address _vTmpLpAddr;
        for (
            uint256 i = voteLpPoolMap.iterateStart();
            voteLpPoolMap.iterateValid(i);
            i = voteLpPoolMap.iterateNext(i)
        ) {
            (key, _vTmpLpAddr) = voteLpPoolMap.iterateGet(i);
            if (_vTmpLpAddr == newLpAddr) {
                voteLpPoolMap.remove(key);
                return;
            }
        }
    }

    function getVotePool(address newLpAddr) external view returns (uint256) {
        address _vTmpLpAddr;
        uint256 key = 0;
        for (
            uint256 i = voteLpPoolMap.iterateStart();
            voteLpPoolMap.iterateValid(i);
            i = voteLpPoolMap.iterateNext(i)
        ) {
            (key, _vTmpLpAddr) = voteLpPoolMap.iterateGet(i);
            if (_vTmpLpAddr == newLpAddr) {
                return key;
            }
        }
        return 0;
    }

    function setSqrtEnable(bool enable) public onlyOwner {
        if (sqrtEnable != enable) {
            sqrtEnable = enable;
        }
    }

    function setPow(
        uint256 lPow,
        uint256 bPow,
        uint256 sPow
    ) public onlyOwner {
        //no need to check pow ?= 0
        if (lPow != lpPow) {
            lpPow = lPow;
        }
        if (bPow != balancePow) {
            balancePow = bPow;
        }
        if (sPow != stakePow) {
            stakePow = sPow;
        }
    }
}
