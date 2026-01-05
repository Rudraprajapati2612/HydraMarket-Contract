use anchor_lang::prelude::*;

use crate::state::{MarketState, ResultOutcome};

#[event]
pub struct MarketCreated{
    pub market_id : [u8;32],
    pub market_address:Pubkey,
    pub question : String,
    pub yes_token_mint :Pubkey,
    pub no_token_mint:Pubkey,
    pub escrow_vault:Pubkey,
    pub resolution_adapter:Pubkey,
    pub created_at:i64,
    pub expire_at:i64
}

#[event]
// when market state is changed from Created to resolved 
pub struct  MarketStateChanged{
    pub market_id:[u8;32],
    pub market_address:Pubkey,
    pub old_state:MarketState,
    pub new_state:MarketState,

    pub timestamp : i64
}

#[event]
pub struct MarketResolved{
    pub market_id: [u8;32],
    pub market_address: Pubkey,
    pub market_outcome:ResultOutcome,
    pub resolved_at : i64
}



#[event]

pub struct MarketMetaDataUpdated{
    pub market_id : [u8;32],
    pub market_address:Pubkey,

    pub description : Option<String>,
    pub category:Option<String>,

    pub timestamp : i64
}

#[event]
pub struct MarketCancelled {
    /// Market ID
    pub market_id: [u8; 32],
    
    /// Market address
    pub market_address: Pubkey,
    
    /// Cancellation timestamp
    pub cancelled_at: i64,
}