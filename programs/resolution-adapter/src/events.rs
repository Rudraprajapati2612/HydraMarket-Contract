use core::str;

use anchor_lang::prelude::*;
use market_registry::ResultOutcome;

use crate::state::{MarketCategory, OracleType};

#[event]

pub struct ProposalSumbitted{
    pub market : Pubkey,
    // Oracle who Sumbitted the Proposal 
    pub proposer : Pubkey,
    // Yes No Invalid 
    pub outcome : ResultOutcome,
    // sports and crypto 
    pub category : MarketCategory,

    pub bond_amount : u64,

    pub data_source_count : u8,

    pub dispute_deadline : i64,

    pub timestamp : i64
}


#[event]

pub struct  ProposalDispute{
    pub market : Pubkey,
    // original Proposal 
    pub proposer : Pubkey,
    // disputer who is against the Outcome 
    pub disputer : Pubkey,

    pub counter_outcome : ResultOutcome,

    pub bond_amount : u64,

    pub reason : String,

    pub new_deadline : i64,

    pub timestamp : i64
}

#[event]

pub struct OutcomeFinalized{
    pub market : Pubkey,

    pub outcome : ResultOutcome,

    pub winning_proposer : Pubkey,

    pub was_disputed : bool,

    pub slashed_amount : u64 ,

    pub reward_amount : u64,

    pub timestamp : i64
}

#[event]

pub struct  CryptoPriceValidated{
    pub market : Pubkey,

    pub pair : String,

    pub oracle_type : OracleType,

    pub price : i64,
    // Size of Uncertanity 
    // lower the confidence better the predicted Value
    pub confidence : Option<u64>,

    pub timestamp : i64
}




#[event]

pub struct SportsEventvalidated {
    pub market : Pubkey,

    pub event_id : String,

    pub oracle_type : OracleType,
    // Which team won 
    pub result : String,

    pub timestamp : i64
}

#[event]

pub struct EmergencyResolution{
    pub market :  Pubkey,

    pub admin : Pubkey,

    pub outcome : ResultOutcome ,
     
    pub reason : String,

    pub redunded_amount : u64,

    pub timestamp : i64 
}