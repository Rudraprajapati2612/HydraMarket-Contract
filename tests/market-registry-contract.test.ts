// import * as anchor from "@coral-xyz/anchor";
// import { Program } from "@coral-xyz/anchor";
// import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
// import { expect, use } from "chai";
// import { MarketRegistry     } from "../target/types/market_registry";
// import { TOKEN_PROGRAM_ID, calculateEpochFee } from "@solana/spl-token";

// describe("Market Registery Complete Tests",()=>{
//     const provider = anchor.AnchorProvider.env()
//     anchor.setProvider(provider)

//     const program  = anchor.workspace.MarketRegistry as Program<MarketRegistry>;

//     // declare all the keywords and variable 
    
//     let admin : Keypair;
//     let nonAdmin : Keypair
//     let user :Keypair;

    
//     // market - 1  account 
//     let market1Pda : PublicKey;
//     let market1Id : Uint8Array;
//     let market1YesMint : Keypair; //we need to create their mint account in test 
//     let market1NoMint : Keypair;
//     let market1EscrowVault : PublicKey; //hodl usdc for market1 
//     let market1ResolutionAdapter : Keypair; // oracle feed 


//     // market - 2  account 
//     let market2Pda : PublicKey;
//     let market2Id : Uint8Array;
//     let market2YesMint : Keypair; //we need to create their mint account in test 
//     let market2NoMint : Keypair;
//     let market2EscrowVault : PublicKey;
//     let market2ResolutionAdapter : PublicKey;


//       // Mock escrow program (for testing - would be real in production)
//     let mockEscrowProgram: PublicKey;

//     // Time constants
//     const nowTimestamp = Math.floor(Date.now() / 1000);
//     const futureExpiry = nowTimestamp + 30 * 24 * 60 * 60; // 30 days
//     const pastExpiry = nowTimestamp - 10; // Already expired


//     // Some of the helper function 

//     async function airdrop(pubkey :PublicKey,number =10){
//         const sig = await provider.connection.requestAirdrop(
//             pubkey,
//             number * LAMPORTS_PER_SOL
//         )
//         const latestBlockHash = await provider.connection.getLatestBlockhash();

//         await provider.connection.confirmTransaction({
//             signature : sig,
//             blockhash : latestBlockHash.blockhash,
//             lastValidBlockHeight : latestBlockHash.lastValidBlockHeight
//         })
//     }

//     function getMarketState(state:any){
//         if(state.created) return "CREATED";
//         if(state.open) return "OPEN";
//         if(state.paused) return "PAUSED";
//         if(state.resolving) return "RESOLVING";
//         if(state.resolved) return "RESOLVED";
//         return "UNKNOWN"
//     }

//     async function createMarket(marketId : Uint8Array , question : string , expireAt : number , signer : Keypair = admin){
//        const yesMint = Keypair.generate();
//        const noMint = Keypair.generate();

//        const [marketPda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("market") , Buffer.from(marketId)],
//         program.programId
//        );

//        const [escrowVaultPda] = PublicKey.findProgramAddressSync(
//         [Buffer.from("escrow_vault"),marketPda.toBuffer()],
//         mockEscrowProgram
//        );

//        const resolutionAdapter  = Keypair.generate();

//        const params = {
//         marketId : Array.from(marketId),
//         question,
//         description : `Test market : ${question}`,
//         category : "Test",
//         expireAt :new anchor.BN(expireAt),
//         resolutionSource: "Test Oracle" 
//        }

//        await program.methods
//       .initializeMarket(params)
//       .accounts({
//         admin: signer.publicKey,
//         // @ts-ignore
//         market: marketPda,
//         yesTokenMint: yesMint.publicKey,
//         noTokenMint: noMint.publicKey,
//         escrowVault: escrowVaultPda,
//         escrowProgram: mockEscrowProgram,
//         resolutionAdapter:resolutionAdapter.publicKey,
//         systemProgram: SystemProgram.programId,
//         tokenProgram: TOKEN_PROGRAM_ID,
//         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//       })
//       .signers([signer, yesMint, noMint])
//       .rpc();

//     return {
//       marketPda,
//       yesMint,
//       noMint,
//       escrowVaultPda,
//       resolutionAdapter,
//     };



//     }

//     // lets setup befor creating new market 

//     before(async ()=>{
//         console.log("Setting Up the Market");
        
