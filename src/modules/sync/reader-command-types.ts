// Parses a raw `reader_command.command` value into the structured JSON shape the
// app expects to receive. Rows in this table are always the legacy ZKTeco-style
// device command text, e.g.:
//   DATA USER PIN=1234\tName=John\tPasswd=\tCard=1234\tGrp=5\tTZ=\tPri=
//   DATA DEL_USER PIN=1234
// Anything that doesn't match a recognized legacy verb is unsupported and should
// be resolved as failed by the caller. Only `type` and `data` are returned — other
// legacy fields (name/card/group) are dropped. `data` currently always holds the
// PIN (the only field today's supported types carry) — revisit its shape if/when
// a future command type needs to carry something else.

export interface IParsedReaderCommand {
  type: string;
  data: string;
}

const SUPPORTED_READER_COMMAND_TYPES = new Set(['ADD_EMPLOYEE', 'DELETE_EMPLOYEE']);

const LEGACY_VERB_TO_TYPE: Record<string, string> = {
  USER: 'ADD_EMPLOYEE',
  DEL_USER: 'DELETE_EMPLOYEE',
};

/** Returns the normalized command (only `type` and `data`), or `null` if unrecognized/unsupported. */
export function parseReaderCommand(command: string): IParsedReaderCommand | null {
  const trimmed = command.trim();
  if (!trimmed.startsWith('DATA ')) {
    return null;
  }

  const afterKeyword = trimmed.slice('DATA '.length).trimStart();
  const verbEnd = afterKeyword.indexOf(' ');
  const verb = verbEnd === -1 ? afterKeyword : afterKeyword.slice(0, verbEnd);
  const rest = verbEnd === -1 ? '' : afterKeyword.slice(verbEnd + 1);

  const type = LEGACY_VERB_TO_TYPE[verb];
  if (!type || !SUPPORTED_READER_COMMAND_TYPES.has(type)) {
    return null;
  }

  const fields: Record<string, string> = {};
  for (const pair of rest.split('\t')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key) {
      fields[key] = value;
    }
  }

  return {
    type,
    data: fields.PIN ?? '',
  };
}
