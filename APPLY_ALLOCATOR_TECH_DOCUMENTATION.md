# Apply.Allocator.Tech - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [User Roles and Permissions](#user-roles-and-permissions)
4. [Application Workflow](#application-workflow)
5. [Root Key Holder (RKH) Management](#root-key-holder-rkh-management)
6. [Meta Allocator (MDMA) Management](#meta-allocator-mdma-management)
7. [Governance Team Operations](#governance-team-operations)
8. [Technical Implementation](#technical-implementation)
9. [API Reference](#api-reference)
10. [Deployment Guide](#deployment-guide)

## Overview

Apply.Allocator.Tech is a comprehensive platform for managing Filecoin Plus DataCap allocations. The system facilitates the entire lifecycle of allocator applications, from initial submission through final approval and DataCap allocation. It supports both traditional Root Key Holder (RKH) approval pathways and modern Meta Allocator (MDMA) smart contract-based approvals.

### Key Features
- **Multi-role Access Control**: Different interfaces for applicants, governance team, root key holders, and meta allocators
- **Automated Workflows**: Event-driven system with GitHub integration
- **Multisig Support**: Advanced multisig wallet management for root key holders
- **Smart Contract Integration**: Meta Allocator contract support for automated approvals
- **Real-time Status Tracking**: Live application status updates
- **KYC Integration**: Automated Know Your Customer verification process

## System Architecture

### Frontend (Next.js)
- **Framework**: Next.js 14 with TypeScript
- **UI Components**: Radix UI with Tailwind CSS
- **State Management**: React Context + TanStack Query
- **Wallet Integration**: Support for Ledger, Filsnap, and MetaMask
- **Filecoin Integration**: Direct RPC calls to Filecoin network

### Backend (Node.js)
- **Framework**: Express.js with TypeScript
- **Database**: MongoDB for application data
- **Message Queue**: RabbitMQ for event processing
- **Event Sourcing**: Event-driven architecture with CQRS
- **External Integrations**: GitHub, Airtable, Zyphe KYC

### Key Components
```
Frontend (rkh-frontend/)
├── Dashboard - Application management interface
├── Multisig Portal - RKH multisig operations
├── Connect Wallet - Multi-wallet support
└── Components - Reusable UI components

Backend (allocator-rkh-backend/)
├── Application Service - Core business logic
├── Event Handlers - Workflow automation
├── External Clients - GitHub, Airtable, etc.
└── Infrastructure - Database, message queue
```

## User Roles and Permissions

### 1. Applicants (GUEST/USER)
**Purpose**: Submit and track allocator applications

**Capabilities**:
- Submit new allocator applications via Airtable form
- Track application status through dashboard
- Complete KYC verification process
- View application details and requirements

**Access Level**: Public dashboard, application submission

### 2. Governance Team (GOVERNANCE_TEAM)
**Purpose**: Review and approve applications before RKH consideration

**Capabilities**:
- Review applications in governance review phase
- Override KYC status if needed
- Approve applications to proceed to RKH approval
- Provide feedback and requirements

**Access Level**: Governance review interface, application management

### 3. Root Key Holders (ROOT_KEY_HOLDER)
**Purpose**: Final approval authority for DataCap allocations

**Capabilities**:
- Direct signers of the f080 multisig wallet
- Approve/reject allocator proposals
- Manage verifier registrations
- Access multisig portal for advanced operations

**Access Level**: Full RKH dashboard, multisig portal

### 4. Indirect Root Key Holders (INDIRECT_ROOT_KEY_HOLDER)
**Purpose**: Members of multisig wallets that are signers of f080

**Capabilities**:
- Same capabilities as direct RKH but through multisig
- Manage their specific multisig wallet
- Propose and approve transactions within their multisig
- Access to parent multisig address information

**Access Level**: Multisig portal, limited RKH dashboard

### 5. Meta Allocators (METADATA_ALLOCATOR)
**Purpose**: Smart contract-based approval pathway

**Capabilities**:
- Manage MDMA smart contract operations
- Approve applications through smart contract
- Access Meta Allocator dashboard
- Manage Safe multisig for contract operations

**Access Level**: Meta Allocator interface, Safe wallet integration

### 6. Administrators (ADMIN)
**Purpose**: System administration and oversight

**Capabilities**:
- Full system access
- Override any role permissions
- System configuration management
- Debug and maintenance operations

**Access Level**: Complete system access

## Application Workflow

### 1. Application Submission Phase
```
Applicant → Airtable Form → Backend Processing → GitHub PR → KYC Phase
```

**Process**:
1. Applicant fills out Airtable form with public/private data separation
2. Backend fetches data from Airtable (GDPR compliant)
3. System creates GitHub PR to Filecoin-Allocator registry
4. Application status: `KYC_PHASE`

### 2. KYC Verification Phase
```
KYC Phase → Zyphe Platform → Verification → Governance Review Phase
```

**Process**:
1. Applicant receives Zyphe KYC link
2. Complete identity verification and human verification
3. Zyphe provides status to backend
4. Application status: `GOVERNANCE_REVIEW_PHASE`

### 3. Governance Review Phase
```
Governance Review → Team Assessment → RKH/Meta Approval Phase
```

**Process**:
1. Governance team reviews application
2. Team provides feedback and requirements
3. Application approved to proceed
4. System determines pathway: RKH or Meta Allocator
5. Application status: `RKH_APPROVAL_PHASE` or `META_APPROVAL_PHASE`

### 4. Final Approval Phase

#### RKH Pathway
```
RKH Approval → Multisig Signatures → DataCap Allocation
```

**Process**:
1. Root Key Holders review proposal
2. Required threshold of signatures (typically 2)
3. On-chain transaction execution
4. Application status: `DC_ALLOCATED`

#### Meta Allocator Pathway
```
Meta Approval → Smart Contract → Safe Multisig → DataCap Allocation
```

**Process**:
1. Meta Allocator reviews proposal
2. Safe multisig approval required
3. Smart contract execution
4. Application status: `DC_ALLOCATED`

### Application Status Flow
```
SUBMISSION → KYC_PHASE → GOVERNANCE_REVIEW_PHASE → 
RKH_APPROVAL_PHASE/META_APPROVAL_PHASE → DC_ALLOCATED
```

## Root Key Holder (RKH) Management

### Multisig Architecture

The RKH system uses a hierarchical multisig structure:

```
f080 (Main RKH Multisig)
├── Direct Signers (ROOT_KEY_HOLDER)
└── Multisig Signers (INDIRECT_ROOT_KEY_HOLDER)
    ├── Multisig A
    ├── Multisig B
    └── Multisig C
```

### Multisig Portal Features

#### 1. Signer Management
- **View Current Signers**: Display all signers of f080 multisig
- **Add Signers**: Propose new signers to multisig
- **Remove Signers**: Propose signer removal
- **Threshold Management**: View and modify approval thresholds

#### 2. Allocator Proposals
- **Pending Proposals**: Review all pending allocator proposals
- **Transaction Decoding**: Human-readable parameter display
- **Approve/Reject Actions**: Direct proposal management
- **Real-time Updates**: Live proposal status

#### 3. My Proposals
- **Personal Proposals**: Manage proposals for your multisig
- **Proposal Tracking**: Monitor approval status
- **Action Management**: Approve/reject within your multisig

### Multisig Operations

#### Direct RKH Operations
```typescript
// Direct f080 signer operations
const directRKH = {
  role: AccountRole.ROOT_KEY_HOLDER,
  capabilities: [
    'Direct f080 signing',
    'Proposal approval/rejection',
    'Verifier management'
  ]
}
```

#### Indirect RKH Operations
```typescript
// Multisig member operations
const indirectRKH = {
  role: AccountRole.INDIRECT_ROOT_KEY_HOLDER,
  parentMsigAddress: 'f1...', // Parent multisig address
  capabilities: [
    'Multisig proposal creation',
    'Parent multisig signing',
    'Hierarchical approval chain'
  ]
}
```

### Wallet Integration

#### Supported Wallets
1. **Ledger Hardware Wallet**
   - Secure hardware signing
   - Filecoin app support
   - Multisig compatibility

2. **Filsnap (MetaMask Extension)**
   - Browser-based signing
   - MetaMask integration
   - Filecoin address support

3. **MetaMask (for Meta Allocators)**
   - Ethereum-based operations
   - Safe multisig integration
   - Smart contract interactions

## Meta Allocator (MDMA) Management

### Smart Contract Architecture

The Meta Allocator system uses smart contracts for automated DataCap allocation:

```
MDMA Contract (f410fw325e6novwl57jcsbhz6koljylxuhqq5jnp5ftq)
├── Safe Multisig (0xB6F5d279AEad97dFA45209F3E53969c2EF43C21d)
├── Allowance Management
└── Automated Approvals
```

### Meta Allocator Operations

#### 1. Smart Contract Integration
- **Contract Address**: `f410fw325e6novwl57jcsbhz6koljylxuhqq5jnp5ftq`
- **Ethereum Bridge**: `0xB6F5d279AEad97dFA45209F3E53969c2EF43C21d`
- **Function**: `addAllowance(address, datacap)`

#### 2. Safe Multisig Management
- **Safe Kit Integration**: Protocol Kit for Safe operations
- **Multi-signature Requirements**: Configurable approval thresholds
- **Transaction Execution**: Automated contract calls

#### 3. Approval Workflow
```typescript
// Meta Allocator approval process
const metaAllocatorApproval = {
  steps: [
    'Review application in META_APPROVAL_PHASE',
    'Safe multisig proposal creation',
    'Multisig member approvals',
    'Smart contract execution',
    'DataCap allocation'
  ]
}
```

### Key Differences: RKH vs Meta Allocator

| Aspect | Root Key Holder | Meta Allocator |
|--------|----------------|----------------|
| **Approval Method** | Manual multisig signing | Smart contract automation |
| **Speed** | Human-dependent | Automated execution |
| **Flexibility** | High (manual review) | Medium (programmed rules) |
| **Security** | Multisig threshold | Safe + smart contract |
| **Use Case** | High-value, complex cases | Standard, routine approvals |

## Governance Team Operations

### Application Review Process

#### 1. Review Interface
- **Dashboard Access**: View all applications in governance review
- **Status Management**: Move applications between phases
- **KYC Override**: Bypass KYC requirements if needed
- **Feedback System**: Provide detailed review comments

#### 2. Approval Criteria
- **Technical Assessment**: Evaluate technical capabilities
- **Business Model**: Review allocation strategy
- **Compliance Check**: Ensure regulatory compliance
- **Risk Assessment**: Evaluate potential risks

#### 3. Decision Making
```typescript
// Governance review decision flow
const governanceDecision = {
  approved: {
    pathway: 'RKH' | 'META_ALLOCATOR',
    datacap: number,
    conditions: string[]
  },
  rejected: {
    reason: string,
    feedback: string,
    resubmissionAllowed: boolean
  }
}
```

## Technical Implementation

### Frontend Architecture

#### Component Structure
```
src/
├── app/ - Next.js app router
├── components/ - Reusable UI components
│   ├── dashboard/ - Application management
│   ├── multisig-rkh-portal/ - RKH operations
│   ├── connect/ - Wallet connections
│   └── ui/ - Base UI components
├── hooks/ - Custom React hooks
├── lib/ - Utility libraries
├── types/ - TypeScript definitions
└── providers/ - React context providers
```

#### Key Hooks
- `useAccount()`: Account and wallet management
- `useAllocatorProposals()`: Proposal fetching and management
- `useSignerManagement()`: Multisig signer operations
- `useMetaAllocatorTransaction()`: Smart contract interactions

### Backend Architecture

#### Service Structure
```
packages/application/
├── domain/ - Business logic and entities
├── application/ - Use cases and commands
├── infrastructure/ - External integrations
└── api/ - HTTP controllers and middleware
```

#### Event-Driven Workflow
```typescript
// Event flow example
ApplicationCreated → KYCStarted → KYCApproved → 
GovernanceReviewStarted → GovernanceReviewApproved → 
RKHApprovalStarted → RKHApprovalCompleted → DCAllocated
```

### Database Schema

#### Application Document
```typescript
interface Application {
  id: string;
  status: ApplicationStatus;
  applicantName: string;
  applicantAddress: string;
  datacap: number;
  applicationInstructions: ApplicationInstruction[];
  rkhApprovals: string[];
  rkhApprovalThreshold: number;
  metaAllocator?: {
    blockNumber: number;
    txHash: string;
  };
}
```

### External Integrations

#### 1. GitHub Integration
- **Repository**: Filecoin-Allocator registry
- **Pull Requests**: Application submissions
- **Reviews**: Governance team feedback
- **Webhooks**: Status updates

#### 2. Airtable Integration
- **Form Data**: Application submissions
- **GDPR Compliance**: Public/private data separation
- **Real-time Sync**: Automatic data fetching

#### 3. Zyphe KYC
- **Identity Verification**: Automated KYC process
- **Status Webhooks**: Real-time verification updates
- **Compliance**: Regulatory compliance management

## API Reference

### Authentication
All API endpoints require wallet-based authentication with role verification.

### Core Endpoints

#### Applications
```http
GET /api/applications
POST /api/applications
GET /api/applications/:id
PUT /api/applications/:id
```

#### Roles
```http
GET /api/roles?address={address}
```

#### Multisig Operations
```http
GET /api/multisig/state
POST /api/multisig/propose
POST /api/multisig/approve
POST /api/multisig/reject
```

### WebSocket Events
```typescript
// Real-time application updates
interface ApplicationEvent {
  type: 'status_change' | 'approval' | 'rejection';
  applicationId: string;
  data: any;
}
```

## Deployment Guide

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- MongoDB instance
- RabbitMQ instance
- Filecoin node access
- GitHub App credentials

### Environment Variables

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_LOTUS_URL=http://your-lotus-node:1234
NEXT_PUBLIC_LOTUS_TOKEN=your-auth-token
NEXT_PUBLIC_CHAIN_ID=314
NEXT_PUBLIC_META_ALLOCATOR_CONTRACT_ADDRESS=0xB6F5d279AEad97dFA45209F3E53969c2EF43C21d
```

#### Backend (.env)
```bash
API_PORT=3001
MONGODB_URI=mongodb://localhost:27017/filecoin-plus
RABBITMQ_URL=localhost:5672
GITHUB_APP_ID=your-github-app-id
GITHUB_APP_PRIVATE_KEY=your-private-key
AIRTABLE_API_KEY=your-airtable-key
LOTUS_RPC_URL=http://your-lotus-node:1234/rpc/v0
LOTUS_AUTH_TOKEN=your-lotus-token
```

### Docker Deployment
```bash
# Backend
cd allocator-rkh-backend
docker compose up -d

# Frontend
cd rkh-frontend
docker build -t apply-allocator-frontend .
docker run -p 3000:3000 apply-allocator-frontend
```

### Production Considerations
- **SSL/TLS**: HTTPS for all communications
- **Load Balancing**: Multiple backend instances
- **Monitoring**: Application performance monitoring
- **Backup**: Regular database backups
- **Security**: Wallet security best practices

## Security Considerations

### Wallet Security
- **Hardware Wallets**: Recommended for RKH operations
- **Multisig Thresholds**: Appropriate approval requirements
- **Key Management**: Secure private key storage
- **Access Control**: Role-based permissions

### Network Security
- **RPC Security**: Secure Filecoin node access
- **API Security**: Rate limiting and authentication
- **Data Privacy**: GDPR compliance measures
- **Audit Trail**: Complete transaction logging

### Smart Contract Security
- **Contract Audits**: Regular security audits
- **Access Controls**: Proper permission management
- **Emergency Procedures**: Pause and recovery mechanisms
- **Upgrade Paths**: Contract upgrade strategies

## Conclusion

Apply.Allocator.Tech provides a comprehensive solution for Filecoin Plus DataCap allocation management. The system supports both traditional multisig-based approvals and modern smart contract automation, ensuring flexibility and security for all stakeholders.

The platform's event-driven architecture, multi-role access control, and integration with external services make it a robust solution for managing the complex workflow of DataCap allocation in the Filecoin ecosystem.

For technical support or questions, please refer to the project repositories or contact the development team.
