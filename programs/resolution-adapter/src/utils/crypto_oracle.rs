use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, get_feed_id_from_hex};

use crate::{constants::MAX_ORACLE_STALENESS_SECONDS, error::ResolutionError};


pub struct PriceData{

    pub price : i64,
    pub confidence : u64,
    pub timestamp : i64,
    pub expo : i32
}

// price_update_account -> Is a solana account that Store Price pyth Data on chain
pub fn read_pyth_price(price_update_account : &AccountInfo
    ,feed_id:&str)->Result<PriceData>{
        // try_deserialize -> Convert Byte data into Rust Structs 
    let price_update = PriceUpdateV2::try_deserialize(&mut price_update_account.data.borrow().as_ref())
                                                        .map_err(|_| ResolutionError::InvalidPythAccount)?;   



    // Convert Hex field to Byte 

    let feed_id_bytes = get_feed_id_from_hex(feed_id).map_err(|_| ResolutionError::InvalidPythAccount)?; 

    let price_feed = price_update.get_price_no_older_than(&Clock::get()?,
                 MAX_ORACLE_STALENESS_SECONDS as u64,   
                             &feed_id_bytes)
                            .map_err(|_| ResolutionError::InvalidPythAccount)?; 
    Ok(PriceData { 
        price : price_feed.price,
        confidence : price_feed.conf,
        timestamp : price_feed.publish_time,
        expo     : price_feed.exponent
     })
}


pub fn normalize_price(price : i64 , expo : i32)->Result<i64>{
    if expo >=0 {
        let multiplier = 10_i64.pow(expo as u32);
        price.checked_mul(multiplier).ok_or(ResolutionError::ArithmeticOverflow.into())
    }else{
        Ok(price)
    }
   
}

pub fn validate_pyth_price(price_data :&PriceData,current_time:i64)->Result<()>{
    let age = current_time.checked_sub(price_data.timestamp).ok_or(ResolutionError::InvalidTimestamp)?;
    
    
    // If price  is fetch freshly then Means less than 5 min that means price is fresh and we can use it 
    require!(age<=MAX_ORACLE_STALENESS_SECONDS,ResolutionError::StaleOracleData);


    //Calculating maximum confidence in this 
    // max confidenc is 10% greater than  10% of total price is bad for us  
    let max_confidence = (price_data.price.abs() as u64)
        .checked_mul(1000) // 10% in basis points
        .ok_or(ResolutionError::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(ResolutionError::ArithmeticOverflow)?;

    require!(price_data.confidence<=max_confidence,ResolutionError::LowPriceConfidence);
    Ok(())
}