

use anchor_lang::prelude::*;

use crate::{constants::MARKET_SEED, error::MarketRegistryError, event::MarketCancelled, state::{Market,MarketState}
};

#[derive(Accounts)]

pub struct PauseMarket<'info>{
    #[account(mut)]
    pub admin : Signer<'info>,

    #[account(
        mut ,
        seeds = [MARKET_SEED,market.market_id.as_ref()],
        bump = market.bump,
        constraint = market.creator == admin.key() @ MarketRegistryError::Unauthorized
    )]
    pub market  : Account<'info,Market>
}


pub fn handler(ctx:Context<PauseMarket>)->Result<()>{
    let market_address = ctx.accounts.market.key();
    let market = &mut ctx.accounts.market;

    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;

    require!(market.state == MarketState::Open,MarketRegistryError::InvalidMarketState);

    let old_state = market.state;
    market.state = MarketState::Paused;

    msg!("Market paused: {:?}", market.market_id);
    msg!("State: {:?} -> {:?}", old_state, market.state);

    emit!(MarketCancelled{
        market_id : market.market_id,
        market_address : market_address,
        cancelled_at : current_timestamp
    });
    Ok(())
}