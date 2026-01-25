use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use market_registry::{ResultOutcome, program::MarketRegistry, cpi::accounts::FinalizeMarket,};

use crate::{
    constants::RESOLUTION_SEED, error::ResolutionError, events::EmergencyResolution, state::ResolutionProposal
};

#[derive(Accounts)]
pub struct EmergencyResolve<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: validated via PDA seeds
    #[account(mut)]
    pub market: UncheckedAccount<'info>,

    pub market_registry_program: Program<'info, MarketRegistry>,

    #[account(
        mut,
        seeds = [RESOLUTION_SEED, market.key().as_ref()],
        bump = resolution_proposal.bump
    )]
    pub resolution_proposal: Account<'info, ResolutionProposal>,

    #[account(
        mut,
        constraint = bond_vault.key() == resolution_proposal.bond_vault
            @ ResolutionError::BondVaultMismatch
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// ✅ IMPORTANT: explicit `'info` lifetime is declared HERE
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, EmergencyResolve<'info>>,
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

    require!(
        !reason.is_empty() && reason.len() <= 200,
        ResolutionError::InvalidOutcome
    );

    let refunded_amount = ctx.accounts.bond_vault.amount;

    if refunded_amount > 0 && !resolution.bond_contributers.is_empty() {
        require!(
            ctx.remaining_accounts.len() == resolution.bond_contributers.len(),
            ResolutionError::InvalidAccountCount
        );

        let seeds = &[
            RESOLUTION_SEED,
            resolution.market.as_ref(),
            &[resolution.bump],
        ];
        let signer = &[&seeds[..]];

        for (idx, contributor) in resolution.bond_contributers.iter().enumerate() {
            let recipient = &ctx.remaining_accounts[idx];

            msg!(
                "Refunding {} USDC to {}",
                contributor.amount as f64 / 1_000_000.0,
                contributor.participant
            );

            let cpi_accounts = Transfer {
                from: ctx.accounts.bond_vault.to_account_info(),
                to: recipient.clone(),
                authority: resolution.to_account_info(),
            };

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            );

            token::transfer(cpi_ctx, contributor.amount)?;
        }
    }else {
        msg!("No Bond To Refund")
    }

    msg!("Finalizing market with forced outcome...");
    let cpi_ctx = CpiContext::new(
        ctx.accounts.market_registry_program.to_account_info(),
        FinalizeMarket {
            resolution_adapter: ctx.accounts.admin.to_account_info(),
            market: ctx.accounts.market.to_account_info(),
        },
    );
    market_registry::cpi::finalize_market(cpi_ctx, forced_outcome)?;

    msg!("Market finalized: ✅");

    // ✅ ADD: Mark as finalized
    resolution.is_finalized = true;
    resolution.is_emergency_resolved = true;

    msg!("Resolution marked as finalized: ✅");

    // ✅ ADD: Emit event
    emit!(EmergencyResolution {
        market: resolution.market,
        admin: ctx.accounts.admin.key(),
        outcome: forced_outcome,
        reason,
        redunded_amount: refunded_amount,
        timestamp: clock.unix_timestamp,
    });

    msg!("⚠️ EMERGENCY RESOLUTION COMPLETE ⚠️");
    Ok(())
}
