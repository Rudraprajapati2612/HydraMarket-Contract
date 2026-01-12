use anchor_lang::prelude::*;

use crate::{Market, MarketState,
    error::MarketRegistryError
};


#[derive(Accounts)]
pub struct AssertMarketExpired<'info>{
    pub market : Account<'info,Market>
}

pub fn handler(ctx:Context<AssertMarketExpired>) ->Result<()>{
    let market = &ctx.accounts.market;
    let clock = Clock::get()?;

    require!(
        clock.unix_timestamp >= market.expire_at,
        MarketRegistryError::MarketNotExpired
    );

    require!(
        market.state == MarketState::Open || market.state == MarketState::Close,
        MarketRegistryError::InvalidMarketState
    );
    Ok(())
}