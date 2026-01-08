use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};
use market_registry::{ResultOutcome, state::Market};
use crate::{constants::VAULT_SEED, error::EscrowVaultError, events::PayoutClaimed, state::{EscrowVault, PayoutCalculation}
};

#[derive(Accounts)]
pub struct ClaimPayouts<'info>{
    #[account(mut)]
    pub user : Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED,vault.market.as_ref()],
        bump = vault.bump
    )]
    pub vault : Account<'info,EscrowVault>,

    #[account(
        constraint = market.key() == vault.market @ EscrowVaultError::MarketRegistryMismatch
    )]
    pub market : Account<'info,Market>,
    
    #[account(
        mut,
        constraint = usdc_vault.key() == vault.usdc_vault @ EscrowVaultError::UsdcVaultMismatch
    )]
    pub usdc_vault : Account<'info,TokenAccount>,

    #[account(
        mut,
        constraint = user_usdc.mint == usdc_vault.mint,
        constraint = user_usdc.owner == user.key() 
    )]
    pub user_usdc : Account<'info,TokenAccount>,

    #[account(
        mut ,
        constraint = yes_token_mint.key() == vault.yes_token_mint @ EscrowVaultError::TokenMintMismatch
    )]
    pub yes_token_mint : Account<'info,Mint>,

    
    #[account(
        mut ,
        constraint = no_token_mint.key() == vault.no_token_mint @ EscrowVaultError::TokenMintMismatch
    )]
    pub no_token_mint : Account<'info,Mint>,

    #[account(
        mut,
        constraint = user_yes_account.mint == yes_token_mint.key(),  //this say token account actually hold correct token 
        constraint = user_yes_account.owner == user.key()
    )]
    pub user_yes_account : Account<'info,TokenAccount>,
    
    #[account(
        mut,
        constraint = user_no_account.mint == no_token_mint.key(),
        constraint = user_no_account.owner == user.key(),
    )]
    pub user_no_account : Account<'info,TokenAccount>,

    pub token_program : Program<'info,Token>
}

pub fn handler(ctx:Context<ClaimPayouts>)->Result<()>{
    let vault_key = ctx.accounts.vault.key();
    let vault  = &mut ctx.accounts.vault;
    let clock = Clock::get()?;
    // check first vault is settled 
    require!(vault.is_ready_for_claims(),EscrowVaultError::NotSettled);

    // get users token balances 
    let yes_balance = ctx.accounts.user_yes_account.amount;
    let no_balance = ctx.accounts.user_no_account.amount;

    // validate user has enough token to claims 

    require!(yes_balance>0 || no_balance>0,EscrowVaultError::NoTokensToClaim);

    msg!("User claiming payout:");
    msg!("  YES balance: {}", yes_balance);
    msg!("  NO balance: {}", no_balance);

     // TODO: Read outcome from Market account via deserialization
    let market = &mut ctx.accounts.market; // as we just want to read the data and we know that our market is resolved 
                                                                    // then we can pass it as a Account 

    require!(market.state == market_registry::state::MarketState::Resolved,EscrowVaultError::NotSettled);

    let outcome = market.resolution_outcome.ok_or(EscrowVaultError::MarketNotResolved)?;

     // based on outcome calculate payout
    let payout = match outcome{
        ResultOutcome::Yes => {
            PayoutCalculation::for_yes_outcome(yes_balance, no_balance)?
        }
        ResultOutcome::No => {
            PayoutCalculation::for_no_outcome(yes_balance, no_balance)?
        }

        ResultOutcome::Invalid => {
            PayoutCalculation::for_invalid_outcome(yes_balance, no_balance)?
        }
    };

    msg!("Payout calculation:");
    msg!("  Outcome: {:?}", outcome);
    msg!("  USDC payout: {} USDC", payout.payout_amount as f64 / crate::constants::USDC_UNIT as f64);
    msg!("  YES to burn: {}", payout.yes_token_to_burn);
    msg!("  NO to burn: {}", payout.no_token_to_burn);


   

    //  Burn User token 
    // we need to cpi to token program to burn a user token 

    let market_key = vault.market.key();

    let vault_seeds = &[
        VAULT_SEED,
        market_key.as_ref(),
        &[vault.bump]
    ];

    let vault_signer= &[&vault_seeds[..]];

    // Burn Yes No token 
    if payout.yes_token_to_burn > 0 {
        token::burn(
            CpiContext::new(ctx.accounts.token_program.to_account_info(),
                Burn{
                    mint : ctx.accounts.yes_token_mint.to_account_info(),
                    from : ctx.accounts.user_yes_account.to_account_info(),
                    authority : ctx.accounts.user.to_account_info()
                } 
            ),
    
     payout.yes_token_to_burn)?;
     msg!("Burned {} YES tokens", payout.yes_token_to_burn);
    }
    // Burn No token 

    if payout.no_token_to_burn > 0 {
        token::burn( 
            CpiContext::new(ctx.accounts.token_program.to_account_info(),
                Burn{
                    mint : ctx.accounts.no_token_mint.to_account_info(),
                    from : ctx.accounts.user_no_account.to_account_info(),
                    authority : ctx.accounts.user.to_account_info()
                } )
            , payout.no_token_to_burn)?;
            msg!("Burned {} NO tokens", payout.no_token_to_burn);
    }
    // Transfer usdc payout 

    if payout.payout_amount > 0 {
        token::transfer(
        CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), 
        Transfer{
            from : ctx.accounts.usdc_vault.to_account_info(),
            to  : ctx.accounts.user_usdc.to_account_info(),
            authority : vault.to_account_info()
        },
         
        vault_signer)
        , payout.payout_amount)?;
        msg!("Transferred {} USDC to user", 
        payout.payout_amount as f64 / crate::constants::USDC_UNIT as f64)
    }

    //  Update Vault State

    vault.total_locked_collateral = vault.total_locked_collateral.checked_sub(payout.payout_amount).ok_or(EscrowVaultError::ArithmeticUnderflow)?;
    msg!("Payout claimed successfully");
    msg!("Remaining collateral in vault: {} USDC", 
        vault.total_locked_collateral as f64 / crate::constants::USDC_UNIT as f64);

        emit!(PayoutClaimed{
            vault : vault_key,
            market: vault.market,
            user: ctx.accounts.user.key(),
            payout_amount: payout.payout_amount,
            yes_burned: payout.yes_token_to_burn,
            no_burned: payout.no_token_to_burn,
            remaning_collateral: vault.total_locked_collateral,
            timestamp: clock.unix_timestamp
        });
   
    Ok(())
}