import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, PublicKeyInitData, SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";
import { MarketRegistry } from "../target/types/market_registry";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
describe("Market Registery Contract",()=>{
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.MarketRegistry as Program<MarketRegistry>;
    let admin : Keypair;
    let marketAccount : PublicKey;
    let yesTokenMint : Keypair;
    let noMintToken : Keypair;
    let escrowVault : PublicKey;
    let escrowProgram  : PublicKey;
    let resolutionAdapter : PublicKey

    // Market question 
    const marketId = new Uint8Array(32).fill(1); 
    const question = "Will BTC price reach $100k by end of janurary" //what to do if from admin question has some mistake ? 
    const description = "This markete will resolve to Yes if Bitcoin $100k by the end of janurary"
    const category = "Crypto";
    const resolutionSource = "Pyth Network"

    // Time 
    const nowTimestamp = Math.floor(Date.now()/1000);
    const expiredAt = nowTimestamp + (30 * 24 * 60 * 60);


    before(async()=>{
        //  airdrop solana to the admin 
        admin = Keypair.generate();

        const reqAirdropSig = await provider.connection.requestAirdrop(
            admin.publicKey,
            10*LAMPORTS_PER_SOL
        )

        // confirm transaction 

        const latestblockHash = await provider.connection.getLatestBlockhash();

        await provider.connection.confirmTransaction({
            signature : reqAirdropSig,
            blockhash : latestblockHash.blockhash,
            lastValidBlockHeight : latestblockHash.lastValidBlockHeight
        })

        yesTokenMint = Keypair.generate();
        noMintToken = Keypair.generate();

        escrowProgram = Keypair.generate().publicKey;
        resolutionAdapter = Keypair.generate().publicKey;

        console.log("Admin",admin.publicKey.toString());
        console.log("Yes Token Mint", yesTokenMint.publicKey.toString());
        console.log("No token Mint", noMintToken.publicKey.toString());
        
    })

    describe("Initialize Market",()=>{
        it("Should sucessfully initialize a new market",async ()=>{
            const [marketPda,marketBump] = PublicKey.findProgramAddressSync(
                [Buffer.from("market"), Buffer.from(marketId)],
                program.programId
            )
            marketAccount = marketPda

            const [escrowVaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("escrow_vault"), marketPda.toBuffer()],
                // change this to escrow program After depoloying time 
                program.programId
            )

            escrowVault = escrowVaultPda
            console.log("Market PDA:", marketAccount.toString());
            console.log("Escrow Vault PDA:", escrowVault.toString());

            const params = {
                marketId : Array.from(marketId),
                question,
                description,
                category,
                expireAt : new anchor.BN(expiredAt),
                resolutionSource
            }


            const tx = await program.methods.initializeMarket(params).accounts({
                admin : admin.publicKey,
                // @ts-ignore
                market : marketAccount,
                yesTokenMint : yesTokenMint.publicKey,
                noTokenMint : noMintToken.publicKey,
                escrowVault : escrowVault,
                escrowProgram:escrowProgram,
                resolutionAdapter : resolutionAdapter,
                systemProgram : SystemProgram.programId,
                tokenProgram : TOKEN_PROGRAM_ID,
                rent : SYSVAR_RENT_PUBKEY 
            }).signers([admin,yesTokenMint,noMintToken]).rpc()


            const marketData = await program.account.market.fetch(marketAccount);
            expect(marketData.question).to.equal(question);
            expect(marketData.description).to.equal(description);
            expect(marketData.category).to.equal(category);
            expect(marketData.creator.toString()).to.equal(admin.publicKey.toString());
            expect(marketData.expireAt.toNumber()).to.equal(expiredAt);
            expect(marketData.yesTokenMint.toString()).to.equal(yesTokenMint.publicKey.toString());
            expect(marketData.noTokenMint.toString()).to.equal(noMintToken.publicKey.toString());
            expect(marketData.escrowVault.toString()).to.equal(escrowVault.toString());
            expect(marketData.resolutionAdapter.toString()).to.equal(resolutionAdapter.toString());
            expect(marketData.resolutionSource).to.equal(resolutionSource);
            
            // Check initial state
            expect(marketData.state).to.deep.equal({ created: {} });
            expect(marketData.resolutionOutcome).to.be.null;
             expect(marketData.resolvedAt).to.be.null;

            console.log("✅ Market initialized successfully!");
            console.log("Market State:", marketData.state);
        })

    })

})