//         admin = Keypair.generate();
//         nonAdmin = Keypair.generate();
//         user = Keypair.generate();
//         market1ResolutionAdapter = Keypair.generate();
//         // airdrop solana to all the users 

//         await Promise.all([
//             airdrop(admin.publicKey),
//             airdrop(nonAdmin.publicKey),
//             airdrop(user.publicKey)
//         ])

//         mockEscrowProgram  = Keypair.generate().publicKey;

//         market1Id = new Uint8Array(32).fill(1);
//         market2Id = new Uint8Array(32).fill(2);
//         console.log("📋 Account Setup:");
//         console.log("  Admin:", admin.publicKey.toString());
//         console.log("  Non-Admin:", nonAdmin.publicKey.toString());
//         console.log("  User:", user.publicKey.toString());
//         console.log("  Mock Escrow Program:", mockEscrowProgram.toString());
//         console.log("\n✅ Setup complete!\n");
//     })




//     // Market Initialization Tests
//     describe("Market Initialize",()=>{
//         // done 
//         it("Should Successfully initialize a new market",async ()=>{
//             console.log("Initialize new Market");
            
//             market1YesMint = Keypair.generate();
//             market1NoMint = Keypair.generate();
//                 // market account Is a pda 
//                 // market accoutn is derived from the Seed = Market + Market ID + Program ID
//             [market1Pda] = PublicKey.findProgramAddressSync(
//                 [Buffer.from("market"), Buffer.from(market1Id)],
//                 program.programId
//             );

//             [market1EscrowVault] = PublicKey.findProgramAddressSync(
//                 [Buffer.from("escrow_vault"), market1Pda.toBuffer()],
//                 mockEscrowProgram
//             );

            

//             const question  = "Will BTC reach $100k by the end of janurary 2026";
//             const description = "Market will resolve yes if Bitcoin will resovle yes"
//             const category = "Crypto";
//             const resolutionSource = "Pyth BTC/USDC"

//             const params = {
//                 marketId : Array.from(market1Id),
//                 question,
//                 description,
//                 category,
//                 expireAt : new anchor.BN(futureExpiry),
//                 resolutionSource
//             }

//             await program.methods.initializeMarket(params).accounts({

//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : market1Pda,
//                 yesTokenMint : market1YesMint.publicKey,
//                 noTokenMint : market1NoMint.publicKey,
//                 escrowVault : market1EscrowVault,
//                 escrowProgram : mockEscrowProgram,
//                 resolutionAdapter : market1ResolutionAdapter.publicKey,
//                 systemProgram : SystemProgram.programId,
//                 tokenProgram : TOKEN_PROGRAM_ID,
//                 rent : anchor.web3.SYSVAR_RENT_PUBKEY
//             }).signers([admin,market1YesMint,market1NoMint]).rpc()

//             // fetch the market 

//             const market = await program.account.market.fetch(market1Pda);

//             expect(market.marketId).to.deep.equal(Array.from(market1Id));
//             expect(market.question).to.equal(question);
//             expect(market.description).to.equal(description);
//             expect(market.category).to.equal(category);
//             expect(market.creator.toString()).to.equal(admin.publicKey.toString());
//             expect(market.expireAt.toNumber()).to.equal(futureExpiry);
//             expect(market.yesTokenMint.toString()).to.equal(market1YesMint.publicKey.toString());
//             expect(market.noTokenMint.toString()).to.equal(market1NoMint.publicKey.toString());
//             expect(market.escrowVault.toString()).to.equal(market1EscrowVault.toString());
//             expect(market.resolutionAdapter.toString()).to.equal(market1ResolutionAdapter.publicKey.toString());
//             expect(market.resolutionSource).to.equal(resolutionSource);
//             expect(getMarketState(market.state)).to.equal("CREATED");
//             expect(market.resolutionOutcome).to.be.null;
//             expect(market.resolvedAt).to.be.null;

//             console.log(" Market 1 initialized successfully");
//             console.log("   State:", getMarketState(market.state));
//             console.log("   Market PDA:", market1Pda.toString());
//         })
//         // done
//         it(" Should Create a second market with different ID ",async ()=>{
//             console.log("Initalize Market 2 ");
            

//             const result = await createMarket(market2Id,"WIll SOl Reach 200$ Before jan",futureExpiry);

//             market2Pda = result.marketPda;
//             market2YesMint = result.yesMint;
//             market2NoMint = result.noMint;
//             market2EscrowVault = result.escrowVaultPda;
//             market2ResolutionAdapter = result.resolutionAdapter.publicKey;

