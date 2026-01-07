use anchor_lang::prelude::*;

use crate::{
    constants::{COLLATERAL_PER_PAIR, USDC_UNIT},
    error::EscrowVaultError,
};

#[account]

pub struct EscrowVault {
    pub market: Pubkey,
    // for cpi during initilized the vault
    pub mrarket_registery_program: Pubkey,

    pub usdc_vault: Pubkey,

    pub yes_token_mint: Pubkey,

    pub no_token_mint: Pubkey,

    pub total_locked_collateral: u64,

    pub total_yes_minted: u64,

    pub total_no_minted: u64,

    pub is_settled: bool,

    pub is_minting_paused: bool,
    // admin authority for emergency stop
    pub admin: Pubkey,

    pub bump: u8,
}

impl EscrowVault {
    pub const LEN: usize = 8 + // discriminator
        32 + // market
        32 + // market_registry_program
        32 + // usdc_vault
        32 + // yes_token_mint
        32 + // no_token_mint
        8 + // total_locked_collateral
        8 + // total_yes_minted
        8 + // total_no_minted
        1 + // is_settled
        1 + // is_minting_paused
        32 + // admin
        1; // bump
           // Yes == No == Collateral
    pub fn verify_invariant(&self) -> Result<()> {
        require!(
            self.total_no_minted == self.total_no_minted,
            EscrowVaultError::InvariantViolationCollateralMismatch
        );
        let expected_collateral = self
            .total_yes_minted
            .checked_mul(COLLATERAL_PER_PAIR)
            .ok_or(EscrowVaultError::InvariantViolationCollateralMismatch)?;

        require!(
            self.total_locked_collateral == expected_collateral,
            EscrowVaultError::InvariantViolationCollateralMismatch
        );
        Ok(())
    }

    pub fn can_mint(&self) -> bool {
        !self.is_minting_paused && !self.is_settled
    }
    //   if market is settled then ready for claim
    pub fn is_ready_for_claims(&self) -> bool {
        self.is_settled
    }
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]

pub struct PayoutCalculation {
    pub payout_amount: u64,

    pub yes_token_to_burn: u64,

    pub no_token_to_burn: u64,
}

impl PayoutCalculation {
    pub fn for_yes_outcome(yes_balance: u64, no_balance: u64) -> Result<Self> {
        // let total yes balance (yes token) * 1 USDC
        let payout_amount = yes_balance
            .checked_mul(USDC_UNIT)
            .ok_or(EscrowVaultError::ArithmeticOverflow)?;
        // after payout we need to burn that token
        Ok(Self {
            payout_amount,
            yes_token_to_burn: yes_balance,
            no_token_to_burn: no_balance,
        })
    }

    pub fn for_no_outcome(yes_balance: u64, no_balance: u64) -> Result<Self> {
        // let total No balance (no token) * 1 USDC
        let payout_amount = no_balance
            .checked_mul(USDC_UNIT)
            .ok_or(EscrowVaultError::ArithmeticOverflow)?;
        // after payout we need to burn that token
        Ok(Self {
            payout_amount,
            yes_token_to_burn: yes_balance,
            no_token_to_burn: no_balance,
        })
    }

    pub fn for_invalid_outcome(yes_balance: u64, no_balance: u64) -> Result<Self> {
        let yes_payout = yes_balance
            .checked_mul(USDC_UNIT)
            .ok_or(EscrowVaultError::ArithmeticOverflow)?
            .checked_div(2)
            .ok_or(EscrowVaultError::ArithmeticOverflow)?;

        let no_payout = no_balance
            .checked_mul(USDC_UNIT)
            .ok_or(EscrowVaultError::ArithmeticOverflow)?
            .checked_div(2)
            .ok_or(EscrowVaultError::ArithmeticOverflow)?;

        let total_payout = yes_payout
            .checked_add(no_payout)
            .ok_or(EscrowVaultError::ArithmeticOverflow)?;

        Ok(Self {
            payout_amount: total_payout,
            yes_token_to_burn: yes_balance,
            no_token_to_burn: no_balance,
        })
    }
}
