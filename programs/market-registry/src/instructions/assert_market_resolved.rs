use anchor_lang::prelude::*;

use crate::{Market, MarketState,
    error::MarketRegistryError
};


#[derive(Accounts)]
pub struct AssertMarketResolved<'info>{
    pub market : Account<'info,Market>
}

pub fn handler(ctx:Context<AssertMarketResolved>) ->Result<()>{
    let market = &mut ctx.accounts.market;

    require!(market.state == MarketState::Resolved,MarketRegistryError::MarketNotOpen);
    Ok(())
}