// programs/escrow-vault/src/errors.rs

use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowVaultError {
    #[msg("Unauthorized: Only admin can perform this action")]
    Unauthorized,

    #[msg("Market is not in OPEN state")]
    MarketNotOpen,

    #[msg("Market has not been resolved yet")]
    MarketNotResolved,

    #[msg("Market has already been settled")]
    AlreadySettled,

    #[msg("Vault has not been settled yet")]
    NotSettled,

    #[msg("Insufficient collateral provided")]
    InsufficientCollateral,

    #[msg("Collateral verification failed - vault balance did not increase")]
    CollateralNotReceived,

    #[msg("Invalid number of pairs (must be > 0)")]
    InvalidPairCount,

    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,

    #[msg("Arithmetic underflow occurred")]
    ArithmeticUnderflow,

    #[msg("CRITICAL: Invariant violation - YES supply != NO supply")]
    InvariantViolationSupplyMismatch,

    #[msg("CRITICAL: Invariant violation - Supply != Collateral")]
    InvariantViolationCollateralMismatch,

    #[msg("Invalid market outcome")]
    InvalidOutcome,

    #[msg("User has no tokens to claim")]
    NoTokensToClaim,

    #[msg("Invalid recipient token account")]
    InvalidRecipientAccount,

    #[msg("Payout calculation failed")]
    PayoutCalculationFailed,

    #[msg("Token burn failed")]
    TokenBurnFailed,

    #[msg("Token transfer failed")]
    TokenTransferFailed,

    #[msg("Minting is currently paused")]
    MintingPaused,

    #[msg("Minting is not paused")]
    MintingNotPaused,

    #[msg("Batch size exceeds maximum")]
    BatchSizeExceeded,

    #[msg("Invalid vault authority")]
    InvalidVaultAuthority,

    #[msg("Market registry mismatch")]
    MarketRegistryMismatch,

    #[msg("Token mint mismatch")]
    TokenMintMismatch,

    #[msg("USDC vault mismatch")]
    UsdcVaultMismatch,
}