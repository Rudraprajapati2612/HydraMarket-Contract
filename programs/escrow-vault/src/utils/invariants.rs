use anchor_lang::prelude::*;

use crate::{error::EscrowVaultError, state::EscrowVault};


pub fn verify_vault_invariant(vault : &EscrowVault) -> Result<()>{
    // in verify invariant function 
    // 1st it checks total amount of yes token == total amount of no token minted
    // 2) calculate collateral amount paid by the users 
    // 3) check total locked collateral is equal to expected collateral
    vault.verify_invariant()
}

pub fn log_vault_state(vault:&EscrowVault, operation : &str){
    msg!("=== Vault State After: {} ===", operation);
    msg!("Total YES minted: {}", vault.total_yes_minted);
    msg!("Total NO minted: {}", vault.total_no_minted);
    msg!("Total locked collateral: {} USDC", 
        vault.total_locked_collateral as f64 / 1_000_000.0);
    msg!("Is settled: {}", vault.is_settled);
    msg!("Is minting paused: {}", vault.is_minting_paused);
    msg!("=================================");
}


pub fn verify_collateral_recived(
    vault_balance_before:u64,
    vault_balance_after : u64,
    expected_increase:u64
)->Result<()>{
    let actual_increase = vault_balance_after.checked_sub(vault_balance_before).ok_or(EscrowVaultError::ArithmeticUnderflow)?;
    require!(actual_increase == expected_increase,EscrowVaultError::CollateralNotReceived);
    require!(
        vault_balance_after >= vault_balance_before,
        EscrowVaultError::InvalidVaultState
    );

    msg!("Collateral verified:");
    msg!("  Before: {}", vault_balance_before);
    msg!("  After: {}", vault_balance_after);
    msg!("  Increase: {} (expected: {})", actual_increase, expected_increase);

    Ok(())
}