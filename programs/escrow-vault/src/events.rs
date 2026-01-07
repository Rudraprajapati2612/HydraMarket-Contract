use anchor_lang::prelude::*;


#[event]

pub struct VaultInitialized {
    pub vault : Pubkey,

    pub market : Pubkey,

    pub usdc_vault :Pubkey,

    pub yes_token_mint : Pubkey,

    pub no_token_mint :Pubkey,
    
    pub timestamp : i64
}

#[event]
pub struct PairsMinted {
    pub vault : Pubkey,

    pub market : Pubkey,

    pub yes_recipient : Pubkey,

    pub no_recipient : Pubkey,

    pub pairs : u64,

    pub collateral_locked : u64,

    pub total_locked :u64,

    pub total_yes_minted : u64,

    pub total_no_minted : u64,

    pub timestamp : i64
}
#[event]
pub struct SettlementInitialized{
    pub vault : Pubkey,

    pub market : Pubkey,

    pub total_collateral : u64 ,

    pub timestamp : i64,

}

#[event]

pub struct PayoutClaimed {
    pub vault  : Pubkey,

    pub market : Pubkey,

    pub user : Pubkey,

    pub payout_amount : u64,

    pub yes_burned : u64 ,

    pub no_burned : u64 ,

    pub remaning_collateral : u64,

    pub timestamp : i64
}


#[event]

pub struct MintingPaused{
    pub vault : Pubkey,

    pub market : Pubkey,

    pub timestamp : i64
}


#[event]
pub struct  MintingResumed {
    pub vault : Pubkey,

    pub market : Pubkey,

    pub timestamp : i64
}