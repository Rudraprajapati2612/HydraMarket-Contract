use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use market_registry::ResultOutcome;

use crate::{constants::{DISPUTE_EXTENSION_SECONDS, RESOLUTION_SEED}, error::ResolutionError, events::ProposalDispute, state::{BondContributor, DisputeProposal as DisputeData, ResolutionProposal}};

#[derive(Accounts)]
pub struct  DisputeProposal<'info>{
    #[account(mut)]
    pub disputer : Signer<'info>,

    #[account(
        mut,
        seeds = [RESOLUTION_SEED, resolution_proposal.market.as_ref()],
        bump = resolution_proposal.bump,
        constraint = !resolution_proposal.is_finalized @ ResolutionError::AlreadyFinalized
    )]
    pub resolution_proposal : Account<'info,ResolutionProposal>,

    #[account(
        mut,
        constraint = bond_vault.key() == resolution_proposal.bond_vault @ ResolutionError::BondVaultMismatch
    )]
    pub bond_vault : Account<'info,TokenAccount>,

    #[account(
        mut,
        constraint = dispute_bonder_account.mint == bond_vault.mint,
        constraint = dispute_bonder_account.owner == disputer.key()
    )]
    pub dispute_bonder_account : Account<'info,TokenAccount>,

    pub token_program : Program<'info,Token>
}


pub fn handler(
    ctx:Context<DisputeProposal>,
    counter_outcome : ResultOutcome,
    reason : String,
    bond_amount : u64
) -> Result<()>{
    let resolution = &mut ctx.accounts.resolution_proposal;  
    let clock = Clock::get()?;

    msg!(" DISPUTE INITIATED ");
    msg!("Market: {}", resolution.market);
    msg!("Original proposer: {}", resolution.proposer);
    msg!("Disputer: {}", ctx.accounts.disputer.key());
    msg!("Original outcome: {:?}", resolution.proposed_outcome);
    msg!("Counter outcome: {:?}", counter_outcome);

    require!(resolution.is_dispute_window_open(clock.unix_timestamp),ResolutionError::DisputeWindowClosed);

    msg!("Current time: {}", clock.unix_timestamp);
    msg!("Dispute deadline: {}", resolution.dispute_deadline);
    msg!("Time remaining: {} seconds", 
        resolution.dispute_deadline - clock.unix_timestamp);

    // Cannot dispute own proposal 

    require!(ctx.accounts.disputer.key() != resolution.proposer,ResolutionError::CannotDisputeOwnProposal);
    
    // Bond amount must be greater that original amoutn 
    require!(
        bond_amount >= resolution.bond_amount,
        ResolutionError::InsufficientDisputeBond
    );
    msg!("Dispute bond: {} USDC", bond_amount as f64 / 1_000_000.0);
    msg!("Original bond: {} USDC", resolution.bond_amount as f64 / 1_000_000.0);

    // Check Valid Reason means check its length 

    require!(!reason.is_empty() && reason.len() <= 100, ResolutionError::InvalidOutcome);

    // Transfer Bond To Vault

    let transfer_account = Transfer{
        from : ctx.accounts.dispute_bonder_account.to_account_info(),
        to  : ctx.accounts.bond_vault.to_account_info(),
        authority : ctx.accounts.disputer.to_account_info()
    };

    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_account);

    token::transfer(cpi_ctx, bond_amount)?;
    
    msg!("Dispute bond locked successfully");

    resolution.bond_contributors.push(BondContributor{
        participant : ctx.accounts.disputer.key(),
        amount : bond_amount
    });

    // Extend dispute window by 24 hours
    let new_deadline = clock
        .unix_timestamp
        .checked_add(DISPUTE_EXTENSION_SECONDS)
        .ok_or(ResolutionError::ArithmeticOverflow)?;

    resolution.dispute_deadline = new_deadline;

    msg!("Dispute window extended");
    msg!("New deadline: {}", new_deadline);
    msg!("Extension: {} hours", DISPUTE_EXTENSION_SECONDS / 3600);

    // Create Dispute Record

    let dispute = DisputeData{
        disputer : ctx.accounts.disputer.key(),
        counter_outcome,
        bond_amount,
        reason : reason.clone(),
        timestamp : clock.unix_timestamp
    };

    resolution.add_dispute(dispute)?;

    msg!("Dispute recorded");
    msg!("Total disputes: {}", resolution.disputes.len());

    // Emit dispute event
    emit!(ProposalDispute {
        market: resolution.market,
        proposer: resolution.proposer,
        disputer: ctx.accounts.disputer.key(),
        counter_outcome,
        bond_amount,
        reason,
        new_deadline,
        timestamp: clock.unix_timestamp,
    });

    msg!("Dispute successful");
    Ok(())
}