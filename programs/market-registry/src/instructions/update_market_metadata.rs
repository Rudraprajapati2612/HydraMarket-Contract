

use anchor_lang::prelude::*;

use crate::{Market, MarketMetaDataUpdated, MarketRegistryError, MarketState, UpdateMarketMetaDataParams, constants::MARKET_SEED
    };
#[derive(Accounts)]

pub struct UpdateMarketMetadata<'info>{
    #[account(mut)]
    pub admin : Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED,market.market_id.as_ref()],
        bump = market.bump,
        constraint = market.creator == admin.key() @ MarketRegistryError::Unauthorized
    )]

    pub market : Account<'info,Market>
}


pub fn handler(ctx:Context<UpdateMarketMetadata>,params:UpdateMarketMetaDataParams)->Result<()>{
    let market_address = ctx.accounts.market.key();
    let market = &mut ctx.accounts.market;

    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;


    require!(market.state == MarketState::Created,MarketRegistryError::InvalidMarketState);
    

    params.validate()?;

    let mut update_description = None;
    let mut update_category = None;

    if let Some(category) = params.category.clone() {
        market.category = category.clone();
        update_category = Some(category);
        msg!("Updated category");
    }

    if let Some(description) = params.description.clone(){
        market.description = description.clone();
        update_description = Some(description);
        msg!("Update Description");
    }


    msg!("Market metadata updated: {:?}", market.market_id);

    // Emit event
    emit!(MarketMetaDataUpdated {
        market_id: market.market_id,
        market_address: market_address,
        description: update_description,
        category: update_category,
        timestamp: current_timestamp,
    });
    Ok(())
}