//             const market  = await program.account.market.fetch(market2Pda);

//             expect(market.marketId).to.deep.equal(Array.from(market2Id));
//             expect(getMarketState(market.state)).to.equal("CREATED");

//             console.log(" Market 2 initialized successfully");
//             console.log("   Market PDA:", market2Pda.toString());
//         })


//         // done
//         it("Should fail to Create Duplicate Market (Same Market Id)",async ()=>{
//             try{
//                 await createMarket(market1Id, "Duplicate Market" , futureExpiry);

//                 expect.fail("No new market is created")
//             }catch(e){
//                 expect(e.message).to.include("already in use");
//                 console.log(" Correctly rejected duplicate market ID");
//             }
//         })

//         // done
//         it("Should fialed with  the invalid expire Date",async()=>{
//             console.log("Testing past expire");
            
//             const marketId = new Uint8Array(32).fill(21);

//             try{
//                 await createMarket(marketId,"Past expire",pastExpiry);
//                 expect.fail("Past expire Market is not created")
//             }catch(e){
//                 expect(e.error.errorCode.code).to.equal("InvalidExpiryTimestamp");
//                 console.log(" Correctly rejected past expiry");
//             }
//         })

//         // done
//         it("Should Failed wtih empty Question",async()=>{
//             const marketId = new Uint8Array(32).fill(22);

//             const yesMint = Keypair.generate();
//             const noMint = Keypair.generate();

//             const [marketPda] = PublicKey.findProgramAddressSync(
//                 [Buffer.from("market"),Buffer.from(marketId)],
//                 program.programId
//             );

//             const [escrowVaultPda] = PublicKey.findProgramAddressSync(
//                 [Buffer.from("escrow_vault"),marketPda.toBuffer()],
//                 mockEscrowProgram
//             );

//             const params = {
//                 marketId : Array.from(marketId),
//                 question : "",
//                 description : "Test",
//                 category : "Sports",
//                 expireAt : new anchor.BN(futureExpiry),
//                 resolutionSource : "Test"
//             }


//             try{
//                 await program.methods.initializeMarket(params).accounts({
//                     admin: admin.publicKey,
//                     // @ts-ignore
//                     market: marketPda,
//                     yesTokenMint: yesMint.publicKey,
//                     noTokenMint: noMint.publicKey,
//                     escrowVault: escrowVaultPda,
//                     escrowProgram: mockEscrowProgram,
//                     resolutionAdapter: Keypair.generate().publicKey,
//                     systemProgram: SystemProgram.programId,
//                     tokenProgram: TOKEN_PROGRAM_ID,
//                     rent: anchor.web3.SYSVAR_RENT_PUBKEY,
//                 }).signers([admin,yesMint,noMint]).rpc();

//                 expect.fail("Should have thrown error");
//             }catch(e){
//                 expect(e.error.errorCode.code).to.equal("QuestionEmpty");
//                 console.log(" Correctly rejected empty question");
//             }
//         })
//         // done 
//         it("Should Fail With Long Question",async()=>{
//             console.log("Testing Failing Due to Long Question");

//             const marketId = new Uint8Array(32).fill(26);
//             const question = "R".repeat(201);
//             try{
//                 await createMarket(marketId,question,futureExpiry);
//                 expect.fail("Should have thrown Error")
//             }catch(e){
//                 expect(e.error.errorCode.code).to.equal("QuestionTooLong");
//                 console.log("Rejected Long Question");
                
//             }
//         })
//     })

//     describe("State Transition",()=>{
//         // done
//         it("Should Open Market (CREATED->OPEN) ",async ()=>{
//             console.log("Opening Market Test");
            
//             await program.methods.openMarket().accounts({
//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : market1Pda,
//             }).signers([admin]).rpc()

//             const market  = await program.account.market.fetch(market1Pda);
//             expect(getMarketState(market.state)).to.equal("OPEN");
//             console.log("State is Changed From Created TO Open");
            
//         })
//         // done
//         it("Should Fail to open already Open Market",async ()=>{
//             console.log("Testing Double Open Market");

//             try{
//                 await program.methods.openMarket().accounts({
//                     admin:  admin.publicKey,
//                     // @ts-ignore
//                     market : market1Pda
//                 }).signers([admin]).rpc()

