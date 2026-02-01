import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ResolutionAdapter } from "../target/types/resolution_adapter";
import { MarketRegistry } from "../target/types/market_registry";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TokenAccountNotFoundError, calculateEpochFee, createMint, getAccount, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { expect } from "chai";
import { EscrowVault } from "../target/types/escrow_vault";



describe("Resolution Adapter Complete Test",()=>{
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const resolutionProgram = anchor.workspace.ResolutionAdapter as Program<ResolutionAdapter>
    const escrowProgram = anchor.workspace.EscrowVault as Program<EscrowVault>;
    const marketProgram = anchor.workspace.MarketRegistry as Program<MarketRegistry>

    let admin : Keypair;
    let oracle1 : Keypair;
    let oracle2 : Keypair;
    let oracle3 : Keypair;
    let disputer : Keypair;
    let nonOracle : Keypair;
    let market1ResolutionAdapter: Keypair;
    // Market Account 

    let market1Pda : PublicKey;
    let market1Id : Uint8Array;
    let market1YesMint : Keypair;
    let market1NoMint : Keypair;

    let market2Pda : PublicKey;
    let market2Id : Uint8Array;
    let market2YesMint : Keypair;
    let market2NoMint : Keypair;

    let resolution1Pda : PublicKey;
    let bondVault1 : PublicKey;

    let resolution2Pda  :  PublicKey;
    let bondVault2 : PublicKey;

    let usdcMint : PublicKey;
    let oracle1Usdc : PublicKey;
    let oracle2Usdc : PublicKey;
    let oracle3Usdc : PublicKey;
    let disputerUsdc : PublicKey;
    let protocolTreasuryUsdc : PublicKey;
    const nowTimestamp = Math.floor(Date.now()/1000);
    const shortExpiry = nowTimestamp + 15;
    const futureExpiry = nowTimestamp + 30 * 24 * 60 * 60;


    async function airdrop(pubkey : PublicKey,amount=10){
        const sig = await provider.connection.requestAirdrop(
            pubkey,
            amount*LAMPORTS_PER_SOL
        );

        const latestBlockHash = await provider.connection.getLatestBlockhash();

        await provider.connection.confirmTransaction({
            signature : sig,
            blockhash : latestBlockHash.blockhash,
            lastValidBlockHeight : latestBlockHash.lastValidBlockHeight
        });
    }

    async function getTokenbalance(tokenAddress : PublicKey):Promise<number>{
        const account = await getAccount(provider.connection,tokenAddress);
        return Number(account.amount)
    }

    function getMarketState(state: any): string {
        if (state.created) return "CREATED";
        if (state.open) return "OPEN";
        if (state.paused) return "PAUSED";
        if (state.resolving) return "RESOLVING";
        if (state.resolved) return "RESOLVED";
        return "UNKNOWN";
    }

    async function createMarket(marketId :Uint8Array,question:string,expiry:number){
        const yesMint = Keypair.generate();
        const noMint  = Keypair.generate();


        const [marketPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("market"),Buffer.from(marketId)],
            marketProgram.programId
        );

        const resolutionAdapter = Keypair.generate();


        const [escrowVault] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow_vault"),marketPda.toBuffer()],
            escrowProgram.programId
        );

    

        const params = {
            marketId : Array.from(marketId),
                question,
                description : `Test ${question}`,
                category:"Crypto",
                expireAt : new anchor.BN(expiry),
                resolutionSource:"Pyth BTC/USDC"
          };

        await marketProgram.methods.initializeMarket(params).accounts({
            admin : admin.publicKey,
            // @ts-ignore
            market : marketPda,
            yesTokenMint : yesMint.publicKey,
            noTokenMint : noMint.publicKey,
            escrowVault : escrowVault,
            escrowProgram : escrowProgram.programId,
            resolutionAdapter : resolutionAdapter.publicKey,
            systemProgram : SystemProgram.programId,
            tokenProgram : TOKEN_PROGRAM_ID,
            rent : anchor.web3.SYSVAR_RENT_PUBKEY
        }).signers([admin , yesMint ,noMint]).rpc();

        return { marketPda, yesMint, noMint, resolutionAdapter };
    }

    before(async()=>{
        admin = Keypair.generate();
        oracle1 = Keypair.generate();  
        oracle2 = Keypair.generate();
        oracle3 = Keypair.generate();
        disputer = Keypair.generate();
        nonOracle = Keypair.generate();

        console.log("💰 Airdropping SOL...");
        await Promise.all([
          airdrop(admin.publicKey),
          airdrop(oracle1.publicKey),
          airdrop(oracle2.publicKey),
          airdrop(oracle3.publicKey),
          airdrop(disputer.publicKey),
          airdrop(nonOracle.publicKey),
        ]);

        // Create USDC MInt 

        usdcMint = await createMint(
            provider.connection,
            admin,
            admin.publicKey,
            null,
            6
        )

        // create Oracle USDC Account 
        const oracle1UsdcAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            admin,
            usdcMint,
            oracle1.publicKey,
        );

        oracle1Usdc = oracle1UsdcAccount.address;

        const oracle2UsdcAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            admin,
            usdcMint,
            oracle2.publicKey
        );
        oracle2Usdc = oracle2UsdcAccount.address;


        const oracle3UsdcAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            admin,
            usdcMint,
            oracle3.publicKey
          );
          oracle3Usdc = oracle3UsdcAccount.address;
      
          const disputerUsdcAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            admin,
            usdcMint,
            disputer.publicKey
          );
          disputerUsdc = disputerUsdcAccount.address;

          await Promise.all([
            mintTo(provider.connection,admin,usdcMint,oracle1Usdc,admin,10_000 * 1_000_000),
            mintTo(provider.connection, admin, usdcMint, oracle2Usdc, admin, 10_000 * 1_000_000),
            mintTo(provider.connection, admin, usdcMint, oracle3Usdc, admin, 10_000 * 1_000_000),
            mintTo(provider.connection, admin, usdcMint, disputerUsdc, admin, 10_000 * 1_000_000),      
          ])

        //   Create A Test Market 

        market1Id = new Uint8Array(32).fill(1);
        market2Id = new Uint8Array(32).fill(2);

        console.log("\n Account Setup:");
        console.log("  Admin:", admin.publicKey.toString());
        console.log("  Oracle 1:", oracle1.publicKey.toString());
        console.log("  Oracle 2:", oracle2.publicKey.toString());
        console.log("  Oracle 3:", oracle3.publicKey.toString());
        console.log("  Disputer:", disputer.publicKey.toString());
        console.log("  USDC Mint:", usdcMint.toString());
        console.log("\n Setup complete!\n");
    })

    // Done
    describe("Resolution Initilaization",()=>{
        it("It should Initialization Resolution for crypto market",async()=>{
            console.log("Initilaize crypto market Resolution ");
            
            const result = await createMarket(market1Id,"Will BTC will reach $100k?",shortExpiry);

            market1Pda = result.marketPda;
            market1YesMint = result.yesMint;
            market1NoMint = result.noMint;
            market1ResolutionAdapter = result.resolutionAdapter;

            [resolution1Pda] = PublicKey.findProgramAddressSync(
                [Buffer.from("resolution"), market1Pda.toBuffer()],
                resolutionProgram.programId
            );

            [bondVault1] = PublicKey.findProgramAddressSync(
                [Buffer.from("bond_vault"),market1Pda.toBuffer()],
                resolutionProgram.programId
            );

            await resolutionProgram.methods.initializeResolution({crypto:{}}).accounts({
                authority : admin.publicKey,
                market : market1Pda,
                // @ts-ignore
                resolutionProposal: resolution1Pda,
                bondVault : bondVault1,
                bondMint : usdcMint,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            }).signers([admin]).rpc();

            const resolution = await resolutionProgram.account.resolutionProposal.fetch(resolution1Pda);
      
            expect(resolution.market.toString()).to.equal(market1Pda.toString());
            expect(resolution.category).to.deep.equal({ crypto: {} });
            expect(resolution.bondAmount.toNumber()).to.equal(0);
            expect(resolution.isDisputed).to.be.false;
            expect(resolution.isFinalized).to.be.false;
            expect(resolution.bondVault.toString()).to.equal(bondVault1.toString());
      
            console.log(" Resolution initialized");
            console.log("   Category: Crypto");
            console.log("   Bond Vault:", bondVault1.toString());
        })

        it("Should Shoudl Initialize a resolution For Sports Market",async()=>{
            console.log("Initilizing Sports Market Resolution");
            const result = await createMarket(market2Id,"Will india Win against Nz",shortExpiry);
            market2Pda = result.marketPda;
            market2YesMint = result.yesMint;
            market2NoMint = result.noMint;
            
            [resolution2Pda] = PublicKey.findProgramAddressSync(
                [Buffer.from("resolution"),market2Pda.toBuffer()],
                resolutionProgram.programId
            );

            [bondVault2] = PublicKey.findProgramAddressSync(
                [Buffer.from("bond_vault"),market2Pda.toBuffer()],
                resolutionProgram.programId
            );

            await resolutionProgram.methods.initializeResolution({sports:{}}).accounts({
                authority : admin.publicKey,
                market : market2Pda,
                // @ts-ignore
                resolutionProposal : resolution2Pda,
                bondVault : bondVault2,
                bondMint : usdcMint,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            }).signers([admin]).rpc();

            const resolution = await resolutionProgram.account.resolutionProposal.fetch(resolution2Pda);

            expect(resolution.category).to.deep.equal({ sports: {} });
            console.log(" Sports resolution initialized");
        })

        it("Should Failsed To Initlize a Duplicate reolution",async()=>{

            console.log("Testing Duplicate Initialization");

            try{
                await resolutionProgram.methods.initializeResolution({crypto:{}}).accounts({
                    authority : admin.publicKey,
                    market : market1Pda,
                    // @ts-ignore
                    resolutionProposal : resolution1Pda,
                    bondVault : bondVault1,
                    bondMint : usdcMint,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                }).signers([admin]).rpc()
                expect.fail("Should have Thrown Error")
            }catch(e){
                expect(e.message).to.include("already in use");
                console.log("Correctly rejected duplicate");
            }
            
        })
    })

    // Done 
    describe("Crypto Oracle Proposal",()=>{
        before(async()=>{
            await marketProgram.methods.openMarket().accounts({
                admin : admin.publicKey,
                // @ts-ignore
                market : market1Pda,

            }).signers([admin]).rpc();

            await marketProgram.methods.resolvingMarket().accounts({
                admin : admin.publicKey,
                // @ts-ignore
                market : market1Pda
            }).signers([admin]).rpc();

            console.log("  ⏳ Waiting for market to expire (16 seconds)...");
            await new Promise(resolve => setTimeout(resolve, 16000));
        })

        it("Should Propose Crypto Outcome With Valid bond",async()=>{
            console.log("Oracle Proposing Outcome with 1000 USDC");
            
            const bondAmount = new anchor.BN(1000 * 1_000_000); // 1000 USDC
            const feedIds = [
              "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" // BTC/USD
            ];
            // const btcUsdPriceFeed = new PublicKey("HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J");
            const oracle1Before = await getTokenbalance(oracle1Usdc);
            const vaultBefore = await getTokenbalance(bondVault1);

            await resolutionProgram.methods.proposeCryptoOutcome(
                "BTC/USDC",
                { greaterOrEqual: { target: new anchor.BN(100_000) } },
                feedIds,
                bondAmount
            ).accounts({
                proposer : oracle1.publicKey,
                market : market1Pda,
                // marketRegistryProgram : marketProgram.programId,
                // @ts-ignore
                resolutionProposal : resolution1Pda,
                bondVault : bondVault1,
                proposerBondAccount : oracle1Usdc,
                tokenProgram : TOKEN_PROGRAM_ID
            }).signers([oracle1]).rpc();

            const oracle1After = await getTokenbalance(oracle1Usdc);
            const vaultAfter =await getTokenbalance(bondVault1);

            expect(oracle1Before - oracle1After).to.equal(1000 * 1_000_000);
            expect(vaultAfter - vaultBefore).to.equal(1000 * 1_000_000);

            const resolution = await resolutionProgram.account.resolutionProposal.fetch(resolution1Pda);
            expect(resolution.proposer.toString()).to.equal(oracle1.publicKey.toString());
            expect(resolution.bondAmount.toNumber()).to.equal(1000 * 1_000_000);
            expect(resolution.isDisputed).to.be.false;

            console.log("✅ Proposal submitted");
            console.log("   Proposer:", oracle1.publicKey.toString().slice(0, 8) + "...");
            console.log("   Bond locked: 1000 USDC");
            console.log("   Dispute window: 24 hours");
        })

        it("Should Failed With Insufficient Bond", async () => {
            console.log("Testing insufficient bond (500 USDC < 1000 minimum)");
            
            const marketId = new Uint8Array(32).fill(10);
        
            // FIX: Calculate fresh expiry time
            const freshExpiry = Math.floor(Date.now() / 1000) + 15;
            
            const result = await createMarket(
                marketId,
                "Test Fail For Insufficient Bond",
                freshExpiry  // Use fresh timestamp, not old shortExpiry
            );
        
            const [resolutionPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("resolution"), result.marketPda.toBuffer()],
                resolutionProgram.programId
            );
        
            const [bondVault] = PublicKey.findProgramAddressSync(
                [Buffer.from("bond_vault"), result.marketPda.toBuffer()],
                resolutionProgram.programId
            );
        
            await resolutionProgram.methods.initializeResolution({ crypto: {} }).accounts({
                authority: admin.publicKey,
                market: result.marketPda,
                // @ts-ignore
                resolutionProposal: resolutionPda,
                bondMint: usdcMint,
                bondVault,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            }).signers([admin]).rpc();
        
            await marketProgram.methods.openMarket().accounts({
                admin: admin.publicKey,
                // @ts-ignore
                market: result.marketPda
            }).signers([admin]).rpc();
            
            console.log("  ⏳ Waiting for market to expire (16 seconds)...");
            await new Promise(resolve => setTimeout(resolve, 16000)); // Wait 16 seconds
        

            await marketProgram.methods.resolvingMarket().accounts({
                admin: admin.publicKey,
                // @ts-ignore
                market: result.marketPda
            }).signers([admin]).rpc();
        
            try {
                await resolutionProgram.methods.proposeCryptoOutcome(
                    "BTC/USDC",
                    { greaterOrEqual: { target: new anchor.BN(100_000) } },
                    ["0xe62df..."],
                    new anchor.BN(500 * 1_000_000)  // Only 500 USDC (below minimum)
                ).accounts({
                    proposer: oracle1.publicKey,
                    market: result.marketPda,
                    // @ts-ignore
                    resolutionProposal: resolutionPda,
                    bondVault,
                    proposerBondAccount: oracle1Usdc,
                    tokenProgram: TOKEN_PROGRAM_ID
                }).signers([oracle1]).rpc();
                
                expect.fail("Should have thrown error");
            } catch (e) {
                expect(e.error.errorCode.code).to.equal("InsufficientBond");
                console.log("✓ Correctly rejected - bond too low");
            }
        });

        it("Failed To Propose Twice",async()=>{
            try{
                await resolutionProgram.methods.proposeCryptoOutcome(
                    "BTC/USDC",
                    { greaterOrEqual: { target: new anchor.BN(100_000) } },
                    ["fdaflsjkhflk"],
                    new anchor.BN(1000 * 1_000_000)
                ).accounts({
                    proposer : oracle2.publicKey,
                    market : market1Pda,
                    // @ts-ignore
                    resolutionProposal : resolution1Pda,
                    proposerBondAccount : oracle2Usdc,
                    bondVault : bondVault1,
                    tokenProgram  : TOKEN_PROGRAM_ID
                }).signers([oracle2]).rpc();

                expect.fail("It hosuld Fail")
            }catch(e){  
                expect(e.error.errorCode.code).to.equal("ProposalAlreadyExists");
                console.log(" Correctly rejected double proposal");
            }
        })
    })



    describe("Sports Oracle Proposal",()=>{
        let sportMarketPda: PublicKey;
        let sportResolutionPda: PublicKey;
        let sportBondVault: PublicKey;

    before(async () => {
        console.log("Creating fresh sports market...");
        
        // Create a NEW market with fresh expiry
        const marketId = new Uint8Array(32).fill(20); // Different ID
        const freshExpiry = Math.floor(Date.now() / 1000) + 20;
        
        const result = await createMarket(
            marketId,
            "Will India Win against NZ",
            freshExpiry
        );

        sportMarketPda = result.marketPda;

        // Initialize resolution for this new market
        [sportResolutionPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("resolution"), sportMarketPda.toBuffer()],
            resolutionProgram.programId
        );

        [sportBondVault] = PublicKey.findProgramAddressSync(
            [Buffer.from("bond_vault"), sportMarketPda.toBuffer()],
            resolutionProgram.programId
        );

        await resolutionProgram.methods.initializeResolution({ sports: {} }).accounts({
            authority: admin.publicKey,
            market: sportMarketPda,
            // @ts-ignore
            resolutionProposal: sportResolutionPda,
            bondVault: sportBondVault,
            bondMint: usdcMint,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        }).signers([admin]).rpc();

        // Open the market
        await marketProgram.methods.openMarket().accounts({
            admin: admin.publicKey,
            // @ts-ignore
            market: sportMarketPda
        }).signers([admin]).rpc();

        console.log("Waiting For Market To expire (21 Seconds)");
        await new Promise(resolve => setTimeout(resolve, 21000));

        // Move to resolving state
        await marketProgram.methods.resolvingMarket().accounts({
            admin: admin.publicKey,
            // @ts-ignore
            market: sportMarketPda
        }).signers([admin]).rpc();

        console.log("Sports market ready for resolution");
    });

        it("Should Propose Sports Outcome With multiple Data Source",async()=>{
            const sportsData = [{ 
                sourceType: { manual: {} },
                sourceName: "RapidAPI NBA",
                oracleAccount: null,
                result: "India",
                timestamp: new anchor.BN(Math.floor(Date.now() / 1000)),
            },{
                sourceType : {manual:{}},
                sourceName : "ESPN Info",
                oracleAccount : null ,
                result : "India",
                timestamp: new anchor.BN(Math.floor(Date.now() / 1000)),    
            }];

            await resolutionProgram.methods.proposeSportsOutcome(
                "India Vs New zealand",
                {winner:{}},
                sportsData,
                new anchor.BN(1000 * 1_000_000)
            ).accounts({
                proposer : oracle1.publicKey,
                market : sportMarketPda,
                // @ts-ignore
                resolutionalProposal : sportResolutionPda,
                bondVault : sportBondVault,
                proposerBondAccount : oracle1Usdc,
                tokenProgram : TOKEN_PROGRAM_ID
            }).signers([oracle1]).rpc();

            const resolution = await resolutionProgram.account.resolutionProposal.fetch(sportResolutionPda);
            expect(resolution.bondAmount.toNumber()).to.equal(1000 * 1_000_000);
      
            console.log(" Sports proposal submitted");
            console.log("   Event: India vs New Zealand");
            console.log("   Sources: 2 (RapidAPI, ESPN)");
            console.log("   Consensus: India wins");
        })

        it("Should Failed With disaggering Data Source",async()=>{

            const marketId = new Uint8Array(32).fill(31);
            const freshExpiry = Math.floor(Date.now() / 1000) + 15;
            const result = await createMarket(marketId,"Sports Market(Ind vd Nz)",freshExpiry);

            const [resolutionPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("resolution"), result.marketPda.toBuffer()],
                resolutionProgram.programId
            );
        
            const [bondVault] = PublicKey.findProgramAddressSync(
                [Buffer.from("bond_vault"), result.marketPda.toBuffer()],
                resolutionProgram.programId
            );

            await resolutionProgram.methods
            .initializeResolution({ sports: {} })
            .accounts({
              authority: admin.publicKey,
              market: result.marketPda,
              // @ts-ignore
              resolutionProposal: resolutionPda,
              bondVault,
              bondMint: usdcMint,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([admin])
            .rpc();

            await marketProgram.methods.openMarket().accounts({
                admin : admin.publicKey,
                // @ts-ignore
                market : result.marketPda
            }).signers([admin]).rpc();

            console.log("Waiting For Market To expire (16 Seconds)");
            await new Promise(resolve=>setTimeout(resolve,16000));
            
            await marketProgram.methods.resolvingMarket().accounts({
                admin : admin.publicKey,
                // @ts-ignore
                market : result.marketPda
            }).signers([admin]).rpc();

            const conflictingData = [
                {
                  sourceType: { manual: {} },
                  sourceName: "Source 1",
                  oracleAccount: null,
                  result: "TeamA",
                  timestamp: new anchor.BN(Math.floor(Date.now() / 1000)),
                },
                {
                  sourceType: { manual: {} },
                  sourceName: "Source 2",
                  oracleAccount: null,
                  result: "TeamB", // Different!
                  timestamp: new anchor.BN(Math.floor(Date.now() / 1000)),
                },
            ];

            try{
                await resolutionProgram.methods.proposeSportsOutcome(
                    "Test_Event",
                    { winner: {} },
                    conflictingData,
                    new anchor.BN(1000 * 1_000_000)
                ).accounts({
                    proposer : oracle1.publicKey,
                    market : result.marketPda,
                    // @ts-ignore
                    resolutionProposal: resolutionPda,
                    bondVault,
                    proposerBondAccount : oracle1Usdc,
                    tokenProgram : TOKEN_PROGRAM_ID
                }).signers([oracle1]).rpc();

                expect.fail("It should Fail")
            }catch(e){
                expect(e.error.errorCode.code).to.equal("DataSourceDisagreement");
                console.log(" Correctly rejected disagreeing sources");
            }
        })
    })

    describe("Dispute Mechanism",()=>{
        let disputeMarketPda : PublicKey;
        let disputeResolutionPda : PublicKey;
        let disputeBondVault : PublicKey;

        before(async()=>{
            // Create a new Market With Fresh Expire
            const marketId = new Uint8Array(32).fill(25);
            const freshExpiry = Math.floor(Date.now() / 1000) + 20;
            const result = await createMarket(marketId,"Who Will Win",freshExpiry);
            disputeMarketPda = result.marketPda;

            [disputeResolutionPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("resolution"), disputeMarketPda.toBuffer()],
                resolutionProgram.programId
              );
        
              [disputeBondVault] = PublicKey.findProgramAddressSync(
                [Buffer.from("bond_vault"), disputeMarketPda.toBuffer()],
                resolutionProgram.programId
              );
            
              await resolutionProgram.methods
              .initializeResolution({ crypto: {} })
              .accounts({
                authority: admin.publicKey,
                market: disputeMarketPda,
                // @ts-ignore
                resolutionProposal: disputeResolutionPda,
                bondVault: disputeBondVault,
                bondMint: usdcMint,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
              })
              .signers([admin])
              .rpc();
      
            await marketProgram.methods.openMarket()
              .accounts({ admin: admin.publicKey, 
                // @ts-ignore
                market: disputeMarketPda })
              .signers([admin])
              .rpc();
      
            await marketProgram.methods.resolvingMarket()
              .accounts({ admin: admin.publicKey, 
                // @ts-ignore
                market: disputeMarketPda })
              .signers([admin])
              .rpc();
      
            console.log("  ⏳ Waiting for expiry...");
            await new Promise(resolve => setTimeout(resolve, 21000));
            
            await resolutionProgram.methods
        .proposeCryptoOutcome(
          "BTC/USD",
          { greaterOrEqual: { target: new anchor.BN(100_000) } },
          ["0xe62df..."],
          new anchor.BN(1000 * 1_000_000)
        )
        .accounts({
          proposer: oracle1.publicKey,
          market: disputeMarketPda,
          // @ts-ignore
          resolutionProposal: disputeResolutionPda,
          bondVault: disputeBondVault,
          proposerBondAccount: oracle1Usdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([oracle1])
        .rpc();

      console.log("  Initial proposal made (YES)");
        })

        it("Should Allowed Valid Dispute",async()=>{
            const disputerBefore = await getTokenbalance(disputerUsdc);
            const vaultBefore = await getTokenbalance(disputeBondVault);

            await resolutionProgram.methods.disputeProposal(
                { no:{} },
                "Price did not reach $100k",
                new anchor.BN(1000 * 1_000_000)
            ).accounts({
                disputer : disputer.publicKey,
                // @ts-ignore
                resolutionProposal : disputeResolutionPda,
                bondVault : disputeBondVault,
                disputeBonderAccount : disputerUsdc,
                tokenProgram : TOKEN_PROGRAM_ID
            }).signers([disputer]).rpc();

            const disputerAfter = await getTokenbalance(disputerUsdc);
            const vaultAfter = await getTokenbalance(disputeBondVault);

            expect(disputerBefore - disputerAfter).to.equal(1000 * 1_000_000);
            expect(vaultAfter - vaultBefore).to.equal(1000 * 1_000_000);

            const resolution = await resolutionProgram.account.resolutionProposal.fetch(disputeResolutionPda);
            expect(resolution.isDisputed).to.be.true;
            expect(resolution.disputes.length).to.equal(1);

            console.log("✅ Dispute submitted");
            console.log("   Counter-outcome: NO");
            console.log("   Dispute bond: 1000 USDC");
            console.log("   Dispute window extended: +24 hours");
        })
        // Done
        it("Should Failed with Dispute Own Proposal",async()=>{
            // The oracle who owns resolution can not change his desision 

            console.log("Testing Self Disputed");
            
            try{
                await resolutionProgram.methods.disputeProposal(
                    {no:{}},
                    "changed My mind",
                    new anchor.BN(1000 * 1_000_000)
                ).accounts({
                    disputer : oracle1.publicKey,
                    // @ts-ignore
                    resolutionProposal: disputeResolutionPda,
                    bondVault : disputeBondVault,
                    disputeBonderAccount : oracle1Usdc,
                    tokenProgram : TOKEN_PROGRAM_ID
                }).signers([oracle1]).rpc();
                expect.fail("It will fail")
            }catch(e){
                expect(e.error.errorCode.code).to.equal("CannotDisputeOwnProposal");
                console.log("Own dispute is rejected sucessfully");
            }
        })

        it("Should fail with insufficient Dispute bond",async()=>{
            try{
                await resolutionProgram.methods.disputeProposal(
                    {no:{}},
                    "Fails With Insuffucient Bond amount",
                    new anchor.BN(500 * 1_000_000)
                ).accounts({
                    disputer : oracle2.publicKey,
                    // @ts-ignore
                    resolutionProposal : disputeResolutionPda,
                    bondVault : disputeBondVault,
                    disputeBonderAccount : oracle2Usdc,
                    tokenProgram : TOKEN_PROGRAM_ID
                }).signers([oracle2]).rpc();
                expect.fail("It should Fail Error");
            }catch(e){
                expect(e.error.errorCode.code).to.equal("InsufficientDisputeBond");
                console.log("Insufficient Bond is rejected correctly");
            }
        })
    })

    describe("Finalize Market",()=>{
        let protocolTreasury: PublicKey;  // Add this variable

    before(async () => {
        // Create protocol treasury USDC account (owned by admin)
        const treasuryAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            admin,
            usdcMint,
            admin.publicKey  // Treasury owned by admin
        );
        
        protocolTreasuryUsdc = treasuryAccount.address;

        // Fund the treasury with USDC for rewards
        // ORACLE_REWARD in your Rust code is the reward amount
        // Make sure treasury has enough USDC to pay rewards
        await mintTo(
            provider.connection,
            admin,
            usdcMint,
            protocolTreasuryUsdc,
            admin,
            100_000 * 1_000_000  // 100,000 USDC for rewards
        );

        console.log("Protocol Treasury:", protocolTreasuryUsdc.toString());
        console.log("Treasury funded with 100,000 USDC for rewards");
    });
        it("Should Finalize Indispute proposal",async()=>{
            console.log("Finlaizing Undisputed proposal");
            
            const oracle1Before = await getTokenbalance(oracle1Usdc);

            await resolutionProgram.methods.finalizeOutcome({yes:{}}).accounts({
                authority : market1ResolutionAdapter.publicKey,
                rewardAuthority : admin.publicKey,
                market : market1Pda,
                // @ts-ignore
                resolutionProposal : resolution1Pda,
                bondVault : bondVault1,
                winnerAccount : oracle1Usdc,
                protocolTreasury : protocolTreasuryUsdc,
                tokenProgram : TOKEN_PROGRAM_ID
            }).signers([market1ResolutionAdapter,admin]).rpc();
            const oracle1After = await getTokenbalance(oracle1Usdc);
            const expectedReturn = 1000 * 1_000_000 + 100 * 1_000_000;
            expect(oracle1After - oracle1Before).to.equal(expectedReturn);
            
            const resolution = await resolutionProgram.account.resolutionProposal.fetch(resolution1Pda);
            expect(resolution.isFinalized).to.be.true;
            
            const market = await marketProgram.account.market.fetch(market1Pda);
            expect(getMarketState(market.state)).to.equal("RESOLVED");
            expect(market.resolutionOutcome).to.deep.equal({ yes: {} });
            
            console.log("✅ Finalized successfully");
            console.log("   Oracle received: 1100 USDC (bond + reward)");
            console.log("   Market state: RESOLVED");
            console.log("   Outcome: YES");

        })

        it("Should Failed to finlaize Before Dispute Window",async()=>{
            //  Create a new Market , Resolution PDA , Bond Vault, Initialize a resolution with Crypto  
            const marketId = new Uint8Array(32).fill(26);
            const expire = Math.floor(Date.now() / 1000) + 15;
            const result = await createMarket(marketId,"Failed To Finalize",expire);
            
            const [resolutionPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("resolution"), result.marketPda.toBuffer()],
                resolutionProgram.programId
              );
        
              const [bondVault] = PublicKey.findProgramAddressSync(
                [Buffer.from("bond_vault"), result.marketPda.toBuffer()],
                resolutionProgram.programId
              );
        
              await resolutionProgram.methods
                .initializeResolution({ crypto: {} })
                .accounts({
                  authority: admin.publicKey,
                  
                  market: result.marketPda,
                  // @ts-ignore
                  resolutionProposal: resolutionPda,
                  bondVault,
                  bondMint: usdcMint,
                  systemProgram: SystemProgram.programId,
                  tokenProgram: TOKEN_PROGRAM_ID,
                  rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .signers([admin])
                .rpc();
        
              await marketProgram.methods.openMarket()
                .accounts({ 
                    admin: admin.publicKey, 
                    // @ts-ignore
                    market: result.marketPda 
                })
                .signers([admin])
                .rpc();
                
                console.log("Wait For 16 Second to Expire the market");
            
                await new Promise(r => setTimeout(r, 16000));
              await marketProgram.methods.resolvingMarket()
                .accounts({ 
                    admin: admin.publicKey,
                    //@ts-ignore 
                    market: result.marketPda
                 })
                .signers([admin])
                .rpc();
            //  Propose Crypto Outcome 

            await resolutionProgram.methods.proposeCryptoOutcome(
                "BTC/USD",
                { greaterOrEqual: { target: new anchor.BN(100_000) } },
                ["0xe62df..."],
                new anchor.BN(1000 * 1_000_000)
            ).accounts({
                proposer: oracle1.publicKey,
                market: result.marketPda,
                // @ts-ignore
                resolutionProposal: resolutionPda,
                bondVault,
                proposerBondAccount: oracle1Usdc,
                tokenProgram: TOKEN_PROGRAM_ID,
            }).signers([oracle1]).rpc();
           
            try{
                await resolutionProgram.methods.finalizeOutcome({yes:{}}).accounts({
                    authority : result.resolutionAdapter.publicKey,
                    rewardAuthority : admin.publicKey,
                    // @ts-ignore
                    resolutionProposal : resolutionPda,
                    market : result.marketPda,
                    bondVault : bondVault,
                    winnerAccount : oracle1Usdc,
                    protocolTreasury : protocolTreasuryUsdc,
                    tokenProgram : TOKEN_PROGRAM_ID

                }).signers([result.resolutionAdapter,admin]).rpc();
                expect.fail("It should Throw Error")
            }catch(e){
                expect(e.error.errorCode.code).to.equal("DisputeWindowOpen");
                console.log("Correctly reject the finalize before the dispute window");
                
            }
        })

        it("Should Fail To finalize Twice",async()=>{
            console.log("Faile to Finalize Twice");
            

          try{
            await resolutionProgram.methods.finalizeOutcome({yes:{}}).accounts({
                authority : market1ResolutionAdapter.publicKey,
                rewardAuthority : admin.publicKey,
                market: market1Pda,
                // @ts-ignore
                resolutionProposal : resolution1Pda,
                bondVault : bondVault1,
                winnerAccount : oracle1Usdc,
                protocolTreasury : protocolTreasuryUsdc,
                tokenProgram : TOKEN_PROGRAM_ID
            }).signers([admin,market1ResolutionAdapter]).rpc();

            expect.fail("It should be Fail")
          }catch(e){
            expect(e.error.errorCode.code).to.equal("AlreadyFinalized");
            console.log("Correctly rejected ");
            
          }
        })
    })

    // describe("Emergency Resolution",()=>{
    //     let emergencyMarketPda : PublicKey;
    //     let emergencyResolutionPda : PublicKey;
    //     let emergencyBondVault : PublicKey;
    //     let emergencyResolutionAdapter : Keypair;
    //     before(async()=>{
    //         const marketId = new Uint8Array(32).fill(40);
    //         const expire = Math.floor(Date.now() / 1000) + 15;
    //         const result = await createMarket(marketId, "Emergency test", expire);
    //         emergencyMarketPda = result.marketPda;
    //         emergencyResolutionAdapter = result.resolutionAdapter;

    //         [emergencyResolutionPda] = PublicKey.findProgramAddressSync(
    //           [Buffer.from("resolution"), emergencyMarketPda.toBuffer()],
    //           resolutionProgram.programId
    //         );
      
    //         [emergencyBondVault] = PublicKey.findProgramAddressSync(
    //           [Buffer.from("bond_vault"), emergencyMarketPda.toBuffer()],
    //           resolutionProgram.programId
    //         );

    //         await resolutionProgram.methods
    //         .initializeResolution({ crypto: {} })
    //         .accounts({
    //           authority: admin.publicKey,
    //           market: emergencyMarketPda,
    //           // @ts-ignore
    //           resolutionProposal: emergencyResolutionPda,
    //           bondVault: emergencyBondVault,
    //           bondMint: usdcMint,
    //           systemProgram: SystemProgram.programId,
    //           tokenProgram: TOKEN_PROGRAM_ID,
    //           rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    //         })
    //         .signers([admin])
    //         .rpc();

    //             await marketProgram.methods.openMarket()
    //         .accounts({ 
    //             admin: admin.publicKey,
    //             // @ts-ignore 
    //             market: emergencyMarketPda
    //          })
    //         .signers([admin])
    //         .rpc();
    //         console.log("Waiting for market to expire Emergency Resolution ");
    //         await new Promise(resolve => setTimeout(resolve, 16000));

    //         await marketProgram.methods.resolvingMarket()
    //           .accounts({
    //              admin: admin.publicKey,
    //             // @ts-ignore
    //              market: emergencyMarketPda 
    //             })
    //           .signers([admin])
    //           .rpc();

            
    //           await resolutionProgram.methods
    //           .proposeCryptoOutcome(
    //             "BTC/USD",
    //             { greaterOrEqual: { target: new anchor.BN(100_000) } },
    //             ["0xe62df..."],
    //             new anchor.BN(1000 * 1_000_000)
    //           )
    //           .accounts({
    //             proposer: oracle1.publicKey,
    //             market: emergencyMarketPda,
    //             // @ts-ignore
    //             resolutionProposal: emergencyResolutionPda,
    //             bondVault: emergencyBondVault,
    //             proposerBondAccount: oracle1Usdc,
    //             tokenProgram: TOKEN_PROGRAM_ID,
    //           })
    //           .signers([oracle1])
    //           .rpc();
    //     })

    //     it("Should allow Admin emergency resolution",async()=>{
    //         console.log("admin triger emergency Resolution");
            
    //         await resolutionProgram.methods.emergencyResolve(
    //             { invalid: {} },
    //             "Oracle failure - manual intervention required"
    //         ).accounts({
    //             admin : admin.publicKey,
    //             market : emergencyMarketPda,
    //             resolutionAdapter: emergencyResolutionAdapter.publicKey,
    //             // @ts-ignore
    //             resolutionProposal : emergencyResolutionPda,
    //             bondVault : emergencyBondVault,
    //             tokenProgram : TOKEN_PROGRAM_ID
    //         }).signers([admin,emergencyResolutionAdapter]).rpc();

    //         const resolution = await resolutionProgram.account.resolutionProposal.fetch(emergencyResolutionPda);

    //         expect(resolution.isDisputed).to.be.true;

    //         const market = await marketProgram.account.market.fetch(emergencyMarketPda);
    //         expect(getMarketState(market.state)).to.equal("RESOLVED");
    //         expect(market.resolutionOutcome).to.deep.equal({ invalid: {} });
                
    //         console.log("✅ Emergency resolution complete");
    //         console.log("   Forced outcome: INVALID");
    //         console.log("   Reason: Oracle failure");
    //     })
    // })

    // UPDATED TEST - Emergency Resolution with Option 2

// describe("Emergency Resolution", () => {
//     let emergencyMarketPda: PublicKey;
//     let emergencyResolutionPda: PublicKey;
//     let emergencyBondVault: PublicKey;

//     before(async () => {
//         const marketId = new Uint8Array(32).fill(40);
//         const expire = Math.floor(Date.now() / 1000) + 15;
//         const result = await createMarket(marketId, "Emergency test", expire);
//         emergencyMarketPda = result.marketPda;

//         [emergencyResolutionPda] = PublicKey.findProgramAddressSync(
//             [Buffer.from("resolution"), emergencyMarketPda.toBuffer()],
//             resolutionProgram.programId
//         );

//         [emergencyBondVault] = PublicKey.findProgramAddressSync(
//             [Buffer.from("bond_vault"), emergencyMarketPda.toBuffer()],
//             resolutionProgram.programId
//         );

//         await resolutionProgram.methods
//             .initializeResolution({ crypto: {} })
//             .accounts({
//                 authority: admin.publicKey,
//                 market: emergencyMarketPda,
//                 // @ts-ignore
//                 resolutionProposal: emergencyResolutionPda,
//                 bondVault: emergencyBondVault,
//                 bondMint: usdcMint,
//                 systemProgram: SystemProgram.programId,
//                 tokenProgram: TOKEN_PROGRAM_ID,
//                 rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//             })
//             .signers([admin])
//             .rpc();

//         await marketProgram.methods.openMarket()
//             .accounts({
//                 admin: admin.publicKey,
//                 // @ts-ignore 
//                 market: emergencyMarketPda
//             })
//             .signers([admin])
//             .rpc();

//         console.log("Waiting for market to expire (Emergency Resolution)...");
//         await new Promise(resolve => setTimeout(resolve, 16000));

//         await marketProgram.methods.resolvingMarket()
//             .accounts({
//                 admin: admin.publicKey,
//                 // @ts-ignore
//                 market: emergencyMarketPda
//             })
//             .signers([admin])
//             .rpc();

//         await resolutionProgram.methods
//             .proposeCryptoOutcome(
//                 "BTC/USD",
//                 { greaterOrEqual: { target: new anchor.BN(100_000) } },
//                 ["0xe62df..."],
//                 new anchor.BN(1000 * 1_000_000)
//             )
//             .accounts({
//                 proposer: oracle1.publicKey,
//                 market: emergencyMarketPda,
//                 // @ts-ignore
//                 resolutionProposal: emergencyResolutionPda,
//                 bondVault: emergencyBondVault,
//                 proposerBondAccount: oracle1Usdc,
//                 tokenProgram: TOKEN_PROGRAM_ID,
//             })
//             .signers([oracle1])
//             .rpc();

//         console.log("Emergency test market setup complete");
//     });

//     it("Should allow Admin emergency resolution", async () => {
//         console.log("Admin triggering emergency resolution");

//         // CHANGE: No need for resolutionAdapter signer anymore!
//         await resolutionProgram.methods
//             .emergencyResolve(
//                 { invalid: {} },
//                 "Oracle failure - manual intervention required"
//             )
//             .accounts({
//                 admin: admin.publicKey,
//                 market: emergencyMarketPda,
//                 marketRegistryProgram: marketProgram.programId,  // ADD THIS
//                 // @ts-ignore
//                 resolutionProposal: emergencyResolutionPda,
//                 bondVault: emergencyBondVault,
//                 tokenProgram: TOKEN_PROGRAM_ID
//             })
//             .signers([admin])  // ONLY admin signs now!
//             .rpc();

//         const resolution = await resolutionProgram.account.resolutionProposal.fetch(emergencyResolutionPda);

//         // Check resolution is finalized
//         expect(resolution.isFinalized).to.be.true;
//         expect(resolution.isEmergencyResolved).to.be.true;

//         const market = await marketProgram.account.market.fetch(emergencyMarketPda);
//         expect(getMarketState(market.state)).to.equal("RESOLVED");
//         expect(market.resolutionOutcome).to.deep.equal({ invalid: {} });

//         console.log("✅ Emergency resolution complete");
//         console.log("   Forced outcome: INVALID");
//         console.log("   Reason: Oracle failure");
//         console.log("   Market state: RESOLVED");
//     });

//     it("Should fail emergency resolution with invalid reason", async () => {
//         // Create another market for this test
//         const marketId = new Uint8Array(32).fill(41);
//         const expire = Math.floor(Date.now() / 1000) + 15;
//         const result = await createMarket(marketId, "Test invalid reason", expire);

//         const [resolutionPda] = PublicKey.findProgramAddressSync(
//             [Buffer.from("resolution"), result.marketPda.toBuffer()],
//             resolutionProgram.programId
//         );

//         const [bondVault] = PublicKey.findProgramAddressSync(
//             [Buffer.from("bond_vault"), result.marketPda.toBuffer()],
//             resolutionProgram.programId
//         );

//         await resolutionProgram.methods
//             .initializeResolution({ crypto: {} })
//             .accounts({
//                 authority: admin.publicKey,
//                 market: result.marketPda,
//                 // @ts-ignore
//                 resolutionProposal: resolutionPda,
//                 bondVault,
//                 bondMint: usdcMint,
//                 systemProgram: SystemProgram.programId,
//                 tokenProgram: TOKEN_PROGRAM_ID,
//                 rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//             })
//             .signers([admin])
//             .rpc();

//         try {
//             await resolutionProgram.methods
//                 .emergencyResolve(
//                     { invalid: {} },
//                     ""  // Empty reason - should fail
//                 )
//                 .accounts({
//                     admin: admin.publicKey,
//                     market: result.marketPda,
//                     marketRegistryProgram: marketProgram.programId,
//                     // @ts-ignore
//                     resolutionProposal: resolutionPda,
//                     bondVault,
//                     tokenProgram: TOKEN_PROGRAM_ID
//                 })
//                 .signers([admin])
//                 .rpc();

//             expect.fail("Should have thrown error");
//         } catch (e) {
//             expect(e.error.errorCode.code).to.equal("InvalidOutcome");
//             console.log("✓ Correctly rejected empty reason");
//         }
//     });

//     it("Should fail emergency resolution by non-admin", async () => {
//         // Create another market
//         const marketId = new Uint8Array(32).fill(42);
//         const expire = Math.floor(Date.now() / 1000) + 15;
//         const result = await createMarket(marketId, "Test unauthorized", expire);

//         const [resolutionPda] = PublicKey.findProgramAddressSync(
//             [Buffer.from("resolution"), result.marketPda.toBuffer()],
//             resolutionProgram.programId
//         );

//         const [bondVault] = PublicKey.findProgramAddressSync(
//             [Buffer.from("bond_vault"), result.marketPda.toBuffer()],
//             resolutionProgram.programId
//         );

//         await resolutionProgram.methods
//             .initializeResolution({ crypto: {} })
//             .accounts({
//                 authority: admin.publicKey,
//                 market: result.marketPda,
//                 // @ts-ignore
//                 resolutionProposal: resolutionPda,
//                 bondVault,
//                 bondMint: usdcMint,
//                 systemProgram: SystemProgram.programId,
//                 tokenProgram: TOKEN_PROGRAM_ID,
//                 rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//             })
//             .signers([admin])
//             .rpc();

//         try {
//             // Non-admin tries to emergency resolve
//             await resolutionProgram.methods
//                 .emergencyResolve(
//                     { invalid: {} },
//                     "Trying to hack the system"
//                 )
//                 .accounts({
//                     admin: oracle1.publicKey,  // Not the admin!
//                     market: result.marketPda,
//                     marketRegistryProgram: marketProgram.programId,
//                     // @ts-ignore
//                     resolutionProposal: resolutionPda,
//                     bondVault,
//                     tokenProgram: TOKEN_PROGRAM_ID
//                 })
//                 .signers([oracle1])  // Wrong signer
//                 .rpc();

//             expect.fail("Should have thrown error");
//         } catch (e) {
//             // Should fail with Unauthorized error from market_registry
//             expect(e.error.errorCode.code).to.equal("Unauthorized");
//             console.log("✓ Correctly rejected non-admin");
//         }
//     });
// });
    describe("Edge Cases",()=>{
        it("Should handle Maximum Data Sources",async()=>{
            console.log("\n Testing maximum data sources...");

            const marketId = new Uint8Array(32).fill(50);
            const expire = Math.floor(Date.now() / 1000) + 15;
            const result = await createMarket(marketId, "Max sources test", expire);
      
            const [resolutionPda] = PublicKey.findProgramAddressSync(
              [Buffer.from("resolution"), result.marketPda.toBuffer()],
              resolutionProgram.programId
            );
      
            const [bondVault] = PublicKey.findProgramAddressSync(
              [Buffer.from("bond_vault"), result.marketPda.toBuffer()],
              resolutionProgram.programId
            );
      
            await resolutionProgram.methods
              .initializeResolution({ sports: {} })
              .accounts({
                authority: admin.publicKey,
                market: result.marketPda,
                // @ts-ignore
                resolutionProposal: resolutionPda,
                bondVault,
                bondMint: usdcMint,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
              })
              .signers([admin])
              .rpc();
      
            await marketProgram.methods.openMarket()
              .accounts({ admin: admin.publicKey,
                // @ts-ignore
                market: result.marketPda })
              .signers([admin])
              .rpc();
              console.log("Wait For 16 Sec to resolve the market Edge Cases");
              
              console.log("Waiting for market to expire");
              
              await new Promise(resolve => setTimeout(resolve, 16000));
            
              await marketProgram.methods.resolvingMarket()
              .accounts({ admin: admin.publicKey,
                // @ts-ignore
                market: result.marketPda })
              .signers([admin])
              .rpc();
      
            
      
            const fiveSources = Array(5).fill(null).map((_, i) => ({
              sourceType: { manual: {} },
              sourceName: `Source ${i + 1}`,
              oracleAccount: null,
              result: "TeamA",
              timestamp: new anchor.BN(Math.floor(Date.now() / 1000)),
            }));

            // Proposse Sports Outcome 
            await resolutionProgram.methods.proposeSportsOutcome(
                "Test_Event",
                { winner: {} },
                fiveSources,
                new anchor.BN(1000 * 1_000_000)
            ).accounts({
                proposer: oracle1.publicKey,
                market: result.marketPda,
                // @ts-ignore
                resolutionProposal: resolutionPda,
                bondVault,
                proposerBondAccount: oracle1Usdc,
                tokenProgram: TOKEN_PROGRAM_ID,
            }).signers([oracle1]).rpc();

            const resolution = await resolutionProgram.account.resolutionProposal.fetch(resolutionPda);

            expect(resolution.dataSource.length).to.equal(5);
            console.log("5 Data is handle Sucessfully");
            
        })

        it("Should Failed with To Many Data Sources",async()=>{
            console.log("\n Testing maximum data sources...");

            const marketId = new Uint8Array(32).fill(51);
            const expire = Math.floor(Date.now() / 1000) + 15;
            const result = await createMarket(marketId, "Max sources test", expire);
      
            const [resolutionPda] = PublicKey.findProgramAddressSync(
              [Buffer.from("resolution"), result.marketPda.toBuffer()],
              resolutionProgram.programId
            );
      
            const [bondVault] = PublicKey.findProgramAddressSync(
              [Buffer.from("bond_vault"), result.marketPda.toBuffer()],
              resolutionProgram.programId
            );
      
            await resolutionProgram.methods
              .initializeResolution({ sports: {} })
              .accounts({
                authority: admin.publicKey,
                market: result.marketPda,
                // @ts-ignore
                resolutionProposal: resolutionPda,
                bondVault,
                bondMint: usdcMint,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
              })
              .signers([admin])
              .rpc();
      
            await marketProgram.methods.openMarket()
              .accounts({ admin: admin.publicKey,
                // @ts-ignore
                market: result.marketPda })
              .signers([admin])
              .rpc();
              console.log("Wait For 16 Sec to resolve the market Edge Cases With Data source length 6 ");
              
              
              await new Promise(resolve => setTimeout(resolve, 16000));
            
              await marketProgram.methods.resolvingMarket()
              .accounts({ admin: admin.publicKey,
                // @ts-ignore
                market: result.marketPda })
              .signers([admin])
              .rpc();
      
            
      
            const sixSources = Array(6).fill(null).map((_, i) => ({
              sourceType: { manual: {} },
              sourceName: `Source ${i + 1}`,
              oracleAccount: null,
              result: "TeamA",
              timestamp: new anchor.BN(Math.floor(Date.now() / 1000)),
            }));

            try{    
                await resolutionProgram.methods
                .proposeSportsOutcome(
                  "Test_Event",
                  { winner: {} },
                  sixSources,
                  new anchor.BN(1000 * 1_000_000)
                )
                .accounts({
                  proposer: oracle1.publicKey,
                  market: result.marketPda, 
                  // @ts-ignore
                  resolutionProposal: resolutionPda,
                  bondVault,
                  proposerBondAccount: oracle1Usdc,
                  tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([oracle1])
                .rpc();
      
              expect.fail("Should have thrown error");
            }catch(e){
                expect(e.error.errorCode.code).to.equal("TooManyDataSources");
                console.log("✅ Correctly rejected 6 sources");
            }
        })

        it("Should handle maximum 3 Disputes",async()=>{
            console.log("\n Testing maximum data sources...");

            const marketId = new Uint8Array(32).fill(95);
            const expire = Math.floor(Date.now() / 1000) + 15;
            const result = await createMarket(marketId, "Max sources test", expire);
      
            const [resolutionPda] = PublicKey.findProgramAddressSync(
              [Buffer.from("resolution"), result.marketPda.toBuffer()],
              resolutionProgram.programId
            );
      
            const [bondVault] = PublicKey.findProgramAddressSync(
              [Buffer.from("bond_vault"), result.marketPda.toBuffer()],
              resolutionProgram.programId
            );
      
            await resolutionProgram.methods
              .initializeResolution({ crypto: {} })
              .accounts({
                authority: admin.publicKey,
                market: result.marketPda,
                // @ts-ignore
                resolutionProposal: resolutionPda,
                bondVault,
                bondMint: usdcMint,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
              })
              .signers([admin])
              .rpc();
      
            await marketProgram.methods.openMarket()
              .accounts({ admin: admin.publicKey,
                // @ts-ignore
                market: result.marketPda })
              .signers([admin])
              .rpc();
              console.log("Wait For 16 Sec to resolve the market Edge Cases");
              
              console.log("Waiting for market to expire");
              
              await new Promise(resolve => setTimeout(resolve, 16000));
            
              await marketProgram.methods.resolvingMarket()
              .accounts({ admin: admin.publicKey,
                // @ts-ignore
                market: result.marketPda })
              .signers([admin])
              .rpc();
            

               // Initial proposal
            await resolutionProgram.methods
            .proposeCryptoOutcome(
              "BTC/USD",
              { greaterOrEqual: { target: new anchor.BN(100_000) } },
              ["0xe62df..."],
              new anchor.BN(1000 * 1_000_000)
            )
            .accounts({
              proposer: oracle1.publicKey,
              market: result.marketPda,
              // @ts-ignore
              resolutionProposal: resolutionPda,
              bondVault,
              proposerBondAccount: oracle1Usdc,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([oracle1])
            .rpc();

            // Dispute 1 = oracle 2
            
            await resolutionProgram.methods
        .disputeProposal(
          { no: {} },
          "Dispute 1",
          new anchor.BN(1000 * 1_000_000)
        )
        .accounts({
          disputer: oracle2.publicKey,
          
          // @ts-ignore
          resolutionProposal: resolutionPda,
          bondVault,
          disputeBonderAccount: oracle2Usdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([oracle2])
        .rpc();

              // Dispute 2
      await resolutionProgram.methods
      .disputeProposal(
        { invalid: {} },
        "Dispute 2",
        new anchor.BN(1000 * 1_000_000)
      )
      .accounts({
        disputer: oracle3.publicKey,
        // @ts-ignore
        resolutionProposal: resolutionPda,
        bondVault,
        disputeBonderAccount: oracle3Usdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([oracle3])
      .rpc();

    // Dispute 3
    await resolutionProgram.methods
      .disputeProposal(
        { yes: {} },
        "Dispute 3",
        new anchor.BN(1000 * 1_000_000)
      )
      .accounts({
        disputer: disputer.publicKey,
        // @ts-ignore
        resolutionProposal: resolutionPda,
        bondVault,
        disputeBonderAccount: disputerUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([disputer])
      .rpc();

        const resolution = await resolutionProgram.account.resolutionProposal.fetch(resolutionPda);
        expect(resolution.disputes.length).to.equal(3);

        console.log("✅ Accepted 3 disputes");
        })
    })

    describe("Query and Verification",()=>{
        it("Should fetch all resolution proposals", async () => {
            console.log("\n📋 Fetching all resolutions...");
      
            const allResolutions = await resolutionProgram.account.resolutionProposal.all();
      
            console.log(`\nTotal resolutions: ${allResolutions.length}`);
            allResolutions.slice(0, 5).forEach((res, i) => {
              console.log(`\nResolution ${i + 1}:`);
              console.log("  Address:", res.publicKey.toString());
              console.log("  Market:", res.account.market.toString());
              console.log("  Category:", res.account.category.crypto ? "Crypto" : "Sports");
              console.log("  Bond:", res.account.bondAmount.toNumber() / 1_000_000, "USDC");
              console.log("  Disputed:", res.account.isDisputed);
              console.log("  Finalized:", res.account.isFinalized);
            });
      
            expect(allResolutions.length).to.be.greaterThan(0);
        });

        it("Should verify final vault balances", async () => {
            console.log("\n💰 Verifying vault balances...");
      
            const vault1Balance = await getTokenbalance(bondVault1);
            const vault2Balance = await getTokenbalance(bondVault2);
      
            console.log(`\nBond Vault 1: ${vault1Balance / 1_000_000} USDC`);
            console.log(`Bond Vault 2: ${vault2Balance / 1_000_000} USDC`);
      
            // Vaults should have remaining bonds from disputed/unfinaliz markets
            expect(vault1Balance).to.be.greaterThanOrEqual(0);
            expect(vault2Balance).to.be.greaterThanOrEqual(0);
        });
    })
})