use anchor_lang::prelude::*;
use anchor_lang::require;
use market_registry::ResultOutcome;

use crate::error::ResolutionError;
use crate::state::SportsEventType;



pub fn find_consensus(results:&[String])->Result<String>{
    require!(!results.is_empty(),ResolutionError::NoDataSources);
    // Typr of count = [("India",4)
    //                  ,("Nz,2")
    //                 ]

    let mut counts : Vec<(String,usize)> = Vec::new();
    for result in results {
       if let Some(entry) = counts.iter_mut().find(|(r,_)|r==result){
        entry.1 += 1;
       }else {
           counts.push((result.clone(),1));
       } 
    }

    counts.sort_by(|a,b| b.1.cmp(&a.1));

    Ok(counts[0].0.clone())
}


pub fn validate_sports_consensus(results:&[String],consensus:&str)->Result<()>{
    let total = results.len();

    let agreeing = results.iter().filter(|r| r.as_str()==consensus).count();
    
    let required = if total == 2 {
        total
    }else {
        (total/2)+1
    };

    require!(
        agreeing>=required,ResolutionError::DataSourceDisagreement
    );
    Ok(())
}

pub fn determine_sports_outcome(
    event_type : SportsEventType,
    result : &str,
)->Result<ResultOutcome>{

    match event_type {
        SportsEventType::Winner => {
            match result.to_lowercase().as_str() {
                "yes" | "winner" => Ok(ResultOutcome::Yes),
                "no" | "loser" => Ok(ResultOutcome::No),
                "draw" | "tie" => Ok(ResultOutcome::Invalid),

                _ => {
                    Ok(ResultOutcome::Yes)
                }
            }
        }

        SportsEventType::ScoreThreshold =>{
            match  result.to_lowercase().as_str() {
                "yes"|"over"|"above" => Ok(ResultOutcome::Yes),
                "no" |"under" | "below" => Ok(ResultOutcome::No),
                "Invalid" | "canceled" => Ok(ResultOutcome::Invalid),
                _ =>{
                    Err(ResolutionError::InvalidEventOutcome.into())
                }
            }
        }

        SportsEventType::YesNo => {
            match result.to_lowercase().as_str() {
                "yes" => Ok(ResultOutcome::Yes),
                "no" => Ok(ResultOutcome::No),
                "invalid" => Ok(ResultOutcome::Invalid),

                _ => {
                    Err(
                        ResolutionError::InvalidEventOutcome.into()
                    )
                }
            }
        }
    }
}

pub fn normalize_team_name(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .trim()
        .to_string()
}

pub fn teams_match(team1: &str, team2: &str) -> bool {
    let norm1 = normalize_team_name(team1);
    let norm2 = normalize_team_name(team2);
    
    norm1 == norm2 || norm1.contains(&norm2) || norm2.contains(&norm1)
}