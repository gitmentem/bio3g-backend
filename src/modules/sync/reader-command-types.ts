// Parses a raw `reader_command.command` value into the structured JSON shape the
// app expects to receive. Rows in this table are always the legacy ZKTeco-style
// device command text, one command per line, e.g.:
//   DATA USER PIN=1234\tName=John\tPasswd=\tCard=1234\tGrp=5\tTZ=\tPri=
//   DATA USER PIN=5678\tName=Jane\tPasswd=\tCard=\tGrp=\tTZ=\tPri=
//   DATA DEL_USER PIN=1234
//   DATA SET_DUPLICATE_PUNCH Enabled=1 Period=5
// A single row can bundle multiple lines (e.g. a bulk employee sync), so the
// whole blob is split on newlines and each line is parsed independently. Lines
// that don't match a recognized legacy verb, or whose required fields are
// missing, are dropped; the caller resolves the whole row as failed only if no
// line parsed at all. Only `type` and `data` are returned — other legacy
// fields (name/card/group) are dropped.

export interface IParsedReaderCommand {
  type: string;
  data: Record<string, string>;
}

interface IReaderCommandDefinition {
  type: string;
  parse: (rest: string) => Record<string, string> | null;
}

/** Splits `Key=value` pairs on tabs — the ZKTeco USER/DEL_USER convention, needed so values (e.g. Name) may contain spaces. */
function parseTabFields(rest: string): Record<string, string> {
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
  return fields;
}

function parsePinField(rest: string): Record<string, string> {
  return { pin: parseTabFields(rest).PIN ?? '' };
}

function parseEnabledFlag(rest: string): Record<string, string> | null {
  const match = rest.match(/Enabled=(\d)/);
  if (!match) {
    return null;
  }
  return { enabled: match[1]! };
}

function parseDuplicatePunch(rest: string): Record<string, string> | null {
  const enabledMatch = rest.match(/Enabled=(\d)/);
  if (!enabledMatch) {
    return null;
  }
  const data: Record<string, string> = { enabled: enabledMatch[1]! };
  const periodMatch = rest.match(/Period=(\d+)/);
  if (periodMatch) {
    data.period = periodMatch[1]!;
  }
  return data;
}

function parsePunchState(rest: string): Record<string, string> | null {
  const stateMatch = rest.match(/State=(manual|fixed)/);
  if (!stateMatch) {
    return null;
  }
  const data: Record<string, string> = { state: stateMatch[1]! };
  const fixedModeMatch = rest.match(/FixedMode=(check-in|check-out)/);
  if (fixedModeMatch) {
    data.fixedMode = fixedModeMatch[1]!;
  }
  return data;
}

function parseThresholds(rest: string): Record<string, string> | null {
  const verifyMatch = rest.match(/Verify=([\d.]+)/);
  const registerMatch = rest.match(/Register=([\d.]+)/);
  if (!verifyMatch && !registerMatch) {
    return null;
  }

  const data: Record<string, string> = {};
  if (verifyMatch) data.verify = verifyMatch[1]!;
  if (registerMatch) data.register = registerMatch[1]!;
  return data;
}

const LEGACY_VERB_DEFINITIONS: Record<string, IReaderCommandDefinition> = {
  USER: { type: 'ADD_EMPLOYEE', parse: parsePinField },
  DEL_USER: { type: 'DELETE_EMPLOYEE', parse: parsePinField },
  SET_STAY_FUNCTION_LOCK: { type: 'SET_STAY_FUNCTION_LOCK', parse: parseEnabledFlag },
  SET_SITE_CODE_STAY: { type: 'SET_SITE_CODE_STAY', parse: parseEnabledFlag },
  SET_ACTIVITY_CODE_STAY: { type: 'SET_ACTIVITY_CODE_STAY', parse: parseEnabledFlag },
  SET_DUPLICATE_PUNCH: { type: 'SET_DUPLICATE_PUNCH', parse: parseDuplicatePunch },
  SET_PUNCH_STATE: { type: 'SET_PUNCH_STATE', parse: parsePunchState },
  SET_RAPID_CLOCK: { type: 'SET_RAPID_CLOCK', parse: parseEnabledFlag },
  SET_THRESHOLDS: { type: 'SET_THRESHOLDS', parse: parseThresholds },
};

function parseReaderCommandLine(line: string): IParsedReaderCommand | null {
  const afterKeyword = line.slice('DATA '.length).trimStart();
  const verbEnd = afterKeyword.indexOf(' ');
  const verb = verbEnd === -1 ? afterKeyword : afterKeyword.slice(0, verbEnd);
  const rest = verbEnd === -1 ? '' : afterKeyword.slice(verbEnd + 1);

  const definition = LEGACY_VERB_DEFINITIONS[verb];
  if (!definition) {
    return null;
  }

  const data = definition.parse(rest);
  if (!data) {
    return null;
  }

  return { type: definition.type, data };
}

/** Returns the normalized commands found in every recognized line, or `[]` if none parsed. */
export function parseReaderCommand(command: string): IParsedReaderCommand[] {
  return command
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('DATA '))
    .map(parseReaderCommandLine)
    .filter((parsed): parsed is IParsedReaderCommand => parsed !== null);
}
