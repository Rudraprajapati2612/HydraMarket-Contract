
/// Seed for EscrowVault PDA derivation
pub const VAULT_SEED: &[u8] = b"escrow_vault";

/// Seed for USDC vault (Associated Token Account)
pub const USDC_VAULT_SEED: &[u8] = b"usdc_vault";

/// USDC has 6 decimals (same as SPL Token standard)
pub const USDC_DECIMALS: u8 = 6;

/// 1 USDC in lamports (smallest unit)
pub const USDC_UNIT: u64 = 1_000_000; // 1.0 USDC

/// Collateral required per pair (1 USDC)
/// 1 pair = 1 YES + 1 NO = 1 USDC locked
pub const COLLATERAL_PER_PAIR: u64 = USDC_UNIT;

/// Maximum users that can be batch settled at once
pub const MAX_BATCH_SETTLE_SIZE: u8 = 10;

/// Number of decimals for outcome tokens (YES/NO)
pub const OUTCOME_TOKEN_DECIMALS: u8 = 6;