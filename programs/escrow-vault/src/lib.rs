use anchor_lang::prelude::*;
pub mod state;
pub mod error;
pub mod events;
pub mod constants;
pub mod instructions;
pub mod utils;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;
pub use utils::*;
declare_id!("7naTChgbgNS8cUoMbfKoYA8qomHJVUf5oeVjv9iSmiyf");


#[program]

pub mod escrow_vault {
    use super::*;

    pub fn initialize_vault(ctx:Context<InitializeVault>)->Result<()>{
        instructions::initialize_vault::handler(ctx)
    }

    pub fn mint_pairs(ctx:Context<MintPairs>,pairs:u64)->Result<()>{
        instructions::mint_pairs::handler(ctx, pairs)
    }

    pub fn settle(ctx:Context<Settle>)->Result<()>{
        instructions::settle::handler(ctx)
    }


    pub fn claim_payout(ctx:Context<ClaimPayouts>)->Result<()>{
        instructions::claim_payout::handler(ctx)
    }

    pub fn pause_minting(ctx:Context<PauseMinting>)->Result<()>{
        instructions::pause_minting::handler(ctx)
    }

    pub fn resume_minting(ctx:Context<ResumeMinting>)->Result<()>{
        instructions::resume_minting::handler(ctx)
    }
    
}