
use anchor_lang::prelude::*;
use crate::error::MarketRegistryError;
use crate::constants::*;

#[account]
pub struct Market{
    pub market_id : [u8;32],

    pub question : String,

    pub description:String,
    

    pub category : String,

    pub creator:Pubkey,

    pub created_at : i64,

    pub expire_at : i64,
    pub state : MarketState,
    pub yes_token_mint:Pubkey,

    pub no_token_mint:Pubkey,

    pub escrow_vault : Pubkey,
    pub resolution_adapter:Pubkey,
    // from which source ("pyth network")
    pub resolution_source : String,
    pub resolution_outcome:Option<ResultOutcome>,
    pub resolved_at : Option<i64>,

    pub bump : u8
}

impl Market {
    pub const LEN: usize = 8 + // discriminator
        32 + // market_id
        4 + MAX_QUESTION_LENGTH + // question (String)
        4 + MAX_DESCRIPTION_LENGTH + // description
        4 + MAX_CATEGORY_LENGTH + // category
        32 + // creator
        8 + // created_at
        8 + // expires_at
        1 + // state (enum)
        32 + // yes_token_mint
        32 + // no_token_mint
        32 + // escrow_vault
        32 + // resolution_adapter
        4 + MAX_RESOLUTION_SOURCE_LENGTH + // resolution_source
        1 + 1 + // resolution_outcome (Option<enum>)
        1 + 8 + // resolved_at (Option<i64>)
        1; // bum


        pub fn is_experied(&self,current_timestamp:i64)->bool{
            current_timestamp>=self.expire_at
        }

        pub fn can_trade(&self)->bool{
            matches!(self.state,MarketState::Open)         
        }

        pub fn is_resolved(&self)->bool{
            matches!(self.state,MarketState::Resolved)
        }
        pub fn in_resolution_window(&self,current_timestamp:i64)->bool{
            let window_end = self.expire_at.checked_add(RESOLUTION_WINDOW).unwrap_or(i64::MAX);

            current_timestamp>= self.expire_at && current_timestamp<=window_end
        }
}
#[account]
pub struct InitializeMarketParams{
    pub market_id: [u8;32],

    pub question:String,
    pub description:String,
    pub category : String,
    pub expire_at:i64,
    // Source like pyth and so on 
    pub resolution_source:String,

}

impl InitializeMarketParams{
    pub fn validate(&self,current_timestamp:i64)->Result<()>{
        // check for question length 0 
        require!(
            !self.question.trim().is_empty(),
            MarketRegistryError::QuestionEmpty
        );
        
        // validate question length 
        require!(self.question.len()<=MAX_QUESTION_LENGTH,MarketRegistryError::QuestionTooLong);
        // Validate Description length 
        require!(self.description.len()<=MAX_DESCRIPTION_LENGTH,MarketRegistryError::DescriptionTooLong);

        require!(self.category.len()<=MAX_CATEGORY_LENGTH,MarketRegistryError::CategoryTooLong);
        require!(self.resolution_source.len() <= MAX_RESOLUTION_SOURCE_LENGTH,MarketRegistryError::ResolutionSourceTooLong);
        
        // 
        require!(self.expire_at>current_timestamp,MarketRegistryError::InvalidExpiryTimestamp);

        let duration = self.expire_at.checked_sub(current_timestamp).ok_or(MarketRegistryError::ArithmeticOverflow)?;
        require!(duration >= MIN_EXPIRY_DURATION,MarketRegistryError::ExpiryTooShort);

        require!(
            duration <= MAX_EXPIRY_DURATION,MarketRegistryError::ExpiryTooLong
        );

        Ok(())
    }
}
#[derive(AnchorSerialize,AnchorDeserialize,Clone)]
pub struct  UpdateMarketMetaDataParams{
    pub description : Option<String>,
    pub category : Option<String>
}

impl UpdateMarketMetaDataParams{
    pub fn validate(&self)->Result<()>{
        if let Some(desc) = &self.description{
            require!(desc.len()<= MAX_DESCRIPTION_LENGTH,MarketRegistryError::DescriptionTooLong)
        }

        if  let Some(cat) = &self.category{
            require!(cat.len()<= MAX_CATEGORY_LENGTH,MarketRegistryError::CategoryTooLong)
        }
        Ok(())
    }
}

#[account]
pub struct AdminAuthority {
    /// Current admin public key
    pub admin: Pubkey,
    
    /// PDA bump
    pub bump: u8,
}

impl AdminAuthority {
    pub const LEN: usize = 8 + // discriminator
        32 + // admin
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum  ResultOutcome {
    Yes,
    No,
    Invalid
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum MarketState{
    Open,
    Close,
    Created,
    Resolved,
    Resolving,
    Paused
}