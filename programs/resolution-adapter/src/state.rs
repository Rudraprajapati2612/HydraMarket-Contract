use anchor_lang::prelude::*;
use market_registry::ResultOutcome;

use crate::error::ResolutionError;


#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BondContributor{
    pub participant : Pubkey,

    pub amount : u64
}

#[account]
pub struct ResolutionProposal{
    
    pub market : Pubkey,
    // Oracle Who sumbited the Proposal 
    pub proposer : Pubkey,

    pub proposed_outcome : Option<ResultOutcome>,
    
    // locked USDC FOr Oracle 
    pub bond_amount : u64 ,
    
    // Timestamp for market is resolved 
    pub proposal_timestamp : i64,

    pub dispute_deadline : i64,

    pub category : MarketCategory,

    pub data_source : Vec<DataSource>,
    // IT CHECKS FOR WHETHER THE ANY USER IS AGAINST  THE DECISION 
    pub is_disputed : bool ,

    pub is_finalized : bool,

    pub disputes : Vec<DisputeProposal>,

    //  it is used to check the honesty of the bond 
    // 1)Flow Oracle Purpose outcome 
    // 2) Oracle Locks 1000USDC in bond Vault 
    // 3)If Result is correct then Bond will retutn 1000 usdc for the Honsety 
    pub bond_vault : Pubkey,

    pub bump : u8,

    pub bond_contributors:Vec<BondContributor>,

    pub is_emergency_resolved : bool
}


impl ResolutionProposal{
    pub const LEN: usize = 8 +  // discriminator
    32 +  // market
    32 +  // proposer
    1 +   // proposed_outcome (enum)
    8 +   // bond_amount
    8 +   // proposal_timestamp
    8 +   // dispute_deadline
    1 +   // category (enum)
    4 + (5 * DataSource::LEN) +  // data_sources (vec with max 5)
    1 +   // is_disputed
    1 +   // is_finalized
    4 + (3 * DisputeProposal::LEN) +  // disputes (vec with max 3)
    32 +  // bond_vault
    1 +
    4 + (10 * BondContributor::LEN) + // ✅ ADD: bond_contributors (max 10)
    1;    // bump

    pub fn is_dispute_window_open(&self,current_time:i64) -> bool{
        current_time< self.dispute_deadline && !self.is_finalized
    }

    pub fn is_dispute_window_closed(&self,current_time:i64)-> bool{
        current_time>= self.dispute_deadline || self.is_finalized
    }

    pub fn add_dispute(&mut self , dispute:DisputeProposal)->Result<()>{
        require!(self.disputes.len() < 3, ResolutionError::MaxDisputesReached);
        self.disputes.push(dispute);
        self.is_disputed = true;
        Ok(())
    }
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct  DisputeProposal{
    // who sumbited the dispute 
    pub disputer : Pubkey,
    // Proposal answers That want to challange 
    pub counter_outcome : ResultOutcome,

    pub bond_amount : u64,

    pub reason  : String,

    pub timestamp : i64
}

impl DisputeProposal {
    pub const LEN: usize = 
    32+   //dispute 
    1+  // Conter Outcome
    8+ // bond amount 
    4+ 100+ //reason (String)
    8;  // timestamp
}




#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq,Debug)]
pub enum  MarketCategory {
    Crypto,
    Sports
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct  DataSource{
    pub source_type :OracleType,
    // e.g For "BTC/USDC" for crypto and team_name  for Sports
    pub identifer : String,

    pub oracle_account : Option<Pubkey>,
    pub value : OracleValue,
    pub timestamp : i64
}


impl DataSource {
    pub const LEN: usize = 
        1 +   // source_type (enum)
        4 + 32 +  // identifier (String, max 32 chars)
        1 + 32 +  // oracle_account (Option<Pubkey>)
        OracleValue::LEN +  // value
        8;    // timestamp
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum OracleType {
    Pyth,
    Switchboard,
    Api3,
    RapidApi,
    Manual    
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum  OracleValue {
    // price vaule for(Crypto market)
    Price(i64),
    // Event result (for sports market)
    Event(String),
    // Boolean result for Yes  and No 
    Boolean(bool)
}

impl OracleValue {
    pub const LEN: usize = 1 + 8 + (4 + 32); // enum discriminator + largest variant
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone)]

pub struct CryptoResolutionData {
    pub pair : String,

    pub condition : PriceCondition,

    pub observed_prices : Vec<i64>,
    // average price 
    pub consensus_price : i64
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PriceCondition{

    GreaterOrEqual {target : i64},

    LessOrEqual {target:i64},

    Between {min : i64, max : i64}
}

impl PriceCondition{
    pub fn is_met(&self,price:i64)->bool{
        match  self {
            PriceCondition::GreaterOrEqual { target } => price >= *target,
            PriceCondition::LessOrEqual { target } => price<=*target,
            PriceCondition::Between { min, max } => price>=*min && price <= *max
        }
    }
}

#[derive(AnchorDeserialize,AnchorSerialize,Clone)]

pub struct SportsResolutionData{
    pub event_id : String,

    pub event_type : SportsEventType,

    pub observed_result : Vec<String>,

    pub consensus_result : String
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]

pub enum SportsEventType {
    Winner,
    ScoreThreshold,
    YesNo
}


impl BondContributor {
    pub const LEN: usize = 32 + 8;  // pubkey + u64
}
