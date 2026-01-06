
use anchor_lang::prelude::*;

use crate::{constants::MARKET_SEED, error::MarketRegistryError, event::MarketCancelled, state::{Market, MarketState, ResultOutcome}};
#[derive(Accounts)]

pub struct  CancelMarket<'info>{
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


pub fn handler(ctx :Context<CancelMarket>)->Result<()>{
    let market_address = ctx.accounts.market.key();
    let market = &mut ctx.accounts.market;
    let clock = Clock::get()?;

    let current_timestamp = clock.unix_timestamp;

    // market cannot cancle if already resolved 

    require!(!market.is_resolved(),MarketRegistryError::MarketAlreadyResolved);
    // set the resolution outcome to invalid 
    // and update the market resolve time 
    // and update the state from current state to Resolved
    market.resolution_outcome = Some(ResultOutcome::Invalid);
    market.resolved_at  = Some(current_timestamp);
    market.state = MarketState::Resolved;

    msg!("Market cancelled: {:?}", market.market_id);
    msg!("All users will receive full refunds");

    emit!(MarketCancelled{
        market_id : market.market_id,
        market_address : market_address,
        cancelled_at : current_timestamp
    });

    Ok(())
}