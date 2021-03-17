const { expectRevert, time } = require('@openzeppelin/test-helpers');
const SakeToken = artifacts.require('SakeToken');
const SakeMasterV2 = artifacts.require('SakeMasterV2');
const MockERC20 = artifacts.require('MockERC20V2');

contract('SakeMasterV2', ([alice, bob, carol, admin, sakefee, sakeMaker, minter]) => {
    beforeEach(async () => {
        this.sake = await SakeToken.new({ from: alice });
        this.sakeMasterV2 = await SakeMasterV2.new(this.sake.address, admin, sakeMaker, sakefee, '0', { from: alice });
    });

    it('should set correct state variables', async () => {
        const sake = await this.sakeMasterV2.sake();
        const administrator = await this.sakeMasterV2.admin();
        const owner = await this.sakeMasterV2.owner();
        const startBlock = await this.sakeMasterV2.startBlock();
        const sakePerBlockYieldFarming = await this.sakeMasterV2.sakePerBlockYieldFarming();
        const sakePerBlockTradeMining = await this.sakeMasterV2.sakePerBlockTradeMining();
        const tradeMiningSpeedUpEndBlock = await this.sakeMasterV2.tradeMiningSpeedUpEndBlock();
        const yieldFarmingIIEndBlock = await this.sakeMasterV2.yieldFarmingIIEndBlock();
        const tradeMiningEndBlock = await this.sakeMasterV2.tradeMiningEndBlock();
        assert.equal(sake.valueOf(), this.sake.address);
        assert.equal(admin.valueOf(), administrator);
        assert.equal(owner.valueOf(), alice);
        assert.equal(startBlock.valueOf(), '0');
        assert.equal(sakePerBlockYieldFarming.valueOf(), '5000000000000000000');
        assert.equal(sakePerBlockTradeMining.valueOf(), '10000000000000000000');
        assert.equal(tradeMiningSpeedUpEndBlock.valueOf(), '192000');
        assert.equal(yieldFarmingIIEndBlock.valueOf(), '1152000');
        assert.equal(tradeMiningEndBlock.valueOf(), '2304000');
    });

    it('should allow owner and only owner to update admin', async () => {
        assert.equal((await this.sakeMasterV2.admin()).valueOf(), admin);
        await expectRevert(this.sakeMasterV2.setAdmin(bob, { from: carol }), 'Ownable: caller is not the owner');
        await this.sakeMasterV2.setAdmin(bob, { from: alice });
        assert.equal((await this.sakeMasterV2.admin()).valueOf(), bob);
    });

    it('should allow owner and only owner to update admin', async () => {
        assert.equal((await this.sakeMasterV2.admin()).valueOf(), admin);
        await expectRevert(this.sakeMasterV2.setAdmin(bob, { from: carol }), 'Ownable: caller is not the owner');
        await this.sakeMasterV2.setAdmin(bob, { from: alice });
        assert.equal((await this.sakeMasterV2.admin()).valueOf(), bob);
    });

    it('should allow owner and only owner to update sake Fee Address', async () => {
        assert.equal((await this.sakeMasterV2.sakeFeeAddress()).valueOf(), sakefee);
        await expectRevert(this.sakeMasterV2.setSakeFeeAddress(bob, { from: carol }), 'sf:Call must come from admin.');
        await this.sakeMasterV2.setSakeFeeAddress(bob, { from: admin });
        assert.equal((await this.sakeMasterV2.sakeFeeAddress()).valueOf(), bob);
    });

    it('should allow owner and only owner to update sakeMaker', async () => {
        assert.equal((await this.sakeMasterV2.sakeMaker()).valueOf(), sakeMaker);
        await expectRevert(this.sakeMasterV2.setSakeMaker(bob, { from: carol }), 'sm:Call must come from admin.');
        await this.sakeMasterV2.setSakeMaker(bob, { from: admin });
        assert.equal((await this.sakeMasterV2.sakeMaker()).valueOf(), bob);
    });

    it('should allow owner and only owner to update lpFeeRatio', async () => {
        assert.equal((await this.sakeMasterV2.lpFeeRatio()).valueOf(), '0');
        await expectRevert(this.sakeMasterV2.setLpFeeRatio('10', { from: carol }), 'lp:Call must come from admin.');
        await expectRevert(this.sakeMasterV2.setLpFeeRatio('200', { from: admin }), 'invalid ratio');
        await this.sakeMasterV2.setLpFeeRatio('10', { from: admin });
        assert.equal((await this.sakeMasterV2.lpFeeRatio()).valueOf(), '10');
    });

    it('should allow owner and only owner to update withdrawInterval', async () => {
        assert.equal((await this.sakeMasterV2.withdrawInterval()).valueOf(), '192000');
        await expectRevert(this.sakeMasterV2.setWithdrawInterval('10', { from: carol }), 'i:Call must come from admin.');
        await this.sakeMasterV2.setWithdrawInterval('1000', { from: admin });
        assert.equal((await this.sakeMasterV2.withdrawInterval()).valueOf(), '1000');
    });

    it('should allow admin and only admin to update sake fee ratio', async () => {
        assert.equal((await this.sakeMasterV2.sakeFeeRatio()).valueOf(), '10');
        await expectRevert(this.sakeMasterV2.setSakeFeeRatio('20', { from: carol }), 'sfr:Call must come from admin.');
        await expectRevert(this.sakeMasterV2.setSakeFeeRatio('200', { from: admin }), 'invalid ratio');
        await this.sakeMasterV2.setSakeFeeRatio('20', { from: admin });
        assert.equal((await this.sakeMasterV2.sakeFeeRatio()).valueOf(), '20');
    });

    it('should allow admin and only admin to update sake per block for yeild farming', async () => {
        assert.equal(await this.sakeMasterV2.sakePerBlockYieldFarming().valueOf(), '5000000000000000000');
        await expectRevert(this.sakeMasterV2.setSakePerBlockYieldFarming('10000000000000000000', false, { from: alice }), 'yield:Call must come from admin.');
        await this.sakeMasterV2.setSakePerBlockYieldFarming('10000000000000000000', false, { from: admin });
        assert.equal(await this.sakeMasterV2.sakePerBlockYieldFarming().valueOf(), '10000000000000000000');
    });

    it('should allow admin and only admin to update sake per block for trade mining', async () => {
        assert.equal(await this.sakeMasterV2.sakePerBlockTradeMining().valueOf(), '10000000000000000000');
        await expectRevert(this.sakeMasterV2.setSakePerBlockTradeMining('20000000000000000000', false, { from: alice }), 'trade:Call must come from admin.');
        await this.sakeMasterV2.setSakePerBlockTradeMining('20000000000000000000', false, { from: admin });
        assert.equal(await this.sakeMasterV2.sakePerBlockTradeMining().valueOf(), '20000000000000000000');
    });

    it('set trade mining speed up end block', async () => {
        assert.equal(await this.sakeMasterV2.tradeMiningSpeedUpEndBlock().valueOf(), '192000');
        await expectRevert(this.sakeMasterV2.setTradeMiningSpeedUpEndBlock('200000', { from: alice }), 'tmsu:Call must come from admin.');
        await this.sakeMasterV2.setTradeMiningSpeedUpEndBlock('200000', { from: admin });
        assert.equal(await this.sakeMasterV2.tradeMiningSpeedUpEndBlock().valueOf(), '200000');
    });

    it('set yield farming II end block', async () => {
        assert.equal(await this.sakeMasterV2.yieldFarmingIIEndBlock().valueOf(), '1152000');
        await expectRevert(this.sakeMasterV2.setYieldFarmingIIEndBlock('1200000', { from: alice }), 'yf:Call must come from admin.');
        await this.sakeMasterV2.setYieldFarmingIIEndBlock('1200000', { from: admin });
        assert.equal(await this.sakeMasterV2.yieldFarmingIIEndBlock().valueOf(), '1200000');
    });

    it('set trade mining end block', async () => {
        assert.equal(await this.sakeMasterV2.tradeMiningEndBlock().valueOf(), '2304000');
        await expectRevert(this.sakeMasterV2.setTradeMiningEndBlock('2500000', { from: alice }), 'tm:Call must come from admin.');
        await this.sakeMasterV2.setTradeMiningEndBlock('2500000', { from: admin });
        assert.equal(await this.sakeMasterV2.tradeMiningEndBlock().valueOf(), '2500000');
    });

    it('handover the saketoken mintage right', async () => {
        assert.equal(await this.sake.owner(), alice);
        await this.sake.transferOwnership(this.sakeMasterV2.address, { from: alice });
        assert.equal(await this.sake.owner(), this.sakeMasterV2.address);
        await this.sakeMasterV2.handoverSakeMintage(bob);
        assert.equal(await this.sake.owner(), bob);
    });

    it('getMultiplier', async () => {
        const result1 = await this.sakeMasterV2.getMultiplier(0, 192000);
        assert.equal(result1.multipY.valueOf(), '192000');
        assert.equal(result1.multipT.valueOf(), '384000');
        const result2 = await this.sakeMasterV2.getMultiplier(0, 193000);
        assert.equal(result2.multipY.valueOf(), '193000');
        assert.equal(result2.multipT.valueOf(), '385000');
        const result3 = await this.sakeMasterV2.getMultiplier(0, 1152000);
        assert.equal(result3.multipY.valueOf(), '1152000');
        assert.equal(result3.multipT.valueOf(), '1344000');
        const result4 = await this.sakeMasterV2.getMultiplier(0, 1200000);
        assert.equal(result4.multipY.valueOf(), '1152000');
        assert.equal(result4.multipT.valueOf(), '1392000');
        const result5 = await this.sakeMasterV2.getMultiplier(1200000, 1500000);
        assert.equal(result5.multipY.valueOf(), '0');
        assert.equal(result5.multipT.valueOf(), '300000');
        const result6 = await this.sakeMasterV2.getMultiplier(1200000, 2305000);
        assert.equal(result6.multipY.valueOf(), '0');
        assert.equal(result6.multipT.valueOf(), '1104000');
        const result7 = await this.sakeMasterV2.getMultiplier(2305000, 2306000);
        assert.equal(result7.multipY.valueOf(), '0');
        assert.equal(result7.multipT.valueOf(), '0');
    });

    it('getSakePerBlock', async () => {
        assert.equal(await this.sakeMasterV2.getSakePerBlock(100).valueOf(), '25000000000000000000');
        assert.equal(await this.sakeMasterV2.getSakePerBlock(192000).valueOf(), '25000000000000000000');
        assert.equal(await this.sakeMasterV2.getSakePerBlock(193000).valueOf(), '15000000000000000000');
        assert.equal(await this.sakeMasterV2.getSakePerBlock(1152000).valueOf(), '15000000000000000000');
        assert.equal(await this.sakeMasterV2.getSakePerBlock(1155000).valueOf(), '10000000000000000000');
        assert.equal(await this.sakeMasterV2.getSakePerBlock(2304000).valueOf(), '10000000000000000000');
        assert.equal(await this.sakeMasterV2.getSakePerBlock(2305000).valueOf(), '0');
    });

    context('With ERC/LP token added to the field', () => {
        beforeEach(async () => {
            this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
            this.sToken = await MockERC20.new("SakeSwap Slippage Token", "SST", "1000000000", { from: minter });
            await this.sToken.transfer(alice, '1000', { from: minter });
            await this.sToken.transfer(bob, '1000', { from: minter });
            await this.sToken.transfer(carol, '1000', { from: minter });
            await this.lp.transfer(alice, '1000', { from: minter });
            await this.lp.transfer(bob, '1000', { from: minter });
            await this.lp.transfer(carol, '1000', { from: minter });
            this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter });
            this.sToken2 = await MockERC20.new("SakeSwap Slippage Token", "SST", "1000000000", { from: minter });
            await this.sToken2.transfer(alice, '1000', { from: minter });
            await this.sToken2.transfer(bob, '1000', { from: minter });
            await this.sToken2.transfer(carol, '1000', { from: minter });
            await this.lp2.transfer(alice, '1000', { from: minter });
            await this.lp2.transfer(bob, '1000', { from: minter });
            await this.lp2.transfer(carol, '1000', { from: minter });
        });

        it('add pool', async () => {
            await expectRevert(this.sakeMasterV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: alice }), 'add:Call must come from admin.');
            await this.sakeMasterV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin });
            assert.equal((await this.sakeMasterV2.poolLength()).valueOf(), '1');
            await expectRevert(this.sakeMasterV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin }), 'pool exist');
            await this.sakeMasterV2.add('100', '100', this.lp2.address, this.sToken2.address, false, { from: admin });
            assert.equal((await this.sakeMasterV2.poolLength()).valueOf(), '2');
        });

        it('set pool allocpoint', async () => {
            await this.sakeMasterV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin });
            await expectRevert(this.sakeMasterV2.set(0, '200', false, { from: alice }), 'set:Call must come from admin.');
            await this.sakeMasterV2.set(0, '200', false, { from: admin });
            assert.equal((await this.sakeMasterV2.poolInfo('0')).allocPoint, '200');
        });

        it('set multiplierSToken', async () => {
            await this.sakeMasterV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin });
            assert.equal((await this.sakeMasterV2.poolInfo('0')).multiplierSToken, '100');
            await expectRevert(this.sakeMasterV2.setMultiplierSToken(0, '200', false, { from: alice }), 'sms:Call must come from admin.');
            await this.sakeMasterV2.setMultiplierSToken(0, '200', false, { from: admin });
            assert.equal((await this.sakeMasterV2.poolInfo('0')).multiplierSToken, '200');
        });

        it('set pool withdraw sake switch', async () => {
            await this.sakeMasterV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin });
            assert.equal((await this.sakeMasterV2.poolInfo('0')).sakeLockSwitch, true);
            await expectRevert(this.sakeMasterV2.setSakeLockSwitch(0, false, false, { from: alice }), 's:Call must come from admin.');
            await this.sakeMasterV2.setSakeLockSwitch(0, false, false, { from: admin });
            assert.equal((await this.sakeMasterV2.poolInfo('0')).sakeLockSwitch, false);
        });

        it('should give out SAKEs only after farming time', async () => {
            const sakeMasterV2 = await SakeMasterV2.new(this.sake.address, admin, sakeMaker, sakefee, '200', { from: alice });
            await this.sake.mint(sakeMasterV2.address, '1000');
            await this.sake.transferOwnership(sakeMasterV2.address, { from: alice });
            await sakeMasterV2.setSakePerBlockYieldFarming('5', false,{ from: admin });
            await sakeMasterV2.setSakePerBlockTradeMining('10', false,{ from: admin });
            await sakeMasterV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin });
            await sakeMasterV2.setWithdrawInterval('1', { from: admin });
            await this.lp.approve(sakeMasterV2.address, '1000', { from: bob });
            await sakeMasterV2.deposit(0, '100', '0', { from: bob });
            await time.advanceBlockTo('189');
            await sakeMasterV2.deposit(0, '0', '0', { from: bob }); // block 90
            assert.equal((await this.sake.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('194');
            await sakeMasterV2.deposit(0, '0', '0', { from: bob }); // block 95
            assert.equal((await this.sake.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('199');
            assert.equal((await this.sake.balanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('204');
            assert.equal((await sakeMasterV2.pendingSake(0, bob)).valueOf(), '100');
            await sakeMasterV2.deposit(0, '0', '0', { from: bob }); // block 105
            assert.equal((await this.sake.balanceOf(bob)).valueOf(), '125');
            assert.equal((await this.sake.balanceOf(sakeMasterV2.address)).valueOf(), '975');
        });

        it('should distribute SAKEs properly for each staker', async () => {
            // 100 per block farming rate starting at block 300 with bonus until block 1000
            const sakeMasterV2 = await SakeMasterV2.new(this.sake.address, admin, sakeMaker, sakefee, '300', { from: alice });
            await this.sake.mint(sakeMasterV2.address, '5000');
            await this.sake.transferOwnership(sakeMasterV2.address, { from: alice });
            await sakeMasterV2.setSakePerBlockYieldFarming('5', false,{ from: admin });
            await sakeMasterV2.setSakePerBlockTradeMining('10', false,{ from: admin });
            await sakeMasterV2.add('100', '100', this.lp.address, this.sToken.address, false, { from: admin });
            await sakeMasterV2.setWithdrawInterval('1', { from: admin });
            await this.lp.approve(sakeMasterV2.address, '1000', { from: alice });
            await this.lp.approve(sakeMasterV2.address, '1000', { from: bob });
            await this.lp.approve(sakeMasterV2.address, '1000', { from: carol });
            // Alice deposits 10 LPs at block 310
            await time.advanceBlockTo('309');
            await sakeMasterV2.deposit(0, '10', '0', { from: alice });
            // Bob deposits 20 LPs at block 314
            await time.advanceBlockTo('313');
            await sakeMasterV2.deposit(0, '20', '0', { from: bob });
            // Carol deposits 30 LPs at block 218
            await time.advanceBlockTo('317');
            await sakeMasterV2.deposit(0, '30', '0', { from: carol });
            // Alice deposits 10 more LPs at block 220. At this point:
            // Alice should have: 4*25 + 4*1/3*25 + 2*1/6*25 = 141
            // SakeMaster should have the remaining: 5000  - 141 = 109
            await time.advanceBlockTo('319')
            await sakeMasterV2.deposit(0, '10', '0', { from: alice });
            assert.equal((await this.sake.totalSupply()).valueOf(), '5200');
            assert.equal((await this.sake.balanceOf(alice)).valueOf(), '141');
            assert.equal((await this.sake.balanceOf(bob)).valueOf(), '0');
            assert.equal((await this.sake.balanceOf(carol)).valueOf(), '0');
            assert.equal((await this.sake.balanceOf(sakeMasterV2.address)).valueOf(), '5059');
            // Bob withdraws 5 LPs at block 230. At this point:
            // Bob should have: 4*2/3*25 + 2*2/6*25 + 10*2/7*25 = 154
            await time.advanceBlockTo('329')
            await sakeMasterV2.withdraw(0, '5', { from: bob });
            assert.equal((await this.sake.totalSupply()).valueOf(), '5400');
            assert.equal((await this.sake.balanceOf(alice)).valueOf(), '141');
            assert.equal((await this.sake.balanceOf(bob)).valueOf(), '154');
            assert.equal((await this.sake.balanceOf(carol)).valueOf(), '0');
            assert.equal((await this.sake.balanceOf(sakeMasterV2.address)).valueOf(), '5105');
            // Alice withdraws 20 LPs at block 240.
            // Bob withdraws 15 LPs at block 250.
            // Carol withdraws 30 LPs at block 260.
            await time.advanceBlockTo('339')
            await sakeMasterV2.withdraw(0, '20', { from: alice });
            await time.advanceBlockTo('349')
            await sakeMasterV2.withdraw(0, '15', { from: bob });
            await time.advanceBlockTo('359')
            await sakeMasterV2.withdraw(0, '30', { from: carol });
            assert.equal((await this.sake.totalSupply()).valueOf(), '6000');
            // Alice should have: 141 + 10*2/7*25 + 10*2/6.5*25 = 289
            assert.equal((await this.sake.balanceOf(alice)).valueOf(), '289');
            // Bob should have: 154 + 10*1.5/6.5 * 25 + 10*1.5/4.5*25 = 295
            assert.equal((await this.sake.balanceOf(bob)).valueOf(), '295');
            // Carol should have: 2*3/6*25 + 10*3/7*25 + 10*3/6.5*25 + 10*3/4.5*25 + 10*25 = 665
            assert.equal((await this.sake.balanceOf(carol)).valueOf(), '665');
            // All of them should have 1000 LPs back.
            assert.equal((await this.lp.balanceOf(alice)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(carol)).valueOf(), '1000');
        });

        it('should give proper SAKEs allocation to each pool', async () => {
            const sakeMasterV2 = await SakeMasterV2.new(this.sake.address, admin, sakeMaker, sakefee, '400', { from: alice });
            await this.sake.mint(sakeMasterV2.address, '5000');
            await this.sake.transferOwnership(sakeMasterV2.address, { from: alice });
            await sakeMasterV2.setSakePerBlockYieldFarming('5', false,{ from: admin });
            await sakeMasterV2.setSakePerBlockTradeMining('10', false,{ from: admin });
            await this.lp.approve(sakeMasterV2.address, '1000', { from: alice });
            await this.lp2.approve(sakeMasterV2.address, '1000', { from: bob });
            // Add first LP to the pool with allocation 10
            await sakeMasterV2.add('10', '100', this.lp.address, this.sToken.address, true, { from: admin });
            // Alice deposits 10 LPs at block 410
            await time.advanceBlockTo('409');
            await sakeMasterV2.deposit(0, '10', '0', { from: alice });
            // Add LP2 to the pool with allocation 2 at block 320
            await time.advanceBlockTo('419');
            await sakeMasterV2.add('20', '100',this.lp2.address, this.sToken2.address, true, { from: admin });
            // Alice should have 10*25 pending reward
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '250');
            // Bob deposits 10 LP2s at block 325
            await time.advanceBlockTo('424');
            await sakeMasterV2.deposit(1, '10', '0', { from: bob });
            // Alice should have 250 + 5*1/3*25 = 291 pending reward
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '291');
            await time.advanceBlockTo('430');
            // At block 330. Bob should get 5*2/3*25 = 82. Alice should get ~41 more.
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '332');
            assert.equal((await sakeMasterV2.pendingSake(1, bob)).valueOf(), '82');
        });

        it('should stop giving bonus SAKEs after the bonus period ends', async () => {
            const sakeMasterV2 = await SakeMasterV2.new(this.sake.address, admin, sakeMaker, sakefee, '500', { from: alice });
            await this.sake.mint(sakeMasterV2.address, '5000');
            await this.sake.transferOwnership(sakeMasterV2.address, { from: alice });
            await sakeMasterV2.setSakePerBlockYieldFarming('5', false,{ from: admin });
            await sakeMasterV2.setSakePerBlockTradeMining('10', false,{ from: admin });
            await this.lp.approve(sakeMasterV2.address, '1000', { from: alice });
            await sakeMasterV2.add('1', '100', this.lp.address, this.sToken.address, true, { from: admin });
            await sakeMasterV2.setTradeMiningEndBlock('600', { from: admin });
            await sakeMasterV2.setYieldFarmingIIEndBlock('600', { from: admin });
            // Alice deposits 10 LPs at block 590
            await time.advanceBlockTo('589');
            await sakeMasterV2.deposit(0, '10', '0', { from: alice });
            // At block 605, she should have 25*10 = 250 pending.
            await time.advanceBlockTo('610');
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '250');
        });

        it('can not harvest sake if harvest interval less than withdraw interval', async () => {
            const sakeMasterV2 = await SakeMasterV2.new(this.sake.address, admin, sakeMaker, sakefee, '650', { from: alice });
            await this.sake.mint(sakeMasterV2.address, '5000');
            await this.sake.transferOwnership(sakeMasterV2.address, { from: alice });
            await sakeMasterV2.setSakePerBlockYieldFarming('5', false,{ from: admin });
            await sakeMasterV2.setSakePerBlockTradeMining('10', false,{ from: admin });
            await this.lp.approve(sakeMasterV2.address, '1000', { from: alice });
            await sakeMasterV2.add('1', '100', this.lp.address, this.sToken.address, true, { from: admin });
            // Alice deposits 10 LPs at block 690
            await time.advanceBlockTo('689');
            await sakeMasterV2.deposit(0, '10', '0', { from: alice });//590
            await time.advanceBlockTo('700');
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '250');
            await sakeMasterV2.deposit(0, '0', '0', { from: alice });//601
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '275');
            assert.equal((await this.sake.balanceOf(alice)).valueOf(), '0');
            await sakeMasterV2.withdraw(0, '5', { from: alice });//602
            assert.equal((await this.sake.balanceOf(alice)).valueOf(), '0');
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '300');
            await sakeMasterV2.setWithdrawInterval('1', { from: admin });//603
            await sakeMasterV2.deposit(0, '0', '0', { from: alice });//604
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '0');
            assert.equal((await this.sake.balanceOf(alice)).valueOf(), '350');
            await time.advanceBlockTo('709');
            await sakeMasterV2.withdraw(0, '5', { from: alice });//610
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '0');
            assert.equal((await this.sake.balanceOf(alice)).valueOf(), '500');
        });

        it('lp fee ratio', async () => {
            const sakeMasterV2 = await SakeMasterV2.new(this.sake.address, admin, sakeMaker, sakefee, '750', { from: alice });
            const lp = await MockERC20.new('LPToken', 'LP', '400000000000000000000', { from: minter });
            await lp.transfer(alice, '200000000000000000000', { from: minter });
            await lp.transfer(bob, '200000000000000000000', { from: minter });
            await this.sake.mint(sakeMasterV2.address, '5000');
            await lp.approve(sakeMasterV2.address, '200000000000000000000', { from: alice });
            await lp.approve(sakeMasterV2.address, '200000000000000000000', { from: bob });
            await sakeMasterV2.add('1', '100', lp.address, this.sToken.address, true, { from: admin });
            // Alice deposits 10 LPs at block 790
            await time.advanceBlockTo('789');
            await sakeMasterV2.deposit(0, '200000000000000000000', '0', { from: alice });//690
            await sakeMasterV2.deposit(0, '200000000000000000000', '0', { from: bob });//691
            await time.advanceBlockTo('799');
            await sakeMasterV2.withdraw(0, '5000000000000000000', { from: alice });
            assert.equal((await lp.balanceOf(alice)).valueOf(), '5000000000000000000');
            await sakeMasterV2.setLpFeeRatio(5, { from: admin });
            await sakeMasterV2.withdraw(0, '5000000000000000000', { from: alice });
            assert.equal((await lp.balanceOf(alice)).valueOf(), '9750000000000000000');
            assert.equal((await lp.balanceOf(sakeMasterV2.address)).valueOf(), '390000000000000000000');
            assert.equal((await lp.balanceOf(sakeMaker)).valueOf(), '250000000000000000');
            await sakeMasterV2.withdraw(0, '5000000000000000000', { from: bob });
            assert.equal((await lp.balanceOf(bob)).valueOf(), '4750000000000000000');
            assert.equal((await lp.balanceOf(sakeMaker)).valueOf(), '500000000000000000');
        });

        it('sake fee ratio', async () => {
            const sakeMasterV2 = await SakeMasterV2.new(this.sake.address, admin, sakeMaker, sakefee, '850', { from: alice });
            await this.sake.mint(sakeMasterV2.address, '5000');
            await this.sake.transferOwnership(sakeMasterV2.address, { from: alice });
            await sakeMasterV2.setSakePerBlockYieldFarming('5', false,{ from: admin });
            await sakeMasterV2.setSakePerBlockTradeMining('10', false,{ from: admin });
            await this.lp.approve(sakeMasterV2.address, '1000', { from: alice });
            await sakeMasterV2.add('1', '100', this.lp.address, this.sToken.address, true, { from: admin });
            // Alice deposits 10 LPs at block 890
            await time.advanceBlockTo('889');
            await sakeMasterV2.deposit(0, '10', '0', { from: alice });//890
            await time.advanceBlockTo('900');
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '250');
            await sakeMasterV2.deposit(0, '0', '0', { from: alice });//901
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '275');
            assert.equal((await this.sake.balanceOf(alice)).valueOf(), '0');
            await sakeMasterV2.withdraw(0, '5', { from: alice });//902
            assert.equal((await this.sake.balanceOf(alice)).valueOf(), '0');
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '300');
            await sakeMasterV2.setSakeLockSwitch(0, false, false, { from: admin });
            await sakeMasterV2.deposit(0, '0', '0', { from: alice });//904
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '0');
            assert.equal((await this.sake.balanceOf(alice)).valueOf(), '315');
            await time.advanceBlockTo('909');
            await sakeMasterV2.withdraw(0, '5', { from: alice });//910
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '0');
            assert.equal((await this.sake.balanceOf(alice)).valueOf(), '450');
            assert.equal((await this.sake.balanceOf(sakefee)).valueOf(), '50');
        });

        it('with draw', async () => {
            const sakeMasterV2 = await SakeMasterV2.new(this.sake.address, admin, sakeMaker, sakefee, '1000', { from: alice });
            await this.sake.mint(sakeMasterV2.address, '5000');
            await this.sake.transferOwnership(sakeMasterV2.address, { from: alice });
            await sakeMasterV2.setSakePerBlockYieldFarming('5', false, { from: admin });
            await sakeMasterV2.setSakePerBlockTradeMining('10', false, { from: admin });
            await this.lp.approve(sakeMasterV2.address, '1000', { from: alice });
            await this.sToken.approve(sakeMasterV2.address, '1000', { from: alice });
            await this.lp.approve(sakeMasterV2.address, '1000', { from: bob });
            await this.sToken.approve(sakeMasterV2.address, '1000', { from: bob });
            await sakeMasterV2.add('100', '10000000000', this.lp.address, this.sToken.address, true, { from: admin });
            await time.advanceBlockTo('1098');
            await expectRevert(sakeMasterV2.deposit(0, '0', '1', { from: alice }), 'deposit:invalid');//990
            await sakeMasterV2.deposit(0, '1000', '10', { from: alice }); //1000==>alice
            assert.equal((await sakeMasterV2.userInfo(0, alice)).amount, '2000');
            assert.equal((await sakeMasterV2.userInfo(0, alice)).amountLPtoken, '1000');
            assert.equal((await sakeMasterV2.userInfo(0, alice)).amountStoken, '10');
            await time.advanceBlockTo('1109');
            await sakeMasterV2.deposit(0, '1000', '10', { from: bob }); //1100==>bob
            assert.equal((await sakeMasterV2.userInfo(0, bob)).amount, '2000');
            assert.equal((await sakeMasterV2.userInfo(0, bob)).amountLPtoken, '1000');
            assert.equal((await sakeMasterV2.userInfo(0, bob)).amountStoken, '10');
            await expectRevert(sakeMasterV2.withdraw(0, '1100', { from: alice }), 'withdraw: LP amount not enough');
            await time.advanceBlockTo('1119');
            await sakeMasterV2.withdraw(0, '500', { from: alice });//1120
            // alice have sake = 10*25+1/2*10*25 = 375
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '375');
            assert.equal((await sakeMasterV2.pendingSake(0, bob)).valueOf(), '125');
            assert.equal((await this.lp.balanceOf(alice)).valueOf(), '500');
            assert.equal((await this.sToken.balanceOf(alice)).valueOf(), '990');
            assert.equal((await sakeMasterV2.userInfo(0, alice)).amountStoken, '0');
            assert.equal((await sakeMasterV2.userInfo(0, alice)).amountLPtoken, '500');
            assert.equal((await sakeMasterV2.userInfo(0, alice)).amount, '500');
            assert.equal((await this.lp.balanceOf(sakeMasterV2.address)).valueOf(), '1500');
            assert.equal((await this.sToken.balanceOf(sakeMasterV2.address)).valueOf(), '10');
            await time.advanceBlockTo('1129');
            await sakeMasterV2.withdraw(0, '500', { from: bob });//1130
            // alice have sake = 1/2*10*25 + 10*25*4/5= 325
            assert.equal((await sakeMasterV2.pendingSake(0, bob)).valueOf(), '325');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '500');
            assert.equal((await this.sToken.balanceOf(bob)).valueOf(), '990');
            assert.equal((await sakeMasterV2.userInfo(0, bob)).amountStoken, '0');
            assert.equal((await sakeMasterV2.userInfo(0, bob)).amountLPtoken, '500');
            assert.equal((await sakeMasterV2.userInfo(0, bob)).amount, '500');
            assert.equal((await this.lp.balanceOf(sakeMasterV2.address)).valueOf(), '1000');
            assert.equal((await this.sToken.balanceOf(sakeMasterV2.address)).valueOf(), '0');
        });

        it('emergency with draw', async () => {
            const sakeMasterV2 = await SakeMasterV2.new(this.sake.address, admin, sakeMaker, sakefee, '1100', { from: alice });
            await this.sake.mint(sakeMasterV2.address, '5000');
            await this.sake.transferOwnership(sakeMasterV2.address, { from: alice });
            await sakeMasterV2.setSakePerBlockYieldFarming('5', false, { from: admin });
            await sakeMasterV2.setSakePerBlockTradeMining('10', false, { from: admin });
            await this.lp.approve(sakeMasterV2.address, '1000', { from: alice });
            await this.sToken.approve(sakeMasterV2.address, '1000', { from: alice });
            await this.lp.approve(sakeMasterV2.address, '1000', { from: bob });
            await this.sToken.approve(sakeMasterV2.address, '1000', { from: bob });
            await sakeMasterV2.add('100', '10000000000', this.lp.address, this.sToken.address, true, { from: admin });
            await expectRevert(sakeMasterV2.emergencyWithdraw(0, { from: alice }), 'withdraw: LP amount not enough');
            await sakeMasterV2.deposit(0, '1000', '10', { from: alice });
            await time.advanceBlockTo('1160');
            await sakeMasterV2.emergencyWithdraw(0, { from: alice })
            assert.equal((await sakeMasterV2.pendingSake(0, alice)).valueOf(), '0');
            assert.equal((await this.lp.balanceOf(alice)).valueOf(), '1000');
            assert.equal((await this.sToken.balanceOf(alice)).valueOf(), '990');
            assert.equal((await sakeMasterV2.userInfo(0, alice)).amount, '0');
            assert.equal((await sakeMasterV2.userInfo(0, alice)).amountStoken, '0');
            assert.equal((await sakeMasterV2.userInfo(0, alice)).amountLPtoken, '0');
        });
    });
});
