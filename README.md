# Filecoin Plus - Backend

[![License: MIT][license-badge]][license]

[license]: LICENSE.md
[license-badge]: https://img.shields.io/badge/License-MIT-blue.svg

![banner](./img/banner.png)

> 🚧 **Warning:** This project is currently WIP, the information provided may be outdated.

This repository contains the source code for the backend service responsible for managing the Filecoin Plus program.

## Project Overview

The `filecoin-plus-backend` service manages the entire lifecycle of allocator applications within the Filecoin Plus
program. It is designed as an event-driven system to automate and streamline the process from initial application
submission to final approval. The system starts with a GitHub pull request (PR), which triggers the subsequent automated
workflows, aligning with the requirement that all application-related activities are managed via GitHub.

The backend service is responsible for the following key functionalities:

- **Application Submission**: Accepting allocator applications from users and submitting them to the Filecoin-Allocator
  registry repository.
- **KYC Process**: Managing the KYC process for applicants.
- **Governance Review**: Facilitating the governance review process for applications.
- **Root Key Holder Approval**: Managing the on-chain approval process for root key holders.

## System Architecture

- Node JS
- Typescript
- MongoDB for storing application data
- RabbitMQ for message queuing
- Express API
- Worker services

```mermaid
stateDiagram-v2
    [*] --> Submission
    Submission --> KYC_In_Progress: KYCStarted
    KYC_In_Progress --> KYC_Completed: KYCApproved
    KYC_In_Progress --> KYC_Failed: KYCRejected
    KYC_Completed --> Governance_Review_In_Progress: GovernanceReviewStarted
    Governance_Review_In_Progress --> Governance_Review_Completed: GovernanceReviewApproved
    Governance_Review_In_Progress --> Governance_Review_Failed: GovernanceReviewRejected
    Governance_Review_Completed --> RKH_Approval_In_Progress: RKHApprovalStarted
    Governance_Review_Completed --> MA_Approval_In_Progress: MAApprovalStarted
    RKH_Approval_In_Progress --> RKH_Approval_Completed: RKHApprovalsUpdated[approvals >= threshold]
    RKH_Approval_In_Progress --> RKH_Approval_Failed: RKHApprovalsUpdated[approvals < threshold]
    MA_Approval_In_Progress --> MA_Approval_Completed
    MA_Approval_In_Progress --> MA_Approval_Failed
    RKH_Approval_Completed --> [*]: DC_ALLOCATED
    MA_Approval_Completed --> [*]: DC_ALLOCATED
    KYC_Failed --> [*]
    Governance_Review_Failed --> [*]
    RKH_Approval_Failed --> [*]
    Submission --> Submission_Failed: Error during submission
    Submission_Failed --> [*]
```

### Application Submission

