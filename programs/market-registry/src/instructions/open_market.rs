use anchor_lang::prelude::*;

use crate::{constants::MARKET_SEED, error::MarketRegistryError, event::MarketStateChanged, state::{Market, MarketState}
        };

#[derive(Accounts)]

pub struct OpenMarket<'info>{
    #[account(mut)]
    pub admin  : Signer<'info>,
    #[account(
        mut,
        seeds= [MARKET_SEED,market.market_id.as_ref()],
        bump = market.bump,
        constraint = market.creator == admin.key() @ MarketRegistryError::Unauthorized
    )]
    pub market : Account<'info,Market>,

}

pub fn handler(ctx:Context<OpenMarket>)-> Result<()>{
    let market_address = ctx.accounts.market.key();
    let market = &mut ctx.accounts.market;
    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;

    require!(market.state == MarketState::Created,MarketRegistryError::InvalidMarketState);
    require!(!market.is_experied(current_timestamp),MarketRegistryError::MarketExpired);

    let old_state = market.state;

    market.state = MarketState::Open;

    msg!("Market opened: {:?}", market.market_id);
    msg!("State: {:?} -> {:?}", old_state, market.state);

    emit!(MarketStateChanged{
        market_id : market.market_id,
        market_address : market_address,
        old_state : old_state,
        new_state : market.state,
        timestamp : current_timestamp
    });
    Ok(())
}