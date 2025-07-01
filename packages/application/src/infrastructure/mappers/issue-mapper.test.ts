import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { Container } from 'inversify';
import { IIssueMapper, IssueMapper } from './issue-mapper';
import { GithubIssueFactory } from '@mocks/factories';
import { TYPES } from '@src/types';
import { ILLEGAL_CHARACTERS_REGEX, JSON_NUMBER_REGEX } from '@src/infrastructure/mappers/constants';

describe('IssueMapper', () => {
  let container: Container;
  let mapper: IIssueMapper;

  beforeEach(() => {
    container = new Container();
    container.bind<IIssueMapper>(TYPES.IssueMapper).to(IssueMapper);
    mapper = container.get<IIssueMapper>(TYPES.IssueMapper);
  });

  it('should map complete github issue to issue details', () => {
    const { issue } = GithubIssueFactory.createOpened();

    const result = mapper.fromDomainToIssue(issue);
    const jsonNumberFromBody = issue?.body?.match(JSON_NUMBER_REGEX)?.[1];

    expect(result).toEqual({
      githubIssueId: issue.id,
      title: issue.title,
      creator: {
        userId: issue.user?.id,
        name: issue.user?.login,
      },
      assignees: issue.assignees?.map(assigne => ({
        userId: assigne.id,
        name: assigne.login,
      })),
      labels: issue.labels.map(label => (typeof label === 'string' ? label : label.name)),
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      closedAt: null,
      jsonNumber: jsonNumberFromBody,
      state: issue.state,
    });
  });

  it('should handle missing user data', () => {
    const { issue } = GithubIssueFactory.createOpened();
    issue.user = null;

    const result = mapper.fromDomainToIssue(issue);

    expect(result.creator).toEqual({
      userId: 0,
      name: 'Unknown',
    });
  });
});

describe('IssueMapper regex test', () => {
  it.each`
    given                                                                        | expected
    ${"### What is your JSON hash (starts with 'rec')\n\nrec123abc"}             | ${'rec123abc'}
    ${"What is your JSON hash (starts with 'rec')\n\nrec456def"}                 | ${'rec456def'}
    ${"Some other text What is your JSON hash (starts with 'rec')\n\nrecABC123"} | ${'recABC123'}
    ${'json: 12345'}                                                             | ${null}
    ${"What is your JSON hash (starts with 'rec')\n\n123abc"}                    | ${null}
    ${"What is your JSON hash (starts with 'rec')\n\nnotrecabc"}                 | ${null}
    ${"What is your JSON hash (starts with 'rec')\n\nrec"}                       | ${null}
  `('should extract jsonNumber from "$given"', ({ given, expected }) => {
    const match = given.match(JSON_NUMBER_REGEX);

    if (expected === null) {
      expect(match).toBeNull();
    } else {
      expect(match?.[1]).toBe(expected);
    }
  });

  it.each`
    given              | expected
    ${'abc123def'}     | ${'abc123def'}
    ${'rec@#$123'}     | ${'rec123'}
    ${'rec-123_abc'}   | ${'rec-123_abc'}
    ${'rec!@#$%^&*()'} | ${'rec'}
  `('should clean illegal chars: "$given" -> "$expected"', ({ given, expected }) => {
    const result = given.replace(ILLEGAL_CHARACTERS_REGEX, '');

    expect(result).toBe(expected);
  });
});
