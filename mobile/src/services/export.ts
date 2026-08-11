import { Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';

import { getBodySite } from '../domain/bodySites';
import { buildExportCsv, exportFileName } from '../domain/exportCsv';
import { sideEffectLabel } from '../domain/sideEffects';
import type { InjectionRow } from '../db/types';
import { listInjections } from '../repositories/injections';
import { listMeasurements } from '../repositories/measurements';
import { listMedications } from '../repositories/medications';
import { listSideEffects } from '../repositories/sideEffects';

export type ExportOutcome =
  | { kind: 'shared' }
  | { kind: 'dismissed' }
  | { kind: 'empty' }
  | { kind: 'failed'; message: string };

/**
 * `SC in the upper left abdomen`. The CSV has no route column, so the route
 * rides in the detail column with the site. An id Poke no longer knows stays
 * as it is rather than becoming a blank cell.
 */
function injectionDetail(row: InjectionRow): string {
  const route = row.route.toUpperCase();
  if (!row.site_id) return route;
  const site = getBodySite(row.site_id);
  return `${route} in the ${site ? site.label.toLocaleLowerCase() : row.site_id}`;
}

export async function exportHistory(now = Date.now()): Promise<ExportOutcome> {
  try {
    const [medications, injections, weights, sideEffectLogs] = await Promise.all([
      listMedications(true),
      listInjections({ limit: 5000 }),
      listMeasurements('weight', { limit: 5000 }),
      listSideEffects({ limit: 5000 }),
    ]);

    if (injections.length === 0 && weights.length === 0 && sideEffectLogs.length === 0) {
      return { kind: 'empty' };
    }

    const csv = buildExportCsv({
      medications,
      // The file writes `site_id` into the detail column, and a clinician reads
      // the file without knowing Poke. So the column carries the route and the
      // site label instead of the storage key.
      injections: injections.map((row) => ({ ...row, site_id: injectionDetail(row) })),
      weights,
      // The store keeps effects as a parsed shape; the file wants the label a
      // human reads.
      sideEffects: sideEffectLogs.map((log) => ({ ...log, effect: sideEffectLabel(log.effect) })),
    }, now);

    const file = new File(Paths.cache, exportFileName(now));
    if (file.exists) file.delete();
    file.create();
    file.write(csv);

    // iOS shares a file by url; Android's share sheet only takes text.
    const result = Platform.OS === 'ios'
      ? await Share.share({ url: file.uri })
      : await Share.share({ message: csv });

    return result.action === Share.dismissedAction ? { kind: 'dismissed' } : { kind: 'shared' };
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : 'The export did not finish.';
    return { kind: 'failed', message };
  }
}