//                 expect.fail("Throw Error")
//             }catch(e){
//                 expect(e.error.errorCode.code).to.equal("InvalidMarketState");
//                 console.log("Correctly Rejected Double Open");
                
//             }
            
//         })
//         // done 
//         it("Should Fail If Non admin tries to open market",async ()=>{
//             console.log("Testing Non admin Open market");

//             try{
//                 await program.methods.openMarket().accounts({
//                     admin:  nonAdmin.publicKey,
//                     // @ts-ignore
//                     market : market2Pda
//                 }).signers([nonAdmin]).rpc()

//                 expect.fail("Should Throw Error")
//             }catch(e){
//                 expect(e.error.errorCode.code).to.equal("Unauthorized");
//                 console.log("Non admin is rejected");  
//             }
            

          
//         })
//         // done 
//         it("Should Pause the Market (OPEN -> PAUSE)",async ()=>{
//             console.log("Pause the market");
            
//             await program.methods.pauseMarket().accounts({
//                 admin: admin.publicKey,
//                 // @ts-ignore
//                 market : market1Pda
//             }).signers([admin]).rpc()
            
//             const market = await program.account.market.fetch(market1Pda);
//             expect(getMarketState(market.state)).to.equal("PAUSED");

//             console.log("Market 1 Paused");
            
//         })
//         // done 
//         it("Should resume the pause market (PAUSE->OPEN)",async()=>{
//             console.log("Resume the market");

//             await program.methods.resumeMarket().accounts({
//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : market1Pda
//             }).signers([admin]).rpc()

//             const market = await program.account.market.fetch(market1Pda);
//         expect(getMarketState(market.state)).to.equal("OPEN")
//         })

//         // done
//         it("Should Set Market To Resolving",async()=>{
//             await program.methods.resolvingMarket().accounts({
//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : market1Pda
//             }).signers([admin]).rpc()

//             const market = await program.account.market.fetch(market1Pda);
//             expect(getMarketState(market.state)).to.equal("RESOLVING");

//             console.log("✅ Market 1 resumed");
//             console.log("   State:", getMarketState(market.state));
//         })

//         it("Not finalize market after expiry", async () => {
//             console.log("Testing market finalization...");
            
//             // Step 1: Create market expiring in 5 seconds
//             const marketId = new Uint8Array(32).fill(100);
//             const shortExpiry = Math.floor(Date.now() / 1000) + 15;
            
//             const result = await createMarket(
//                 marketId,
//                 "Will this test pass?",
//                 shortExpiry
//             );
            
//             console.log(`  Market expires at: ${new Date(shortExpiry * 1000).toISOString()}`);
            
//             // Step 2: Open market
//             await program.methods.openMarket()
//                 .accounts({
//                     admin: admin.publicKey,
//                     // @ts-ignore
//                     market: result.marketPda
//                 })
//                 .signers([admin])
//                 .rpc();
            
//             let market = await program.account.market.fetch(result.marketPda);
//             console.log(`  Market state: ${getMarketState(market.state)}`);
            
//             // Step 3: Set to resolving
//             await program.methods.resolvingMarket()
//                 .accounts({
//                     admin: admin.publicKey,
//                     // @ts-ignore
//                     market: result.marketPda
//                 })
//                 .signers([admin])
//                 .rpc();
            
//             market = await program.account.market.fetch(result.marketPda);
//             console.log(`  Market state: ${getMarketState(market.state)}`);
            
//             // Step 4: Wait for expiry
//             console.log("  ⏳ Waiting for market to expire (16 seconds)...");
//             await new Promise(resolve => setTimeout(resolve, 16000));
            
//             const nowTime = Math.floor(Date.now() / 1000);
//             console.log(`  Current time: ${new Date(nowTime * 1000).toISOString()}`);
//             console.log(`  Market expired: ${nowTime > shortExpiry ? "YES ✅" : "NO ❌"}`);
            
//             // Step 5: Finalize
//             await program.methods.finalizeMarket({ yes: {} })
//                 .accounts({
//                     resolutionAdapter: result.resolutionAdapter.publicKey,
//                     // @ts-ignore
//                     market: result.marketPda
//                 })
//                 .signers([result.resolutionAdapter])
//                 .rpc();
            
//             // Step 6: Verify
//             market = await program.account.market.fetch(result.marketPda);
//             expect(getMarketState(market.state)).to.equal("RESOLVED");
//             expect(market.resolutionOutcome).to.deep.equal({ yes: {} });
//             expect(market.resolvedAt).to.not.be.null;
            
