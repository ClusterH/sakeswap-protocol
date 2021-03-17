const { expectRevert } = require('@openzeppelin/test-helpers');
const SakeToken = artifacts.require('SakeToken');
const SakeMaster = artifacts.require('SakeMaster');
const SakeBar = artifacts.require('SakeBar');
const SakeVoterCalc = artifacts.require('SakeVoterCalc');
const MockERC20 = artifacts.require('MockERC20');
const SakeSwapPair = artifacts.require('SakeSwapPair');
const SakeSwapFactory = artifacts.require('SakeSwapFactory');
const STokenMaster = artifacts.require('STokenMaster');
const SakeMasterV2 = artifacts.require('SakeMasterV2');

const TOTAL_SUPPLY = 10000000;
const LP_SUPPLY    = 1000000;

contract('SakeVoterCalc', ([alice, bob, carol, dev, admin, sakefee, sakeMaker, minter]) => {
    beforeEach(async () => {
        this.sakeToken = await SakeToken.new({ from: alice });
        await this.sakeToken.mint(minter, TOTAL_SUPPLY, { from: alice });
        this.SakeBar = await SakeBar.new(this.sakeToken.address,{ from: alice });
        this.sTokenMaster = await STokenMaster.new(this.sakeToken.address, bob, carol, '200', '10', '0', '300000', { from: alice });
        this.sakeMaster = await SakeMaster.new(this.sakeToken.address, dev, '1000', '0', { from: alice });
        this.sakeMasterV2 = await SakeMasterV2.new(this.sakeToken.address, admin, sakeMaker, sakefee, '0', { from: alice });
        this.SakeVoterCalc = await SakeVoterCalc.new(this.sakeToken.address, this.SakeBar.address, this.sTokenMaster.address, this.sakeMaster.address, this.sakeMasterV2.address,{ from: alice });
    });

    it('check totalSupply', async () => {
        await this.sakeToken.mint(alice, '10000', { from: alice });
        await this.sakeToken.mint(bob, '10000', { from: alice });
        await this.sakeToken.mint(carol, '10000', { from: alice });
        //sqrt(10030000)
        assert.equal((await this.SakeVoterCalc.totalSupply()).valueOf(), '3167');
        await this.sakeToken.mint(carol, '50000', { from: alice });
        //sqrt(10080000)
        assert.equal((await this.SakeVoterCalc.totalSupply()).valueOf(), '3174');
        await this.sakeToken.mint(bob, '50000', { from: alice });
        //sqrt(10130000)
        assert.equal((await this.SakeVoterCalc.totalSupply()).valueOf(), '3182');
        this.SakeVoterCalc.setSqrtEnable(false, { from: alice });
        assert.equal((await this.SakeVoterCalc.totalSupply()).valueOf(), '10130000');
        this.SakeVoterCalc.setSqrtEnable(true, { from: alice });
        assert.equal((await this.SakeVoterCalc.totalSupply()).valueOf(), '3182');
        //sakebar enter
        await this.sakeToken.approve(this.SakeBar.address, '10000', { from: carol });
        await this.SakeBar.enter('10000',{ from: carol });
        //sqrt(10140000)
        assert.equal((await this.SakeVoterCalc.totalSupply()).valueOf(), '3182');
        await this.SakeVoterCalc.setPow(2,1,0, { from: alice });
        // totalSupply = //sqrt(10130000)
        assert.equal((await this.SakeVoterCalc.totalSupply()).valueOf(), '3181');
        await this.SakeVoterCalc.setPow(2,1,2, { from: alice });
        // totalSupply = //sqrt(10150000)
        assert.equal((await this.SakeVoterCalc.totalSupply()).valueOf(), '3184');
    });

    it('check votePools api', async () => {
        tmpToken = await MockERC20.new('TToken', 'TOKEN0', TOTAL_SUPPLY, { from: minter });
        await expectRevert(this.SakeVoterCalc.addVotePool(tmpToken.address,{ from: bob }),'Not Owner');
        await expectRevert(this.SakeVoterCalc.delVotePool(tmpToken.address,{ from: bob }),'Not Owner');
        for(i=50;i<100;i++)
        {
            tmpToken = await MockERC20.new('TToken', 'TOKEN0', TOTAL_SUPPLY, { from: minter });
            this.SakeVoterCalc.addVotePool(tmpToken.address, { from: alice });
            this.SakeVoterCalc.delVotePool(tmpToken.address, { from: alice });
        }
        //console.log("get total2 ",(await this.SakeVoterCalc.totalSupply()).valueOf());
    });

    it('check balanceOf', async () => {
        // test xsake voter
        //bob 20000 sake 
        await this.sakeToken.transfer(bob, 20000, { from: minter });
        //sakebar enter -> 10000 xsake , 10000 sake
        await this.sakeToken.approve(this.SakeBar.address, '20000', { from: bob });
        await this.SakeBar.enter('20000',{ from: bob });
        //sqrt(20000)
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '141');
        await this.SakeBar.leave('10000',{ from: bob });
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '141');

        //sakeMaster
        this.factory0 = await SakeSwapFactory.new(alice, { from: alice });
        this.factory1 = await SakeSwapFactory.new(alice, { from: alice });
        this.factory3 = await SakeSwapFactory.new(alice, { from: alice });
        this.factory4 = await SakeSwapFactory.new(alice, { from: alice });
        await this.sakeToken.transferOwnership(this.sakeMaster.address, { from: alice });
        this.token0 = await MockERC20.new('TToken', 'TOKEN0', TOTAL_SUPPLY, { from: minter });
        this.lp0 = await SakeSwapPair.at((await this.factory0.createPair(this.token0.address, this.sakeToken.address)).logs[0].args.pair);
        await this.token0.transfer(this.lp0.address, LP_SUPPLY, { from: minter });
        await this.sakeToken.transfer(this.lp0.address, LP_SUPPLY, { from: minter });
        await this.lp0.mint(minter);
        await this.sakeMaster.add('100', this.lp0.address, true);
        await this.lp0.transfer(bob, '10000', { from: minter });
        await this.lp0.approve(this.sakeMaster.address, '10000', { from: bob });
        await this.sakeMaster.deposit(0, '10000', { from: bob });
        //console.log("get bob balanceOf",(await this.SakeVoterCalc.balanceOf(bob)).valueOf());
        this.SakeVoterCalc.addVotePool(this.lp0.address, { from: alice });
        //sqrt(lp 10000*2 + sakebar 10000 + sake 10000)
        //console.log("get bob balanceOf1",(await this.SakeVoterCalc.balanceOf(bob)).valueOf());
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '200');
        this.token1 = await MockERC20.new('TToken1', 'TOKEN1', TOTAL_SUPPLY, { from: minter });
        this.lp1 = await SakeSwapPair.at((await this.factory1.createPair(this.token1.address, this.sakeToken.address)).logs[0].args.pair);
        await this.token1.transfer(this.lp1.address, LP_SUPPLY, { from: minter });
        await this.sakeToken.transfer(this.lp1.address, LP_SUPPLY, { from: minter });
        await this.lp1.mint(minter);
        await this.sakeMaster.add('100', this.lp1.address, true);
        await this.lp1.transfer(bob, '20000', { from: minter });
        await this.lp1.approve(this.sakeMaster.address, '10000', { from: bob });
        await this.sakeMaster.deposit(1, '10000', { from: bob });
        //sqrt(lp 30000*2 + sakebar 10000 + sake 10000)
        await this.SakeVoterCalc.addVotePool(this.lp1.address, { from: alice });
        //console.log("get bob balanceOf2",(await this.SakeVoterCalc.balanceOf(bob)).valueOf());
        await this.SakeVoterCalc.delVotePool(this.lp0.address, { from: alice });
        //sqrt(lp 20000*2 + sakebar 10000 + sake 10000)
        //console.log("get bob balanceOf3",(await this.SakeVoterCalc.balanceOf(bob)).valueOf());
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '244');
        // await this.sakeMaster.withdraw(1, '10000', { from: bob });
        // //no change
        // console.log("get bob balanceOf4",(await this.SakeVoterCalc.balanceOf(bob)).valueOf());

         //test masterV2
        this.tokenst1 = await MockERC20.new('ST1Token', 'TOKENST', TOTAL_SUPPLY, { from: minter });
        this.lpst1 = await SakeSwapPair.at((await this.factory3.createPair(this.tokenst1.address, this.sakeToken.address)).logs[0].args.pair);
        await this.tokenst1.transfer(this.lpst1.address, LP_SUPPLY, { from: minter });
        await this.sakeToken.transfer(this.lpst1.address, LP_SUPPLY, { from: minter });
        await this.lpst1.mint(minter);
        await this.sakeMasterV2.setSakePerBlockYieldFarming('5', false,{ from: admin });
        await this.sakeMasterV2.setSakePerBlockTradeMining('10', false,{ from: admin });
        await this.sakeMasterV2.setWithdrawInterval('1', { from: admin });
        await this.sakeMasterV2.add('100', '100', this.lpst1.address, this.tokenst1.address, false, { from: admin });       
        await this.lpst1.transfer(bob, '10000', { from: minter });
        await this.tokenst1.transfer(bob, '10000', { from: minter });
        await this.lpst1.approve(this.sakeMasterV2.address, '10000', { from: bob });
        await this.tokenst1.approve(this.sakeMasterV2.address, '10000', { from: bob });
        await this.sakeMasterV2.deposit(0, '10000', '10000',{ from: bob });
        //sqrt(lp 20000*2 + sakebar 10000 + sake 10000)
        //console.log("get bob balanceOf5",(await this.SakeVoterCalc.balanceOf(bob)).valueOf());
        await this.SakeVoterCalc.addVotePool(this.lpst1.address, { from: alice });
        //voter = sqrt(lp 30000*2 + sakebar 10000 + sake 10000)
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '282');
        // console.log("get bob balanceOf6",(await this.SakeVoterCalc.balanceOf(bob)).valueOf());
        // console.log("get lp0",this.lp0.address);
        // console.log("get lp0 index",(await this.SakeVoterCalc.getVotePool(this.lp0.address)).valueOf());
        // console.log("get lp1",this.lp1.address);
        // console.log("get lp1 index",(await this.SakeVoterCalc.getVotePool(this.lp1.address)).valueOf());
        // console.log("get lpst1",this.lpst1.address);
        // console.log("get lpst1 index",(await this.SakeVoterCalc.getVotePool(this.lpst1.address)).valueOf());
        await this.sakeMasterV2.withdraw(0, '10000', { from: bob });
        //voter = sqrt(lp 30000*2 + sakebar 10000 + sake 10000)
        //console.log("get bob balanceOf7",(await this.SakeVoterCalc.balanceOf(bob)).valueOf());
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '282');
        this.tokenst2 = await MockERC20.new('ST2Token', 'TOKENST', TOTAL_SUPPLY, { from: minter });
        this.lpst2 = await SakeSwapPair.at((await this.factory4.createPair(this.tokenst2.address, this.sakeToken.address)).logs[0].args.pair);
        await this.tokenst2.transfer(this.lpst2.address, LP_SUPPLY, { from: minter });
        await this.sakeToken.transfer(this.lpst2.address, LP_SUPPLY, { from: minter });
        await this.lpst2.mint(minter);
        await this.sakeMasterV2.add('100', '100', this.lpst2.address, this.tokenst2.address, false, { from: admin });       
        await this.lpst2.transfer(bob, '20000', { from: minter });
        await this.tokenst2.transfer(bob, '20000', { from: minter });
        await this.lpst2.approve(this.sakeMasterV2.address, '20000', { from: bob });
        await this.tokenst2.approve(this.sakeMasterV2.address, '20000', { from: bob });
        await this.sakeMasterV2.deposit(1, '10000', '10000',{ from: bob });
        await this.SakeVoterCalc.addVotePool(this.lpst2.address, { from: alice });
        //voter = sqrt(lp 50000*2 + sakebar 10000 + sake 10000)
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '346');
        await this.SakeVoterCalc.delVotePool(this.lpst1.address, { from: alice });
        //voter = sqrt(lp 40000*2 + sakebar 10000 + sake 10000)
        //console.log("get bob balanceOf8",(await this.SakeVoterCalc.balanceOf(bob)).valueOf());
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '316');
        
        //test setPow
        await this.SakeVoterCalc.setPow(2,1,0, { from: alice });
        // voter = sqrt(2*40000+1*10000)
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '300');
        await this.SakeVoterCalc.setPow(1,1,0, { from: alice });
        //voter = sqrt(1*40000+1*10000)
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '223');
        await this.SakeVoterCalc.setPow(1,1,2, { from: alice });
        //voter = sqrt(1*40000+1*10000+2*10000)
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '264');
        await this.SakeVoterCalc.setPow(2,1,1, { from: alice });

        //test setSqrtEnable
        await this.SakeVoterCalc.setSqrtEnable(false, { from: alice });
        //voter = (2*40000+1*10000+1*10000)
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '100000');
        await this.SakeVoterCalc.setSqrtEnable(true, { from: alice });
        //voter = sqrt(2*40000+1*10000+1*10000)
        assert.equal((await this.SakeVoterCalc.balanceOf(bob)).valueOf(), '316');
    });
});
