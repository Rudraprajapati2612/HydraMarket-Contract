import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import { MarketRegistry } from "../target/types/market_registry";
import { EscrowVault } from "../target/types/escrow_vault";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { program } from "@coral-xyz/anchor/dist/cjs/native/system";
import { TOKEN_PROGRAM_ID, createAccount, createMint, getAccount, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { expect } from "chai";

describe("Hydra Market Full Integration Test",()=>{
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const marketProgram  = anchor.workspace.MarketRegistry as Program<MarketRegistry>;
    const escrowProgram = anchor.workspace.EscrowVault as Program<EscrowVault>;

    // Keypairs 

    let admin : Keypair;
    let settlementWorker : Keypair;
    let alice : Keypair;
    let bob : Keypair;
    let charlie : Keypair;
    let resolutionAdapter : Keypair
    // Market Account 
    let marketPda : PublicKey;
    let yesTokenMint : Keypair;
    let noTokenMint : Keypair;
    let escrowVaultPda : PublicKey;
    
    
    let usdcMint : PublicKey;
    let hotWalletUsdc : PublicKey;
    let aliceUsdc : PublicKey;
    let bobUsdc : PublicKey;
    let charlieUsdc:PublicKey;

    // Token accounts for YES/NO
    let aliceYes: PublicKey;
    let aliceNo: PublicKey;
    let bobYes: PublicKey;
    let bobNo: PublicKey;
    let charlieYes: PublicKey;
    let charlieNo: PublicKey;

    // Market Parameters

    const marketId = new Uint8Array(32).fill(1);
    const question = "Will BTC reach $100k by the end of Feb 2026"
    const description = "Market resolves to YES if Bitcoin reaches $100,000 by January 31, 2026";
    const category = "Crypto";
    const resolutionSource = "Pyth Network BTC/USDC";
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const expireAt = new anchor.BN(nowTimestamp + 30 * 24 * 60 * 60);

    async function airdrop(pubkey:PublicKey,amount: number=10){
        const sig = await provider.connection.requestAirdrop(
            pubkey,
            amount * LAMPORTS_PER_SOL
        );

        const lastBlockhash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
            signature:sig,
            blockhash : lastBlockhash.blockhash,
            lastValidBlockHeight : lastBlockhash.lastValidBlockHeight
        });
    }

    // Get Token Balance 
    async function getTokenbalance(tokenAccount:PublicKey):Promise<number>{
        const account = await getAccount(provider.connection,tokenAccount);
        return Number(account.amount);
    }

    // Log Balance For debuging 

    async function logBalances(user:String,usdcAccount:PublicKey,yesAccount?:PublicKey,noAccount?:PublicKey){
        const usdcBalance = await getTokenbalance(usdcAccount);
        console.log(`\n${user} Balances:`);
        console.log(`  USDC: ${usdcBalance / 1_000_000}`);

        if(yesAccount){
            const yesBalance = await getTokenbalance(yesAccount);
            console.log(`  YES:  ${yesBalance}`);
        }
        if(noAccount){
            const noBalance = await getTokenbalance(noAccount);
            console.log(`  NO:  ${noBalance}`);
        }
    }

    // Get market State 
    function getMarketState(state: any): string {
        if (state.created) return "CREATED";
        if (state.open) return "OPEN";
        if (state.paused) return "PAUSED";
        if (state.resolving) return "RESOLVING";
        if (state.resolved) return "RESOLVED";
        return "UNKNOWN";
      }
    

      before(async ()=>{
        console.log("\n Setting up test environment...\n");

        admin = Keypair.generate();
        settlementWorker = Keypair.generate();
        alice = Keypair.generate();
        bob = Keypair.generate();
        charlie = Keypair.generate();
        resolutionAdapter = Keypair.generate();

        console.log("💰 Airdropping SOL...");
        await Promise.all([
          airdrop(admin.publicKey),
          airdrop(settlementWorker.publicKey),
          airdrop(alice.publicKey),
          airdrop(bob.publicKey),
          airdrop(charlie.publicKey),
        ]);
        
        // Create a Usdc Mint account 

        usdcMint = await createMint(
            provider.connection,
            admin, //payer
            admin.publicKey, // Mint Authority  
            null, //freeze Authority 
            6   //decimal 
        );

        // Creata a Hot Wallet For USDC Account 

        const hotWalletAccount  = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            admin, // who is a payer for it 
            usdcMint, // which type of token will present in this 
            settlementWorker.publicKey // Who is the owner of it 
        )
        hotWalletUsdc = hotWalletAccount.address;
        // Create A user Usdc Account 
        
        const aliceUsdcAccount = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            admin,
            usdcMint,
            alice.publicKey
        );
        aliceUsdc = aliceUsdcAccount.address; 


        const bobUsdcAccount  = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            admin,
            usdcMint,
            bob.publicKey
        );
        bobUsdc = bobUsdcAccount.address; 


        const charlieUsdcAccount  = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            admin,
            usdcMint,
            charlie.publicKey
        );
        charlieUsdc = charlieUsdcAccount .address; 

        // Mint some Usdc to User 
        await Promise.all([ //provider,payer,mint,destination,authority,amount
            mintTo(provider.connection, admin, usdcMint, aliceUsdc, admin, 10_000 * 1_000_000),
            mintTo(provider.connection, admin, usdcMint, bobUsdc, admin, 10_000 * 1_000_000),
            mintTo(provider.connection, admin, usdcMint, charlieUsdc, admin, 10_000 * 1_000_000),
            mintTo(provider.connection, admin, usdcMint, hotWalletUsdc, admin, 1_000_000 * 1_000_000)
        ]);

        // Generate Token Mint 
        yesTokenMint = Keypair.generate();
        noTokenMint = Keypair.generate();
        resolutionAdapter = Keypair.generate();

        // Generate market Pda 
        [marketPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("market"),Buffer.from(marketId)],
            marketProgram.programId
        );

        [escrowVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow_vault"),marketPda.toBuffer()],
            escrowProgram.programId
        );

        console.log("\n Account Addresses:");
        console.log("  Admin:", admin.publicKey.toString());
        console.log("  Settlement Worker:", settlementWorker.publicKey.toString());
        console.log("  Alice:", alice.publicKey.toString());
        console.log("  Bob:", bob.publicKey.toString());
        console.log("  Charlie:", charlie.publicKey.toString());
        console.log("\n  USDC Mint:", usdcMint.toString());
        console.log("  Hot Wallet USDC:", hotWalletUsdc.toString());
        console.log("\n  Market PDA:", marketPda.toString());
        console.log("  Escrow Vault PDA:", escrowVaultPda.toString());
        console.log("  YES Mint:", yesTokenMint.publicKey.toString());
        console.log("  NO Mint:", noTokenMint.publicKey.toString());
        console.log("\n Setup complete!\n");
    })


    describe("Market Creation",()=>{
        it("Should initialize a new market",async()=>{
            const params = {
                marketId : Array.from(marketId),
                question,
                description,
                category,
                expireAt,
                resolutionSource
            };

            await marketProgram.methods.initializeMarket(params).accounts({
                admin : admin.publicKey,
                // @ts-ignore
                market : marketPda,
                yesTokenMint : yesTokenMint.publicKey,
                noTokenMint : noTokenMint.publicKey,
                escrowVault : escrowVaultPda,
                escrowProgram : escrowProgram.programId,
                resolutionAdapter : resolutionAdapter.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            }).signers([admin,yesTokenMint,noTokenMint]).rpc();

            const market = await marketProgram.account.market.fetch(marketPda);
            expect(market.question).to.equal(question);
            expect(market.description).to.equal(description);
            expect(market.category).to.equal(category);
            expect(market.creator.toString()).to.equal(admin.publicKey.toString());
            expect(market.expireAt.toNumber()).to.equal(expireAt.toNumber());
            expect(market.yesTokenMint.toString()).to.equal(yesTokenMint.publicKey.toString());
            expect(market.noTokenMint.toString()).to.equal(noTokenMint.publicKey.toString());
            expect(market.escrowVault.toString()).to.equal(escrowVaultPda.toString());
            expect(market.resolutionSource).to.equal(resolutionSource);
            expect(getMarketState(market.state)).to.equal("CREATED");
            expect(market.resolutionOutcome).to.be.null;
            expect(market.resolvedAt).to.be.null;
      
            console.log(" Market initialized successfully");
            console.log("   State:", getMarketState(market.state));
        })

        it("Should Initialize new Escrow Vault",async()=>{
            console.log("\n Initializing escrow vault...");
            // Vault USDC 
            const usdcVaultPda = await anchor.utils.token.associatedAddress({
                mint: usdcMint,
                owner: escrowVaultPda,  // The VAULT PDA is the owner
            })

            await escrowProgram.methods.initializeVault().accounts({
                admin : admin.publicKey,
                market : marketPda,
                // @ts-ignore
                vault : escrowVaultPda,
                marketRegisteryProgram :marketProgram.programId,
                yesTokenMint : yesTokenMint.publicKey,
                noTokenMint : noTokenMint.publicKey,
                usdcVault : usdcVaultPda,
                usdcMint,
                systemProgram : SystemProgram.programId,
                tokenProgram : TOKEN_PROGRAM_ID,
                associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID
            }).signers([admin]).rpc()

            const vault = await escrowProgram.account.escrowVault.fetch(escrowVaultPda);

            expect(vault.market.toString()).to.equal(marketPda.toString());
            expect(vault.yesTokenMint.toString()).to.equal(yesTokenMint.publicKey.toString());
            expect(vault.noTokenMint.toString()).to.equal(noTokenMint.publicKey.toString());
            expect(vault.usdcVault.toString()).to.equal(usdcVaultPda.toString());
            expect(vault.totalLockedCollateral.toNumber()).to.equal(0);
            expect(vault.totalYesMinted.toNumber()).to.equal(0);
            expect(vault.totalNoMinted.toNumber()).to.equal(0);
            expect(vault.isSettled).to.be.false;
            expect(vault.isMintingPaused).to.be.false;

            console.log("✅ Escrow vault initialized successfully");
            console.log("   YES/NO minted: 0/0");
            console.log("   Collateral locked: 0 USDC");
        })

        it("Should Open the market for trading",async()=>{
            console.log("Opening Market");
            
            await marketProgram.methods.openMarket().accounts({
                admin : admin.publicKey,
                // @ts-ignore
                market : marketPda
            }).signers([admin]).rpc();

            const market = await marketProgram.account.market.fetch(marketPda);
            expect(getMarketState(market.state)).to.equal("OPEN");
      
            console.log(" Market opened successfully");
            console.log("   State:", getMarketState(market.state));
        })
        
    })


    describe("Token Minting and Trading",()=>{
        before(async()=>{
            console.log("Creating Token Account For User");
            

            const aliceYesAccount = await getOrCreateAssociatedTokenAccount(
                provider.connection,
                alice,
                yesTokenMint.publicKey,
                alice.publicKey,

            );
            aliceYes = aliceYesAccount.address;

            const aliceNoAccount = await getOrCreateAssociatedTokenAccount(
                provider.connection,
                alice,
                noTokenMint.publicKey,
                alice.publicKey,

            );
            aliceNo = aliceNoAccount.address;


            const bobYesAccount = await getOrCreateAssociatedTokenAccount(
                provider.connection,
                bob,
                yesTokenMint.publicKey,
                bob.publicKey
              );
              bobYes = bobYesAccount.address;
        
              const bobNoAccount = await getOrCreateAssociatedTokenAccount(
                provider.connection,
                bob,
                noTokenMint.publicKey,
                bob.publicKey
              );
              bobNo = bobNoAccount.address;
        
              const charlieYesAccount = await getOrCreateAssociatedTokenAccount(
                provider.connection,
                charlie,
                yesTokenMint.publicKey,
                charlie.publicKey
              );
              charlieYes = charlieYesAccount.address;
        
              const charlieNoAccount = await getOrCreateAssociatedTokenAccount(
                provider.connection,
                charlie,
                noTokenMint.publicKey,
                charlie.publicKey
              );
              charlieNo = charlieNoAccount.address;
        
              console.log("Token Account Created");
              
              
        })

        it("Should mint complementary pairs (Alice buys YES bob buys NO)",async()=>{
            const pairs = new anchor.BN(100);

            const usdcVaultPda = getAssociatedTokenAddressSync(
                usdcMint,           // mint
                escrowVaultPda,     // owner (the vault PDA)
                true                // allowOwnerOffCurve (required for PDAs)
            );
                
            // Get Vault balance before 

            const vaultBefore = await getAccount(provider.connection,usdcVaultPda);
            const vaultBalanceBefore = Number(vaultBefore.amount);

            await escrowProgram.methods.mintPairs(pairs).accounts({
                authority : settlementWorker.publicKey,
                // @ts-ignore
                vault : escrowVaultPda,
                market:marketPda,
                marketRegisteryProgram : marketProgram.programId,
                usdcVault : usdcVaultPda,
                usdcMint,
                hotWalletUsdc,
                yesTokenMint : yesTokenMint.publicKey,
                noTokenMint : noTokenMint.publicKey,
                yesRecipient : aliceYes,
                noRecipient : bobNo,
                tokenProgram : TOKEN_PROGRAM_ID
            }).signers([settlementWorker]).rpc();


            const aliceYesBalance = await getTokenbalance(aliceYes);
            const bobNoBalance = await getTokenbalance(bobNo);
            const vaultAfter = await getAccount(provider.connection, usdcVaultPda);
            const vaultBalanceAfter = Number(vaultAfter.amount);

            expect(aliceYesBalance).to.equal(100);
            expect(bobNoBalance).to.equal(100);
            expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(100 * 1_000_000);
            
            const vault = await escrowProgram.account.escrowVault.fetch(escrowVaultPda);
            expect(vault.totalYesMinted.toNumber()).to.equal(100);
            expect(vault.totalNoMinted.toNumber()).to.equal(100);
            expect(vault.totalLockedCollateral.toNumber()).to.equal(100 * 1_000_000);
      
            console.log("✅ Pairs minted successfully");
            await logBalances("Alice", aliceUsdc, aliceYes, aliceNo);
            await logBalances("Bob", bobUsdc, bobYes, bobNo);
            console.log("\nVault State:");
            console.log(`  YES minted: ${vault.totalYesMinted.toNumber()}`);
            console.log(`  NO minted: ${vault.totalNoMinted.toNumber()}`);
            console.log(`  Collateral: ${vault.totalLockedCollateral.toNumber() / 1_000_000} USDC`);
        })
    })
})