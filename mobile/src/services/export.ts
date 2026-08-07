import { Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';

import { buildExportCsv, exportFileName } from '../domain/exportCsv';
import { sideEffectLabel } from '../domain/sideEffects';
import { listInjections } from '../repositories/injections';
import { listMeasurements } from '../repositories/measurements';
import { listMedications } from '../repositories/medications';
import { listSideEffects } from '../repositories/sideEffects';

export type ExportOutcome =
  | { kind: 'shared' }
  | { kind: 'dismissed' }
  | { kind: 'empty' }
  | { kind: 'failed'; message: string };

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
      injections,
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
