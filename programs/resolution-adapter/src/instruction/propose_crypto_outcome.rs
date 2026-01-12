use anchor_lang::prelude::*;

use anchor_spl::token::{Token, TokenAccount};
use market_registry::{Market, ResultOutcome, cpi::accounts::AssertMarketExpired, program::MarketRegistry};

use crate::{constants::{MAX_DATA_SOURCES, MIN_PROPOSAL_BOND, RESOLUTION_SEED}, error::ResolutionError, events::CryptoPriceValidated, state::{DataSource, MarketCategory, OracleType, OracleValue, PriceCondition, ResolutionProposal}, utils::{normalize_price, read_pyth_price, validate_pyth_price}
};

#[derive(Accounts)]
pub struct ProposeCryptoOutcome<'info>{
    #[account(mut)]
    pub proposer : Signer<'info>,

    pub market : UncheckedAccount<'info>,

    pub market_registery_program  : Program<'info,MarketRegistry>,

    #[account(
        mut,
        seeds = [RESOLUTION_SEED,market.key().as_ref()],
        bump = resolution_proposal.bump,
        constraint = resolution_proposal.category == MarketCategory::Crypto @ ResolutionError::InvalidMarketCategory,
        constraint = !resolution_proposal.is_finalized @ ResolutionError::AlreadyFinalized
    )]
    pub resolution_proposal : Account<'info,ResolutionProposal>,

    #[account(
        mut ,
        constraint = bond_vault.key() == resolution_proposal.bond_vault @ ResolutionError::BondVaultMismatch
    )]
    pub bond_vault : Account<'info,TokenAccount>,

    #[account(
        mut,
        constraint = proposer_bond_account.mint == bond_vault.mint ,
        constraint = proposer_bond_account.owner == proposer.key()
    )]
    pub proposer_bond_account:Account<'info,TokenAccount>,

    pub token_program : Program<'info,Token>
}

pub fn handler(ctx:Context<ProposeCryptoOutcome>,pair : String,condition:PriceCondition,feed_ids:Vec<String>,bond_amount:u64)->Result<()>{
    
    let resolution = &mut ctx.accounts.resolution_proposal;
    let clock = Clock::get()?;



    // check bond amount 
    require!(bond_amount>=MIN_PROPOSAL_BOND,ResolutionError::InsufficientBond);
    
    // check for no exesting proposal 
    // if proposal is already exist then can not add porposal for second time 
    require!(resolution.bond_amount == 0 , ResolutionError::ProposalAlreadyExists); 

    // Check for market Expirey

    // Cpi to market program 

    let cpi_account = AssertMarketExpired{
        market : ctx.accounts.market.to_account_info()
    };

    let cpi_ctx = CpiContext::new(ctx.accounts.market_registery_program.to_account_info(), cpi_account);

    market_registry::cpi::assert_market_expired(cpi_ctx)?;


    // Validate Fees Outcome 
    require!(
        !feed_ids.is_empty() && feed_ids.len() <= MAX_DATA_SOURCES,
        ResolutionError::TooManyDataSources
    );

    msg!("Validating {} Pyth price feeds for {}", feed_ids.len(), pair);


    // Collect Price from all Price Update account 

    let mut data_source = Vec::new();
    let mut price  = Vec::new();

    for(idx,feed_id) in feed_ids.iter().enumerate(){
        msg!("Reading Pyth feed {}: {}", idx + 1, feed_id);

        let price_update_account = &ctx.remaining_accounts[idx];
        // feed id is a string like "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" for ETH/USD
        let price_data = read_pyth_price(price_update_account, feed_id)?;
        msg!(
            "Pyth price: {} (confidence: {}, expo: {}, timestamp: {})", 
            price_data.price,
            price_data.confidence,
            price_data.expo,
            price_data.timestamp
        );
        //  This function helps us to check for  
        // 1) That price is fetch freshly means the price we get is fetche before 5min if yes than proceed and if not then throw error 
        // 2) Check confidence of the price 
        validate_pyth_price(&price_data, clock.unix_timestamp)?;
    
        
        let normalized_price = normalize_price(price_data.price, price_data.expo)?; 
        price.push(normalized_price);

        data_source.push(DataSource{
            source_type : OracleType::Pyth,
            identifer : pair.clone(),
            oracle_amount : Some(price_update_account.key()),
            value : OracleValue::Price(normalized_price),
            timestamp : price_data.timestamp
        });

        emit!(CryptoPriceValidated{
            market: ctx.accounts.market.key(),
            pair: pair.clone(),
            oracle_type: OracleType::Pyth,
            price: normalized_price,
            confidence: Some(price_data.confidence),
            timestamp: clock.unix_timestamp,
        })
    }

    
    Ok(())
}