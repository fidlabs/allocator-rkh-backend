import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { Container } from 'inversify';
import { IIssueMapper, IssueMapper } from './issue-mapper';
import { GithubIssueFactory } from '@mocks/factories';
import { TYPES } from '@src/types';
import {
  ISSUE_TITLE_REGEX,
  NEW_TEMPLATE_JSON_SECTION_REGEX,
  OLD_TEMPLATE_JSON_SECTION_REGEX,
  JSON_HASH_REGEX,
} from '@src/infrastructure/mappers/constants';

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
    const jsonNumberFromBody = mapper.extractJsonNumber(issue.body ?? '');

    expect(result).toEqual({
      githubIssueId: issue.id,
      githubIssueNumber: issue.number,
      title: issue.title.replace('[DataCap Refresh] ', ''),
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

  describe('extractJsonNumber', () => {
    it.each`
      body                                                                           | expected
      ${"### What is your JSON hash (starts with 'rec')\nrecwS2sB0UNfqfAVx\n###"}    | ${'recwS2sB0UNfqfAVx'}
      ${"### What is your JSON hash (starts with 'rec') ? \nrecwS2sB0UNfqfAVx\n###"} | ${'recwS2sB0UNfqfAVx'}
      ${"### What is your JSON hash (starts with 'rec') ? \n12313123\n###"}          | ${'12313123'}
      ${'###    What   is   your   JSON   hash  \nrecwS2sB0UNfqfAVx\n###'}           | ${'recwS2sB0UNfqfAVx'}
      ${'###    What   is   your   JSON   hash  \n123321123\n###'}                   | ${'123321123'}
      ${'### What is your JSON hash\n12345\n###'}                                    | ${'12345'}
      ${'2. **Paste your JSON number:** 1069'}                                       | ${'1069'}
      ${'2. **Paste your JSON number:** recwS2sB0UNfqfAVx'}                          | ${'recwS2sB0UNfqfAVx'}
      ${'2.    **Paste   your    JSON    number  :  **   recwS2sB0UNfqfAVx'}         | ${'recwS2sB0UNfqfAVx'}
      ${'2.    **Paste   your    JSON    number  :  **   313123'}                    | ${'313123'}
      ${'2.    **Paste   your    JSON    number  :  **   313123'}                    | ${'313123'}
      ${'2. **Paste your JSON number:** 1069\n'}                                     | ${'1069'}
      ${'### What is your JSON hash\nnotrecabc\n###'}                                | ${'recabc'}
      ${'### What is your JSON hash\nrec\n###'}                                      | ${''}
      ${'### What is your JSON hash\n\n###'}                                         | ${''}
      ${'no relevant block here'}                                                    | ${''}
    `('should extract correct json number/hash from body', ({ body, expected }) => {
      expect(mapper.extractJsonNumber(body)).toBe(expected);
    });
  });
});

describe('IssueMapper regex test', () => {
  describe('JSON_HASH_REGEX', () => {
    it.each`
      given                                                                        | expected
      ${"### What is your JSON hash (starts with 'rec')\n\nrec123abc"}             | ${'rec123abc'}
      ${"What is your JSON hash (starts with 'rec')\n\nrec456def"}                 | ${'rec456def'}
      ${"Some other text What is your JSON hash (starts with 'rec')\n\nrecABC123"} | ${'recABC123'}
      ${'json: 12345'}                                                             | ${undefined}
      ${"What is your JSON hash (starts with 'rec')\n\n123abc"}                    | ${undefined}
      ${"What is your JSON hash (starts with 'rec')\n\n123321321"}                 | ${undefined}
      ${"What is your JSON hash (starts with 'rec')\n\nnotrecabc"}                 | ${'recabc'}
      ${"What is your JSON hash (starts with 'rec')\n\nrec"}                       | ${undefined}
    `('should extract jsonNumber from "$given"', ({ given, expected }) => {
      const match = given.match(JSON_HASH_REGEX);

      expect(match?.[0]).toBe(expected);
    });
  });

  describe('ISSUE_TITLE_REGEX', () => {
    it.each`
      given                  | expected
      ${'Datacap refresh'}   | ${undefined}
      ${'[Datacap refresh]'} | ${undefined}
      ${'DataCap refresh'}   | ${undefined}
      ${'[DataCap refresh]'} | ${undefined}
      ${'DataCap Refresh'}   | ${undefined}
      ${'[DataCap Refresh]'} | ${'[DataCap Refresh]'}
    `('should extract correct text: "$given" -> "$expected"', ({ given, expected }) => {
      const result = given.match(ISSUE_TITLE_REGEX);

      expect(result?.[0]).toBe(expected);
    });
  });

  describe('JSON_HASH_REGEX', () => {
    it.each`
      input                  | expected
      ${'rec123abc'}         | ${'rec123abc'}
      ${'recwS2sB0UNfqfAVx'} | ${'recwS2sB0UNfqfAVx'}
      ${'rec_foo'}           | ${null}
      ${'rec'}               | ${null}
      ${'notrecabc'}         | ${'recabc'}
      ${'something else'}    | ${null}
      ${'rec123 abc rec456'} | ${'rec123'}
    `('should extract first rec hash or null', ({ input, expected }) => {
      const match = input.match(JSON_HASH_REGEX)?.[0] ?? null;
      expect(match).toBe(expected);
    });
  });

  describe('OLD_TEMPLATE_JSON_SECTION_REGEX', () => {
    it.each`
      input                                                                         | matching
      ${'2. **Paste your JSON number:** 1069'}                                      | ${true}
      ${'1. **Paste your JSON number:** 42'}                                        | ${true}
      ${'10. **Paste your JSON number:** 12345'}                                    | ${true}
      ${'2. **Paste your JSON number:** '}                                          | ${true}
      ${'Paste your JSON number: 1069'}                                             | ${false}
      ${'2. **Paste your JSON number:** 1069\n3. **Paste your JSON number:** 2048'} | ${true}
      ${'no relevant block here'}                                                   | ${false}
    `('should detect if old template section is present $input', ({ input, matching }) => {
      const match = input.match(OLD_TEMPLATE_JSON_SECTION_REGEX)?.[0] ?? null;
      expect(!!match).toBe(matching);
    });
  });

  describe('NEW_TEMPLATE_JSON_SECTION_REGEX', () => {
    it.each`
      input                                                                             | matching
      ${'### What is your JSON hash\nrec1\n###'}                                        | ${true}
      ${'# What is your JSON hash\nrec2\n#'}                                            | ${true}
      ${'###What is your JSON hash\nrec3\n###'}                                         | ${true}
      ${'### What is your JSON hash\nrecwS2sB0UNfqfAVx\n###'}                           | ${true}
      ${'### What is your JSON hash\nnotrec\n###'}                                      | ${true}
      ${'### What is your JSON hash\nrec_foo\n###'}                                     | ${true}
      ${'### What is your JSON hash\nsomething else\n###'}                              | ${true}
      ${'### What is your JSON hash\nrec123\n###\n# What is your JSON hash\nrec456\n#'} | ${true}
      ${'### Something else\nrec5\n###'}                                                | ${false}
      ${'no relevant block here'}                                                       | ${false}
    `('should detect if new template section is present', ({ input, matching }) => {
      const match = input.match(NEW_TEMPLATE_JSON_SECTION_REGEX)?.[0] ?? null;
      expect(!!match).toBe(matching);
    });
  });
});
