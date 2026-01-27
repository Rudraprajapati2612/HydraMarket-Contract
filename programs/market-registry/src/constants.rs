

// use anchor_lang::prelude::*;

/// Seed for Market PDA derivation
pub const MARKET_SEED: &[u8] = b"market";

/// Seed for Admin authority PDA
pub const ADMIN_SEED: &[u8] = b"admin";

/// Maximum length for market question
pub const MAX_QUESTION_LENGTH: usize = 200;

/// Maximum length for market description
pub const MAX_DESCRIPTION_LENGTH: usize = 1000;

/// Maximum length for market category
pub const MAX_CATEGORY_LENGTH: usize = 50;

/// Maximum length for resolution source identifier
pub const MAX_RESOLUTION_SOURCE_LENGTH: usize = 100;

/// Minimum time until market expiry (1 hour in seconds)
// In programs/market-registry/src/constants.rs

#[cfg(not(feature = "testing"))]
pub const MIN_EXPIRY_DURATION: i64 = 3600; // 1 hour for production

#[cfg(feature = "testing")]
pub const MIN_EXPIRY_DURATION: i64 = 10; // 10 seconds for tests
/// Maximum time until market expiry (1 year in seconds)
pub const MAX_EXPIRY_DURATION: i64 = 31_536_000;

/// Time window for market resolution after expiry (7 days)
pub const RESOLUTION_WINDOW: i64 = 604_800;

/// Number of decimals for outcome tokens (same as USDC)
pub const TOKEN_DECIMALS: u8 = 6;

/// Initial supply for token mints (0, minted on demand)
pub const INITIAL_TOKEN_SUPPLY: u64 = 0;