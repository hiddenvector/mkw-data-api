import { ID_PATTERN } from '../schemas';

/**
 * Throws if any ID is not a valid slug or appears more than once.
 * Shared by the data generator and the Worker's startup validation.
 */
export function assertValidIds(label: string, ids: string[], { unique = true } = {}): void {
  const invalid = ids.filter((id) => !ID_PATTERN.test(id));
  if (invalid.length > 0) {
    throw new Error(`Invalid IDs in ${label}: ${invalid.map((id) => `'${id}'`).join(', ')}`);
  }

  if (unique) {
    const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    if (duplicates.length > 0) {
      throw new Error(`Duplicate IDs in ${label}: ${duplicates.join(', ')}`);
    }
  }
}
