use anchor_lang::prelude::*;

use crate::{Market, MarketState,
    error::MarketRegistryError
};


#[derive(Accounts)]
pub struct AssertMarketOpen<'info>{
    pub market : Account<'info,Market>
}

pub fn handler(ctx:Context<AssertMarketOpen>) ->Result<()>{
    let market = &mut ctx.accounts.market;

    require!(market.state == MarketState::Open,MarketRegistryError::MarketNotOpen);
    Ok(())
}