use anchor_lang::prelude::*;

use crate::{constants::MARKET_SEED, error::MarketRegistryError, event::MarketResolved, state::{Market,MarketState, ResultOutcome}
};

#[derive(Accounts)]

pub struct FinalizeMarket<'info>{
    #[account(mut)]
    pub resolution_adapter : Signer<'info>,
    #[account(
        mut,
        seeds = [MARKET_SEED,market.market_id.as_ref()],
        bump = market.bump,
        constraint = market.resolution_adapter == resolution_adapter.key() @ MarketRegistryError::InvalidResolutionAdapter
    )]
    pub market : Account<'info,Market>
}


pub fn handler(ctx:Context<FinalizeMarket>,outcome:ResultOutcome)->Result<()>{
    let market_address = ctx.accounts.market.key();

    let market = &mut ctx.accounts.market;
    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;

    // check 3 important condition 
    // 1) market state is reolving and market is expired
    // 2) market is not resolved 
    // 3) amrket is in resolution phase 
    require!(market.state == MarketState::Resolving || market.is_experied(current_timestamp)
        ,MarketRegistryError::InvalidMarketState);

    require!(!market.is_resolved(),MarketRegistryError::MarketAlreadyResolved);
    require!(market.in_resolution_window(current_timestamp),MarketRegistryError::ResolutionWindowClosed);
    // 1)set market Outcome
    // 2) Update makrket resolution time 
    // 3)change market state
    
    market.resolution_outcome = Some(outcome);
    market.resolved_at = Some(current_timestamp);
    market.state = MarketState::Resolved;
    
    msg!("Market finalized: {:?}", market.market_id);
    msg!("Outcome: {:?}", outcome);
    msg!("Resolved at: {}", current_timestamp);
    // Emit event
    emit!(MarketResolved {
        market_id: market.market_id,
        market_address: market_address,
        market_outcome : outcome,
        resolved_at: current_timestamp,
    });
    Ok(())
}