import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EscrowVault } from "../target/types/escrow_vault";
import { MarketRegistry } from "../target/types/market_registry";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID,  createMint, getAccount, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { expect } from "chai";



describe("escrow Vault Tests",()=>{
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // const escrowProgram = anchor.workspace.EscrowVault as Program<EscrowVault>;
    // const marketProgram  = anchor.workspace.MarketRegistry as Program<MarketRegistry>;
    let escrowProgram: Program<EscrowVault>;
    let marketProgram: Program<MarketRegistry>;
    let admin : Keypair;
    let settlementWorker  : Keypair;
    let alice : Keypair;
    let bob :Keypair;
    let charli : Keypair;
    let nonAuthorized : Keypair ;
    // market 1 (Yes Outcome)
    let market1Pda : PublicKey;
    let market1Id : Uint8Array;
    let vault1Pda : PublicKey;
    let vault1UsdcPda : PublicKey;
    let yes1Mint : Keypair;
    let no1Mint : Keypair;
    // Market 2 No outcome 
    let market2Pda : PublicKey;
    let market2Id : Uint8Array;
    let vault2Pda : PublicKey;
    let vault2UsdcPda : PublicKey;
    let yes2Mint : Keypair;
    let no2Mint : Keypair;
    // market 3 Invalid Outcome 
    let market3Pda : PublicKey;
    let market3Id : Uint8Array;
    let vault3Pda : PublicKey;
    let vault3UsdcPda : PublicKey;
    let yes3Mint : Keypair;
    let no3Mint : Keypair;

    // USDC account 
    let usdcMint : PublicKey;
    let hotWalletUsdc : PublicKey;
    let aliceUsdc : PublicKey;
    let bobUsdc : PublicKey;
    let charliUsdc : PublicKey;

    // Token Account 

    let aliceYes1 : PublicKey;
    let aliceNo1 : PublicKey;
    let bobYes1 : PublicKey;
    let bobNo1 : PublicKey;
    let charliYes1 : PublicKey;
    let charliNo1 : PublicKey;


    let aliceYes2 : PublicKey;
    let aliceNo2 : PublicKey;
    let bobYes2 : PublicKey;
    let bobNo2 : PublicKey;
    let charliYes2 : PublicKey;
    let charliNo2 : PublicKey;



    let aliceYes3 : PublicKey;
    let aliceNo3 : PublicKey;
    let bobYes3 : PublicKey;
    let bobNo3 : PublicKey;
    let charliYes3 : PublicKey;
    let charliNo3 : PublicKey;

    const nowTimestamp =  Math.floor(Date.now()/1000);
    const futureExpiry = nowTimestamp + 30*24*60*60;


    // Helper Function 

    async function airdrop(pubkey : PublicKey,amount : number=10){
        const sig = await provider.connection.requestAirdrop(
            pubkey,
            amount * LAMPORTS_PER_SOL
        )

        const latestBlockHash = await provider.connection.getLatestBlockhash();

        await provider.connection.confirmTransaction({
            signature : sig ,
            blockhash : latestBlockHash.blockhash,
            lastValidBlockHeight : latestBlockHash.lastValidBlockHeight 
        })
    }

    async function getTokenbalance(tokenAccount:PublicKey):Promise<number>{
        const account = await getAccount(provider.connection, tokenAccount)
        return Number(account.amount)
    }

    async function createMarket(marketId : Uint8Array,question:string){
        const yesMint = Keypair.generate();
        const noMint = Keypair.generate();

        const [marketPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("market"),Buffer.from(marketId)],
            marketProgram.programId
        );

        const [escrowVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow_vault"),marketPda.toBuffer()],
            escrowProgram.programId
        );

        const param = {
            marketId : Array.from(marketId),
            question,
            description : `Test ${question}`,
            category : "Test",
            expireAt : new anchor.BN(futureExpiry),
            resolutionSource : "Test" 
        }

        await marketProgram.methods.initializeMarket(param).accounts({
            admin: admin.publicKey,
            // @ts-ignore
            market : marketPda,
            yesTokenMint : yesMint.publicKey,
            noTokenMint : noMint.publicKey,
            escrowVault : escrowVaultPda,
            escrowProgram : escrowProgram.programId,
            resolutionAdapter : Keypair.generate().publicKey,
            systemProgram :  SystemProgram.programId,
            tokenProgram:TOKEN_PROGRAM_ID,
            rent : anchor.web3.SYSVAR_RENT_PUBKEY
        }).signers([admin,yesMint,noMint]).rpc()

        return {marketPda,yesMint,noMint,escrowVaultPda};
    }


    async function initializeVault(marketPda : PublicKey,yesMint:PublicKey,noMint:PublicKey){
        const [vaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow_vault"), marketPda.toBuffer()],
            escrowProgram.programId
        );

       const usdcVaultPda = await getAssociatedTokenAddressSync(
        usdcMint,
        vaultPda,
        true
       )

        await escrowProgram.methods.initializeVault().accounts({
            admin : admin.publicKey,
            market : marketPda,
            // @ts-ignore
            vault:vaultPda,
            yesTokenMint : yesMint,
            noTokenMint : noMint,
            marketRegisteryProgram:marketProgram.programId,
            usdcMint,
            usdcVault : usdcVaultPda,
            systemProgram : SystemProgram.programId,
            tokenProgram : TOKEN_PROGRAM_ID,
            rent : anchor.web3.SYSVAR_RENT_PUBKEY
        }).signers([admin]).rpc()

        return {vaultPda , usdcVaultPda};
    }

    async function openMarket(marketPda : PublicKey){
        await marketProgram.methods.openMarket().accounts({
            admin : admin.publicKey,
            // @ts-ignore
            market : marketPda
        }).signers([admin]).rpc()

    }

    async function mintPairs(
        vaultPda : PublicKey,
        marketPda : PublicKey,
        usdcVaultPda:PublicKey,
        yesMint: PublicKey,
        noMint: PublicKey,
        yesRecipient:PublicKey,
        noRecipient:PublicKey,
        pairs : number
    ){
        await escrowProgram.methods.mintPairs(new anchor.BN(pairs)).accounts({

            authority:settlementWorker.publicKey,
            // @ts-ignore
            vault : vaultPda,
            market : marketPda,
            marketRegistryProgram:marketProgram.programId,
            usdcVault: usdcVaultPda,
            usdcMint,
            hotWalletUsdc,
            yesTokenMint: yesMint,
            noTokenMint: noMint,
            yesRecipient,
            noRecipient,
            tokenProgram: TOKEN_PROGRAM_ID,    
        }).signers([admin]).rpc()
    }


    before(async ()=>{
        admin = Keypair.generate();
       
        const adminWallet = new anchor.Wallet(admin);

        const provider = new anchor.AnchorProvider(
        anchor.getProvider().connection,
        adminWallet,
        anchor.AnchorProvider.defaultOptions()
        );

        anchor.setProvider(provider);
                
        escrowProgram = anchor.workspace.EscrowVault as Program<EscrowVault>;
  marketProgram = anchor.workspace.MarketRegistry as Program<MarketRegistry>;   
        
        settlementWorker  = Keypair.generate();
        alice = Keypair.generate();
        bob = Keypair.generate();
        charli =  Keypair.generate();
        nonAuthorized = Keypair.generate();


        console.log(" Airdrop  SOL...");
        await Promise.all([
        airdrop(admin.publicKey),
        airdrop(settlementWorker.publicKey),
        airdrop(alice.publicKey),
        airdrop(bob.publicKey),
        airdrop(charli.publicKey),
        airdrop(nonAuthorized.publicKey),
        ]);

        // creating USDC Mock 

        

        // it tells about how the  metadata Of USDC mint  Like it is of 6 decimal 
        usdcMint = await createMint(
            provider.connection,
            admin,
            admin.publicKey,
            null,
            6
        );

        // create Hot wallet 

        const hotWallet = await getOrCreateAssociatedTokenAccount(
            provider.connection,
            admin,
            usdcMint,
            settlementWorker.publicKey
        );
        hotWalletUsdc = hotWallet.address;

        await mintTo(
            provider.connection,
            admin,
            usdcMint,
            hotWalletUsdc,
            admin,
            10_000_000*1_000_000
        );

        // Create USDC accounts for users
    const aliceUsdcAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        admin,
        usdcMint,
        alice.publicKey
      );
      aliceUsdc = aliceUsdcAccount.address;
  
      const bobUsdcAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        admin,
        usdcMint,
        bob.publicKey
      );
      bobUsdc = bobUsdcAccount.address;
  
      const charlieUsdcAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        admin,
        usdcMint,
        charli.publicKey
      );
      charliUsdc = charlieUsdcAccount.address;
  
      // Generate market IDs
      market1Id = new Uint8Array(32).fill(1);
      market2Id = new Uint8Array(32).fill(2);
      market3Id = new Uint8Array(32).fill(3);
  
      console.log(" Setup complete!\n");
    });

    describe("Vault initialization",()=>{
        it("Vault initialization for market 1",async()=>{
            const result = await createMarket(market1Id,"Will BTC reach $100k");
            market1Pda = result.marketPda;
            yes1Mint = result.yesMint;
            no1Mint = result.noMint;

            const vaultResult = await initializeVault(
                market1Pda,
                yes1Mint.publicKey,
                no1Mint.publicKey
            );

            vault1Pda=vaultResult.vaultPda;
            vault1UsdcPda = vaultResult.usdcVaultPda;

            const vault = await escrowProgram.account.escrowVault.fetch(vault1Pda);
      expect(vault.totalYesMinted.toNumber()).to.equal(0);
      expect(vault.totalNoMinted.toNumber()).to.equal(0);
      expect(vault.isSettled).to.be.false;

        })
    })


})