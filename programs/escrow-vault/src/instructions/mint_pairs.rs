use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};
use market_registry::cpi::accounts::AssertMarketOpen;
use market_registry::program::MarketRegistry;
use crate::{constants::{COLLATERAL_PER_PAIR, USDC_DECIMALS, USDC_UNIT, VAULT_SEED}, error::EscrowVaultError, events::PairsMinted, state::EscrowVault, utils::{log_vault_state, verify_collateral_recived, verify_vault_invariant}
};
// locks colateral usd and mint Yes and No token 
#[derive(Accounts)]
pub struct MintPairs <'info>{
    // SettelMent Worker  the person who will sign the transaction for transfering the usdc from Hot waller  to Vault 
    pub authority : Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED,vault.market.as_ref()],
        bump = vault.bump
    )]
    pub vault : Account<'info,EscrowVault>,
        /// CHECK: validated via CPI
    pub market : UncheckedAccount<'info>,

    pub market_registry_program: Program<'info, MarketRegistry>,
    #[account(
        mut,
        constraint = usdc_vault.key() == vault.usdc_vault @ EscrowVaultError::Unauthorized,
        constraint = usdc_vault.mint == usdc_mint.key(),
        constraint = usdc_vault.owner == vault.key()
    )]
    pub usdc_vault : Account<'info,TokenAccount>,

    #[account(
        constraint = usdc_mint.decimals == USDC_DECIMALS
    )]
    pub usdc_mint : Account<'info,Mint>,

    #[account(
        mut,
        constraint = hot_wallet_usdc.mint == usdc_mint.key(),
    )]
    pub hot_wallet_usdc : Account<'info,TokenAccount>,

    #[account(
        mut ,
        constraint = yes_token_mint.key() == vault.yes_token_mint @ EscrowVaultError::TokenMintMismatch,
    )]
    pub yes_token_mint : Account<'info,Mint>,

    #[account(
        mut,
        constraint = no_token_mint.key() == vault.no_token_mint @ EscrowVaultError::TokenMintMismatch, 
    )]
    pub no_token_mint : Account<'info,Mint>,


    #[account(
        mut,
        constraint = yes_recipient.mint == yes_token_mint.key() @ EscrowVaultError::InvalidRecipientAccount,
    )]
    pub yes_recipient: Account<'info, TokenAccount>,

    /// NO token recipient account (user who buys NO)
    #[account(
        mut,
        constraint = no_recipient.mint == no_token_mint.key() @ EscrowVaultError::InvalidRecipientAccount,
    )]
    pub no_recipient: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler (ctx:Context<MintPairs> , pairs:u64)->Result<()>{
    let vault_key = ctx.accounts.vault.key();
    let vault  = &mut ctx.accounts.vault;
    let clock = Clock::get()?;
    // check for pair is greater than 0
    require!(pairs>0,EscrowVaultError::InvalidPairCount);
    // check vault can mint now so for it track for settled and is_minting pause  -> Means if market is settel and minting is paused then we cant mint 
    // let say if market is not settled yet and minting is not paused then we can say market is open and its we can mint 
    require!(vault.can_mint(),EscrowVaultError::MintingPaused);
    // TODO validate state of market is open 
    
    let cpi_ctx = CpiContext::new(
        ctx.accounts.market_registry_program.to_account_info(),
        AssertMarketOpen {
            market: ctx.accounts.market.to_account_info(),
        },
    );

    market_registry::cpi::assert_market_open(cpi_ctx)?;

    // check how much collateral is required ?

    let required_collateral = pairs.checked_mul(COLLATERAL_PER_PAIR).ok_or(EscrowVaultError::ArithmeticOverflow)?;

    msg!("Minting {} pairs", pairs);
    msg!("Required collateral: {} USDC", required_collateral as f64 / USDC_UNIT as f64);


    // check vault balance before
    let vault_balance_before = ctx.accounts.usdc_vault.amount;

    msg!("Transferring {} USDC from Hot Wallet to Vault", 
        required_collateral as f64 / USDC_UNIT as f64);

    // transfer the token 
    // let me explain this 
    // 1---->COLD Wallet (main walet multi sig) hold all 90 % of total asset
    // 2---->HOT Wallet (contain 9% of the fund ) 
    let transfet_account = Transfer{
        from : ctx.accounts.hot_wallet_usdc.to_account_info(),
        to : ctx.accounts.usdc_vault.to_account_info(),
        authority : ctx.accounts.authority.to_account_info()
    };

    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(),transfet_account );

    token::transfer(cpi_ctx, required_collateral)?;
    ctx.accounts.usdc_vault.reload()?;

    // check the balance after the transfer 
    let vault_balance_after = ctx.accounts.usdc_vault.amount;

    verify_collateral_recived(vault_balance_before, vault_balance_after, required_collateral)?;

    //  mint the pairs to the respective recipients

    // vault will mint the yes and not token and vault is Pda so we need to derive From the seeds
    let market_key = vault.market.key();
    let vault_seeds = &[
        VAULT_SEED,
        market_key.as_ref(),
        &[vault.bump],
    ];
    let vault_signer = &[&vault_seeds[..]];

    msg!("Minting {} YES tokens to {}", pairs, ctx.accounts.yes_recipient.key());

    let mint_account = MintTo{
        mint : ctx.accounts.yes_token_mint.to_account_info(),
        to : ctx.accounts.yes_recipient.to_account_info(),
        authority : vault.to_account_info()
    };

    let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
                                                     mint_account, vault_signer);

    token::mint_to(cpi_ctx, pairs)?;

    msg!("Minting {} NO tokens to {}", pairs, ctx.accounts.no_recipient.key());

    let no_mint_account =MintTo{
        mint : ctx.accounts.no_token_mint.to_account_info(),
        to : ctx.accounts.no_recipient.to_account_info(),
        authority : vault.to_account_info()
    };

    let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(),
                                         no_mint_account, vault_signer);

    token::mint_to(cpi_ctx, pairs)?;

    // update the vault state 
    vault.total_locked_collateral = vault.total_locked_collateral
        .checked_add(required_collateral)
        .ok_or(EscrowVaultError::ArithmeticOverflow)?;

    vault.total_yes_minted = vault.total_yes_minted
        .checked_add(pairs)
        .ok_or(EscrowVaultError::ArithmeticOverflow)?;

    vault.total_no_minted = vault.total_no_minted
        .checked_add(pairs)
        .ok_or(EscrowVaultError::ArithmeticOverflow)?;

    // validate the vault state 
    verify_vault_invariant(vault)?;

    log_vault_state(vault, "mint_pairs");

    // emit the event 
    msg!("Pairs minted successfully");
    msg!("New totals:");
    msg!("  YES minted: {}", vault.total_yes_minted);
    msg!("  NO minted: {}", vault.total_no_minted);
    msg!("  Locked collateral: {} USDC", 
        vault.total_locked_collateral as f64 / USDC_UNIT as f64);

        emit!(PairsMinted {
            vault: vault_key,
            market: vault.market,
            yes_recipient: ctx.accounts.yes_recipient.key(),
            no_recipient: ctx.accounts.no_recipient.key(),
            pairs,
            collateral_locked: required_collateral,
            total_locked: vault.total_locked_collateral,
            total_yes_minted: vault.total_yes_minted,
            total_no_minted: vault.total_no_minted,
            timestamp: clock.unix_timestamp,
        });
    Ok(())
}