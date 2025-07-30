export const ISSUE_TITLE_REGEX = /\[DataCap Refresh]/s;
export const NEW_TEMPLATE_JSON_SECTION_REGEX = /#{1,}\s*What\s*is\s*your\s*JSON\s*hash.*?#{1,}/gs;
export const OLD_TEMPLATE_JSON_SECTION_REGEX =
  /Paste\s+your\s+JSON\s+number\s*:\s*\*{2}\s*([^\n\r]*)/i;
export const JSON_HASH_REGEX = /rec[a-zA-Z0-9]+/g;
export const NEW_TEMPLATE_JSON_NUMBER_REGEX = /(?:[\n\r])[ \t]*([0-9]+)\b/;
export const OLD_TEMPLATE_JSON_NUMBER_REGEX = /(?:\*)[ \t]*([0-9]+)\b/;
