use anchor_lang::prelude::*;

use crate::{constants::VAULT_SEED, error::EscrowVaultError, events::{ MintingResumed }, state::EscrowVault
};

#[derive(Accounts)]

pub struct ResumeMinting<'info> {
    #[account(mut)]
    pub admin : Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED,vault.market.as_ref()],
        bump = vault.bump,
        constraint = vault.admin == admin.key() @ EscrowVaultError::Unauthorized,
    )]
    pub vault : Account<'info,EscrowVault>


}

pub fn handler(ctx:Context<ResumeMinting>)->Result<()>{
    let vault_key = ctx.accounts.vault.key();
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;
    require!(vault.is_minting_paused,EscrowVaultError::MintingNotPaused);

    require!(!vault.is_settled,EscrowVaultError::AlreadySettled);
    
    
    vault.is_minting_paused = false;

    msg!("Minting Resumed for vault: {}", vault_key);

    // Emit event
    emit!(MintingResumed {
        vault: vault_key,
        market: vault.market,
        timestamp: clock.unix_timestamp,
    });
    Ok(())
}