//             console.log("✅ Market finalized successfully");
//             console.log(`   Outcome: YES`);
//             console.log(`   Resolved at: ${new Date(market.resolvedAt.toNumber() * 1000).toISOString()}`);
            
//         });
        
//     })

//     //  Resolution Outcome 

//     // Done
//     describe("Resolution Outcome",()=>{
//         let market3Pda : PublicKey;
//         let market3ResolutionAdapter : Keypair;
//         before(async()=>{
//             const market3Id = new Uint8Array(32).fill(3);

//             const shortExpiry = Math.floor(Date.now() / 1000) + 15;
//             const result = await createMarket(
//                 market3Id,
//                 "Test Market for No Outcome",
//                 shortExpiry
//             );
            
//             market3Pda = result.marketPda;
//             market3ResolutionAdapter = result.resolutionAdapter;
//             await program.methods
//             .openMarket() 
//             .accounts({
//                admin : admin.publicKey,
//             // @ts-ignore
//                market : market3Pda
//             }).signers([admin]).rpc();


//             await program.methods.resolvingMarket().accounts({
//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : market3Pda
//             }).signers([admin]).rpc();

//             console.log("   ⏳ Waiting for market to expire (16 seconds)...");
//             await new Promise(resolve => setTimeout(resolve, 16000));
//         })

//         it("It Should Finalized With No Outcome",async()=>{
//             await program.methods.finalizeMarket({no:{}})
//             .accounts(
//                 {
//                     resolutionAdapter : market3ResolutionAdapter.publicKey,
//                     // @ts-ignore
//                     market : market3Pda
//                 }
//             ).signers([market3ResolutionAdapter]).rpc()

//             const market = await program.account.market.fetch(market3Pda);
//             expect(getMarketState(market.state)).to.equal("RESOLVED");
//             expect(market.resolutionOutcome).to.deep.equal({ no: {} });
      
//             console.log(" Finalized with NO");
//             console.log("   Outcome: NO");
//         })


//         it("It Should Finalized With Invalid Outcome",async()=>{
//             const market4Id = new Uint8Array(32).fill(4);
//             const shortExpiry = Math.floor(Date.now() / 1000) + 15;
//             const result = await createMarket(
//                 market4Id,
//                 "Testing Market With No Outcome",
//                 shortExpiry
//             );

//             const market4Pda = result.marketPda;

//             await program.methods.openMarket().accounts({
//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : market4Pda
//             }).signers([admin]).rpc();

//             let marketOpen = await program.account.market.fetch(market4Pda);
//             console.log(`  Market state: ${getMarketState(marketOpen.state)}`);

//             await program.methods.resolvingMarket().accounts({
//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : market4Pda
//             }).signers([admin]).rpc();

             
//             let marketRes = await program.account.market.fetch(market4Pda);
//             console.log(`  Market state: ${getMarketState(marketRes.state)}`);
            
//             // Step 4: Wait for expiry
//             console.log("  ⏳ Waiting for market to expire (16 seconds)...");
//             await new Promise(resolve => setTimeout(resolve, 16000));
            
//             const nowTime = Math.floor(Date.now() / 1000);
//             console.log(`  Current time: ${new Date(nowTime * 1000).toISOString()}`);
//             console.log(`  Market expired: ${nowTime > shortExpiry ? "YES ✅" : "NO ❌"}`);
            
//             await program.methods.finalizeMarket({invalid:{}})
//                 .accounts({
//                     resolutionAdapter : result.resolutionAdapter.publicKey,
//                     // @ts-ignore
//                     market : market4Pda
//                 }).signers([result.resolutionAdapter]).rpc();
            
//             const marketFin = await program.account.market.fetch(market4Pda);
//             expect(getMarketState(marketFin.state)).to.equal("RESOLVED");
//             expect(marketFin.resolutionOutcome).to.deep.equal({ invalid: {} });
            
//         })

//         // Done 
//         it("Should to fail To Finalizing before Resolving State",async()=>{
//             const market5id = new Uint8Array(32).fill(5);

//             const result = await createMarket(
//                 market5id,
//                 "Test Market 5 Pda",
//                 futureExpiry
//             )

