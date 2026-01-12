use anchor_lang::prelude::*;

/// Seed for resolution proposal PDA
pub const RESOLUTION_SEED: &[u8] = b"resolution";

/// Seed for oracle bond vault
pub const BOND_VAULT_SEED: &[u8] = b"bond_vault";

/// Minimum bond required to propose outcome (1000 USDC)
pub const MIN_PROPOSAL_BOND: u64 = 1_000 * 1_000_000; // 1000 USDC with 6 decimals

/// Dispute window duration (24 hours)
pub const DISPUTE_WINDOW_SECONDS: i64 = 24 * 60 * 60;

/// Extended dispute window if challenged (additional 24 hours)
pub const DISPUTE_EXTENSION_SECONDS: i64 = 24 * 60 * 60;

/// Maximum number of data sources allowed per proposal
pub const MAX_DATA_SOURCES: usize = 5;

/// Reward for correct oracle proposal (100 USDC)
pub const ORACLE_REWARD: u64 = 100 * 1_000_000;

/// Maximum price deviation allowed between sources (5%)
pub const MAX_PRICE_DEVIATION_BPS: u16 = 500; // 5% in basis points

/// Minimum confidence required for Pyth price feeds (90%)
pub const MIN_PYTH_CONFIDENCE_BPS: u16 = 9000; // 90% in basis points

/// Maximum staleness for oracle data (5 minutes)
pub const MAX_ORACLE_STALENESS_SECONDS: i64 = 5 * 60;

/// USDC decimals
pub const USDC_DECIMALS: u8 = 6;

/// Price decimals for oracle feeds
pub const PRICE_DECIMALS: u8 = 8;