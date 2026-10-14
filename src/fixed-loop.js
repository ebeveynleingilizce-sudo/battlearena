// Preserve elapsed time in the accumulator. Never drop ticks on slow frames.
// Work per render is bounded; any backlog continues on the following frame.
export class FixedStepClock {
  constructor(tickRate, maxSteps = 120) {
    this.dt = 1 / tickRate;
    this.maxSteps = maxSteps;
    this.accumulator = 0;
  }
  reset() { this.accumulator = 0; }
  advance(seconds, step, running) {
    if (!running()) { this.reset(); return 1; }
    this.accumulator += Math.max(0, seconds);
    let steps = 0;
    while (this.accumulator + 1e-10 >= this.dt && steps < this.maxSteps && running()) {
      step();
      this.accumulator -= this.dt;
      steps++;
    }
    if (!running()) this.reset();
    return Math.min(1, Math.max(0, this.accumulator / this.dt));
  }
}
