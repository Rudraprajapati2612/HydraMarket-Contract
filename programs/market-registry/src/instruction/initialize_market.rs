use anchor_lang::prelude::*;
use anchor_spl::{associated_token::spl_associated_token_account, token::{Mint, Token}};

use crate::{
    constants::*,
    event::MarketCreated, 
    state::{Market,InitializeMarketParams}
};

#[derive(Accounts)]
#[instruction(params:InitializeMarketParams)]
pub struct MarketInitialize<'info>{
    #[account(mut)]
    pub admin : Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = Market::LEN,
        seeds=[MARKET_SEED,params.market_id.as_ref()],
        bump
    )]
    pub market : Account<'info,Market>,

    #[account(
        init,
        payer = admin,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = escrow_vault,
    )]
    pub yes_token_mint : Account<'info,Mint>,


    #[account(
        init,
        payer = admin,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = escrow_vault,
    )]
    pub no_token_mint : Account<'info,Mint>,

    #[account(mut,
        seeds = [b"escrow_vault",market.key().as_ref()],
        bump,
        seeds::program = escrow_program.key()
    )]
    pub escrow_vault : UncheckedAccount<'info>,
    // used unchecked account when it is used by another account 
    pub escrow_program:UncheckedAccount<'info>,

    pub resolution_adapter : UncheckedAccount<'info>,
    pub system_program : Program<'info,System>,
    pub token_program : Program<'info,Token>,
    pub rent : Sysvar<'info,Rent>
}


pub fn handeler(ctx:Context<MarketInitialize>,params : InitializeMarketParams)->Result<()>{
    
    let clock = Clock::get()?;

    let current_timestamp = clock.unix_timestamp;

    params.validate(current_timestamp)?;

    // initialized market 
    let market_key = ctx.accounts.market.key();

    let market =  &mut ctx.accounts.market;

    market.market_id = params.market_id;
    market.question = params.question.clone();
    market.description = params.description.clone();
    market.category = params.category.clone();
    market.created_at = current_timestamp;
    market.expire_at = params.expire_at;
    market.state = crate::state::MarketState::Created;
    market.yes_mint_token = ctx.accounts.yes_token_mint.key();
    market.no_mint_token=ctx.accounts.no_token_mint.key();
    market.resolution_adapter = ctx.accounts.resolution_adapter.key();
    market.resolution_outcome = None;
    market.bump = ctx.bumps.market;

    

    msg!("Market created successfully");
    msg!("Market ID: {:?}", market.market_id);
    msg!("YES token mint: {}", market.yes_mint_token);
    msg!("NO token mint: {}", market.no_mint_token);
    msg!("Escrow vault: {}", market.escrow_vault);

    // Emit event
    emit!(MarketCreated {
        market_id: market.market_id,
        market_address: market_key,
        question: params.question,
        yes_token_mint: market.yes_mint_token,
        no_token_mint: market.no_mint_token,
        escrow_vault: market.escrow_vault,
        resolution_adapter: market.resolution_adapter,
        expire_at: market.expire_at,
        created_at: current_timestamp,
    });
    Ok(())
}