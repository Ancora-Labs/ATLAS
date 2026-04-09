import { loadConfig } from './src/config.ts';
import { readJson } from './src/core/fs_utils.ts';
import { runResearchSynthesizer } from './src/core/research_synthesizer.ts';

const cfg = await loadConfig();
const scout = await readJson('state/research_scout_output.json', null);
if (!scout) {
  console.log('NO_SCOUT');
  process.exit(1);
}
const res = await runResearchSynthesizer(cfg, scout);
console.log('SYNTH_SUCCESS', res?.success);
console.log('TOPIC_COUNT', res?.topicCount);
console.log('QG_PASSED', res?.qualityGate?.passed);
console.log('QG_DEGRADED', res?.qualityGate?.degradedPlanningMode);
console.log('QG_QUARANTINED', Array.isArray(res?.qualityGate?.quarantinedTopics) ? res.qualityGate.quarantinedTopics.length : 'na');
if (Array.isArray(res?.qualityGate?.topicDensities)) {
  for (const d of res.qualityGate.topicDensities.slice(0, 8)) {
    console.log('DENS', d.topic, d.actionableCount, d.passed);
  }
}
