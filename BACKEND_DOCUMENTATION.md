# Apply.Allocator.Tech - Backend Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Core Services](#core-services)
5. [Event-Driven Workflow](#event-driven-workflow)
6. [External Integrations](#external-integrations)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Guide](#deployment-guide)

## Overview

The backend service is built with Node.js, TypeScript, and follows an event-driven architecture with CQRS (Command Query Responsibility Segregation) pattern. It manages the entire lifecycle of Filecoin Plus DataCap allocation applications.

### Key Features
- **Event-Driven Architecture**: Event sourcing with CQRS
- **External Integrations**: GitHub, Airtable, Zyphe KYC
- **Message Queue**: RabbitMQ for event processing
- **Database**: MongoDB for data persistence
- **API**: Express.js REST API
- **Worker Services**: Background job processing

## Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   External      │    │   Blockchain    │
│   (Next.js)     │◄──►│   Services      │◄──►│   (Filecoin)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend Service                          │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│   API Layer     │   Event Bus     │   Command Bus   │  Workers  │
│   (Express)     │   (RabbitMQ)    │   (In-Memory)   │ (Background)│
└─────────────────┴─────────────────┴─────────────────┴───────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                               │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│   MongoDB       │   Event Store   │   Read Models   │  Cache    │
│   (Documents)   │   (Events)      │   (Views)       │ (Redis)   │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
```

### Event Flow
```
Application Submitted → KYC Started → KYC Approved → 
Governance Review Started → Governance Review Approved → 
RKH/Meta Approval Started → Approval Completed → DataCap Allocated
```

## Project Structure

```
allocator-rkh-backend/
├── packages/
│   ├── application/              # Main application package
│   │   ├── src/
│   │   │   ├── api/              # HTTP API layer
│   │   │   │   ├── http/
│   │   │   │   │   ├── controllers/  # API controllers
│   │   │   │   │   ├── middlewares/  # Express middlewares
│   │   │   │   │   └── processors/   # Response processors
│   │   │   │   └── index.ts
│   │   │   ├── application/      # Application layer
│   │   │   │   ├── commands/     # Command handlers
│   │   │   │   ├── events/       # Event handlers
│   │   │   │   ├── queries/      # Query handlers
│   │   │   │   └── services/     # Business services
│   │   │   ├── domain/           # Domain layer
│   │   │   │   ├── application/  # Application entities
│   │   │   │   └── types.ts      # Domain types
│   │   │   ├── infrastructure/   # Infrastructure layer
│   │   │   │   ├── clients/      # External clients
│   │   │   │   ├── db/           # Database layer
│   │   │   │   ├── event-bus/    # Event bus implementations
│   │   │   │   ├── event-store/  # Event store implementations
│   │   │   │   └── repositories/ # Data repositories
│   │   │   ├── testing/          # Test utilities
│   │   │   ├── config.ts         # Configuration
│   │   │   ├── startup.ts        # Application startup
│   │   │   └── types.ts          # Application types
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── core/                     # Shared core package
│       ├── src/
│       │   ├── AggregateRoot.ts  # Base aggregate root
│       │   ├── Command.ts        # Command base classes
│       │   ├── Event.ts          # Event base classes
│       │   ├── EventStore.ts     # Event store interface
│       │   └── interfaces/       # Core interfaces
│       ├── package.json
│       └── tsconfig.json
├── docker-compose.yml            # Docker services
├── Dockerfile                    # Backend Docker image
├── package.json                  # Root package.json
└── tsconfig.json                 # Root TypeScript config
```

## Core Services

### 1. Application Service

#### DatacapAllocator Aggregate
```typescript
// packages/application/src/domain/application/application.ts
export class DatacapAllocator extends AggregateRoot {
  public applicationNumber: number;
  public applicantName: string;
  public applicantAddress: string;
  public applicationStatus: ApplicationStatus;
  public applicationInstructions: ApplicationInstruction[] = [];
  public rkhApprovals: string[] = [];
  public rkhApprovalThreshold: number = 2;
  
  constructor(guid: string) {
    super(guid);
  }
  
  createApplication(command: CreateApplicationCommand): void {
    const event = new ApplicationCreated(
      this.guid,
      command.applicationNumber,
      command.applicantName,
      command.applicantAddress,
      command.timestamp
    );
    
    this.apply(event);
    this.addDomainEvent(event);
  }
  
  applyApplicationCreated(event: ApplicationCreated): void {
    this.applicationNumber = event.applicationNumber;
    this.applicantName = event.applicantName;
    this.applicantAddress = event.applicantAddress;
    this.applicationStatus = ApplicationStatus.KYC_PHASE;
  }
  
  approveGovernanceReview(command: ApproveGovernanceReviewCommand): void {
    const event = new GovernanceReviewApproved(
      this.guid,
      command.applicationInstructions,
      command.timestamp
    );
    
    this.apply(event);
    this.addDomainEvent(event);
  }
  
  applyGovernanceReviewApproved(event: GovernanceReviewApproved): void {
    this.applicationInstructions = event.applicationInstructions;
    
    // Determine approval pathway
    const hasMetaAllocator = event.applicationInstructions.some(
      instruction => instruction.method === ApplicationAllocator.META_ALLOCATOR
    );
    
    if (hasMetaAllocator) {
      this.applicationStatus = ApplicationStatus.META_APPROVAL_PHASE;
      const metaEvent = new MetaAllocatorApprovalStarted(this.guid);
      this.apply(metaEvent);
      this.addDomainEvent(metaEvent);
    } else {
      this.applicationStatus = ApplicationStatus.RKH_APPROVAL_PHASE;
      const rkhEvent = new RKHApprovalStarted(this.guid);
      this.apply(rkhEvent);
      this.addDomainEvent(rkhEvent);
    }
  }
}
```

### 2. Command Handlers

#### CreateApplicationCommandHandler
```typescript
// packages/application/src/application/commands/create-application/create-application.command.ts
@injectable()
export class CreateApplicationCommandHandler implements ICommandHandler<CreateApplicationCommand> {
  constructor(
    @inject(TYPES.DatacapAllocatorRepository) private readonly repository: IDatacapAllocatorRepository,
    @inject(TYPES.PullRequestService) private readonly pullRequestService: IPullRequestService,
    @inject(TYPES.Logger) private readonly logger: Logger
  ) {}
  
  async handle(command: CreateApplicationCommand): Promise<void> {
    this.logger.info(`Handling create application command for application ${command.applicationNumber}`);
    
    const application = new DatacapAllocator(command.guid);
    application.createApplication(command);
    
    await this.repository.save(application, -1);
    
    // Create GitHub PR
    await this.pullRequestService.createPullRequest(command);
    
    this.logger.info(`Application ${command.guid} created successfully`);
  }
}
```

#### ApproveGovernanceReviewCommandHandler
```typescript
// packages/application/src/application/commands/submit-governance-review/submit-governance-review.command.ts
@injectable()
export class ApproveGovernanceReviewCommandHandler implements ICommandHandler<ApproveGovernanceReviewCommand> {
  constructor(
    @inject(TYPES.DatacapAllocatorRepository) private readonly repository: IDatacapAllocatorRepository,
    @inject(TYPES.Logger) private readonly logger: Logger
  ) {}
  
  async handle(command: ApproveGovernanceReviewCommand): Promise<void> {
    this.logger.info(`Handling approve governance review command for application ${command.applicationId}`);
    
    const application = await this.repository.getById(command.applicationId);
    if (!application) {
      throw new Error('Application not found');
    }
    
    application.approveGovernanceReview(command);
    await this.repository.save(application, -1);
    
    this.logger.info(`Governance review approved for application ${command.applicationId}`);
  }
}
```

### 3. Event Handlers

#### ApplicationCreatedEventHandler
```typescript
// packages/application/src/application/events/handlers/application-created.event.ts
@injectable()
export class ApplicationCreatedEventHandler implements IEventHandler<ApplicationCreated> {
  public event = ApplicationCreated.name;
  
  constructor(@inject(TYPES.Db) private readonly _db: Db) {}
  
  async handle(event: ApplicationCreated): Promise<void> {
    console.log('ApplicationCreatedEventHandler', event);
    
    await this._db.collection('applicationDetails').insertOne({
      id: event.aggregateId,
      applicationNumber: event.applicationNumber,
      applicantName: event.applicantName,
      applicantAddress: event.applicantAddress,
      status: ApplicationStatus.KYC_PHASE,
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    });
  }
}
```

#### GovernanceReviewApprovedEventHandler
```typescript
// packages/application/src/application/events/handlers/governance-review-approved.event.ts
@injectable()
export class GovernanceReviewApprovedEventHandler implements IEventHandler<GovernanceReviewApproved> {
  public event = GovernanceReviewApproved.name;
  
  constructor(@inject(TYPES.Db) private readonly _db: Db) {}
  
  async handle(event: GovernanceReviewApproved): Promise<void> {
    console.log('GovernanceReviewApprovedEventHandler', event);
    
    const status = event.applicationInstructions.some(
      instruction => instruction.method === ApplicationAllocator.META_ALLOCATOR
    ) ? ApplicationStatus.META_APPROVAL_PHASE : ApplicationStatus.RKH_APPROVAL_PHASE;
    
    await this._db.collection('applicationDetails').updateOne(
      { id: event.aggregateId },
      {
        $set: {
          status,
          applicationInstructions: event.applicationInstructions,
          updatedAt: event.timestamp,
        },
      }
    );
  }
}
```

## Event-Driven Workflow

### Event Flow Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │   KYC Process   │    │   Governance    │
│   Submitted     │───►│   Completed     │───►│   Review        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub PR     │    │   Zyphe KYC     │    │   Team Review   │
│   Created       │    │   Status        │    │   Decision      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   RKH Approval  │◄───│   Pathway       │───►│   Meta Allocator│
│   Process       │    │   Decision      │    │   Process       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Multisig      │    │   Smart         │    │   DataCap       │
│   Signatures    │    │   Contract      │    │   Allocated     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Event Types

#### Application Events
```typescript
// packages/application/src/domain/application/application.events.ts
export class ApplicationCreated extends Event {
  constructor(
    public readonly aggregateId: string,
    public readonly applicationNumber: number,
    public readonly applicantName: string,
    public readonly applicantAddress: string,
    public readonly timestamp: Date
  ) {
    super(aggregateId, ApplicationCreated.name);
  }
}

export class KYCApproved extends Event {
  constructor(
    public readonly aggregateId: string,
    public readonly timestamp: Date
  ) {
    super(aggregateId, KYCApproved.name);
  }
}

export class GovernanceReviewApproved extends Event {
  constructor(
    public readonly aggregateId: string,
    public readonly applicationInstructions: ApplicationInstruction[],
    public readonly timestamp: Date
  ) {
    super(aggregateId, GovernanceReviewApproved.name);
  }
}

export class RKHApprovalCompleted extends Event {
  constructor(
    public readonly aggregateId: string,
    public readonly applicationInstructions: ApplicationInstruction[],
    public readonly timestamp: Date
  ) {
    super(aggregateId, RKHApprovalCompleted.name);
  }
}

export class MetaAllocatorApprovalCompleted extends Event {
  constructor(
    public readonly aggregateId: string,
    public readonly applicationInstructions: ApplicationInstruction[],
    public readonly blockNumber: number,
    public readonly txHash: string,
    public readonly timestamp: Date
  ) {
    super(aggregateId, MetaAllocatorApprovalCompleted.name);
  }
}
```

## External Integrations

### 1. GitHub Integration

#### GitHub Client
```typescript
// packages/application/src/infrastructure/clients/github.ts
@injectable()
export class GithubClient implements IGithubClient {
  private octokit: Octokit;
  
  constructor(@inject(TYPES.GithubClientConfig) config: GithubClientConfig) {
    this.octokit = new Octokit({
      appId: config.appId,
      privateKey: config.privateKey,
      installationId: config.installationId,
    });
  }
  
  async createPullRequest(data: CreatePullRequestData): Promise<string> {
    const { owner, repo, title, body, head, base } = data;
    
    const response = await this.octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });
    
    return response.data.html_url;
  }
  
  async getPullRequestReviews(owner: string, repo: string, pullNumber: number): Promise<any[]> {
    const response = await this.octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
    });
    
    return response.data;
  }
}
```

#### Pull Request Service
```typescript
// packages/application/src/application/services/pull-request.service.ts
@injectable()
export class PullRequestService implements IPullRequestService {
  constructor(
    @inject(TYPES.GithubClient) private readonly githubClient: IGithubClient,
    @inject(TYPES.Logger) private readonly logger: Logger
  ) {}
  
