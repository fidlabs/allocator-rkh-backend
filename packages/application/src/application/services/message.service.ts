import { injectable } from 'inversify'
import { ApplicationStatus, DatacapAllocator } from '@src/domain/application/application'

@injectable()
export class MessageService {
  generatePullRequestMessage(application: DatacapAllocator): string {
    const githubLink = `https://github.com/${application.applicantGithubHandle}`

    const message = `
# Filecoin Plus Allocator Application

## Application Details
| Field | Value |
|-------|-------|
| Applicant | ${application.applicantName} |
| Organization | ${application.applicantOrgName} |
| Address | [${application.applicantAddress}](https://filfox.info/en/address/${encodeURIComponent(application.applicantAddress)}) |
| GitHub Username | [![GitHub](https://img.shields.io/badge/GitHub-${
      application.applicantGithubHandle
    }?style=flat-square&logo=github)](${githubLink}) |
| Location | ${application.applicantLocation} |

## Grant Details
| Field | Value |
|-------|-------|
| Datacap Amount | ${application.applicationInstructions[application.applicationInstructions.length - 1].datacap_amount} PiB |
| Allocation Method | ${application.applicationInstructions[application.applicationInstructions.length - 1].method} |

---
<sup>This message was automatically generated by the Filecoin Plus Bot. For more information, visit [filecoin.io](https://filecoin.io)</sup>
`

    return message.trim()
  }

  generateCommentMessage(application: DatacapAllocator): string {
    const statusTitle = {
      [ApplicationStatus.SUBMISSION_PHASE]: 'Submission Phase',
      [ApplicationStatus.KYC_PHASE]: 'KYC Phase',
      [ApplicationStatus.GOVERNANCE_REVIEW_PHASE]: 'Governance Review Phase',
      [ApplicationStatus.RKH_APPROVAL_PHASE]: 'RKH Approval Phase',
      [ApplicationStatus.META_APPROVAL_PHASE]: 'Meta Allocator Approval Phase',
      [ApplicationStatus.APPROVED]: 'Approved',
      [ApplicationStatus.REJECTED]: 'Rejected',
    }
    
    const statusEmoji = {
      [ApplicationStatus.SUBMISSION_PHASE]: '📝',
      [ApplicationStatus.KYC_PHASE]: '🔍',
      [ApplicationStatus.GOVERNANCE_REVIEW_PHASE]: '👥',
      [ApplicationStatus.RKH_APPROVAL_PHASE]: '🔑',
      [ApplicationStatus.META_APPROVAL_PHASE]: '🔑',
      [ApplicationStatus.APPROVED]: '✅',
      [ApplicationStatus.REJECTED]: '❌',
    }

    let message = `
## Application Status: \`${statusTitle[application.applicationStatus]}\` ${statusEmoji[application.applicationStatus] || '❓'}

`

    message += this.getStatusSpecificMessage(application)

    message += `
---
<sup>This message was automatically generated by the Filecoin Plus Bot. For more information, visit [filecoin.io](https://filecoin.io)</sup>
`

    return message
  }

  private getStatusSpecificMessage(application: DatacapAllocator): string {
    switch (application.applicationStatus) {
      case ApplicationStatus.KYC_PHASE:
        return this.getKYCStatusMessage(application)
      case ApplicationStatus.GOVERNANCE_REVIEW_PHASE:
        return this.getGovernanceReviewStatusMessage(application)
      case ApplicationStatus.RKH_APPROVAL_PHASE:
        return this.getRKHApprovalStatusMessage(application)
      case ApplicationStatus.META_APPROVAL_PHASE:
        return this.getMetaApprovalStatusMessage(application)
      case ApplicationStatus.APPROVED:
        return this.getApprovedStatusMessage(application)
      case ApplicationStatus.REJECTED:
        return this.getRejectedStatusMessage(application)
      default:
        return `
### Need Assistance?
- For questions about the application process, please contact our support team

> 📞 We're here to help if you need any assistance
`
    }
  }

  private getKYCStatusMessage(application: DatacapAllocator): string {
    return `
### Next Steps
1. Complete the KYC process at [our secure portal](https://flow.togggle.io/fidl/kyc?applicationId=${application.guid})
   - **Name:** ${application.applicantName}
   - **GitHub Username:** ${application.applicantGithubHandle}
2. Your application will be automatically updated once submitted

> ℹ️ KYC completion is required to proceed with your application
`
  }

  private getGovernanceReviewStatusMessage(application: DatacapAllocator): string {
    const currentInstruction = application.applicationInstructions[application.applicationInstructions.length - 1];
    return `
### 🔍 Governance Review Phase
Your application is currently under review by the Fil+ governance team.

### 📊 Current Request
- Amount: \`${currentInstruction.datacap_amount} PiB\`
- Method: \`${currentInstruction.method}\`

### 📋 Review Guidelines
1. Verify applicant details and eligibility
2. Assess datacap request:
   - Is the amount appropriate for the use case?
   - Is the allocation method suitable?
   - Does the distribution strategy make sense?

### ✏️ Making Changes
To modify the allocation parameters:
\`\`\`json
{
  "applicationInstructions": [
    // Previous instructions...
    {
      "datacap_amount": "X", // Amount in PiB
      "method": "META_ALLOCATOR|RKH_ALLOCATOR"
    }
  ]
}
\`\`\`
Edit the latest entry in the JSON file and commit directly to this PR.

> 💬 Please be prepared to respond to any questions or requests for clarification
> 🔧 Governance members: Approve the PR to move the application to the next phase
`
  }

  private getRKHApprovalStatusMessage(application: DatacapAllocator): string {
    return `
### Approval Pending
- Your application is awaiting final approval from on-chain signers
- We'll update this thread once a decision has been made

> ⏳ The final decision is pending. Thank you for your patience.
`
  }

  private getMetaApprovalStatusMessage(application: DatacapAllocator): string {
    return `
### Approval Pending
- Your application is awaiting final approval from on-chain signers
- We'll update this thread once a decision has been made

> ⏳ The final decision is pending. Thank you for your patience.
`
  }

  private getApprovedStatusMessage(application: DatacapAllocator): string {
    return `
### Application Approved
- Congratulations! Your application to become a datacap allocator has been approved
- You will receive further instructions shortly

> 🎉 Welcome to the Filecoin Plus community!
`
  }

  private getRejectedStatusMessage(application: DatacapAllocator): string {
    return `
### Application Rejected
- We regret to inform you that your application has been rejected

> ❌ Please contact our support team for more information
`
  }
}
