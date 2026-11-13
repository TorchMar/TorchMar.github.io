import { parse, printParseErrorCode } from "jsonc-parser";

export function parseConfig(source, filename, allowComments = false) {
  const errors = [];
  const data = parse(source, errors, { disallowComments: !allowComments, allowTrailingComma: false });
  if (errors.length) {
    const error = errors[0];
    const before = source.slice(0, error.offset);
    const line = before.split("\n").length;
    const column = before.length - before.lastIndexOf("\n");
    throw new Error(`${filename}:${line}:${column}: ${printParseErrorCode(error.error)}`);
  }
  return data;
}