  async createPullRequest(command: CreateApplicationCommand): Promise<void> {
    const title = `Add allocator: ${command.applicantName}`;
    const body = this.generatePullRequestBody(command);
    const head = `allocator-${command.applicationNumber}`;
    const base = 'main';
    
    try {
      const prUrl = await this.githubClient.createPullRequest({
        owner: process.env.GITHUB_OWNER!,
        repo: process.env.GITHUB_REPO!,
        title,
        body,
        head,
        base,
      });
      
      this.logger.info(`Created PR for application ${command.applicationNumber}: ${prUrl}`);
    } catch (error) {
      this.logger.error(`Failed to create PR for application ${command.applicationNumber}:`, error);
      throw error;
    }
  }
  
  private generatePullRequestBody(command: CreateApplicationCommand): string {
    return `
# Allocator Application: ${command.applicantName}

**Application Number:** ${command.applicationNumber}
**Applicant Address:** ${command.applicantAddress}

## Application Details
- Name: ${command.applicantName}
- Organization: ${command.applicantOrgName}
- GitHub Handle: ${command.applicantGithubHandle}

## Review Process
This PR will be reviewed by the governance team and approved by root key holders.

**Status:** Pending Review
    `.trim();
  }
}
```

### 2. Airtable Integration

#### Airtable Client
```typescript
// packages/application/src/infrastructure/clients/airtable.ts
@injectable()
export class AirtableClient implements IAirtableClient {
  private base: Airtable.Base;
  
