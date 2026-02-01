// File: programs/market-registry/src/instructions/emergency_finalize_market.rs

use anchor_lang::prelude::*;

use crate::{MARKET_SEED, Market, MarketRegistryError, MarketResolved, MarketState, ResultOutcome};



#[derive(Accounts)]
pub struct EmergencyFinalizeMarket<'info> {
    /// Admin authority - the one who created the market or protocol admin
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// Market to finalize
    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.as_ref()],
        bump = market.bump,
        constraint = market.creator == admin.key() @ MarketRegistryError::Unauthorized
    )]
    pub market: Account<'info, Market>
}

pub fn handler(
    ctx: Context<EmergencyFinalizeMarket>,
    outcome: ResultOutcome,
    reason: String
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;

    msg!("⚠️⚠️⚠️ EMERGENCY MARKET FINALIZATION ⚠️⚠️⚠️");
    msg!("Market: {:?}", market.market_id);
    msg!("Admin: {}", ctx.accounts.admin.key());
    msg!("Forced outcome: {:?}", outcome);
    msg!("Reason: {}", reason);
    msg!("Timestamp: {}", current_timestamp);

    // Validate reason
    require!(
        !reason.is_empty() && reason.len() <= 200,
        MarketRegistryError::InvalidInput
    );

    // Check market is not already resolved
    require!(
        !market.is_resolved(),
        MarketRegistryError::MarketAlreadyResolved
    );

    // Emergency override - skip normal validation
    // (no expiry check, no resolution window check, no state check)
    msg!("⚠️ Bypassing normal resolution checks (emergency mode)");

    // Set outcome and mark as resolved
    market.resolution_outcome = Some(outcome);
    market.resolved_at = Some(current_timestamp);
    market.state = MarketState::Resolved;

    msg!("✅ Market finalized via emergency procedure");
    msg!("   Outcome: {:?}", outcome);
    msg!("   Resolved at: {}", current_timestamp);

    // Emit event
    emit!(MarketResolved {
        market_id: market.market_id,
        market_address: ctx.accounts.market.key(),
        market_outcome: outcome,
        resolved_at: current_timestamp,
    });

    Ok(())
}