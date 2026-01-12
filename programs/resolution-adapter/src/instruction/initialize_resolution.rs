use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::{constants::*, state::{MarketCategory, ResolutionProposal}};


#[derive(Accounts)]

pub struct InitializeResolution<'info>{
    #[account(mut)]
    pub authority : Signer<'info>,
    /// CHECK : validate via seeds  
    pub market : UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = ResolutionProposal::LEN,
        seeds = [RESOLUTION_SEED,market.key().as_ref()],
        bump 
    )]
    pub resolution_proposal : Account<'info,ResolutionProposal>,

    #[account(
        init,
        payer = authority ,
        seeds  = [BOND_VAULT_SEED, market.key().as_ref()],
        bump,
        token::mint = bond_mint,
        token::authority = resolution_proposal 
    )]
    pub bond_vault : Account<'info,TokenAccount>,
    /// CHECK : validation by constraint
    pub bond_mint : UncheckedAccount<'info>,

    pub system_program : Program<'info,System>,

    pub token_program : Program<'info,Token>,

    pub rent : Sysvar<'info,Rent>
}

pub fn handler(ctx:Context<InitializeResolution>,category : MarketCategory)->Result<()>{
    let resolution = &mut ctx.accounts.resolution_proposal;
    let clock = Clock::get()?;


    resolution.market = ctx.accounts.market.key();
    resolution.proposer = Pubkey::default(); //make a default pub key for resolution 

    resolution.proposed_outcome = None ;
    resolution.bond_amount = 0;
    resolution.dispute_deadline = 0;
    resolution.category = category;
    resolution.data_source = Vec::new();
    resolution.is_disputed = false;
    resolution.is_finalized = false;
    resolution.disputes = Vec::new();
    resolution.bond_vault = ctx.accounts.bond_vault.key();
    resolution.bump = ctx.bumps.resolution_proposal;

    msg!("Resolution proposal initialized for market: {}", ctx.accounts.market.key());
    msg!("Category: {:?}", category);
    msg!("Bond vault: {}", ctx.accounts.bond_vault.key());

    Ok(())
}