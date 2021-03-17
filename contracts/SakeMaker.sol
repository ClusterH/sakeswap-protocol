pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./sakeswap/interfaces/ISakeSwapERC20.sol";
import "./sakeswap/interfaces/ISakeSwapPair.sol";
import "./sakeswap/interfaces/ISakeSwapFactory.sol";

contract SakeMaker is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    ISakeSwapFactory public factory;
    address public bar;
    address public burnToken;
    address public weth;
    uint8 public burnRatio = 9;

    constructor(
        ISakeSwapFactory _factory,
        address _bar,
        address _burnToken,
        address _weth
    ) public {
        require(
            address(_factory) != address(0) && _bar != address(0) && _burnToken != address(0) && _weth != address(0),
            "invalid address"
        );
        factory = _factory;
        burnToken = _burnToken;
        bar = _bar;
        weth = _weth;
    }

    function convert(address token0, address token1) public {
        // At least we try to make front-running harder to do.
        require(msg.sender == tx.origin, "do not convert from contract");
        ISakeSwapPair pair = ISakeSwapPair(factory.getPair(token0, token1));
        pair.transfer(address(pair), pair.balanceOf(address(this)));
        (uint256 _amount0, uint256 _amount1) = pair.burn(address(this));
        (uint256 amount0, uint256 amount1) = token0 == pair.token0() ? (_amount0, _amount1) : (_amount1, _amount0);
        uint256 wethAmount = _toWETH(token0, amount0) + _toWETH(token1, amount1);
        uint256 wethAmountToBurn = wethAmount.mul(burnRatio).div(10);
        uint256 wethAmountToBar = wethAmount.sub(wethAmountToBurn);
        if (wethAmountToBar > 0) {
            IERC20(weth).transfer(factory.getPair(weth, burnToken), wethAmountToBar);
            _toSAKE(wethAmountToBar, bar);
        }
        if (wethAmountToBurn > 0) {
            IERC20(weth).transfer(factory.getPair(weth, burnToken), wethAmountToBurn);
            _toSAKE(wethAmountToBurn, address(1));
        }
    }

    function _toWETH(address token, uint256 amountIn) internal returns (uint256) {
        if (token == burnToken) {
            uint256 amountToBurn = amountIn.mul(burnRatio).div(10);
            uint256 amountToBar = amountIn.sub(amountToBurn);
            IERC20(token).transfer(bar, amountToBar);
            IERC20(token).transfer(address(1), amountToBurn);
            return 0;
        }
        if (token == weth) {
            return amountIn;
        }
        ISakeSwapPair pair = ISakeSwapPair(factory.getPair(token, weth));
        if (address(pair) == address(0)) {
            return 0;
        }
        uint256 amount0Out;
        uint256 amount1Out;
        uint256 amountOut;
        {
            (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
            address token0 = pair.token0();
            (uint256 reserveIn, uint256 reserveOut) = token0 == token ? (reserve0, reserve1) : (reserve1, reserve0);
            uint256 amountInWithFee = amountIn.mul(997);
            uint256 numerator = amountInWithFee.mul(reserveOut);
            uint256 denominator = reserveIn.mul(1000).add(amountInWithFee);
            amountOut = numerator / denominator;
            (amount0Out, amount1Out) = token0 == token ? (uint256(0), amountOut) : (amountOut, uint256(0));
        }
        IERC20(token).transfer(address(pair), amountIn);
        pair.swap(amount0Out, amount1Out, address(this), new bytes(0));
        return amountOut;
    }

    function _toSAKE(uint256 amountIn, address to) internal {
        ISakeSwapPair pair = ISakeSwapPair(factory.getPair(weth, burnToken));
        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
        address token0 = pair.token0();
        (uint256 reserveIn, uint256 reserveOut) = token0 == weth ? (reserve0, reserve1) : (reserve1, reserve0);
        // avoid stack too deep error
        uint256 amountOut;
        {
            uint256 amountInWithFee = amountIn.mul(997);
            uint256 numerator = amountInWithFee.mul(reserveOut);
            uint256 denominator = reserveIn.mul(1000).add(amountInWithFee);
            amountOut = numerator / denominator;
        }
        (uint256 amount0Out, uint256 amount1Out) = token0 == weth ? (uint256(0), amountOut) : (amountOut, uint256(0));
        pair.swap(amount0Out, amount1Out, to, new bytes(0));
    }

    function setBurnRatio(uint8 newRatio) public onlyOwner {
        require(newRatio >= 0 && newRatio <= 10, "invalid burn ratio");
        burnRatio = newRatio;
    }

    function setBurnToken(address _burnToken) public onlyOwner {
        require(_burnToken != address(0), "invalid address");
        burnToken = _burnToken;
    }

    function setBar(address _bar) public onlyOwner {
        require(_bar != address(0), "invalid address");
        bar = _bar;
    }
}
