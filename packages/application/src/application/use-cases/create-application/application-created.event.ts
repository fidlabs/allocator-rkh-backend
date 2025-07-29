import { IEventHandler } from '@filecoin-plus/core';
import { inject, injectable } from 'inversify';

import { ApplicationCreated } from '@src/domain/application/application.events';
import { TYPES } from '@src/types';
import { IApplicationDetailsRepository } from '@src/infrastructure/respositories/application-details.repository';
import { ApplicationStatus } from '@src/domain/application/application';

@injectable()
export class ApplicationCreatedEventHandler implements IEventHandler<ApplicationCreated> {
  public event = ApplicationCreated.name;

  constructor(
    @inject(TYPES.ApplicationDetailsRepository)
    private readonly _repository: IApplicationDetailsRepository,
  ) {}

  async handle(event: ApplicationCreated) {
    const applicationDetails = {
      id: event.guid,
      number: event.applicationNumber,
      name: event.applicantName,
      organization: event.applicantOrgName,
      address: event.applicantAddress,
      github: event.applicantGithubHandle,
      allocationTrancheSchedule: event.allocationTrancheSchedule,
      datacap: 5,
      status: ApplicationStatus.KYC_PHASE,
    };
    await this._repository.save(applicationDetails, 0);
  }
}
