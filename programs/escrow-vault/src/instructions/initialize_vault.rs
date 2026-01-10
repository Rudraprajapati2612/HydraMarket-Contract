use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;
use crate::{constants::{OUTCOME_TOKEN_DECIMALS, VAULT_SEED}, events::VaultInitialized, state::EscrowVault
    };

#[derive(Accounts)]

pub struct InitializeVault<'info>{
    // for vault initialization 
    #[account(mut)]
    pub admin  : Signer<'info>,

    /// Market account from MarketRegistry (for validation)
    /// CHECK: We read this to link vault to market
    pub market : UncheckedAccount<'info>, //it used to derive a pda for Vault 
    // each market has excately one vault and that vault is derived using market public key and seeds
    #[account(
        init,
        payer = admin,
        space = EscrowVault::LEN,
        seeds = [VAULT_SEED,market.key().as_ref()],
        bump 
    )]
    pub vault : Account<'info,EscrowVault>,

    #[account(
        init,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault
    )]
    pub usdc_vault: Account<'info, TokenAccount>,
    
    // validate this is a usdc  
    pub usdc_mint : Account<'info,Mint>,
    #[account(
        constraint = yes_token_mint.decimals == OUTCOME_TOKEN_DECIMALS
    )]
    pub yes_token_mint : Account<'info,Mint>,
    #[account(
        constraint = no_token_mint.decimals == OUTCOME_TOKEN_DECIMALS
    )]
    pub no_token_mint : Account<'info,Mint>,
     /// Market registry program (for CPI validation)
    /// CHECK: We store this for later CPI calls
    pub market_registery_program : UncheckedAccount<'info>,

    pub system_program : Program<'info,System>,

    pub token_program : Program<'info,Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}


pub fn handler(ctx:Context<InitializeVault>)->Result<()>{
    let vault_key = ctx.accounts.vault.key();
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    vault.market = ctx.accounts.market.key();
    vault.mrarket_registery_program = ctx.accounts.market_registery_program.key();
    vault.usdc_vault = ctx.accounts.usdc_vault.key();
    vault.yes_token_mint = ctx.accounts.yes_token_mint.key();
    vault.no_token_mint = ctx.accounts.no_token_mint.key();
    vault.total_locked_collateral = 0;
    vault.total_yes_minted=0;
    vault.total_no_minted=0;
    vault.is_settled = false;
    vault.is_minting_paused = false;
    vault.admin = ctx.accounts.admin.key();
    vault.bump = ctx.bumps.vault;
    

    
    msg!("Escrow vault initialized");
    msg!("Vault: {}", vault_key);
    msg!("Market: {}", vault.market);
    msg!("USDC Vault: {}", vault.usdc_vault);
    msg!("YES Mint: {}", vault.yes_token_mint);
    msg!("NO Mint: {}", vault.no_token_mint);

    emit!(VaultInitialized{
        vault : vault_key,
        market : vault.market,
        usdc_vault: vault.usdc_vault,
        yes_token_mint: vault.yes_token_mint,
        no_token_mint: vault.no_token_mint,
        timestamp: clock.unix_timestamp,
    });
    Ok(())
}