pub mod initialize_resolution;
pub mod propose_crypto_outcome;
pub mod propose_sports_outcome;
pub mod dispute_proposal;
pub mod finalize_outcome;
pub mod emergency_resolve;

// Re-export ALL items from each module at the instructions level
pub use initialize_resolution::*;
pub use propose_crypto_outcome::*;
pub use propose_sports_outcome::*;
pub use dispute_proposal::*;
pub use finalize_outcome::*;
pub use emergency_resolve::*;