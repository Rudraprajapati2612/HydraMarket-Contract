use anchor_lang::prelude::*;

use crate::{Market, MarketRegistryError, MarketState, MarketStateChanged, constants::MARKET_SEED};

#[derive(Accounts)]

pub struct ResolvingMarket<'info>{
    #[account(mut)]
    pub admin : Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED,market.market_id.as_ref()],
        bump = market.bump,
        constraint = market.creator == admin.key()  @ MarketRegistryError::Unauthorized
    )]
    pub market : Account<'info,Market>
}

pub fn handler(ctx:Context<ResolvingMarket>)->Result<()>{
    let market_address = ctx.accounts.market.key();
    let market = &mut ctx.accounts.market;
    let clock = Clock::get()?;
    require!(market.state == MarketState::Open,MarketRegistryError::InvalidMarketState);

    let old_state = market.state;

    market.state = MarketState::Resolving;

    msg!("Market Resolving: {:?}", market.market_id);
    msg!("State: {:?} -> {:?}", old_state, market.state);

    emit!(MarketStateChanged{
        market_id: market.market_id,
        market_address: market_address,
        old_state,
        new_state: market.state,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}