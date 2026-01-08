use anchor_lang::prelude::*;
use market_registry::cpi::accounts::AssertMarketResolved;
use market_registry::program::MarketRegistry;

use crate::{constants::VAULT_SEED, error::EscrowVaultError, events::SettlementInitialized, state::EscrowVault
};

#[derive(Accounts)]
pub struct Settle<'info>{
    #[account(mut)]
    pub authority  : Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED,vault.market.as_ref()],
        bump = vault.bump
    )]
    pub vault : Account<'info,EscrowVault>,

    #[account(
        constraint = market.key() == vault.market @ EscrowVaultError::MarketRegistryMismatch
    )]
    pub market: UncheckedAccount<'info>,

    pub market_registry_program: Program<'info, MarketRegistry>,
}


pub fn handler(ctx:Context<Settle>)->Result<()>{
    let vault_key = ctx.accounts.vault.key();
    let vault  = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    // if vault is already settel then cant proceed from this 
    require!(!vault.is_settled,EscrowVaultError::AlreadySettled);

    let cpi_ctx = CpiContext::new(ctx.accounts.market_registry_program.to_account_info(),
     AssertMarketResolved{
        market:ctx.accounts.market.to_account_info()
     },
    );

    market_registry::cpi::assert_market_resolved(cpi_ctx)?;


    vault.is_settled = true;

    msg!("Settlement initiated for vault: {}", vault_key);
    msg!("Total collateral available: {} USDC", 
        vault.total_locked_collateral as f64 / crate::constants::USDC_UNIT as f64);
    msg!("Total YES tokens: {}", vault.total_yes_minted);
    msg!("Total NO tokens: {}", vault.total_no_minted);

    // Emit event
    emit!(SettlementInitialized {
        vault: vault_key,
        market: vault.market,
        total_collateral: vault.total_locked_collateral,
        timestamp: clock.unix_timestamp,
    });
    Ok(())
}
