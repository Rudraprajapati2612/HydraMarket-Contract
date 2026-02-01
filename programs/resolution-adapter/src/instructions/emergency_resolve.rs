
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use market_registry::{
    cpi::accounts::EmergencyFinalizeMarket,
    program::MarketRegistry,
    ResultOutcome,
};
use crate::{
    constants::RESOLUTION_SEED,
    error::ResolutionError,
    events::EmergencyResolution,
    state::ResolutionProposal,
};

/// Emergency resolution - Admin override for critical situations
#[derive(Accounts)]
pub struct EmergencyResolve<'info> {
    /// Admin/multi-sig authority
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Market account (from MarketRegistry)
    /// CHECK: Validated via CPI - NOT mut here, market_registry handles it
    pub market: UncheckedAccount<'info>,

    /// Market Registry program
    pub market_registry_program: Program<'info, MarketRegistry>,

    /// Resolution proposal PDA
    #[account(
        mut,
        seeds = [RESOLUTION_SEED, market.key().as_ref()],
        bump = resolution_proposal.bump
    )]
    pub resolution_proposal: Account<'info, ResolutionProposal>,

    /// Bond vault (holds all bonds)
    #[account(
        mut,
        constraint = bond_vault.key() == resolution_proposal.bond_vault @ ResolutionError::BondVaultMismatch
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<EmergencyResolve>,
    forced_outcome: ResultOutcome,
    reason: String,
) -> Result<()> {
    let resolution = &mut ctx.accounts.resolution_proposal;
    let clock = Clock::get()?;

    msg!("⚠️⚠️⚠️ EMERGENCY RESOLUTION TRIGGERED ⚠️⚠️⚠️");
    msg!("Market: {}", resolution.market);
    msg!("Admin: {}", ctx.accounts.admin.key());
    msg!("Forced outcome: {:?}", forced_outcome);
    msg!("Reason: {}", reason);
    msg!("Timestamp: {}", clock.unix_timestamp);

    // Validate reason
    require!(
        !reason.is_empty() && reason.len() <= 200,
        ResolutionError::InvalidOutcome
    );

    let refunded_amount = ctx.accounts.bond_vault.amount;

    if refunded_amount > 0 {
        msg!("Bond vault balance: {} USDC", refunded_amount as f64 / 1_000_000.0);
        msg!("⚠️ NOTE: Bonds remain in vault for manual distribution");
        msg!("Admin must manually refund participants");
    } else {
        msg!("No bonds to refund (vault empty)");
    }

    // Finalize market via CPI using emergency instruction
    msg!("Calling emergency_finalize_market on MarketRegistry...");
    
    let cpi_ctx = CpiContext::new(
        ctx.accounts.market_registry_program.to_account_info(),
        EmergencyFinalizeMarket {
            admin: ctx.accounts.admin.to_account_info(),
            market: ctx.accounts.market.to_account_info(),
        },
    );
    
    market_registry::cpi::emergency_finalize_market(
        cpi_ctx,
        forced_outcome,
        reason.clone()
    )?;
    
    msg!("Market finalized via emergency procedure: ✅");

    // Mark resolution as finalized
    resolution.is_finalized = true;
    resolution.is_emergency_resolved = true;

    msg!("Resolution marked as emergency finalized: ✅");

    // Emit emergency resolution event
    emit!(EmergencyResolution {
        market: resolution.market,
        admin: ctx.accounts.admin.key(),
        outcome: forced_outcome,
        reason,
        refunded_amount,
        timestamp: clock.unix_timestamp,
    });

    msg!("Event emitted: ✅");
    msg!("⚠️ EMERGENCY RESOLUTION COMPLETE ⚠️");

    Ok(())
}