- Applications are submitted via a Form connected to an Airtable
- For GDPR compliance, the application data is split into two different views, a public and private view.
- The public data is fetched by the Filecoin Plus backend and stored in a MongoDB database. The data is fetched using
  the [airtable](https://www.npmjs.com/package/airtable) NPM package.
- Afterwards the backend will create a PR application to the Filecoin-Allocator registry repository. containing the
  formatted json file with the public data.

![Application Phase](img/phases/application-phase.png)

### Know Your Client (KYC) Process

- After the application is accepted the applicant will be provided a link to the Zyphe platform to complete KYC and
  human verification.
- The KYC process is done through the Zyphe platform. The Zyphe platform will provide a KYC status to the Filecoin Plus
  backend.

![KYC Phase](img/phases/kyc-phase.png)

### Governance Review

- After the KYC is accepted, governance team will review and provide feedback on allocator applications.

![Governance Review Phase](img/phases/governance-review-phase.png)

### Root Key Holder Approval

- Root Key Holders are responsible for auditing the diligence and bookkeeping of the governance team before approving
  on-chain DataCap reqeusts to allocators. These requests can be for new allocators, to supply more DataCap to existing
  allocators, or to remove DataCap from an allocator.

## Architecture and Tech Stack

## Getting Started

This section provides instructions on how to setup the project locally and using Docker.
Before starting, you can clone the repository by running the following command:

```bash
git clone https://github.com/threesigmaxyz/filecoin-plus-backend.git
```

### Docker Setup

#### Prerequisites

Before running the Docker setup, you need to have the following tools installed:

- Docker (`docker`)
- Docker Compose (`docker compose`)

#### Configuration

The Docker setup can be configured by setting the following environment variables:

| Environment Variable             | Description                                                  | Example Values                               |
| -------------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| `API_PORT`                       | Port number for the API service                              | `3000`                                       |
| `MONGODB_URI`                    | URI for connecting to MongoDB                                | `mongodb://host.docker.internal:27017/`      |
| `RABBITMQ_URL`                   | URL for connecting to RabbitMQ                               | `localhost:5672`                             |
| `RABBITMQ_USERNAME`              | Username for RabbitMQ authentication                         | `admin`                                      |
| `RABBITMQ_PASSWORD`              | Password for RabbitMQ authentication                         | `admin`                                      |
| `RABBITMQ_EXCHANGE_NAME`         | Name of the RabbitMQ exchange                                | `filecoin-plus`                              |
| `RABBITMQ_EXCHANGE_TYPE`         | Type of the RabbitMQ exchange                                | `topic`                                      |
| `RABBITMQ_QUEUE_NAME`            | Name of the RabbitMQ queue                                   | `allocator`                                  |
| `GITHUB_OWNER`                   | Owner of the GitHub repository                               | `fidlabs`                                    |
| `GITHUB_REPO`                    | Name of the GitHub repository                                | `filecoin-plus-backend`                      |
| `GITHUB_APP_ID`                  | ID of the GitHub App                                         | `1`                                          |
| `GITHUB_APP_PRIVATE_KEY`         | Private key for the GitHub App                               | `-----BEGIN RSA PRIVATE KEY-----...`         |
| `GITHUB_APP_INSTALLATION_ID`     | Installation ID for the GitHub App                           | `1337`                                       |
| `GITHUB_TOKEN`                   | GitHub Token for the GitHub App                              |                                              |
| `GOVERNANCE_TEAM_GITHUB_HANDLES` | github handles of the governance team                        | 'Kevin-FF-USA,Amin-Foundation'                             |
| `GOVERNANCE_REVIEW_ADDRESSES`    | Wallet addresses of people on the Fil+ governance team       | 'f1..., f1....'                              |
| `RKH_ADDRESSES`                  | Wallet addresses of Root Key Holders                         | 'f1..., f1....'                              |
| `MA_ADDRESSES`                   | Addresses of contracts controlling Metaallocator Pathways    | ' 0xB6F5d279AEad97dFA45209F3E53969c2EF43C21d |
| `AIRTABLE_API_KEY`               | API key for accessing the Airtable API                       | `pat*******************`                     |
| `AIRTABLE_BASE_ID`               | ID of the Airtable base                                      | `app*******************`                     |
| `AIRTABLE_TABLE_NAME`            | Name of the Airtable table                                   | `tbl*******************`                     |
| `LOTUS_RPC_URL`                  | URL for connecting to the Lotus RPC API                      | `http://localhost:1234/rpc/v0`               |
| `LOTUS_AUTH_TOKEN`               | Token for authenticating with the Lotus RPC API              | `lotus_token_*****************`              |
| `GITHUB_ISSUES_REPO`             | Name of the Governance GitHub repository (added for forking) | `Allocator-Governance`                       |
| `GITHUB_ISSUES_OWNER`            | Owner for Governance github respository (added for forking)  | `filecoin-project`                           |
| `USE_TEST_NET`                   | Set it to true when you want to use test net from config     | `false`                                      |
| `TEST_NET_CHAIN_ID`              | Chain id of the test net                                     | `31415926`                                   |
| `TEST_NET_URL`                   | Test net url                                                 | `http://host.docker.internal:1234/rpc/v0`    |
| `TEST_NET_NETWORK_NAME`          | Test net network name                                        | `local-test-net`                             |
| `LOG_LEVEL`                      | Logging level for the application                            | `info` (default), `debug`                    |

#### Running

You can run the Docker containers by running the following command:

```bash
docker compose up -d
```

This will start the backend service, database and message broker.
By default, the backend service will be available at `http://localhost:3001`.

After you are done, you can stop the containers by running:

```bash
docker compose down
```

# About Us

[Three Sigma](https://threesigma.xyz/) is a venture builder firm focused on blockchain engineering, research, and
investment. Our mission is to advance the adoption of blockchain technology and contribute towards the healthy
development of the Web3 space. If you are interested in joining our team, please contact us
[here](mailto:info@threesigma.xyz).

# Run with interactive mode and keep container alive

docker run -it --rm -v $(pwd):/workspace -v /var/run/docker.sock:/var/run/docker.sock act:dev --reuse --verbose
--verbose --container-options "--interactive --tty" -e workflow-test/issue-test-event.json

# Testing

to run unit tests use

```bash
 npm run test:e2e
```

Due to limitations in the Inversify framework, tests should be run separately for each file.
To run e2e tests use one of following commands:

```bash
  # meta allocator controller
  npm run test:e2e -- get--all-ma
  npm run test:e2e -- post--meta-allocator-reject
  # refresh controller
  npm run test:e2e -- get--all-refreshes
  npm run test:e2e -- post--governance-review
  npm run test:e2e -- post--sync-issues
  npm run test:e2e -- put--upsert-from-issue

```
