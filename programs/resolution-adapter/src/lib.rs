use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod state;
pub mod utils;

// Declare instructions module
pub mod instructions;

// Import everything from instructions to crate root
use instructions::*;

declare_id!("8BPYHejifTVauQkWqKhMzA3uJxDr3U8mKH9NSfbtaAa5");

#[program]
pub mod resolution_adapter {
    use super::*;

    /// Initialize resolution proposal account for a market
    pub fn initialize_resolution(
        ctx: Context<InitializeResolution>,
        category: state::MarketCategory,
    ) -> Result<()> {
        instructions::initialize_resolution::handler(ctx, category)
    }

    /// Propose outcome for crypto market using price oracles
    pub fn propose_crypto_outcome(
        ctx: Context<ProposeCryptoOutcome>,
        pair: String,
        condition: state::PriceCondition,
        feed_ids: Vec<String>,
        bond_amount: u64,
    ) -> Result<()> {
        instructions::propose_crypto_outcome::handler(ctx, pair, condition, feed_ids, bond_amount)
    }

    /// Propose outcome for sports market using event data
    pub fn propose_sports_outcome(
        ctx: Context<ProposeSportsOutcome>,
        event_id: String,
        event_type: state::SportsEventType,
        oracle_data: Vec<SportsOracleData>,
        bond_amount: u64,
    ) -> Result<()> {
        instructions::propose_sports_outcome::handler(ctx, event_id, event_type, oracle_data, bond_amount)
    }

    /// Dispute an existing proposal
    pub fn dispute_proposal(
        ctx: Context<DisputeProposal>,
        counter_outcome: market_registry::ResultOutcome,
        reason: String,
        bond_amount: u64,
    ) -> Result<()> {
        instructions::dispute_proposal::handler(ctx, counter_outcome, reason, bond_amount)
    }

    /// Finalize outcome after dispute window
    pub fn finalize_outcome(
        ctx: Context<FinalizeOutcome>,
        final_outcome: market_registry::ResultOutcome,
    ) -> Result<()> {
        instructions::finalize_outcome::handler(ctx, final_outcome)
    }

    /// Emergency resolution (admin only)
    pub fn emergency_resolve(
        ctx: Context<EmergencyResolve>,
        forced_outcome: market_registry::ResultOutcome,
        reason: String,
    ) -> Result<()> {
        instructions::emergency_resolve::handler(ctx, forced_outcome, reason)
    }

    
}