//             try{
//             await program.methods.finalizeMarket({yes:{}})
//                   .accounts({
//                     resolutionAdapter : result.resolutionAdapter.publicKey,
//                     // @ts-ignore
//                     market : result.marketPda
//                   }).signers([result.resolutionAdapter]).rpc()
//                   expect.fail("Should have thrown error");
//                 }
//                 catch(e:any){
//                     expect(e.error.errorCode.code).to.equal("InvalidMarketState");
//                     console.log("✅ Correctly rejected early finalization");
//                 }  
//         })

//         // Done 
//         it("Should Failed to Finalize Twice",async()=>{
//             try{
//                 await program.methods.finalizeMarket({no:{}})
//                       .accounts({
//                         resolutionAdapter : market3ResolutionAdapter.publicKey,
//                         // @ts-ignore
//                         market : market3Pda
//                       }).signers([market3ResolutionAdapter]).rpc()
//                 expect.fail("Should have thrown error");      
//             }catch(e:any){
//                 expect(e.error.errorCode.code).to.equal("MarketAlreadyResolved");
//             console.log(" Correctly rejected double finalization");
//             }
//         })
//     })

//     // Done 
//     describe("Access Control",()=>{

//         let testmarketPda : PublicKey ;
        
//         before(async()=>{
//             const marketId = new Uint8Array(32).fill(10);
            
//             const result = await createMarket(
//                 marketId,
//                 "Access Control Test",
//                 futureExpiry
//             );

//             testmarketPda = result.marketPda;

//             await program.methods.openMarket().accounts({
//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : testmarketPda
//             }).signers([admin]).rpc();
//         })  
//         // Done
//         it("Should Reject non Admin Pause",async ()=>{
//             try{
//                 await program.methods.pauseMarket()
//                       .accounts({
//                         admin: nonAdmin.publicKey,
//                         // @ts-ignore
//                         market : testmarketPda
//                       }).signers([nonAdmin]).rpc()

//                       expect.fail("Should have thrown error");
//             }catch(e){
//                 expect(e.error.errorCode.code).to.equal("Unauthorized");
//                 console.log("✅ Correctly rejected non-admin pause");
//             }   
//         })

//         it("Should Reject Non Admin Open",async()=>{
//             await program.methods.pauseMarket().accounts({
//                 admin:admin.publicKey,
//                 // @ts-ignore
//                 market : testmarketPda
//             }).signers([admin]).rpc()

//             try{
//                 await program.methods.resumeMarket().accounts({
//                     admin : nonAdmin.publicKey,
//                     // @ts-ignore
//                     market : testmarketPda
//                 }).signers([nonAdmin]).rpc();

//                 expect.fail("Should Have Thrown Error")
//             }catch(e){
//                 expect(e.error.errorCode.code).to.equal("Unauthorized");
//                 console.log("Correctly rejected non admin Resume");
                
//             }
//         })

//         it("Should reject Non admin set resolving",async()=>{
//             // Resume the market because market is pause 
//             await program.methods.resumeMarket().accounts({
//                 admin: admin.publicKey,
//                 // @ts-ignore
//                 market : testmarketPda
//             }).signers([admin]).rpc();

//             try{
//                 await program.methods.resolvingMarket().accounts({
//                     admin : nonAdmin.publicKey,
//                     // @ts-ignore
//                     market : testmarketPda
//                 }).signers([nonAdmin]).rpc();
//                 expect.fail("Should have thrown error");
//             }catch(e:any){
//                 expect(e.error.errorCode.code).to.equal("Unauthorized");
//                 console.log(" Correctly rejected non-admin set resolving");
//             }
//         })

//         it("Should Reject Non admin Finalized",async()=>{

//             await program.methods.resolvingMarket().accounts({
//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : testmarketPda
//             }).signers([admin]).rpc();

//             try{
//                 await program.methods.finalizeMarket({yes:{}}).accounts({
//                     resolutionAdapter : nonAdmin.publicKey,
//                     // @ts-ignore
//                     market : testmarketPda
//                 }).signers([nonAdmin]).rpc();
//                 expect.fail("Should have thrown error");
//             }catch(e){
//                 expect(e.error.errorCode.code).to.equal("InvalidResolutionAdapter");
//                 console.log("✅ Correctly rejected non-admin finalize");
//             }
//         })


//     })

//     describe("Market Queries and Validation",()=>{
//         it("Should Fetch market Data Correctly",async()=>{
//             console.log("Fetching Market 1 Data");
            

//             const market = await program.account.market.fetch(market1Pda);

//             console.log("Market 1 Details");
            
