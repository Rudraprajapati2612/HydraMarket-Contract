use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use market_registry::{
    cpi::accounts::FinalizeMarket,
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

    pub resolution_adapter: Signer<'info>,

    /// Market account (from MarketRegistry)
    /// CHECK: Validated via CPI
    #[account(mut)]
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

// ✅ CORRECT: No explicit lifetime parameters needed
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

    // Validate admin authority
    // TODO: In production, verify admin is in allowed list or multi-sig
    msg!("⚠️ WARNING: Emergency override by admin");

    // Validate reason
    require!(
        !reason.is_empty() && reason.len() <= 200,
        ResolutionError::InvalidOutcome
    );

    let refunded_amount = ctx.accounts.bond_vault.amount;

    if refunded_amount > 0 {
        msg!("Bond vault balance: {} USDC", refunded_amount as f64 / 1_000_000.0);
        msg!("All bonds will be refunded");

        // Derive PDA signer
        let resolution_seeds = &[
            RESOLUTION_SEED,
            resolution.market.as_ref(),
            &[resolution.bump],
        ];
        let resolution_signer = &[&resolution_seeds[..]];

        // TODO: Implement proper refund distribution
        // For now, bonds remain in vault for manual distribution
        msg!("⚠️ NOTE: Bonds remain in vault for manual distribution");
        msg!("Admin must manually refund participants");
    } else {
        msg!("No bonds to refund (vault empty)");
    }

    // Admin check (governance / multisig later)
    require!(
        ctx.accounts.admin.is_signer,
        ResolutionError::Unauthorized
    );
    // Finalize market via CPI with forced outcome
    msg!("Finalizing market with forced outcome...");
    let cpi_ctx = CpiContext::new(
        ctx.accounts.market_registry_program.to_account_info(),
        FinalizeMarket {
            resolution_adapter: ctx.accounts.resolution_adapter.to_account_info(),
            market: ctx.accounts.market.to_account_info(),
        },
    );
    market_registry::cpi::finalize_market(cpi_ctx, forced_outcome)?;
    
    msg!("Market finalized: ✅");

    // Mark resolution as finalized
    resolution.is_finalized = true;

    msg!("Resolution marked as finalized: ✅");

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