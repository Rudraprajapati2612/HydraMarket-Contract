# 🌊 HydraMarket - Decentralized Prediction Market Protocol

![Solana](https://img.shields.io/badge/Solana-14F195?style=for-the-badge&logo=solana&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)
![Anchor](https://img.shields.io/badge/Anchor-6B4FBB?style=for-the-badge&logo=anchor&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

> A fully on-chain prediction market protocol built on Solana, enabling permissionless creation and trading of binary outcome markets with oracle-based resolution.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Testing](#testing)
- [Documentation](#documentation)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

HydraMarket is a decentralized prediction market protocol that allows anyone to create, trade, and resolve binary outcome markets on Solana. Markets can be created for any verifiable event (crypto prices, sports scores, political outcomes, etc.) with automatic oracle-based resolution.

### **Key Highlights**

- 🚀 **Fully On-Chain** - All logic executed on Solana
- ⚡ **High Performance** - Sub-second trade execution
- 🔒 **Secure** - Audited smart contracts with economic security
- 📊 **Oracle Integration** - Pyth (crypto) & RapidAPI (sports)
- 💰 **Capital Efficient** - Automated market making via YES/NO token pairs
- 🎲 **Permissionless** - Anyone can create or trade markets

---

## ✨ Features

### **For Traders**

- ✅ Trade on any verifiable outcome (crypto, sports, politics, etc.)
- ✅ Buy/sell YES/NO tokens representing outcomes
- ✅ Automatic settlement and payout claims
- ✅ Real-time price discovery
- ✅ Low fees and fast execution

### **For Market Creators**

- ✅ Create markets for any binary outcome
- ✅ Set custom expiration dates
- ✅ Choose resolution sources (Pyth, RapidAPI, manual)
- ✅ Manage market state (open, pause, resume)
- ✅ Emergency resolution powers (admin)

### **For Oracles**

- ✅ Propose outcomes with bonded stake (1000 USDC)
- ✅ Earn rewards for correct proposals (100 USDC)
- ✅ 24-hour dispute window for challenges
- ✅ Slashing for incorrect proposals
- ✅ Multi-source consensus for sports markets

---

## 🏗️ Architecture

HydraMarket consists of three core Solana programs (smart contracts):

```
┌─────────────────────────────────────────────────────────────┐
│                      HydraMarket Protocol                   │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌──────────────────┐
│    Market     │   │    Escrow     │   │   Resolution     │
│   Registry    │◄──┤     Vault     │◄──┤     Adapter      │
└───────────────┘   └───────────────┘   └──────────────────┘
        │                   │                   │
        ├─ Create Markets   ├─ Mint YES/NO      ├─ Oracle Proposals
        ├─ State Mgmt       ├─ Hold USDC        ├─ Dispute Mechanism
        ├─ Validation       ├─ Settle Trades    ├─ Finalization
        └─ Resolution       └─ Claim Payouts    └─ Emergency Override
```

### **Program Relationships**

1. **Market Registry** creates markets and manages lifecycle
2. **Escrow Vault** mints YES/NO tokens and holds collateral
3. **Resolution Adapter** handles oracle proposals and finalization
4. All programs use **Cross-Program Invocations (CPI)** for communication

---

## 📦 Smart Contracts

### **1. Market Registry**

**Purpose:** Market creation and lifecycle management

**Key Functions:**
- `initialize_market` - Create new prediction market
- `open_market` - Allow trading to begin
- `pause_market` / `resume_market` - Emergency controls
- `resolving_market` - Transition to resolution phase
- `finalize_market` - Mark market as resolved
- `assert_market_expired` - Validation for resolution

**States:**
```
CREATED → OPEN → PAUSED → OPEN → RESOLVING → RESOLVED
```

**Program ID (Devnet):** `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`

---

### **2. Escrow Vault**

**Purpose:** Token minting and settlement

**Key Functions:**
- `initialize_vault` - Create vault for market
- `mint_pairs` - Mint YES/NO token pairs (1 USDC → 1 YES + 1 NO)
- `settle` - Mark market as settled after resolution
- `claim_payout` - Users claim winnings (1 winning token → 1 USDC)

**Economics:**
```
Mint:    1 USDC → 1 YES + 1 NO
Outcome: YES wins
Payout:  1 YES → 1 USDC
         1 NO  → 0 USDC (worthless)
```

**Program ID (Devnet):** `GrAkKPVRdVnVkhpCfLLU1m1aphkkB7gCdEW4EYPBdD4K`

---

### **3. Resolution Adapter**

**Purpose:** Oracle-based market resolution

**Key Functions:**
- `initialize_resolution` - Setup resolution for market
- `propose_crypto_outcome` - Oracle proposes outcome (Pyth data)
- `propose_sports_outcome` - Oracle proposes outcome (RapidAPI data)
- `dispute_proposal` - Challenge incorrect proposal
- `finalize_outcome` - Confirm final outcome after dispute window
- `emergency_resolve` - Admin override (extreme cases)

**Oracle Economics:**
```
Proposal Bond: 1000 USDC
Reward: 100 USDC
Dispute Window: 24 hours

Scenarios:
✅ Correct + Undisputed → Get 1000 USDC + 100 USDC = 1100 USDC
✅ Correct + Disputed → Get 2000 USDC + 100 USDC = 2100 USDC (slashed disputer's bond)
❌ Incorrect + Disputed → Lose 1000 USDC (slashed)
```

**Program ID (Devnet):** `8BPYHejifTVauQkWqKhMzA3uJxDr3U8mKH9NSfbtaAa5`

---

## 🚀 Getting Started

### **Prerequisites**

- Rust 1.75+ (`rustup install stable`)
- Solana CLI 1.18+ (`sh -c "$(curl -sSfL https://release.solana.com/stable/install)"`)
- Anchor CLI 0.30+ (`cargo install --git https://github.com/coral-xyz/anchor avm --locked`)
- Node.js 18+ / Bun 1.0+

### **Installation**

```bash
# Clone repository
git clone https://github.com/yourusername/hydramarket-contracts.git
cd hydramarket-contracts

# Install dependencies
yarn install
# or
bun install

# Build programs
anchor build

# Run tests
anchor test
```

---

## 🧪 Testing

### **Run All Tests**

```bash
# Run all test suites
anchor test

# Run specific test file
anchor test tests/market-registry.test.ts

# Run with logs
anchor test -- --nocapture
```

### **Test Coverage**

**Market Registry (20+ tests):**
- ✅ Market initialization
- ✅ State transitions
- ✅ Access control
- ✅ Edge cases

**Escrow Vault (15+ tests):**
- ✅ Vault initialization
- ✅ Token minting
- ✅ Settlement
- ✅ Payout claims

**Resolution Adapter (25+ tests):**
- ✅ Oracle proposals
- ✅ Dispute mechanism
- ✅ Finalization
- ✅ Emergency resolution

**Total: 60+ test cases** ✅

### **Test Market Flow**

```bash
# Run integration test (full market lifecycle)
anchor test tests/integration-tests.ts
```

This tests:
1. Create market
2. Open for trading
3. Users mint YES/NO pairs
4. Market expires
5. Oracle proposes outcome
6. Market finalizes
7. Users claim payouts

---

## 📚 Documentation

### **Core Documentation**

- [Architecture Overview](./docs/ARCHITECTURE.md) - System design and program interactions
- [Market Lifecycle](./MARKET_LIFECYCLE_EXPLAINED.md) - Complete market state flow
- [Oracle Integration](./resolution-adapter/README.md) - Pyth & RapidAPI integration
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Deploy to devnet/mainnet

### **Program READMEs**

- [Market Registry](./market-registry/README.md)
- [Escrow Vault](./escrow-vault/README.md)
- [Resolution Adapter](./resolution-adapter/README.md)

### **Guides**

- [Creating Markets](./docs/CREATE_MARKET.md)
- [Trading Guide](./docs/TRADING.md)
- [Oracle Guide](./docs/ORACLE.md)
- [Claiming Payouts](./docs/CLAIM_PAYOUT.md)

---

## 🌐 Deployment

### **Devnet**

```bash
# Configure for devnet
solana config set --url https://api.devnet.solana.com

# Fund wallet
solana airdrop 5

# Deploy
anchor deploy

# Verify
solana program show <PROGRAM_ID>
```

**Deployed Programs (Devnet):**

| Program | ID | Explorer |
|---------|-------|----------|
| Market Registry | `H42DouiugXCKGn9sHrC7N6PtvRQFwwDLZsHJW1Q58N2h` | [View](https://explorer.solana.com/address/H42DouiugXCKGn9sHrC7N6PtvRQFwwDLZsHJW1Q58N2h?cluster=devnet) |
| Escrow Vault | `CRyAfXPmf11myj8X1dZ3AdjSfwXEjB5Ep4HpXmf6D6QP` | [View](https://explorer.solana.com/address/CRyAfXPmf11myj8X1dZ3AdjSfwXEjB5Ep4HpXmf6D6QP?cluster=devnet) |
| Resolution Adapter | `HiXBiQDjtvMCW4K6xsgyCrEf7zH1zkWuAtGqshSSfJL9` | [View](https://explorer.solana.com/address/HiXBiQDjtvMCW4K6xsgyCrEf7zH1zkWuAtGqshSSfJL9?cluster=devnet) |

### **Mainnet**

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for mainnet deployment steps.

---

## 🔒 Security

### **Audits**

- [ ] Internal review ✅
- [ ] External audit (pending)
- [ ] Bug bounty program (planned)

### **Security Features**

✅ **Access Control** - Admin-only functions protected  
✅ **Input Validation** - All parameters validated  
✅ **Overflow Protection** - Safe math operations  
✅ **Reentrancy Guards** - State updates before external calls  
✅ **Oracle Bonding** - Economic security for resolution  
✅ **Dispute Mechanism** - Challenge incorrect proposals  
✅ **Emergency Pause** - Admin can pause markets  

### **Known Limitations**

⚠️ **Oracle Trust** - Resolution depends on oracle honesty (mitigated by bonding + disputes)  
⚠️ **Admin Powers** - Admin can emergency resolve (mitigated by multi-sig in production)  
⚠️ **Price Oracles** - Pyth oracle latency (~1 second)  

### **Reporting Vulnerabilities**

Please report security issues to: security@hydramarket.com

**Do NOT** open public issues for security vulnerabilities.

---

## 📊 Program Statistics

| Metric | Value |
|--------|-------|
| **Total Programs** | 3 |
| **Lines of Code** | ~5,000 |
| **Test Coverage** | 60+ tests |
| **Dependencies** | anchor-lang, anchor-spl, pyth-solana-receiver-sdk |
| **Deployment Size** | ~200-300 KB per program |
| **Estimated Deploy Cost** | ~3-5 SOL (devnet/mainnet) |

---

## 🛠️ Development

### **Project Structure**

```
hydramarket-contracts/
├── programs/
│   ├── market-registry/        # Market lifecycle
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── state/
│   │   │   ├── instructions/
│   │   │   ├── error.rs
│   │   │   └── events.rs
│   │   └── Cargo.toml
│   │
│   ├── escrow-vault/           # Token minting & settlement
│   │   ├── src/
│   │   └── Cargo.toml
│   │
│   └── resolution-adapter/     # Oracle resolution
│       ├── src/
│       └── Cargo.toml
│
├── tests/
│   ├── market-registry.test.ts
│   ├── escrow-vault.test.ts
│   ├── resolution-adapter.test.ts
│   └── integration-tests.ts
│
├── app/                        # (Future) Frontend
├── docs/                       # Documentation
├── Anchor.toml
├── package.json
└── README.md
```

### **Building**

```bash
# Clean build
anchor clean && anchor build

# Build specific program
anchor build -- --package market-registry

# Check program size
ls -lh target/deploy/*.so
```

### **Linting**

```bash
# Rust linting
cargo clippy --all-targets --all-features

# TypeScript linting
yarn lint
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### **Development Workflow**

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`anchor test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

### **Code Standards**

- ✅ All functions must have tests
- ✅ Follow Rust naming conventions
- ✅ Add inline comments for complex logic
- ✅ Update documentation for new features
- ✅ Run `cargo clippy` before committing

---

## 📈 Roadmap

### **Phase 1: MVP (Q2 2025)** ✅
- [x] Market Registry contract
- [x] Escrow Vault contract
- [x] Resolution Adapter contract
- [x] Comprehensive test suite
- [x] Devnet deployment

### **Phase 2: Production (Q3 2025)**
- [ ] External audit
- [ ] Mainnet deployment
- [ ] Frontend application
- [ ] Indexer service
- [ ] API documentation

### **Phase 3: Features (Q4 2025)**
- [ ] CLOB integration
- [ ] Automated market maker (AMM)
- [ ] Multi-outcome markets
- [ ] Conditional markets
- [ ] Governance token

### **Phase 4: Scale (2026)**
- [ ] Cross-chain bridges
- [ ] Mobile app
- [ ] Advanced analytics
- [ ] Market maker incentives
- [ ] DAO governance

---

## 💰 Economics

### **Market Creation**

- No fee to create markets
- Admin-only in MVP (will be permissionless post-audit)

### **Trading**

- Minting: 1 USDC → 1 YES + 1 NO (no fee)
- Trading: Platform fee TBD (likely 0.1-0.5%)
- Settlement: No fee

### **Oracle Rewards**

- Bond: 1000 USDC (returned if correct)
- Reward: 100 USDC (for correct proposals)
- Slashing: Lose bond if incorrect + disputed

---

## 🔗 Links

- **Website:** https://hydramarket.com (coming soon)
- **Twitter:** [@0xRudraSol](https://x.com/0xRudraSol)

- **Explorer (Devnet):** [Solana Explorer](https://explorer.solana.com/address/Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS?cluster=devnet)

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Solana Labs](https://solana.com/) - Blockchain infrastructure
- [Anchor Framework](https://www.anchor-lang.com/) - Solana development framework
- [Pyth Network](https://pyth.network/) - Price oracle integration
- [Polymarket](https://polymarket.com/) - Inspiration for prediction markets

---

## 📞 Contact

- **Email:** rudraprajapati2612@gmail.com
- **Twitter:** [@0xRudraSol](https://x.com/0xRudraSol)
- 

---

**Built with ❤️ on Solana**

---

## 🎯 Quick Start Example

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MarketRegistry } from "./target/types/market_registry";

// Initialize
const provider = anchor.AnchorProvider.env();
const program = anchor.workspace.MarketRegistry as Program<MarketRegistry>;

// Create market
const marketId = Buffer.from(crypto.randomUUID().slice(0, 32));
const tx = await program.methods
  .initializeMarket({
    marketId: Array.from(marketId),
    question: "Will BTC reach $100k?",
    description: "Resolves YES if BTC >= $100k by Feb 28, 2025",
    category: { crypto: {} },
    expireAt: new anchor.BN(1740787200), // Feb 28, 2025
    resolutionSource: "pyth-btc-usd",
  })
  .accounts({
    authority: provider.wallet.publicKey,
  })
  .rpc();

console.log("Market created! Signature:", tx);
```

---

**⭐ Star this repo if you find it helpful!**
