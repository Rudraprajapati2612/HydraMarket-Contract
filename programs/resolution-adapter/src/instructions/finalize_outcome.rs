
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use market_registry::{ResultOutcome, program::MarketRegistry,cpi::accounts::FinalizeMarket,};

use crate::{constants::{ORACLE_REWARD, RESOLUTION_SEED}, error::ResolutionError, events::OutcomeFinalized, state::ResolutionProposal};

#[derive(Accounts)]

pub struct FinalizeOutcome<'info>{
    
    #[account(mut)]
    pub authority : Signer<'info>,

    #[account(mut)]
    /// CHECK : validate via CPI
    pub market : UncheckedAccount<'info>,

    
    pub market_registery_program : Program<'info,MarketRegistry>,

    #[account(
        mut,
        seeds = [RESOLUTION_SEED, market.key().as_ref()],
        bump = resolution_proposal.bump,
        constraint = !resolution_proposal.is_finalized @ ResolutionError::AlreadyFinalized
    )]
    pub resolution_proposal : Account<'info,ResolutionProposal>,

    #[account(
        mut,
        constraint = bond_vault.key() == resolution_proposal.bond_vault @ ResolutionError::BondVaultMismatch
    )]
    pub bond_vault : Account<'info,TokenAccount>,

     /// Winner's USDC account (receives bond + reward)
     #[account(mut)]
     pub winner_account: Account<'info, TokenAccount>,
 
     /// Protocol treasury (source of rewards)
     #[account(mut)]
     pub protocol_treasury: Account<'info, TokenAccount>,
 
     pub token_program: Program<'info, Token>,
}

pub fn handler(ctx:Context<FinalizeOutcome>,final_outcome : ResultOutcome)->Result<()>{
    let resolution = &mut ctx.accounts.resolution_proposal;
    let clock = Clock::get()?;

    msg!("🏁 FINALIZING MARKET RESOLUTION 🏁");
    msg!("Market: {}", resolution.market);
    msg!("Final outcome: {:?}", final_outcome);

    require!(
        resolution.is_dispute_window_closed(clock.unix_timestamp),ResolutionError::DisputeWindowOpen
    );

    msg!("Current time: {}", clock.unix_timestamp);
    msg!("Dispute deadline: {}", resolution.dispute_deadline);
    msg!("Dispute window closed:");

    let winning_proposer : Pubkey;
    let slashed_amount : u64;

    if !resolution.is_disputed {
         // NO DISPUTE: Accept original proposal
         msg!("No disputes received");
         msg!("Accepting original proposal");

         winning_proposer = resolution.proposer; 
        slashed_amount = 0;

        msg!("Winner: {}", winning_proposer);
    }else {
        // DISPUTED: Determine winner based on final outcome
        msg!("Market was disputed");
        msg!("Total disputes: {}", resolution.disputes.len());
        msg!("Determining winner...");
        
        if Some(final_outcome) == resolution.proposed_outcome {
            winning_proposer = resolution.proposer;
            msg!("Original proposer was correct");
            msg!("Winner: {}", winning_proposer);

            slashed_amount = resolution.disputes.iter().map(|d|d.bond_amount).sum();
            
            msg!("Slashing {} disputer bonds", resolution.disputes.len());
            msg!("Slashed amount: {} USDC", slashed_amount as f64 / 1_000_000.0);
        }else {
            // Disputer is correct 

            let winning_dispute = resolution.disputes.iter().find(|d|d.counter_outcome == final_outcome).ok_or(ResolutionError::InvalidOutcome)?;

            winning_proposer = winning_dispute.disputer ;

            msg!("Disputer was correct");
            msg!("Winner: {}", winning_proposer);

            slashed_amount = resolution.bond_amount + 
                             resolution.disputes.iter()
                             .filter(|d| d.counter_outcome!=final_outcome)
                             .map(|d|d.bond_amount)
                             .sum::<u64>();

        msg!("Slashing original proposer + {} wrong disputers", 
        resolution.disputes.iter().filter(|d| d.counter_outcome != final_outcome).count());
        msg!("Slashed amount: {} USDC", slashed_amount as f64 / 1_000_000.0);
        }
    }

    // calculate total vault payout 
    let bond_vault_balance = ctx.accounts.bond_vault.amount;

    let total_payout = bond_vault_balance.checked_add(ORACLE_REWARD).ok_or(ResolutionError::ArithmeticOverflow)?;

    msg!("Payout calculation:");
    msg!("  Bond vault balance: {} USDC", bond_vault_balance as f64 / 1_000_000.0);
    msg!("  Oracle reward: {} USDC", ORACLE_REWARD as f64 / 1_000_000.0);
    msg!("  Total payout: {} USDC", total_payout as f64 / 1_000_000.0);

    let resolution_seeds = &[
        RESOLUTION_SEED,
        resolution.market.as_ref(),
        &[resolution.bump],
    ];
    let resolution_signer = &[&resolution_seeds[..]];

      // Transfer entire bond vault balance to winner
      msg!("Transferring bonds to winner...");
      let bond_transfer_ctx = CpiContext::new_with_signer(
          ctx.accounts.token_program.to_account_info(),
          Transfer {
              from: ctx.accounts.bond_vault.to_account_info(),
              to: ctx.accounts.winner_account.to_account_info(),
              authority: resolution.to_account_info(),
          },
          resolution_signer,
      );
      token::transfer(bond_transfer_ctx, bond_vault_balance)?;

          // Transfer reward from protocol treasury
    msg!("Transferring oracle reward...");
    let reward_transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.protocol_treasury.to_account_info(),
            to: ctx.accounts.winner_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        },
    );
    token::transfer(reward_transfer_ctx, ORACLE_REWARD)?;

    msg!("Reward transferred: ✅");

        // Finalize market in MarketRegistry via CPI
        msg!("Finalizing market in MarketRegistry...");
        
        let fin_mkt = FinalizeMarket{
            resolution_adapter : ctx.accounts.authority.to_account_info(),
            market:ctx.accounts.market.to_account_info()
        };

        let cpi_ctx = CpiContext::new(ctx.accounts.market_registery_program.to_account_info(), fin_mkt);

        market_registry::cpi::finalize_market(cpi_ctx, final_outcome)?;
        msg!("Market finalized in MarketRegistry: ✅");

    // Mark resolution as finalized
    resolution.is_finalized = true;

    msg!("Resolution marked as finalized: ✅");

    // Emit finalization event
    emit!(OutcomeFinalized {
        market: resolution.market,
        outcome: final_outcome,
        winning_proposer,
        was_disputed: resolution.is_disputed,
        slashed_amount,
        reward_amount: ORACLE_REWARD,
        timestamp: clock.unix_timestamp,
    });

    msg!("🎉 FINALIZATION COMPLETE 🎉");
    msg!("Final outcome: {:?}", final_outcome);
    msg!("Winner: {}", winning_proposer);
    msg!("Total earned: {} USDC", total_payout as f64 / 1_000_000.0);
    Ok(())
}