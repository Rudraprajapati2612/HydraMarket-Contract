use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions; // ✅ PLURAL
pub mod state;
pub mod utils;

pub use instructions::*; // optional
pub use state::*;
pub use events::*;
   
declare_id!("8BPYHejifTVauQkWqKhMzA3uJxDr3U8mKH9NSfbtaAa5");

#[program]
pub mod resolution_adapter {
    use super::*;

    pub fn initialize_resolution(
        ctx: Context<InitializeResolution>,
        category: MarketCategory,
    ) -> Result<()> {
        instructions::initialize_resolution::handler(ctx, category)
    }
   
    pub fn propose_crypto_outcome(
        ctx: Context<ProposeCryptoOutcome>,
        pair: String,
        condition: PriceCondition,
        feed_ids: Vec<String>,
        bond_amount: u64,
    ) -> Result<()> {
        instructions::propose_crypto_outcome::handler(
            ctx,
            pair,
            condition,
            feed_ids,
            bond_amount,
        )
    }

    pub fn propose_sports_outcome(
        ctx: Context<ProposeSportsOutcome>,
        event_id: String,
        event_type: SportsEventType,
        oracle_data: Vec<instructions::propose_sports_outcome::SportsOracleData>,
        bond_amount: u64,
    ) -> Result<()> {
        instructions::propose_sports_outcome::handler(
            ctx,
            event_id,
            event_type,
            oracle_data,
            bond_amount,
        )
    }

    pub fn dispute_proposal(
        ctx: Context<instructions::dispute_proposal::DisputeProposal>,
        counter_outcome: market_registry::ResultOutcome,
        reason: String,
        bond_amount: u64,
    ) -> Result<()> {
        instructions::dispute_proposal::handler(
            ctx,
            counter_outcome,
            reason,
            bond_amount,
        )
    }

    pub fn finalize_outcome(
        ctx: Context<FinalizeOutcome>,
        final_outcome: market_registry::ResultOutcome,
    ) -> Result<()> {
        instructions::finalize_outcome::handler(ctx, final_outcome)
    }

    pub fn emergency_resolve<'info>(
        ctx: Context<'_, '_, '_, 'info, EmergencyResolve<'info>>,
        forced_outcome: market_registry::ResultOutcome,
        reason: String,
    ) -> Result<()> {
        instructions::emergency_resolve::handler(ctx, forced_outcome, reason)
    }
    

}