//             console.log(" Question",market.question);
//             console.log(" State",getMarketState(market.state));
//             console.log(" Creator",market.creator.toString());
//             console.log(" Expire at ",new Date(market.expireAt.toNumber()*1000).toString());
//             console.log(" YES Mint:", market.yesTokenMint.toString());
//             console.log(" NO Mint:", market.noTokenMint.toString());
//             console.log(" Escrow Vault:", market.escrowVault.toString());
//             console.log(" Resolution:", market.resolutionOutcome ? "YES" : "Not resolved");
      
//             expect(market.question).to.not.be.empty;
//             expect(market.creator.toString()).to.equal(admin.publicKey.toString());
//         })

//         it("Should Fetch All the Market",async()=>{
//             console.log("Fetching All the Market");

//             const allMarkets = await program.account.market.all();

//             console.log(`\nTotal markets created: ${allMarkets.length}`);
            
//             allMarkets.forEach((market,index)=>{
//                 console.log(`\nMarket ${index+1}`);
//                 console.log("  Address:", market.publicKey.toString());
//                 console.log("  Question:", market.account.question);
//                 console.log("  State:", getMarketState(market.account.state));
//             })

//             expect(allMarkets.length).to.be.greaterThan(0);
//         })

//         it("DEBUG: Scan entire account for creator pubkey", async() => {
//             console.log("\n🔍 DEEP SCAN FOR CREATOR PUBKEY\n");
            
//             // Fetch market to confirm creator
//             const market = await program.account.market.fetch(market1Pda);
//             console.log("Market creator:", market.creator.toString());
//             console.log("Admin pubkey:", admin.publicKey.toString());
//             console.log("Match:", market.creator.toString() === admin.publicKey.toString());
            
//             // Get raw account data
//             const accountInfo = await program.provider.connection.getAccountInfo(market1Pda);
//             const data = accountInfo.data;
            
//             console.log("\nAccount size:", data.length, "bytes");
//             console.log("Discriminator [0-7]:", data.slice(0, 8).toString('hex'));
            
//             // Convert creator pubkey to bytes for searching
//             const creatorBytes = admin.publicKey.toBytes();
//             console.log("\nSearching for creator bytes:", Buffer.from(creatorBytes).toString('hex'));
            
//             // Search the entire account
//             let found = false;
//             for (let i = 0; i <= data.length - 32; i++) {
//                 const slice = data.slice(i, i + 32);
                
//                 // Check if bytes match
//                 if (Buffer.from(slice).equals(Buffer.from(creatorBytes))) {
//                     console.log(`\n✅ FOUND CREATOR AT OFFSET ${i}!`);
//                     console.log(`   Bytes ${i} to ${i + 31}`);
                    
//                     // Show context
//                     if (i >= 8) {
//                         console.log(`   Previous 8 bytes [${i-8} to ${i-1}]:`, data.slice(i-8, i).toString('hex'));
//                     }
//                     console.log(`   Creator bytes [${i} to ${i+31}]:`, slice.toString('hex'));
//                     if (i + 32 < data.length) {
//                         console.log(`   Next 8 bytes [${i+32} to ${i+39}]:`, data.slice(i+32, Math.min(i+40, data.length)).toString('hex'));
//                     }
                    
//                     found = true;
//                 }
//             }
            
//             if (!found) {
//                 console.log("\n Creator pubkey NOT found in account data!");
//                 console.log("This is very unusual. Possible issues:");
//                 console.log("1. Wrong market account being tested");
//                 console.log("2. Creator stored differently than expected");
//                 console.log("3. Account data corrupted");
                
//                 // Show first 200 bytes
//                 console.log("\nFirst 200 bytes of account:");
//                 console.log(data.slice(0, Math.min(200, data.length)).toString('hex'));
//             }
            
//             expect(found).to.be.true;
//         });
        
//         it("Should Fetch market By creator", async() => {
//             // After running the DEBUG test above, use the offset it found
//             // For now, let's try a wider range
//             const offsetsToTry = [8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120];
            
//             for (const offset of offsetsToTry) {
//                 const markets = await program.account.market.all([
//                     {
//                         memcmp: {
//                             offset: offset,
//                             bytes: admin.publicKey.toBase58()
//                         }
//                     }
//                 ]);
                
//                 if (markets.length > 0) {
//                     console.log(`\n✅ SUCCESS! Offset ${offset} found ${markets.length} markets`);
//                     expect(markets.length).to.be.greaterThan(0);
//                     return;
//                 }
//             }
            
