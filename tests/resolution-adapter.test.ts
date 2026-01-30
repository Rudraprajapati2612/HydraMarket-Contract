import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ResolutionAdapter } from "../target/types/resolution_adapter";
import { MarketRegistry } from "../target/types/market_registry";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getAccount, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
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
                expireAt : new anchor.BN(futureExpiry),
                resolutionSource:"Pyth BTC/USDC"
          };

        await marketProgram.methods.initializeMarket(params).accounts({
            admin : admin.publicKey,
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

    describe("Resolution Initilaization",()=>{
        it("It should Initialization Resolution for crypto market",async()=>{
            console.log("Initilaize crypto market Resolution ");
            
            const result = await createMarket(market1Id,"Will BTC will reach $100k?",shortExpiry);

            market1Pda = result.marketPda;
            market1YesMint = result.yesMint;
            market1NoMint = result.noMint;


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
                marketRegistryProgram : marketProgram.programId,
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
            expect(resolution.bondAmount).to.equal(1000 * 1_000_000);
            expect(resolution.isDisputed).to.be.false;

            console.log("✅ Proposal submitted");
            console.log("   Proposer:", oracle1.publicKey.toString().slice(0, 8) + "...");
            console.log("   Bond locked: 1000 USDC");
            console.log("   Dispute window: 24 hours");
        })
    })
})