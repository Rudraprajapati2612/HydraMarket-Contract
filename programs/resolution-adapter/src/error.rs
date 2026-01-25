use anchor_lang::prelude::*;

#[error_code]
pub enum ResolutionError {
    #[msg("Market has not expired yet")]
    MarketNotExpired,

    #[msg("Market is not in OPEN state")]
    MarketNotOpen,

    #[msg("Proposal bond is below minimum required")]
    InsufficientBond,

    #[msg("Dispute window has not closed yet")]
    DisputeWindowOpen,

    #[msg("Dispute window has already closed")]
    DisputeWindowClosed,

    #[msg("Resolution proposal already exists")]
    ProposalAlreadyExists,

    #[msg("No active proposal found")]
    NoActiveProposal,

    #[msg("Already finalized")]
    AlreadyFinalized,

    #[msg("Caller is not authorized")]
    Unauthorized,

    #[msg("Invalid outcome provided")]
    InvalidOutcome,

    #[msg("Too many data sources (max 5)")]
    TooManyDataSources,

    #[msg("No data sources provided")]
    NoDataSources,

    #[msg("Oracle data is too stale")]
    StaleOracleData,

    #[msg("Price feeds do not agree (deviation too high)")]
    PriceDeviationTooHigh,

    #[msg("Pyth price confidence too low")]
    LowPriceConfidence,

    #[msg("Invalid Pyth price account")]
    InvalidPythAccount,

    #[msg("Invalid Switchboard aggregator")]
    InvalidSwitchboardAccount,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Arithmetic underflow")]
    ArithmeticUnderflow,

    #[msg("Invalid market category for this oracle type")]
    InvalidMarketCategory,

    #[msg("Price condition not met")]
    PriceConditionNotMet,

    #[msg("Event outcome does not match any valid option")]
    InvalidEventOutcome,

    #[msg("Multiple data sources disagree on outcome")]
    DataSourceDisagreement,

    #[msg("Cannot dispute own proposal")]
    CannotDisputeOwnProposal,

    #[msg("Dispute bond must be equal or greater than original bond")]
    InsufficientDisputeBond,

    #[msg("Maximum disputes reached")]
    MaxDisputesReached,

    #[msg("Invalid timestamp")]
    InvalidTimestamp,

    #[msg("Market registry mismatch")]
    MarketRegistryMismatch,

    #[msg("Bond vault mismatch")]
    BondVaultMismatch,

    #[msg("Invalid account count")]
    InvalidAccountCount,
    
    #[msg("Unauthorized admin")]
    UnauthorizedAdmin,

}