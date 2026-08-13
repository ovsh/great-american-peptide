import { HalfLifeScene } from '@/components/onboarding/half-life-scene';
import { InterstitialScene } from '@/components/onboarding/interstitial-scene';
import { getPreset, hasUsableHalfLife, type EvidenceTier } from '@/domain/peptides';
import { useOnboardingStore } from '@/stores/onboarding';

// Interstitial 4, the last one before the flow turns to setup. This is the slot
// where MeAgain shows a review card. Poke has the one claim its competitors
// cannot make, so Poke makes that instead.
//
// Both body sentences are gone. They described the drawing: the source pill is
// the source printed next to the curve, and the amber pill is Poke saying the
// number is an estimate. The caveat under the scene stays, because it is the
// one thing the drawing cannot say, and `principles.md` §6 keeps a limit in
// words even where a picture carries the claim.

/** Short enough for a pill. The full sentence lives in `EVIDENCE_LABELS`. */
const PILL_LABELS: Record<Exclude<EvidenceTier, 'unsourced'>, string> = {
  label: 'Drug label',
  trial: 'Human study',
  estimate: 'Limited evidence',
};

export default function EvidenceScreen() {
  const medicationIds = useOnboardingStore((state) => state.medicationIds);
  // The user's own first sourced medication, never a name Poke made up. A run
  // with nothing sourced yet draws the curve with no source pill rather than
  // with a borrowed one: `AGENTS.md` bans placeholder data on a shipping screen.
  const source = firstSourceLabel(medicationIds);

  return (
    <InterstitialScene
      step="evidence"
      title="Every half-life here names its source"
      // The estimate disclaimer is not repeated here. It lives, verbatim and
      // always reachable, behind the (i) on every level chart (principles §6).
      scene={<HalfLifeScene source={source} />}
    />
  );
}

function firstSourceLabel(medicationIds: readonly string[]): string | null {
  for (const id of medicationIds) {
    const preset = getPreset(id);
    if (preset && hasUsableHalfLife(preset)) return PILL_LABELS[preset.evidence];
  }
  return null;
}
