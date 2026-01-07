#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod constants;
pub mod error;
pub mod event;

pub use instructions::*;
pub use state::*;
pub use constants::*;
pub use error::*;
pub use event::*;

declare_id!("2bRruB58Pk39PRz2wpAhSjURJMKpWoZdpiozzRLruqyU");
#[program]
pub mod market_registry{
    
    use super::*;

    pub fn initialize_market(ctx:Context<MarketInitialize>,params : InitializeMarketParams)->Result<()>{
        instructions::initialize_market::handler(ctx, params)
    }
    
    pub fn open_market(ctx:Context<OpenMarket>)->Result<()>{
        instructions::open_market::handler(ctx)
    }

    pub fn pause_market(ctx:Context<PauseMarket>)->Result<()>{
        instructions::pause_market::handler(ctx)
    }

    pub fn resume_market(ctx:Context<ResumeMarket>)->Result<()>{
        instructions::resume_market::handler(ctx)
    }

    pub fn finalize_market(ctx:Context<FinalizeMarket>, outcome : ResultOutcome)->Result<()>{
        instructions::finalize_market::handler(ctx, outcome)
    }

    pub fn cancel_market(ctx:Context<CancelMarket>)->Result<()>{
        instructions::cancel_market::handler(ctx)
    }

    pub fn update_market_metadata(ctx:Context<UpdateMarketMetadata>,params:UpdateMarketMetaDataParams)->Result<()>{
        
        instructions::update_market_metadata::handler(ctx, params)
    }
}