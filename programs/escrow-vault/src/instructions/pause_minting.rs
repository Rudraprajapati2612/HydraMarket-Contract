use anchor_lang::prelude::*;

use crate::{constants::VAULT_SEED, error::EscrowVaultError, events::{MintingPaused, VaultInitialized}, state::EscrowVault
};

#[derive(Accounts)]

pub struct PauseMinting<'info> {
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

pub fn handler(ctx:Context<PauseMinting>)->Result<()>{
    let vault_key = ctx.accounts.vault.key();
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;
    require!(!vault.is_minting_paused,EscrowVaultError::MintingPaused);
    vault.is_minting_paused = true;

    msg!("Minting paused for vault: {}", vault_key);

    // Emit event
    emit!(MintingPaused {
        vault: vault_key,
        market: vault.market,
        timestamp: clock.unix_timestamp,
    });
    Ok(())
}