//             throw new Error("Could not find markets with any offset");
//         });

//         it("It should Market Expirey in future",async()=>{
//             console.log("Validating Market Expiry");
            
//             const marketId = new Uint8Array(32).fill(20);

//             try{
//                 await createMarket(
//                     marketId,
//                     "Past Expirey Test",
//                     nowTimestamp - 3600
//                 );
//                 expect.fail("Should have Thrown Error")
//             }catch(e){
//                 expect(e.error.errorCode.code).to.equal("InvalidExpiryTimestamp");
//                 console.log("Correctly rejected past expiry");
                
//             }
//         })
//     })

//     describe("Edge Case",()=>{
//         it("Should handle market with minimum valid question length",async()=>{
//             console.log("Testing minimum question length");
            
//             const marketId = new Uint8Array(32).fill(30);
//             const minQuestion = "Q?";

//             const result = await createMarket(marketId,minQuestion,futureExpiry);

//             const market = await program.account.market.fetch(result.marketPda);
            
//             expect(market.question).to.equal(minQuestion);
//             console.log("Question",minQuestion);
//         })

//         it("Sholud handle market with the question length (200 Words)",async()=>{
//             console.log("Testing Maximum Question Length");

//             const marketId = new Uint8Array(32).fill(31);
//             const maxQuestion = "A".repeat(200);

//             const result = await createMarket(marketId,maxQuestion,futureExpiry);

//             const market = await program.account.market.fetch(result.marketPda);
//             expect(market.question.length).to.equal(200);
//             console.log("Accepted maximum question length (200 chars)");
//         })

//         it("Should Handle Market expiring far in future",async()=>{
//             console.log("Testing for future expire");
            
//             const marketId = new Uint8Array(32).fill(32);

//             const farFuture = nowTimestamp+365*24*60*60;

//             const result = await createMarket(marketId,"Far Future Market",farFuture);

//             const market = await program.account.market.fetch(result.marketPda);
//             expect(market.expireAt.toNumber()).to.equal(farFuture);
//             console.log("✅ Accepted far future expiry");
//             console.log("   Expires:", new Date(farFuture * 1000).toISOString());
//         })

//         it("Should Handle Rapid State Transitions",async()=>{
//             console.log("Testing Rapid State Transations");
            
//             const marketId = new Uint8Array(32).fill(33);
//             const shortExpiry = Math.floor(Date.now() / 1000) + 15;
//             const result = await createMarket(marketId,"Rapid transition test",shortExpiry);

            
//             const marketPda = result.marketPda;

//             // Created To Open 
//             await program.methods.openMarket().accounts({
//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : marketPda
//             }).signers([admin]).rpc();

//             // Open To Paused

//             await program.methods.pauseMarket().accounts({
//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : marketPda
//             }).signers([admin]).rpc();
        
//             // Pause TO Open 

//             await program.methods.resumeMarket().accounts({
//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : marketPda
//             }).signers([admin]).rpc();

//             // Open To Resolving

//             await program.methods.resolvingMarket().accounts({
//                 admin : admin.publicKey,
//                 // @ts-ignore
//                 market : marketPda
//             }).signers([admin]).rpc();

//             await new Promise(resolve => setTimeout(resolve, 16000));
//             // Resolving to Resolved 

//             await program.methods.finalizeMarket({yes:{}}).accounts({
//                 resolutionAdapter : result.resolutionAdapter.publicKey,
//                 // @ts-ignore
//                 market : marketPda
//             }).signers([result.resolutionAdapter]).rpc();

//             const market = await program.account.market.fetch(marketPda);

//             expect(getMarketState(market.state)).to.equal("RESOLVED");
//             console.log("✅ Rapid transitions completed successfully");
//         })

//         it("Should handle special characters in question", async () => {
//             console.log("\n🔤Testing special characters...");
      
//             const marketId = new Uint8Array(32).fill(34);
//             const specialQuestion = "Will BTC reach $100k? (Yes/No) - 2026!";
      
//             const result = await createMarket(marketId, specialQuestion, futureExpiry);
      
//             const market = await program.account.market.fetch(result.marketPda);
//             expect(market.question).to.equal(specialQuestion);
      
//             console.log(" Accepted special characters");
//             console.log("   Question:", specialQuestion);
//         });
//     })

// })

