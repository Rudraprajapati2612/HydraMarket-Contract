import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect, use } from "chai";
import { MarketRegistry     } from "../target/types/market_registry";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("Market Registery Complete Tests",()=>{
    const provider = anchor.AnchorProvider.env()
    anchor.setProvider(provider)

    const program  = anchor.workspace.MarketRegistry as Program<MarketRegistry>;

    // declare all the keywords and variable 
    
    let admin : Keypair;
    let nonAdmin : Keypair
    let user :Keypair;

    
    // market - 1  account 
    let market1Pda : PublicKey;
    let market1Id : Uint8Array;
    let market1YesMint : Keypair; //we need to create their mint account in test 
    let market1NoMint : Keypair;
    let market1EscrowVault : PublicKey; //hodl usdc for market1 
    let market1ResolutionAdapter : PublicKey; // oracle feed 


    // market - 2  account 
    let market2Pda : PublicKey;
    let market2Id : Uint8Array;
    let market2YesMint : Keypair; //we need to create their mint account in test 
    let market2NoMint : Keypair;
    let market2EscrowVault : PublicKey;
    let market2ResolutionAdapter : PublicKey;


      // Mock escrow program (for testing - would be real in production)
    let mockEscrowProgram: PublicKey;

    // Time constants
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const futureExpiry = nowTimestamp + 30 * 24 * 60 * 60; // 30 days
    const pastExpiry = nowTimestamp - 10; // Already expired


    // Some of the helper function 

    async function airdrop(pubkey :PublicKey,number =10){
        const sig = await provider.connection.requestAirdrop(
            pubkey,
            number * LAMPORTS_PER_SOL
        )
        const latestBlockHash = await provider.connection.getLatestBlockhash();

        await provider.connection.confirmTransaction({
            signature : sig,
            blockhash : latestBlockHash.blockhash,
            lastValidBlockHeight : latestBlockHash.lastValidBlockHeight
        })
    }

    function getMarketState(state:any){
        if(state.created) return "CREATED";
        if(state.open) return "OPEN";
        if(state.paused) return "PAUSED";
        if(state.resolving) return "RESOLVING";
        if(state.resolved) return "RESOLVED";
        return "UNKNOWN"
    }


    // lets setup befor creating new market 

    before(async ()=>{
        console.log("Setting Up the Market");
        
        admin = Keypair.generate();
        nonAdmin = Keypair.generate();
        user = Keypair.generate();
        
        // airdrop solana to all the users 

        await Promise.all([
            airdrop(admin.publicKey),
            airdrop(nonAdmin.publicKey),
            airdrop(user.publicKey)
        ])

        mockEscrowProgram  = Keypair.generate().publicKey;

        market1Id = new Uint8Array(32).fill(1);
        market2Id = new Uint8Array(32).fill(2);
        console.log("📋 Account Setup:");
        console.log("  Admin:", admin.publicKey.toString());
        console.log("  Non-Admin:", nonAdmin.publicKey.toString());
        console.log("  User:", user.publicKey.toString());
        console.log("  Mock Escrow Program:", mockEscrowProgram.toString());
        console.log("\n✅ Setup complete!\n");
    })




    // Market Initialization Tests
    describe("Market Initialize",()=>{
        it("Should Successfully initialize a new market",async ()=>{
            console.log("Initialize new Market");
            
            market1YesMint = Keypair.generate();
            market1NoMint = Keypair.generate();
                // market account Is a pda 
                // market accoutn is derived from the Seed = Market + Market ID + Program ID
            [market1Pda] = PublicKey.findProgramAddressSync(
                [Buffer.from("market"), Buffer.from(market1Id)],
                program.programId
            );

            [market1EscrowVault] = PublicKey.findProgramAddressSync(
                [Buffer.from("escrow_vault"), market1Pda.toBuffer()],
                mockEscrowProgram
            );

            market1ResolutionAdapter = Keypair.generate().publicKey;

            const question  = "Will BTC reach $100k by the end of janurary 2026";
            const description = "Market will resolve yes if Bitcoin will resovle yes"
            const category = "Crypto";
            const resolutionSource = "Pyth BTC/USD"

            const params = {
                marketId : Array.from(market1Id),
                question,
                description,
                category,
                expireAt : new anchor.BN(futureExpiry),
                resolutionSource
            }

            await program.methods.initializeMarket(params).accounts({

                admin : admin.publicKey,
                market : market1Pda,
                yesTokenMint : market1YesMint.publicKey,
                noTokenMint : market1NoMint.publicKey,
                escrowVault : market1EscrowVault,
                escrowProgram : mockEscrowProgram,
                resolutionAdapter : market1ResolutionAdapter,
                systemProgram : SystemProgram.programId,
                tokenProgram : TOKEN_PROGRAM_ID,
                rent : anchor.web3.SYSVAR_RENT_PUBKEY
            }).signers([admin,market1YesMint,market1NoMint]).rpc()

            // fetch the market 

            const market = await program.account.market.fetch(market1Pda);

            expect(market.marketId).to.deep.equal(Array.from(market1Id));
            expect(market.question).to.equal(question);
            expect(market.description).to.equal(description);
            expect(market.category).to.equal(category);
            expect(market.creator.toString()).to.equal(admin.publicKey.toString());
            expect(market.expireAt.toNumber()).to.equal(futureExpiry);
            expect(market.yesTokenMint.toString()).to.equal(market1YesMint.publicKey.toString());
            expect(market.noTokenMint.toString()).to.equal(market1NoMint.publicKey.toString());
            expect(market.escrowVault.toString()).to.equal(market1EscrowVault.toString());
            expect(market.resolutionAdapter.toString()).to.equal(market1ResolutionAdapter.toString());
            expect(market.resolutionSource).to.equal(resolutionSource);
            expect(getMarketState(market.state)).to.equal("CREATED");
            expect(market.resolutionOutcome).to.be.null;
            expect(market.resolvedAt).to.be.null;

            console.log("✅ Market 1 initialized successfully");
            console.log("   State:", getMarketState(market.state));
            console.log("   Market PDA:", market1Pda.toString());
        })
    })



})