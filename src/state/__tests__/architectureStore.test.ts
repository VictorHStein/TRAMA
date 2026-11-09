import { describe, expect, it } from 'vitest';
import { useArchitectureStore, usedSteps } from '../architectureStore';

describe('architectureStore - step navigation', () => {
  it('fills all ten steps in the demo, objectives and segments included', () => {
    const arch = useArchitectureStore.getState().architecture;
    expect(arch).not.toBeNull();
    expect(usedSteps(arch!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('previous/next skip empty steps instead of landing on them', () => {
    const s = useArchitectureStore.getState();
    s.setExplorationMode('step');
    s.setStep(6);
    useArchitectureStore.getState().previousStep();
    expect(useArchitectureStore.getState().currentStep).toBe(5);
    // A model without objectives (step 2): next from 1 jumps to 3.
    const arch = useArchitectureStore.getState().architecture!;
    const withoutObjectives = { ...arch, entities: arch.entities.filter((e) => e.category !== 'objective'), relations: arch.relations.filter((r) => r.type !== 'derives_from') };
    expect(usedSteps(withoutObjectives)).not.toContain(2);
    useArchitectureStore.getState().setStep(1);
    useArchitectureStore.getState().nextStep();
    expect(useArchitectureStore.getState().currentStep).toBe(2);
    useArchitectureStore.getState().setStep(10);
    useArchitectureStore.getState().nextStep();
    expect(useArchitectureStore.getState().currentStep).toBe(10);
  });

  it('keeps the Construtor draft and clears it on load', () => {
    const s = useArchitectureStore.getState();
    s.setBuilderDraft('{ "x": 1 }');
    expect(useArchitectureStore.getState().builderDraft).toBe('{ "x": 1 }');
    s.resetToDemo();
    expect(useArchitectureStore.getState().builderDraft).toBeNull();
  });
});
