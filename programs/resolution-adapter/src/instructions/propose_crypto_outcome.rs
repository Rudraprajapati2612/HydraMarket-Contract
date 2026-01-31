use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use market_registry::{ResultOutcome, cpi::accounts::AssertMarketExpired, program::MarketRegistry};

use crate::{
    constants::{DISPUTE_WINDOW_SECONDS, MAX_DATA_SOURCES, MIN_PROPOSAL_BOND, RESOLUTION_SEED},
    error::ResolutionError,
    events::{CryptoPriceValidated, ProposalSumbitted},
    state::{BondContributor, DataSource, MarketCategory, OracleType, OracleValue, PriceCondition, ResolutionProposal},
    utils::{calcualte_median, normalize_price, validate_price_agreement}
};

// Only import Pyth utils when not testing
#[cfg(not(feature = "testing"))]
use crate::utils::{read_pyth_price, validate_pyth_price};

#[derive(Accounts)]
pub struct ProposeCryptoOutcome<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,
    
    /// CHECK: Validated via CPI to market_registry program
    pub market: UncheckedAccount<'info>,

    pub market_registry_program: Program<'info, MarketRegistry>,

    #[account(
        mut,
        seeds = [RESOLUTION_SEED, market.key().as_ref()],
        bump = resolution_proposal.bump,
        constraint = resolution_proposal.category == MarketCategory::Crypto @ ResolutionError::InvalidMarketCategory,
        constraint = !resolution_proposal.is_finalized @ ResolutionError::AlreadyFinalized
    )]
    pub resolution_proposal: Account<'info, ResolutionProposal>,

    #[account(
        mut,
        constraint = bond_vault.key() == resolution_proposal.bond_vault @ ResolutionError::BondVaultMismatch
    )]
    pub bond_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = proposer_bond_account.mint == bond_vault.mint,
        constraint = proposer_bond_account.owner == proposer.key()
    )]
    pub proposer_bond_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>
}

pub fn handler(
    ctx: Context<ProposeCryptoOutcome>,
    pair: String,
    condition: PriceCondition,
    feed_ids: Vec<String>,
    bond_amount: u64
) -> Result<()> {
    let resolution = &mut ctx.accounts.resolution_proposal;
    let clock = Clock::get()?;

    // Validate bond amount
    require!(bond_amount >= MIN_PROPOSAL_BOND, ResolutionError::InsufficientBond);
    
    // Check for no existing proposal
    require!(resolution.bond_amount == 0, ResolutionError::ProposalAlreadyExists);

    // Check for market expiry via CPI
    let cpi_account = AssertMarketExpired {
        market: ctx.accounts.market.to_account_info()
    };
    let cpi_ctx = CpiContext::new(
        ctx.accounts.market_registry_program.to_account_info(),
        cpi_account
    );
    market_registry::cpi::assert_market_expired(cpi_ctx)?;

    // Validate feed count
    require!(
        !feed_ids.is_empty() && feed_ids.len() <= MAX_DATA_SOURCES,
        ResolutionError::TooManyDataSources
    );

    msg!("Validating {} price feeds for {}", feed_ids.len(), pair);

    let mut data_source = Vec::new();
    let mut prices = Vec::new();

    // === DIFFERENT BEHAVIOR FOR TESTING vs PRODUCTION ===
    
    #[cfg(feature = "testing")]
    {
        // TESTING MODE: Use mock prices
        msg!("⚠️  TESTING MODE - Using mock prices");
        
        for (idx, feed_id) in feed_ids.iter().enumerate() {
            // Mock price: $95,000 for BTC (normalized to 8 decimals)
            let mock_price = 95_000_00000000i64;
            let mock_confidence = 100000u64;
            let mock_timestamp = clock.unix_timestamp;
            
            prices.push(mock_price);
            
            data_source.push(DataSource {
                source_type: OracleType::Pyth,
                identifer: pair.clone(),
                oracle_account: None, // No real account in test mode
                value: OracleValue::Price(mock_price),
                timestamp: mock_timestamp
            });

            emit!(CryptoPriceValidated {
                market: ctx.accounts.market.key(),
                pair: pair.clone(),
                oracle_type: OracleType::Pyth,
                price: mock_price,
                confidence: Some(mock_confidence),
                timestamp: clock.unix_timestamp,
            });
            
            msg!("Mock price feed {}: {} (testing mode)", idx + 1, mock_price);
        }
    }
    
    #[cfg(not(feature = "testing"))]
    {
        // PRODUCTION MODE: Use real Pyth oracles
        for (idx, feed_id) in feed_ids.iter().enumerate() {
            msg!("Reading Pyth feed {}: {}", idx + 1, feed_id);

            let price_update_account = &ctx.remaining_accounts[idx];
            let price_data = read_pyth_price(price_update_account, feed_id)?;
            
            msg!(
                "Pyth price: {} (confidence: {}, expo: {}, timestamp: {})",
                price_data.price,
                price_data.confidence,
                price_data.expo,
                price_data.timestamp
            );
            
            validate_pyth_price(&price_data, clock.unix_timestamp)?;
            
            let normalized_price = normalize_price(price_data.price, price_data.expo)?;
            prices.push(normalized_price);

            data_source.push(DataSource {
                source_type: OracleType::Pyth,
                identifer: pair.clone(),
                oracle_account: Some(price_update_account.key()),
                value: OracleValue::Price(normalized_price),
                timestamp: price_data.timestamp
            });

            emit!(CryptoPriceValidated {
                market: ctx.accounts.market.key(),
                pair: pair.clone(),
                oracle_type: OracleType::Pyth,
                price: normalized_price,
                confidence: Some(price_data.confidence),
                timestamp: clock.unix_timestamp,
            });
        }
    }

    // === COMMON CODE (same for testing and production) ===
    
    // Calculate median price
    let consensus_price = calcualte_median(&prices)?;

    // Validate price agreement
    validate_price_agreement(&prices, consensus_price)?;

    // Determine outcome based on condition
    let outcome = if condition.is_met(consensus_price) {
        ResultOutcome::Yes
    } else {
        ResultOutcome::No
    };

    // Transfer bond to vault
    let transfer_account = Transfer {
        from: ctx.accounts.proposer_bond_account.to_account_info(),
        to: ctx.accounts.bond_vault.to_account_info(),
        authority: ctx.accounts.proposer.to_account_info()
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        transfer_account
    );
    token::transfer(cpi_ctx, bond_amount)?;

    msg!("Bond locked: {} USDC", bond_amount as f64 / 1_000_000.0);

    // Track bond contribution
    resolution.bond_contributors.push(BondContributor {
        participant: ctx.accounts.proposer.key(),
        amount: bond_amount
    });

    // Update resolution proposal
    resolution.proposer = ctx.accounts.proposer.key();
    resolution.proposed_outcome = Some(outcome);
    resolution.proposal_timestamp = clock.unix_timestamp;
    resolution.bond_amount = bond_amount;
    resolution.dispute_deadline = clock.unix_timestamp
        .checked_add(DISPUTE_WINDOW_SECONDS)
        .ok_or(ResolutionError::ArithmeticOverflow)?;
    resolution.data_source = data_source;

    msg!("Dispute window: {} seconds", DISPUTE_WINDOW_SECONDS);
    msg!("Dispute deadline: {}", resolution.dispute_deadline);

    // Emit proposal event
    emit!(ProposalSumbitted {
        market: ctx.accounts.market.key(),
        proposer: ctx.accounts.proposer.key(),
        outcome,
        category: MarketCategory::Crypto,
        bond_amount,
        data_source_count: prices.len() as u8,
        dispute_deadline: resolution.dispute_deadline,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}