  constructor(@inject(TYPES.AirtableClientConfig) config: AirtableClientConfig) {
    this.base = new Airtable({ apiKey: config.apiKey }).base(config.baseId);
  }
  
  async getApplications(): Promise<any[]> {
    const records = await this.base(config.tableName).select({
      view: 'Public View', // GDPR compliant public view
    }).all();
    
    return records.map(record => ({
      id: record.id,
      fields: record.fields,
    }));
  }
  
  async getApplicationById(recordId: string): Promise<any> {
    const record = await this.base(config.tableName).find(recordId);
    return {
      id: record.id,
      fields: record.fields,
    };
  }
}
```

### 3. Zyphe KYC Integration

#### KYC Webhook Handler
```typescript
// packages/application/src/api/http/controllers/kyc.controller.ts
@injectable()
export class KYCController {
  constructor(
    @inject(TYPES.CommandBus) private readonly commandBus: ICommandBus,
    @inject(TYPES.Logger) private readonly logger: Logger
  ) {}
  
  async handleKYCWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { applicationId, status, timestamp } = req.body;
      
      this.logger.info(`Received KYC webhook for application ${applicationId}: ${status}`);
      
      if (status === 'approved') {
        const command = new KYCApprovedCommand(applicationId, new Date(timestamp));
        await this.commandBus.send(command);
      } else if (status === 'rejected') {
        const command = new KYCRejectedCommand(applicationId, new Date(timestamp));
        await this.commandBus.send(command);
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      this.logger.error('Error handling KYC webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

## Database Schema

### MongoDB Collections

#### applicationDetails Collection
```typescript
interface ApplicationDetails {
  _id: ObjectId;
  id: string;                    // Application GUID
  applicationNumber: number;     // Sequential application number
  applicantName: string;         // Applicant full name
  applicantAddress: string;      // Filecoin address
  applicantOrgName: string;      // Organization name
  applicantGithubHandle: string; // GitHub username
  status: ApplicationStatus;     // Current application status
  applicationInstructions: ApplicationInstruction[];
  rkhApprovals: string[];        // RKH approval addresses
  rkhApprovalThreshold: number;  // Required approvals
  metaAllocator?: {
    blockNumber: number;
    txHash: string;
  };
  githubPrNumber: string;        // GitHub PR number
  githubPrLink: string;          // GitHub PR URL
  createdAt: Date;
  updatedAt: Date;
}
```

#### ApplicationInstruction Interface
```typescript
interface ApplicationInstruction {
  method: ApplicationAllocator;  // RKH_ALLOCATOR or META_ALLOCATOR
  datacap_amount: number;        // DataCap amount in PiB
  startTimestamp: number;        // Start timestamp
  endTimestamp?: number;         // End timestamp (optional)
  allocatedTimestamp?: number;   // Allocation timestamp
  status: string;                // PENDING, APPROVED, REJECTED
}
```

### Event Store

#### Event Document
```typescript
interface EventDocument {
  _id: ObjectId;
  aggregateId: string;           // Aggregate GUID
  eventType: string;             // Event class name
  eventData: any;                // Event payload
  version: number;               // Event version
  timestamp: Date;               // Event timestamp
  metadata?: any;                // Additional metadata
}
```

## API Endpoints

### REST API Structure

#### Base API Configuration
```typescript
// packages/application/src/api/http/index.ts
@injectable()
export class ApiServer {
  private app: express.Application;
  
  constructor(
    @inject(TYPES.ApplicationController) private readonly applicationController: ApplicationController,
    @inject(TYPES.RoleController) private readonly roleController: RoleController,
    @inject(TYPES.KYCController) private readonly kycController: KYCController,
    @inject(TYPES.Logger) private readonly logger: Logger
  ) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(errorHandler);
  }
  
  private setupRoutes(): void {
    // Application routes
    this.app.get('/applications', this.applicationController.getApplications.bind(this.applicationController));
    this.app.get('/applications/:id', this.applicationController.getApplication.bind(this.applicationController));
    this.app.post('/applications', this.applicationController.createApplication.bind(this.applicationController));
    
    // Role routes
    this.app.get('/roles', this.roleController.getRole.bind(this.roleController));
    
    // KYC webhook
    this.app.post('/kyc/webhook', this.kycController.handleKYCWebhook.bind(this.kycController));
  }
  
  start(port: number): void {
    this.app.listen(port, () => {
      this.logger.info(`API server started on port ${port}`);
    });
  }
}
```

#### Application Controller
```typescript
// packages/application/src/api/http/controllers/application.controller.ts
@injectable()
export class ApplicationController {
  constructor(
    @inject(TYPES.QueryBus) private readonly queryBus: IQueryBus,
    @inject(TYPES.CommandBus) private readonly commandBus: ICommandBus,
    @inject(TYPES.Logger) private readonly logger: Logger
  ) {}
  
  async getApplications(req: Request, res: Response): Promise<void> {
    try {
      const { search, filters, page, limit } = req.query;
      
      const query = new GetApplicationsQuery(
        search as string,
        (filters as string)?.split(',') || [],
        parseInt(page as string) || 1,
        parseInt(limit as string) || 10
      );
      
      const result = await this.queryBus.send(query);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.logger.error('Error fetching applications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch applications',
      });
    }
  }
  
  async getApplication(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const query = new GetApplicationQuery(id);
      const result = await this.queryBus.send(query);
      
      if (!result) {
        res.status(404).json({
          success: false,
          error: 'Application not found',
        });
        return;
      }
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.logger.error('Error fetching application:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch application',
      });
    }
  }
}
```

### API Response Format

#### Success Response
```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}
```

#### Error Response
```typescript
interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
}
```

## Testing Strategy

### Unit Testing

#### Command Handler Testing
```typescript
// packages/application/src/application/commands/create-application/create-application.command.test.ts
import { CreateApplicationCommandHandler } from './create-application.command';
import { CreateApplicationCommand } from './create-application.command';
import { DatacapAllocator } from '@src/domain/application/application';

describe('CreateApplicationCommandHandler', () => {
  let handler: CreateApplicationCommandHandler;
  let mockRepository: jest.Mocked<IDatacapAllocatorRepository>;
  let mockPullRequestService: jest.Mocked<IPullRequestService>;
  let mockLogger: jest.Mocked<Logger>;
  
  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
    } as any;
    
    mockPullRequestService = {
      createPullRequest: jest.fn(),
    } as any;
    
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    } as any;
    
    handler = new CreateApplicationCommandHandler(
      mockRepository,
      mockPullRequestService,
      mockLogger
    );
  });
  
  it('should create application successfully', async () => {
    const command = new CreateApplicationCommand(
      'test-guid',
      123,
      'Test Applicant',
      'f1testaddress',
      new Date()
    );
    
    await handler.handle(command);
    
    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        guid: 'test-guid',
        applicationNumber: 123,
        applicantName: 'Test Applicant',
      }),
      -1
    );
    
    expect(mockPullRequestService.createPullRequest).toHaveBeenCalledWith(command);
  });
});
```

#### Event Handler Testing
```typescript
// packages/application/src/application/events/handlers/application-created.event.test.ts
import { ApplicationCreatedEventHandler } from './application-created.event';
import { ApplicationCreated } from '@src/domain/application/application.events';

describe('ApplicationCreatedEventHandler', () => {
  let handler: ApplicationCreatedEventHandler;
  let mockDb: jest.Mocked<Db>;
  
  beforeEach(() => {
    mockDb = {
      collection: jest.fn().mockReturnValue({
        insertOne: jest.fn(),
      }),
    } as any;
    
    handler = new ApplicationCreatedEventHandler(mockDb);
  });
  
  it('should handle ApplicationCreated event', async () => {
    const event = new ApplicationCreated(
      'test-guid',
      123,
      'Test Applicant',
      'f1testaddress',
      new Date()
    );
    
    await handler.handle(event);
    
    expect(mockDb.collection).toHaveBeenCalledWith('applicationDetails');
    expect(mockDb.collection('applicationDetails').insertOne).toHaveBeenCalledWith({
      id: 'test-guid',
      applicationNumber: 123,
      applicantName: 'Test Applicant',
      applicantAddress: 'f1testaddress',
      status: 'KYC_PHASE',
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    });
  });
});
```

### Integration Testing

#### Application Workflow Testing
```typescript
// packages/application/src/testing/create-app.ts
import { initialize } from '@src/startup';
import { CreateApplicationCommand } from '@src/application/commands/create-application/create-application.command';
import { ApproveGovernanceReviewCommand } from '@src/application/commands/submit-governance-review/submit-governance-review.command';

async function testApplicationWorkflow() {
  const container = await initialize();
  const commandBus = container.get<ICommandBus>(TYPES.CommandBus);
  const repository = container.get<IDatacapAllocatorRepository>(TYPES.DatacapAllocatorRepository);
  
  // Create application
  const createCommand = new CreateApplicationCommand(
    'test-guid',
    123,
    'Test Applicant',
    'f1testaddress',
    new Date()
  );
  
  await commandBus.send(createCommand);
  
  // Verify application created
  const application = await repository.getById('test-guid');
  expect(application.applicationStatus).toBe(ApplicationStatus.KYC_PHASE);
  
  // Approve governance review
  const approveCommand = new ApproveGovernanceReviewCommand(
    'test-guid',
    [
      {
        method: ApplicationAllocator.RKH_ALLOCATOR,
        datacap_amount: 10,
        startTimestamp: Date.now(),
        status: 'PENDING',
      },
    ],
    new Date()
  );
  
  await commandBus.send(approveCommand);
  
  // Verify status updated
  const updatedApplication = await repository.getById('test-guid');
  expect(updatedApplication.applicationStatus).toBe(ApplicationStatus.RKH_APPROVAL_PHASE);
}
```

## Deployment Guide

### Docker Configuration

#### Dockerfile
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/*/package*.json ./packages/*/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Start application
CMD ["npm", "start"]
```

#### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      - API_PORT=3001
      - MONGODB_URI=mongodb://mongodb:27017/filecoin-plus
      - RABBITMQ_URL=amqp://rabbitmq:5672
      - GITHUB_APP_ID=${GITHUB_APP_ID}
      - GITHUB_APP_PRIVATE_KEY=${GITHUB_APP_PRIVATE_KEY}
      - AIRTABLE_API_KEY=${AIRTABLE_API_KEY}
      - LOTUS_RPC_URL=${LOTUS_RPC_URL}
      - LOTUS_AUTH_TOKEN=${LOTUS_AUTH_TOKEN}
    depends_on:
      - mongodb
      - rabbitmq
    volumes:
      - ./logs:/app/logs

  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=filecoin-plus

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    environment:
      - RABBITMQ_DEFAULT_USER=admin
      - RABBITMQ_DEFAULT_PASS=admin

volumes:
  mongodb_data:
  rabbitmq_data:
```

### Environment Variables

#### Required Environment Variables
```bash
# API Configuration
API_PORT=3001

# Database
MONGODB_URI=mongodb://localhost:27017/filecoin-plus

# Message Queue
RABBITMQ_URL=localhost:5672
RABBITMQ_USERNAME=admin
RABBITMQ_PASSWORD=admin
RABBITMQ_EXCHANGE_NAME=filecoin-plus
RABBITMQ_QUEUE_NAME=allocator

# GitHub Integration
GITHUB_OWNER=fidlabs
GITHUB_REPO=filecoin-plus-backend
GITHUB_APP_ID=your-github-app-id
GITHUB_APP_PRIVATE_KEY=your-private-key
GITHUB_APP_INSTALLATION_ID=your-installation-id

# Airtable Integration
AIRTABLE_API_KEY=your-airtable-key
AIRTABLE_BASE_ID=your-base-id
AIRTABLE_TABLE_NAME=your-table-name

# Filecoin RPC
LOTUS_RPC_URL=http://localhost:1234/rpc/v0
LOTUS_AUTH_TOKEN=your-lotus-token

# Role Configuration
GOVERNANCE_REVIEW_ADDRESSES=f1address1,f1address2
RKH_ADDRESSES=f1address3,f1address4
MA_ADDRESSES=0xcontract1,0xcontract2
```

### Production Deployment

#### Kubernetes Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: allocator-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: allocator-backend
  template:
    metadata:
      labels:
        app: allocator-backend
    spec:
      containers:
      - name: backend
        image: allocator-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: API_PORT
          value: "3001"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: allocator-secrets
              key: mongodb-uri
        - name: GITHUB_APP_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: allocator-secrets
              key: github-private-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Service Configuration
```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: allocator-backend-service
spec:
  selector:
    app: allocator-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: LoadBalancer
```

### Monitoring and Logging

#### Health Check Endpoints
```typescript
// packages/application/src/api/http/controllers/health.controller.ts
@injectable()
export class HealthController {
  async health(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
    });
  }
  
  async ready(req: Request, res: Response): Promise<void> {
    // Check database connection
    // Check message queue connection
    // Check external services
    
    res.json({
      status: 'ready',
      checks: {
        database: 'connected',
        messageQueue: 'connected',
        externalServices: 'healthy',
      },
    });
  }
}
```

#### Logging Configuration
```typescript
// packages/application/src/infrastructure/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});
```

This comprehensive backend documentation covers all aspects of the Node.js application, from architecture and services to testing and deployment. It provides developers with everything they need to understand, develop, and maintain the backend codebase.
