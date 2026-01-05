
use anchor_lang::prelude::*;

#[error_code]
pub enum MarketRegistryError {
    #[msg("Unauthorized: Only admin can perform this action")]
    Unauthorized,

    #[msg("Invalid market state for this operation")]
    InvalidMarketState,

    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,

    #[msg("Market has not expired yet")]
    MarketNotExpired,

    #[msg("Market has expired")]
    MarketExpired,

    #[msg("Question exceeds maximum length")]
    QuestionTooLong,

    #[msg("Description exceeds maximum length")]
    DescriptionTooLong,

    #[msg("Category exceeds maximum length")]
    CategoryTooLong,

    #[msg("Resolution source exceeds maximum length")]
    ResolutionSourceTooLong,

    #[msg("Invalid expiry timestamp")]
    InvalidExpiryTimestamp,

    #[msg("Expiry duration too short")]
    ExpiryTooShort,

    #[msg("Expiry duration too long")]
    ExpiryTooLong,

    #[msg("Market is currently paused")]
    MarketPaused,

    #[msg("Market is not paused")]
    MarketNotPaused,

    #[msg("Cannot modify market after trading has started")]
    MarketAlreadyOpen,

    #[msg("Resolution window has not opened yet")]
    ResolutionWindowNotOpen,

    #[msg("Resolution window has closed")]
    ResolutionWindowClosed,

    #[msg("Invalid outcome value")]
    InvalidOutcome,

    #[msg("Caller is not the resolution adapter")]
    InvalidResolutionAdapter,

    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,

    #[msg("Market ID mismatch")]
    MarketIdMismatch,

    #[msg("Invalid token mint provided")]
    InvalidTokenMint,

    #[msg("Invalid escrow vault provided")]
    InvalidEscrowVault,
}