use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use market_registry::{cpi::accounts::AssertMarketExpired, program::MarketRegistry};

use crate::{constants::{DISPUTE_WINDOW_SECONDS, MAX_DATA_SOURCES, MAX_ORACLE_STALENESS_SECONDS, MIN_PROPOSAL_BOND, RESOLUTION_SEED}, error::ResolutionError, events::{ProposalSumbitted, SportsEventvalidated}, state::{BondContributor, DataSource, MarketCategory, OracleType, ResolutionProposal, SportsEventType}, utils::{determine_sports_outcome, find_consensus, validate_sports_consensus}};

#[derive(Accounts)]

pub struct  ProposeSportsOutcome<'info>{
    #[account(mut)]
    pub proposer : Signer<'info>,

    /// CHECK : validate via CPI
    pub market : UncheckedAccount<'info>,

    pub market_registery_program : Program<'info,MarketRegistry>,

    #[account(
        mut,
        seeds = [RESOLUTION_SEED , market.key().as_ref()],
        bump = resolution_proposal.bump,
        constraint = resolution_proposal.category == MarketCategory::Sports @ ResolutionError::InvalidMarketCategory,
        constraint = !resolution_proposal.is_finalized @ ResolutionError::AlreadyFinalized
    )]
    pub resolution_proposal : Account<'info,ResolutionProposal>,

    #[account(
        mut,
        constraint = bond_vault.key() == resolution_proposal.bond_vault @ ResolutionError::BondVaultMismatch
    )]
    pub bond_vault  : Account<'info,TokenAccount>,

    #[account(
        mut ,
        constraint = proposer_bond_account.mint == bond_vault.mint,
        constraint = proposer_bond_account.owner == proposer.key()
    )]
    pub proposer_bond_account : Account<'info,TokenAccount>,

    pub token_program : Program<'info,Token>,
}

pub fn handler(
    ctx:Context<ProposeSportsOutcome>,
    event_id : String,
    event_type:SportsEventType,
    oracle_data : Vec<SportsOracleData>,
    bond_amount : u64
)->Result<()>{
    let resolution_proposal_key = ctx.accounts.proposer.key();
    let resolution = &mut ctx.accounts.resolution_proposal;
    let clock = Clock::get()?;

    // Validate Bond Amount 
    require!(bond_amount>=MIN_PROPOSAL_BOND,ResolutionError::InsufficientBond);
    // validate no existing proposal -> This is the first porposal of their 
    require!(resolution.bond_amount == 0 , ResolutionError::ProposalAlreadyExists);
    let cpi_account = AssertMarketExpired {
        market: ctx.accounts.market.to_account_info()
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.market_registery_program.to_account_info(),  
        cpi_account
    );

    market_registry::cpi::assert_market_expired(cpi_ctx)?;

    // Check That Data is Not empty and oracle data lengeth is less than 
    require!(
        !oracle_data.is_empty() && oracle_data.len() <= MAX_DATA_SOURCES,
        ResolutionError::TooManyDataSources
    );
    msg!("Validating {} data sources for event: {}", oracle_data.len(), event_id);

    let mut data_source = Vec::new();
    let mut results = Vec::new();

    for (idx,oracle_info) in oracle_data.iter().enumerate(){
        msg!("Data source {}: {} = {}", idx + 1, oracle_info.source_name, oracle_info.result);

        // Calculate age for check that data is fresh 
        let age = clock.unix_timestamp
                       .checked_sub(oracle_info.timestamp)
                       .ok_or(ResolutionError::InvalidTimestamp)?;
    
        require!(age<MAX_ORACLE_STALENESS_SECONDS,ResolutionError::StaleOracleData);

        results.push(oracle_info.result.clone());

        data_source.push(
            DataSource{
                source_type : oracle_info.source_type,
                identifer : event_id.clone(),
                oracle_account:oracle_info.oracle_account,
                value : crate::state::OracleValue::Event(oracle_info.result.clone()),
                timestamp : oracle_info.timestamp
            }
        );

        emit!(SportsEventvalidated{
            market:ctx.accounts.market.key(),
            event_id : event_id.clone(),
            oracle_type : oracle_info.source_type,
            result : oracle_info.result.clone(),
            timestamp:clock.unix_timestamp
        });
    }

    let consensus_result = find_consensus(&results)?;
    msg!("Consensus result: {}", consensus_result);

    // Validate all sources agree (or majority for >3 sources)

    // it Checks that more than outcome comes from more than 50% chances
    validate_sports_consensus(&results, &consensus_result)?;

    let outcome = determine_sports_outcome(event_type, &consensus_result)?;
    msg!("Proposed outcome: {:?}", outcome);

    // Transfer amount from bond to vault
    let cpi_account = Transfer{
        from : ctx.accounts.proposer_bond_account.to_account_info(),
        to  : ctx.accounts.bond_vault.to_account_info(),
        authority : ctx.accounts.proposer.to_account_info()
    };

    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_account);

    token::transfer(cpi_ctx, bond_amount)?;
    msg!("Bond locked: {} USDC", bond_amount as f64 / 1_000_000.0);

    // Added Track bond Contribution 

    resolution.bond_contributers.push(BondContributor{
        participant: ctx.accounts.proposer.key(),
        amount : bond_amount
    });

    // Update Resolution proposal 

    resolution.proposer = resolution_proposal_key;
    resolution.proposed_outcome = Some(outcome);
    resolution.proposal_timestamp = clock.unix_timestamp;
    resolution.bond_amount = bond_amount;  // ✅ ADD: Set bond_amount
    resolution.data_source = data_source;
    resolution.dispute_deadline = clock.unix_timestamp.checked_add(DISPUTE_WINDOW_SECONDS).ok_or(ResolutionError::ArithmeticOverflow)?;


    msg!("Dispute window: {} seconds", DISPUTE_WINDOW_SECONDS);
    msg!("Dispute deadline: {}", resolution.dispute_deadline);
    

    emit!(ProposalSumbitted {
        market: ctx.accounts.market.key(),
        proposer: ctx.accounts.proposer.key(),
        outcome,
        category: MarketCategory::Sports,
        bond_amount,
        data_source_count: results.len() as u8,
        dispute_deadline: resolution.dispute_deadline,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SportsOracleData{
    pub source_type : OracleType,

    pub source_name : String,

    pub oracle_account : Option<Pubkey>,

    pub result : String,
    
    pub timestamp : i64
}